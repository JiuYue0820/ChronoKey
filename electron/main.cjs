'use strict';
const path = require('node:path');
const fs = require('node:fs');
const {
  app, BrowserWindow, ipcMain, clipboard, powerMonitor, dialog, shell, session, nativeTheme, Menu,
} = require('electron');
const { Vault } = require('./vault.cjs');
const C = require('./crypto.cjs');

const isMac = process.platform === 'darwin';
const devUrlArg = process.argv.find((a) => a.startsWith('--dev-url='));
const DEV_URL = devUrlArg ? devUrlArg.slice('--dev-url='.length) : null;

// ---------- 数据目录:便携模式(程序旁有 data 文件夹)优先 ----------
function resolveDataDir() {
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
  const portable = path.join(exeDir, 'ChronoKeyData');
  if (app.isPackaged && fs.existsSync(portable)) return { dir: portable, portable: true };
  return { dir: path.join(app.getPath('userData'), 'vault'), portable: false };
}

app.setName('ChronoKey');
const { dir: DATA_DIR, portable: PORTABLE } = resolveDataDir();
const vault = new Vault(DATA_DIR);

let win = null;

// Windows / Linux:使用系统原生标题栏按钮(Window Controls Overlay),含 Win11 贴靠布局。
// 颜色与标题栏背景 --bg-sidebar 一致,高度 48px(微软规范:含搜索框的标题栏为 48px)。
const OVERLAY = {
  light: { color: '#ECE7DC', symbolColor: '#1C1C1C' },
  dark: { color: '#191816', symbolColor: '#EDE8DD' },
};
const overlay = () => ({ ...OVERLAY[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'], height: 48 });
function syncChrome() {
  if (!win || win.isDestroyed()) return;
  if (!isMac) win.setTitleBarOverlay(overlay());
  win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1F1E1B' : '#F6F3EC');
}
let settings = { autoLockMinutes: 5, clipboardSeconds: 20, lockOnSleep: true, lockOnMinimize: false };
let clipboardTimer = null;
let lastCopied = null;

// ---------- 单实例 ----------
const primary = app.requestSingleInstanceLock();
if (!primary) app.exit(0);
app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

// ---------- 锁定 ----------
function lockVault(reason) {
  if (!vault.isUnlocked()) return;
  vault.lock();
  clearClipboardNow();
  if (win && !win.isDestroyed()) win.webContents.send('vault:locked', reason);
}

function clearClipboardNow() {
  if (clipboardTimer) clearTimeout(clipboardTimer);
  clipboardTimer = null;
  if (lastCopied !== null && clipboard.readText() === lastCopied) clipboard.clear();
  lastCopied = null;
  if (win && !win.isDestroyed()) win.webContents.send('clipboard:state', { until: 0 });
}

// 闲置检测
setInterval(() => {
  if (!vault.isUnlocked() || !settings.autoLockMinutes) return;
  if (powerMonitor.getSystemIdleTime() >= settings.autoLockMinutes * 60) lockVault('idle');
}, 10_000);

// ---------- 窗口 ----------
function createWindow() {
  const prefs = vault.getPrefs();
  nativeTheme.themeSource = prefs.theme;
  const bounds = prefs.bounds || {};
  win = new BrowserWindow({
    width: bounds.width || 1180,
    height: bounds.height || 760,
    x: bounds.x,
    y: bounds.y,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    minWidth: 880,
    minHeight: 560,
    show: false,
    title: 'ChronoKey',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1F1E1B' : '#F6F3EC',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    titleBarOverlay: isMac ? undefined : overlay(),
    trafficLightPosition: isMac ? { x: 18, y: 17 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  win.setContentProtection(prefs.contentProtection !== false);
  win.once('ready-to-show', () => { if (bounds.maximized) win.maximize(); win.show(); });
  // 记住窗口位置与大小(非敏感,写入 prefs.json)
  win.on('close', () => {
    vault.setPrefs({ bounds: { ...win.getNormalBounds(), maximized: win.isMaximized() } });
  });
  win.on('minimize', () => { if (settings.lockOnMinimize) lockVault('minimize'); });
  win.on('maximize', () => win.webContents.send('win:state', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('win:state', { maximized: false }));

  // 禁止导航与新窗口;外链交给系统浏览器(只允许 http/https,且由用户点击触发)
  win.webContents.on('will-navigate', (e, url) => {
    if (!DEV_URL || !url.startsWith(DEV_URL)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// ---------- 离线:拦截一切网络请求 ----------
function lockDownNetwork() {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest((details, cb) => {
    const u = details.url;
    const allowed = u.startsWith('file:') || u.startsWith('devtools:') || u.startsWith('data:') || u.startsWith('blob:')
      || (DEV_URL && (u.startsWith(DEV_URL) || u.startsWith(DEV_URL.replace('http', 'ws'))));
    cb({ cancel: !allowed });
  });
  ses.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'clipboard-sanitized-write'));
  ses.webRequest.onHeadersReceived((details, cb) => {
    const csp = DEV_URL
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws:"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });
}

// ---------- IPC ----------
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!win || event.sender !== win.webContents) throw new Error('非法来源');
    try {
      return { ok: true, value: await fn(...args) };
    } catch (e) {
      return { ok: false, error: e.message, code: e.code, waitMs: e.waitMs };
    }
  });
}

function registerIpc() {
  handle('vault:status', () => ({
    exists: vault.exists(),
    unlocked: vault.isUnlocked(),
    guard: vault.getGuard(),
    prefs: vault.getPrefs(),
    dataDir: DATA_DIR,
    portable: PORTABLE,
    platform: process.platform,
    version: app.getVersion(),
  }));

  handle('vault:create', async (password, data) => vault.create(password, data));
  handle('vault:unlock', async (password) => vault.unlock(password));
  handle('vault:recover', async (code, newPassword) => vault.recover(code, newPassword));
  handle('vault:lock', () => lockVault('manual'));
  handle('vault:save', (data, opts) => vault.save(data, opts));
  handle('vault:verify', (password) => vault.verifyPassword(password));
  handle('vault:changePassword', (a, b) => vault.changePassword(a, b));
  handle('vault:rotateRecovery', (pw) => vault.rotateRecovery(pw));
  // "全部忘记":删除主库与全部快照,回到初始设置。锁屏页也可调用(用户已无任何凭据)。
  handle('vault:reset', () => {
    vault.reset();
    clearClipboardNow();
    win.webContents.send('vault:locked', 'reset');
  });

  handle('superkey:export', (data, master, transfer) => vault.exportSuperKey(data, master, transfer));
  handle('superkey:create', (sk, pass) => vault.createFromSuperKey(sk, pass));
  handle('superkey:peek', (sk, pass) => vault.peekSuperKey(sk, pass));
  handle('superkey:inspect', (sk) => {
    const p = C.parseSuperKey(sk);
    return { kdf: p.kdf, bytes: p.ct.length };
  });

  handle('backup:list', () => vault.listBackups());
  handle('backup:create', () => vault.snapshot());
  handle('backup:restore', (name) => { vault.restoreBackup(name); win.webContents.send('vault:locked', 'restore'); });
  handle('backup:openFolder', () => shell.openPath(vault.backupDir));

  handle('settings:apply', (s) => {
    settings = { ...settings, ...s };
    return settings;
  });
  handle('prefs:set', (patch) => {
    const p = vault.setPrefs(patch);
    if ('theme' in patch) { nativeTheme.themeSource = p.theme; syncChrome(); }
    if ('contentProtection' in patch) win.setContentProtection(!!p.contentProtection);
    return p;
  });

  handle('clipboard:copy', (text, { sensitive = true } = {}) => {
    clipboard.writeText(String(text));
    if (clipboardTimer) clearTimeout(clipboardTimer);
    if (sensitive && settings.clipboardSeconds > 0) {
      lastCopied = String(text);
      clipboardTimer = setTimeout(clearClipboardNow, settings.clipboardSeconds * 1000);
      win.webContents.send('clipboard:state', { until: Date.now() + settings.clipboardSeconds * 1000 });
      return { clearsIn: settings.clipboardSeconds };
    }
    // 非敏感内容覆盖了剪贴板:之前的倒计时不再有意义
    lastCopied = null;
    clipboardTimer = null;
    win.webContents.send('clipboard:state', { until: 0 });
    return { clearsIn: 0 };
  });
  handle('clipboard:clear', () => clearClipboardNow());
  handle('clipboard:readImage', () => {
    const img = clipboard.readImage();
    return img.isEmpty() ? null : img.toDataURL();
  });

  handle('ssh:generate', (comment) => C.generateSshKey(comment));

  handle('file:save', async ({ title, defaultName, content, filters }) => {
    const r = await dialog.showSaveDialog(win, { title, defaultPath: defaultName, filters });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, content, { mode: 0o600 });
    return r.filePath;
  });
  handle('file:open', async ({ title, filters }) => {
    const r = await dialog.showOpenDialog(win, { title, filters, properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0];
    if (fs.statSync(p).size > 64 * 1024 * 1024) throw new Error('文件过大(>64MB)');
    return { name: path.basename(p), content: fs.readFileSync(p, 'utf8') };
  });

  handle('win:minimize', () => win.minimize());
  handle('win:toggleMaximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  handle('win:close', () => win.close());
  handle('shell:openExternal', (url) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('只允许打开 http/https 链接');
    return shell.openExternal(url);
  });
}

// ---------- 生命周期 ----------
app.whenReady().then(() => {
  if (!primary) return;
  if (!isMac) Menu.setApplicationMenu(null);
  lockDownNetwork();
  registerIpc();
  createWindow();

  nativeTheme.on('updated', syncChrome);
  powerMonitor.on('lock-screen', () => lockVault('screen-lock'));
  powerMonitor.on('suspend', () => { if (settings.lockOnSleep) lockVault('sleep'); });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { clearClipboardNow(); vault.lock(); });
app.on('window-all-closed', () => { lockVault('closed'); if (!isMac) app.quit(); });

// 拒绝任何额外的 webContents(例如 <webview>)
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
});
