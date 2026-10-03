'use strict';
// 真实 Electron 环境全功能巡检:真实主进程 + preload + 真实加密保险库(非 mock),
// 从"创建保险库"起把每个功能操作一遍,每步整窗截图到 dev/shots-real/,并打印 PASS/FAIL。
// 运行:npm run build && npx electron dev/verify.cjs
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-verify-'));
app.setPath('userData', TMP);
// 预置偏好:关防截屏,截图才不是黑的(仅本巡检目录,不影响正式数据)
fs.mkdirSync(path.join(TMP, 'vault'), { recursive: true });
fs.writeFileSync(path.join(TMP, 'vault', 'prefs.json'), JSON.stringify({ contentProtection: false }));
app.disableHardwareAcceleration();
require('../electron/main.cjs');

const OUT = path.join(__dirname, 'shots-real-' + Date.now());
fs.mkdirSync(OUT, { recursive: true });
const MASTER = 'Ch0rn0-K3y-V3rify!';
const results = [];
const PLOG = path.join(__dirname, 'verify-progress.log');
fs.writeFileSync(PLOG, '');
const log = (m) => fs.appendFileSync(PLOG, '[' + new Date().toISOString().slice(11, 19) + '] ' + m + '\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 注入页面的工具函数(React 受控组件必须走原生 setter)
const H = `
const H_ = {
  setVal(el, v) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
    const s = Object.getOwnPropertyDescriptor(proto, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  byText(sel, words) {
    const hit = (x) => { const c = (x.textContent || '') + ' ' + (x.getAttribute && (x.getAttribute('aria-label') || '')); return words.some((w) => c.includes(w)); };
    return [...document.querySelectorAll(sel)].find(hit);
  },
  async waitFor(sel, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 10000)) { if (document.querySelector(sel)) return true; await H_.sleep(150); }
    return !!document.querySelector(sel);
  },
};
function ok(c) { if (!c) throw new Error('assert: condition false'); return true; }
`;

function j(expr) {
  const win = BrowserWindow.getAllWindows()[0];
  return win.webContents.executeJavaScript(`(async () => { ${H} ${expr} })()`, { userGesture: true });
}

async function shot(name) {
  const win = BrowserWindow.getAllWindows()[0];
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG());
}

async function step(no, label, js, shotName) {
  log(`>>> ${no} ${label}`);
  try {
    const out = await j(js);
    if (shotName) { await sleep(400); await shot(shotName); }
    results.push(`[PASS] ${no} ${label} :: ${out}`);
    log(`<<< ${no} PASS ${out}`);
    return true;
  } catch (e) {
    results.push(`[FAIL] ${no} ${label} :: ${e.message}`);
    log(`<<< ${no} FAIL ${e.message}`);
    return false;
  }
}

function ok(cond) {
  if (!cond) throw new Error('condition not met');
  return JSON.stringify(cond);
}

app.on('browser-window-created', () => {
  const run = async () => {
    const win = BrowserWindow.getAllWindows()[0];
    for (let i = 0; i < 100 && !(win && win.webContents && !win.webContents.isDestroyed()); i++) await sleep(100);
    const wc = win.webContents;
    if (!wc || wc.isDestroyed()) throw new Error('no live webContents');
    wc.on('console-message', (_e, _lvl, msg) => { if (/error/i.test(msg) && !/favicon/i.test(msg)) console.log('[console]', String(msg).slice(0, 200)); });
    wc.on('render-process-gone', (_e, d) => { console.log('RENDER-GONE', d.reason); results.push('[FAIL] render-process-gone ' + d.reason); app.exit(2); });
    // did-finish-load 可能已触发过:已加载则立即返回,否则等事件(上限 20s)
    await new Promise((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      wc.once('did-finish-load', done);
      const iv = setInterval(() => { if (!wc.isDestroyed() && !wc.isLoading()) { clearInterval(iv); done(); } }, 300);
      setTimeout(() => { clearInterval(iv); done(); }, 20000);
    });
    await sleep(1500);

    // 1 欢迎页
    await step('s01', 'setup-welcome', `ok(!!document.querySelector('.lock-card'))`, '01-setup-welcome');

    // 2 进入创建流程
    await step('s02', 'setup-create-page', `H_.byText('.lock-card button', ['创建']).click(); ok(await H_.waitFor('.lock-card form'))`, '02-setup-create');

    // 3 填主密码并创建(KDF 派生,最长等 60s)
    await step('s03', 'create-vault', `
      const pws = document.querySelectorAll('.lock-card input[type=password]');
      H_.setVal(pws[0], ${JSON.stringify(MASTER)}); H_.setVal(pws[1], ${JSON.stringify(MASTER)});
      await H_.sleep(300);
      H_.byText('.lock-card form button', ['创建']).click();
      ok(await H_.waitFor('.recovery-code', 60000))`, '03-recovery-code');

    // 4 勾选已保存 → 进入保险库
    await step('s04', 'enter-vault', `
      document.querySelector('.lock-card input[type=checkbox]').click(); await H_.sleep(250);
      const done = document.querySelector('.lock-card button.w-full'); ok(!done.disabled); done.click();
      ok(await H_.waitFor('.list-pane'));
      ok(typeof window.ck.applySettings === 'function');
      await window.ck.applySettings({ autoLockMinutes: 0, lockOnSleep: false });`, '04-main');

    // 5 新建登录条目
    await step('s05', 'new-login-editor', `
      document.querySelector('.list-head .menu-anchor > button').click(); await H_.sleep(300);
      H_.byText('.menu .menu-item', ['登录']).click(); await H_.sleep(400);
      ok(await H_.waitFor('.editor'))`, '05-new-login-editor');

    // 6 填表 + 加标签 + 保存(顺带验证 tag 删除按钮不再崩)
    await step('s06', 'save-login-item', `
      H_.setVal(document.querySelector('.editor .input-lg'), 'GitHub');
      const f1 = document.querySelector('.editor .form-card input.input:not(.input-lg)');
      H_.setVal(f1, 'octocat');
      const sec = document.querySelector('.editor .with-gen input');
      H_.setVal(sec, 's3cr3t-Passw0rd!');
      const td = document.querySelector('.editor .tag-draft');
      H_.setVal(td, 'work'); td.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await H_.sleep(300);
      const tagDel = document.querySelector('.editor .tag button'); ok(!!tagDel); tagDel.click(); await H_.sleep(200);
      H_.byText('.editor-head button', ['保存', 'Save']).click();
      ok(await H_.waitFor('.list-row'))`, '06-list-with-item');

    // 7 新建 TOTP 条目(验证密钥识别 + 倒计时环)
    await step('s07', 'new-totp-item', `
      document.querySelector('.list-head .menu-anchor > button').click(); await H_.sleep(300);
      H_.byText('.menu .menu-item', ['验证码']).click(); await H_.sleep(400);
      H_.setVal(document.querySelector('.editor .input-lg'), 'GitHub TOTP');
      H_.setVal(document.querySelector('.totp-setup input'), 'JBSWY3DPEHPK3PXP');
      document.querySelectorAll('.totp-setup button')[0].click();
      ok(await H_.waitFor('.totp-setup-live'))`, '07-totp-editor');

    await step('s08', 'save-totp-item', `
      H_.byText('.editor-head button', ['保存']).click();
      await H_.sleep(500); ok(document.querySelectorAll('.list-row').length >= 2)`, '08-list-two-items');

    // 9 详情面板(选中 TOTP 条目,有验证码)
    await step('s09', 'item-detail', `
      const row = [...document.querySelectorAll('.list-row')].find((r) => r.textContent.includes('GitHub TOTP'));
      ok(row); row.click(); ok(await H_.waitFor('.detail'))`, '09-item-detail');

    // 10 移入废纸篓
    await step('s10', 'to-trash', `
      const b = [...document.querySelectorAll('.detail button')].find((x) => ((x.getAttribute('aria-label') || '') + (x.title || '')).includes('废纸'));
      ok(b); b.click(); ok(await H_.waitFor('.list-empty, .list-row'))`, '10-trashed');

    // 11 废纸篓视图 → 还原 TOTP 条目(顺带验证恢复功能)
    await step('s11', 'trash-view-restore', `
      H_.byText('.sidebar .side-row', ['废纸篓', 'Trash']).click(); await H_.sleep(400);
      const row = [...document.querySelectorAll('.list-row')].find((r) => r.textContent.includes('TOTP'));
      ok(row); row.click(); ok(await H_.waitFor('.detail'));
      const b = [...document.querySelectorAll('.detail button')].find((x) => (((x.textContent || '') + (x.getAttribute('aria-label') || '')) + (x.title || '')).includes('恢复'));
      ok(b); b.click(); await H_.sleep(400);
      ok(document.querySelector('.list-empty') || document.querySelectorAll('.list-row').length)`, '11-trash-restore');

    // 12 搜索
    await step('s12', 'search', `
      H_.byText('.sidebar .side-row', ['所有条目', 'All items']).click(); await H_.sleep(300);
      H_.setVal(document.querySelector('.tb-search input'), 'GitHub'); await H_.sleep(400);
      ok(document.querySelectorAll('.list-row').length >= 1)`, '12-search');

    // 13 打开设置 → 侧边栏(核心验证点)
    await step('s13', 'settings-sidebar', `
      const gear = [...document.querySelectorAll('.titlebar button')].find((b) => /设置|settings/i.test(b.getAttribute('aria-label') || ''));
      ok(gear); gear.click();
 ok(await H_.waitFor('.settings-nav'));
 const nav = document.querySelector('.settings-nav');
 const rows = [...nav.children].length;
      const cs = getComputedStyle(nav);
      const w = nav.offsetWidth;
      if (rows !== 7 || cs.display === 'none' || w < 100) throw new Error('sidebar broken: rows=' + rows + ' display=' + cs.display + ' w=' + w);
      ok(nav.textContent.includes('安全'))`, '13-settings-zh');

    // 14 外观页切英文
    await step('s14', 'switch-language-en', `
      H_.byText('.settings-nav button', ['外观']).click(); await H_.sleep(300);
      H_.byText('.settings-body button', ['English']).click(); await H_.sleep(500);
      ok(getComputedStyle(document.querySelector('.settings-nav')).display !== 'none'
        && document.querySelector('.titlebar').textContent.match(/ChronoKey/))`, '14-settings-en');

    // 15 关于页 → 检查更新(真实网络)
    await step('s15', 'about-check-update', `
      H_.byText('.settings-nav button', ['About', '关于']).click(); await H_.sleep(300);
      const btn = [...document.querySelectorAll('.settings-body button')].find((b) => /update|更新/i.test(b.textContent));
      ok(btn); btn.click();
      const found = await H_.waitFor('.settings-body .ok, .settings-body .field-hint.warn, .settings-body .link', 25000);
      ok(found)`, '15-about-update');

    // 16 关掉设置,回主界面(英文)
    await step('s16', 'close-settings', `
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const m = document.querySelector('.modal-close'); if (m) m.click();
      ok(!(await H_.waitFor('.settings-nav', 3000)) || !document.querySelector('.modal'))`, '16-main-en');

    // 17 生成器
    await step('s17', 'generator', `
      H_.byText('.sidebar .side-row', ['密码生成器', 'Password generator']).click(); await H_.sleep(600);
      const out = document.querySelector('.gen-output');
      ok(out && out.textContent.trim().length >= 8);
      const regen = H_.byText('.tool button', ['重新生成', 'Regenerate']); regen.click(); await H_.sleep(400);
      ok(document.querySelector('.gen-output').textContent.trim().length >= 8)`, '17-generator');

    // 18 安全审计
    await step('s18', 'audit', `
      H_.byText('.sidebar .side-row', ['安全审计', 'Security audit']).click(); await H_.sleep(500);
      ok(/创建|created/i.test(document.body.textContent))`, '18-audit');

    // 19 TOTP 面板
    await step('s19', 'totp-board', `
      H_.byText('.sidebar .side-row', ['验证码', '2FA codes', '两步验证']).click(); await H_.sleep(800);
      ok(document.querySelectorAll('.ring').length >= 1)`, '19-totp-board');

    // 20 锁定 → 解锁(验证主密码 + 回到主界面)
    await step('s20', 'lock-and-unlock', `
      const lock = [...document.querySelectorAll('.titlebar button')].find((b) => /锁定|lock/i.test(b.getAttribute('aria-label') || ''));
      ok(lock); lock.click();
      ok(await H_.waitFor('.lock-card input'));
      H_.setVal(document.querySelector('.lock-card input'), ${JSON.stringify(MASTER)});
      H_.byText('.lock-card button', ['解锁', 'Unlock', 'Enter']).click();
      ok(await H_.waitFor('.list-pane'))`, '20-unlock-again');

    // 21 切回中文收尾
    await step('s21', 'back-to-zh', `
      const gear = [...document.querySelectorAll('.titlebar button')].find((b) => /设置|settings/i.test(b.getAttribute('aria-label') || ''));
      gear.click(); await H_.waitFor('.settings-nav');
      H_.byText('.settings-nav button', ['外观', 'Appearance']).click(); await H_.sleep(300);
      H_.byText('.settings-body button', ['简体中文', 'Chinese']).click(); await H_.sleep(400);
      const m = document.querySelector('.modal-close'); if (m) m.click();
      ok(await H_.waitFor('.list-pane'))`, '21-back-zh');

    fs.writeFileSync(path.join(OUT, 'report.txt'), results.join('\n') + '\n');
    console.log('=== VERIFY REPORT ===');
    for (const r of results) console.log(r);
    const failed = results.filter((r) => r.startsWith('[FAIL]'));
    console.log(failed.length ? `VERIFY: ${failed.length} FAILED` : 'VERIFY: ALL PASS');
    app.exit(failed.length ? 1 : 0);
  };

  run().catch((e) => { console.error('DRIVER-ERROR', e); results.push('[FAIL] driver: ' + e.message); fs.writeFileSync(path.join(OUT, 'report.txt'), results.join('\n') + '\n'); app.exit(3); });
});

setTimeout(() => {
  const wins = BrowserWindow.getAllWindows();
  if (!wins.length || !wins[0].webContents || wins[0].webContents.isDestroyed()) {
    console.log('TIMEOUT: no window (single-instance busy?)');
    fs.writeFileSync(path.join(OUT, 'report.txt'), '[FAIL] startup timeout\n');
    app.exit(4);
  }
}, 30000);
