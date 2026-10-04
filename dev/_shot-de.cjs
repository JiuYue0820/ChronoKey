// 一次性:德语(de)界面下截设置页三个 tab,验证语言包语言下的侧边栏与新区块渲染。
// 用法:npx electron dev/_shot-de.cjs   (跑完自删)
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-de-shot-'));
app.setPath('userData', TMP);
fs.writeFileSync(path.join(TMP, 'vault', 'prefs.json'), JSON.stringify({ contentProtection: false, lang: 'de' }));
fs.mkdirSync(path.join(TMP, 'vault'), { recursive: true });
const OUT = path.join(__dirname, 'shots-de');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MASTER = 'Richtig-Pferd-Batterie-7';

const results = [];

let wc;
async function step(label, js, shot) {
  try {
    await wc.executeJavaScript(js);
    results.push(`[PASS] ${label}`);
    console.log(`[PASS] ${label}`);
    if (shot) { await sleep(500); const img = await wc.capturePage(); fs.writeFileSync(path.join(OUT, shot), img.toPNG()); }
  } catch (e) {
    results.push(`[FAIL] ${label} :: ${e.message}`);
    console.log(`[FAIL] ${label} :: ${e.message}`);
  }
}
app.on('browser-window-created', () => {
  const run = async () => {
    const win = BrowserWindow.getAllWindows()[0];
    for (let i = 0; i < 100 && !(win && win.webContents && !win.webContents.isDestroyed()); i++) await sleep(100);
    wc = win.webContents;
    await new Promise((resolve) => {
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      wc.once('did-finish-load', fin);
      const iv = setInterval(() => { if (!wc.isDestroyed() && !wc.isLoading()) { clearInterval(iv); fin(); } }, 300);
      setTimeout(() => { clearInterval(iv); fin(); }, 20000);
    });
    await sleep(1800);

    // 欢迎页:点"创建保险库"(文本匹配,首页还有"迁移"按钮不能抓第一个)
    await step('create-page', `
      const b = [...document.querySelectorAll('.lock-card button')].find(x => /Erstellen|创建/i.test(x.textContent));
      if (!b) throw new Error('create button not found: ' + [...document.querySelectorAll('.lock-card button')].map(x => x.textContent.trim()).join('|'));
      b.click(); await new Promise(r => setTimeout(r, 400))`);
    await step('create-vault', `
      const pws = document.querySelectorAll('.lock-card input[type=password]');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(pws[0], ${JSON.stringify(MASTER)}); set.call(pws[1], ${JSON.stringify(MASTER)});
      await new Promise(r => setTimeout(r, 300));
      const sb = [...document.querySelectorAll('.lock-card form button')].find(b => /Erstellen|创建/i.test(b.textContent));
      sb.click();
      for (let i = 0; i < 120 && !document.querySelector('.recovery-code'); i++) await new Promise(r => setTimeout(r, 500));
      if (!document.querySelector('.recovery-code')) throw new Error('no recovery code');`);
    await step('enter', `
      document.querySelector('.lock-card input[type=checkbox]').click();
      await new Promise(r => setTimeout(r, 250));
      document.querySelector('.lock-card button.w-full').click();
      for (let i = 0; i < 40 && !document.querySelector('.list-pane'); i++) await new Promise(r => setTimeout(r, 250));
      if (!document.querySelector('.list-pane')) throw new Error('no list');`);
    await step('open-settings', `
      const btns = [...document.querySelectorAll('.titlebar button')];
      btns.find(b => /Einstellungen|设置/i.test(b.getAttribute('aria-label') || '')).click();
      for (let i = 0; i < 20 && !document.querySelector('.settings-nav'); i++) await new Promise(r => setTimeout(r, 250));
      if (!document.querySelector('.settings-nav')) throw new Error('no settings');`, 'de-security.png');
    await step('appearance', `
      [...document.querySelectorAll('.settings-nav button')].find(b => /Erscheinungsbild|外观/i.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 500));`, 'de-appearance.png');
    await step('about', `
      [...document.querySelectorAll('.settings-nav button')].find(b => /Info/i.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 500));`, 'de-about.png');

    console.log(results.join('\n'));
    console.log(results.some((r) => r.startsWith('[FAIL]')) ? 'DE-SHOT: FAIL' : 'DE-SHOT: OK');
    app.exit(results.some((r) => r.startsWith('[FAIL]')) ? 1 : 0);
  };
  run().catch((e) => { console.error('DRIVER-ERROR', e); app.exit(3); });
});
