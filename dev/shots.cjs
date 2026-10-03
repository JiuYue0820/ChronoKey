// 离线截图驱动:Electron 加载 mock 应用(无 preload),按步骤点击 UI 并保存整页截图。
// 用法:electron dev/shots.cjs
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const OUT = process.env.SHOT_DIR || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 要跑的步骤:每步一段在页面里执行的 JS(返回简短状态字符串),步后截图
const steps = [
  { name: '01-unlock-form', js: `(() => { const i = document.querySelector('.lock-card input'); if (i) i.focus(); return 'unlock:' + (document.querySelector('.lock-card') ? 'yes' : 'no'); })()` },
  { name: '02-unlocked-main', js: `(() => {
      const i = document.querySelector('.lock-card input');
      if (i) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(i, 'demo'); i.dispatchEvent(new Event('input', { bubbles: true }));
        const b = document.querySelector('.lock-card button[type=submit], .lock-card .w-full');
        setTimeout(() => b.click(), 60); }
      return 'unlock submitted'; })()`, wait: 1500 },
  { name: '03-open-settings', js: `(() => {
      const gear = document.querySelector('.titlebar [aria-label*="设置"], .titlebar button') ;
      const btns=[...document.querySelectorAll('.titlebar button')];
      const g=btns.find(b=>b.querySelector('.icon.gear')||/设置|settings/i.test(b.getAttribute('aria-label')||''));
      (g||btns[btns.length-1]).click();
      return 'settings=' + (!!document.querySelector('.settings')); })()` , wait: 600 },
  { name: '04-settings-sidebar', js: `(() => {
      const nav=document.querySelector('.settings-nav');
      const cs=nav?getComputedStyle(nav):null;
      return 'navFound=' + !!nav + ' | display=' + (cs&&cs.display) + ' | width=' + (nav&&nav.offsetWidth) + 'px | rows=' + (nav?nav.children.length:0); })()`, wait: 200 },
];

async function main() {
  app.disableHardwareAcceleration();
  await app.whenReady();
  const w = parseInt(process.env.W || '1180', 10), h = parseInt(process.env.H || '760', 10);
  const win = new BrowserWindow({ width: w, height: h, show: false, webPreferences: { offscreen: true } });
  await win.loadURL('http://localhost:5199/');
  await sleep(800);
  // 隐藏 offscreen 截图:改用普通窗口截图
  win.show();
  for (const s of steps) {
    const res = await win.webContents.executeJavaScript(s.js, true);
    await sleep(s.wait || 300);
    const p = path.join(OUT, s.name + '.png');
    const img = await win.webContents.capturePage();
    fs.writeFileSync(p, img.toPNG());
    console.log(`[SHOT] ${s.name} :: ${res}`);
  }
  await sleep(400);
  app.exit(0);
}
app.on('window-all-closed', () => app.exit(0));
main().catch((e) => { console.error(e); app.exit(1); });
