'use strict';
// Electron 冒烟测试:用临时数据目录启动真实应用,通过渲染进程的 window.ck 走完整 IPC 流程。
// 运行:npx electron tests/electron-smoke.cjs
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { app } = require('electron');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-smoke-'));
app.setPath('userData', tmp);
require('../electron/main.cjs');

const run = async (win) => {
  const js = `(async () => {
    const out = {};
    out.status = await window.ck.status();
    const data = { schema: 1, items: [{ id: 'x', type: 'login', title: 'GitHub', fields: { password: 'p' }, custom: [], tags: [] }], folders: [], settings: {}, audit: [] };
    out.create = await window.ck.create('correct horse battery', data);
    await window.ck.lock();
    try { await window.ck.unlock('wrong'); } catch (e) { out.wrong = e.message; }
    out.unlocked = (await window.ck.unlock('correct horse battery')).data.items[0].title;
    out.sk = await window.ck.superKeyExport(data, 'correct horse battery');
    out.peek = (await window.ck.superKeyPeek(out.sk, 'correct horse battery')).data.items.length;
    out.ssh = (await window.ck.sshGenerate('t')).publicKey.slice(0, 11);
    try { await fetch('https://example.com'); out.net = 'LEAK'; } catch { out.net = 'blocked'; }
    out.node = typeof require;
    await window.ck.reset();
    const after = await window.ck.status();
    out.resetOk = after.exists === false && after.unlocked === false;
    out.recreated = !!(await window.ck.create('another long pass', data)).recoveryCode;
    return out;
  })()`;
  const r = await win.webContents.executeJavaScript(js);
  const raw = fs.readFileSync(path.join(tmp, 'vault', 'vault.ckv'), 'utf8');
  r.plaintextOnDisk = raw.includes('GitHub');
  r.backupsAfterReset = fs.readdirSync(path.join(tmp, 'vault', 'backups')).length;
  r.sk = `${r.sk.slice(0, 16)}… (${r.sk.length} chars)`;
  console.log(JSON.stringify(r, null, 2));
  const ok = r.unlocked === 'GitHub' && r.wrong === '主密码错误' && r.peek === 1 && r.net === 'blocked' && r.node === 'undefined' && !r.plaintextOnDisk && r.resetOk && r.recreated && r.backupsAfterReset === 0;
  console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
  app.exit(ok ? 0 : 1);
  // Electron 退出后才释放目录句柄
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* 临时目录,系统会清理 */ } });
};

app.on('browser-window-created', (_e, win) => {
  win.webContents.once('did-finish-load', () => run(win).catch((e) => { console.error(e); app.exit(1); }));
});
