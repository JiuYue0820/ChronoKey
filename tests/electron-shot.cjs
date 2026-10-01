'use strict';
// 截取真实 Electron 窗口(含系统原生标题栏按钮)。运行:OUT=路径 npx electron tests/electron-shot.cjs
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { app } = require('electron');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-shot-'));
app.setPath('userData', tmp);
require('../electron/main.cjs');

app.on('browser-window-created', (_e, win) => {
  win.webContents.once('did-finish-load', async () => {
    win.setContentProtection(false); // 仅截图用
    await new Promise((r) => setTimeout(r, 1500));
    const img = await win.webContents.capturePage();
    fs.writeFileSync(process.env.OUT || path.join(os.tmpdir(), 'ck-shot.png'), img.toPNG());
    console.log('SHOT', img.getSize());
    app.exit(0);
  });
});
