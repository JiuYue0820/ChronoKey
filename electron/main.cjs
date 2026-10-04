'use strict';
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const {
  app, BrowserWindow, ipcMain, clipboard, powerMonitor, dialog, shell, session, nativeTheme, Menu, Tray, globalShortcut,
} = require('electron');
const { Vault } = require('./vault.cjs');
const { CODES, mkErr } = require('./errors.cjs');
const C = require('./crypto.cjs');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
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
  // Window Controls Overlay 只在 Windows 可用;mac 用 hiddenInset,Linux 用原生边框
  if (isWin) win.setTitleBarOverlay(overlay());
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
  bridgeIndex = null; // 凭据索引只存在于解锁期间
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
    // Windows:WCO 覆盖按钮;mac:红绿灯 hiddenInset;Linux:原生边框(titleBarStyle 默认)
    titleBarStyle: isMac ? 'hiddenInset' : isWin ? 'hidden' : 'default',
    titleBarOverlay: isWin ? overlay() : undefined,
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
  // 关窗驻留托盘(可选):拦截 close 改为隐藏;真正退出走托盘菜单 Quit(before-quit 里置 isQuitting)
  win.on('close', (e) => {
    if (!app.isQuitting && vault.getPrefs().closeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
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

// ---------- 托盘与全局热键 ----------
let tray = null;
let hotkeyOn = false;
const HOTKEY_ACCEL = 'Control+Shift+K';

function showWindow() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  // Linux 部分发行版缺 appindicator:失败只少个托盘,不影响应用
  try {
    tray = new Tray(path.join(__dirname, '..', 'build', 'icon.png'));
    tray.setToolTip('ChronoKey');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open ChronoKey', click: showWindow },
      { label: 'Lock', click: () => lockVault('manual') },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on('double-click', showWindow);
  } catch (e) {
    console.warn('[ChronoKey] tray unavailable:', e.message);
  }
}

function toggleWindow() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  if (win.isVisible() && win.isFocused()) win.hide();
  else showWindow();
}

function applyHotkey(on) {
  if (on === hotkeyOn) return;
  try {
    if (on) globalShortcut.register(HOTKEY_ACCEL, toggleWindow);
    else globalShortcut.unregister(HOTKEY_ACCEL);
    hotkeyOn = on;
  } catch (e) {
    console.warn('[ChronoKey] global hotkey unavailable:', e.message);
  }
}

// ---------- 浏览器桥(可选,默认关):127.0.0.1 上的最小服务,给配套扩展返回当前站点的登录项 ----------
// 设计约束:只绑回环地址;自定义头 X-ChronoKey-Bridge 让网页跨源请求过不了预检;Bearer 令牌在设置里
// 配对;保险库一锁定索引立即清零;限速防爆破。应用自身的网络封锁(session.webRequest + CSP)不受影响。
let bridgeServer = null;
let bridgeIndex = null; // 解锁期间的最小凭据索引(仅 login+password),主进程持有,锁定即清
let bridgeHits = [];

function startBridge() {
  if (bridgeServer) return;
  try {
    bridgeServer = http.createServer((req, res) => {
      const deny = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (req.method !== 'GET' || url.pathname !== '/bridge/v1/entries') return deny(404, { error: 'not found' });
        if (req.headers['x-chronokey-bridge'] !== '1') return deny(403, { error: 'forbidden' });
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token || token !== vault.getPrefs().bridgeToken) return deny(401, { error: 'bad token' });
        if (!vault.isUnlocked() || !bridgeIndex) return deny(423, { locked: true });
        const now = Date.now();
        bridgeHits = bridgeHits.filter((t) => now - t < 60_000);
        if (bridgeHits.length >= 120) return deny(429, { error: 'rate limited' });
        bridgeHits.push(now);
        const host = String(url.searchParams.get('host') || '').toLowerCase().replace(/^www\./, '');
        const match = host
          ? bridgeIndex.filter((e) => e.hosts.some((h) => h === host || h.endsWith('.' + host) || host.endsWith('.' + h)))
          : bridgeIndex;
        deny(200, { locked: false, entries: match.slice(0, 20) });
      } catch {
        deny(400, { error: 'bad request' });
      }
    });
    bridgeServer.on('error', (e) => { console.warn('[ChronoKey] bridge server error:', e.message); bridgeServer = null; });
    bridgeServer.listen(39781, '127.0.0.1');
  } catch (e) {
    console.warn('[ChronoKey] bridge unavailable:', e.message);
  }
}

function stopBridge() {
  if (bridgeServer) { try { bridgeServer.close(); } catch { } bridgeServer = null; }
  bridgeIndex = null;
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

// ---------- 语言包 ----------
// 扫描目录(exe 旁 → 资源目录 → 数据目录 → 用户目录):安装器把可选语言包装在
// <安装目录>\locales\;便携用户可放进 ChronoKeyData\locales(随 U 盘走);普通用户
// 也可手动放到 userData\locales。同 code 后扫描的覆盖先扫描的(用户目录优先)。
function localeDirs() {
  const dirs = [];
  // 退出阶段 app 可能已销毁:单目录取值失败就跳过,不影响其余目录
  const add = (p) => { try { if (p) dirs.push(p); } catch { } };
  try { add(path.join(path.dirname(app.getPath('exe')), 'locales')); } catch { }
  if (app.isPackaged) add(path.join(process.resourcesPath, 'locales'));
  add(path.join(DATA_DIR, 'locales'));
  try { add(path.join(app.getPath('userData'), 'locales')); } catch { }
  if (!app.isPackaged) add(path.join(__dirname, '..', 'locales'));
  return [...new Set(dirs)];
}

function listLocalePacks() {
  const byCode = new Map();
  for (const dir of localeDirs()) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const name of names) {
      if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?\.json$/.test(name)) continue;
      try {
        const p = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        if (p && p.code && p.dict && typeof p.dict === 'object') {
          byCode.set(p.code, { code: p.code, label: String(p.label || p.code) });
        }
      } catch { /* 单个损坏的语言包不影响其他 */ }
    }
  }
  return [...byCode.values()];
}

function readLocalePack(code) {
  const id = String(code || '');
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(id)) throw mkErr('badLangCode');
  for (const dir of localeDirs()) {
    try {
      const file = path.join(dir, id + '.json');
      if (fs.statSync(file).size > 4 * 1024 * 1024) continue; // 语言包合理上限约 1 MB,4 MB 以上视为异常
      const p = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (p && p.code === id && p.dict && typeof p.dict === 'object') {
        return { code: id, label: String(p.label || id), dict: p.dict };
      }
    } catch { /* 换下一个目录 */ }
  }
  { const e = new Error('语言包不存在: ' + id); e.code = 'localeMissing'; throw e; }
}

// ---------- IPC ----------
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    // 退出阶段 win/event.sender 可能已销毁(访问属性会抛 Object has been destroyed)。
    // 此时安静拒绝,不打错误日志;渲染进程拿到的结果与抛错时一致(preload 会转成 Error)。
    let okSender = false;
    try { okSender = !!win && !win.isDestroyed() && event.sender === win.webContents; } catch { }
    if (!okSender) return { ok: false, error: '非法来源' };
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
    // 首次启用浏览器桥时生成配对令牌(256 bit hex)
    if (patch.browserBridge === true && !patch.bridgeToken && !vault.getPrefs().bridgeToken) {
      patch = { ...patch, bridgeToken: require('node:crypto').randomBytes(32).toString('hex') };
    }
    const p = vault.setPrefs(patch);
    if ('theme' in patch) { nativeTheme.themeSource = p.theme; syncChrome(); }
    if ('contentProtection' in patch) win.setContentProtection(!!p.contentProtection);
    if ('globalHotkey' in patch) applyHotkey(!!p.globalHotkey);
    if ('browserBridge' in patch) {
      if (p.browserBridge) startBridge();
      else stopBridge();
    }
    return p;
  });

  // 渲染进程在解锁/保存后推送最小凭据索引(host → 登录项),锁定时主进程清零
  handle('bridge:index', (entries) => {
    if (!Array.isArray(entries)) throw new Error('bridge index must be an array');
    if (!vault.isUnlocked()) { bridgeIndex = null; return true; }
    bridgeIndex = entries.slice(0, 500).map((e) => ({
      id: String(e?.id || ''),
      title: String(e?.title || ''),
      username: String(e?.username || ''),
      password: String(e?.password || ''),
      totp: e?.totp ? String(e.totp) : null,
      hosts: Array.isArray(e?.hosts) ? e.hosts.slice(0, 5).map((h) => String(h).toLowerCase().replace(/^www\./, '').slice(0, 255)).filter(Boolean) : [],
    })).filter((e) => e.password && e.hosts.length);
    if (vault.getPrefs().browserBridge && !bridgeServer) startBridge();
    return true;
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

  handle('file:save', async ({ title, defaultName, content, filters, encoding }) => {
    const r = await dialog.showSaveDialog(win, { title, defaultPath: defaultName, filters });
    if (r.canceled || !r.filePath) return null;
    if (encoding === 'base64') fs.writeFileSync(r.filePath, Buffer.from(content, 'base64'), { mode: 0o600 });
    else fs.writeFileSync(r.filePath, content, { mode: 0o600, encoding: 'utf8' });
    return r.filePath;
  });
  handle('file:open', async ({ title, filters }) => {
    const r = await dialog.showOpenDialog(win, { title, filters, properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0];
    if (fs.statSync(p).size > 64 * 1024 * 1024) throw mkErr('fileTooBig');
    return { name: path.basename(p), content: fs.readFileSync(p, 'utf8') };
  });

  handle('locales:list', () => listLocalePacks());
  handle('locales:read', (code) => readLocalePack(code));

  // GitHub 的 /releases/latest/download/ 返回 302,需要手动跟随(最多 5 跳)
  const RELEASE_BASE = 'https://github.com/JiuYue0820/ChronoKey/releases/latest/download/';
  const httpsGetText = (url) => new Promise((resolve, reject) => {
    const https = require('node:https');
    const get = (u, redirects) => {
      if (redirects > 7) { reject(new Error('重定向次数过多(最后一个: ' + u.slice(0, 120) + ')')); return; }
      const req = https.get(u, { timeout: 10000, headers: { 'User-Agent': 'ChronoKey' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const loc = res.headers.location;
          if (!loc) { res.resume(); reject(new Error('HTTP ' + res.statusCode + ' 无 Location 头(发布可能处于中间状态): ' + u.slice(0, 120))); return; }
          const next = new URL(loc, u).href;
          res.resume();
          get(next, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode + ': ' + u.slice(0, 120))); return; }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => { body += d; });
        res.on('end', () => resolve(body));
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('超时: ' + u.slice(0, 120))); });
      req.on('error', (e) => reject(new Error(e.message + ': ' + u.slice(0, 120))));
    };
    get(url, 0);
  });

  handle('update:check', async () => {
    const raw = await httpsGetText(RELEASE_BASE + 'latest.json');
    const json = JSON.parse(raw);
    const current = app.getVersion();
    const latest = String(json.version || '');
    const cmp = (a, b) => a.split('.').map(Number).reduce((p, v, i) => p + (v - (b.split('.').map(Number)[i] || 0)) * Math.pow(1000, 2 - i), 0);
    const updateAvailable = cmp(latest, current) > 0;
    // 顺带看语言包清单(失败不影响更新检查)
    let langs = null;
    try {
      const manifest = JSON.parse(await httpsGetText(RELEASE_BASE + 'languages.json'));
      if (manifest && Array.isArray(manifest.languages)) langs = { version: String(manifest.version || ''), count: manifest.languages.length };
    } catch { }
    return {
      current,
      latest,
      updateAvailable,
      url: 'https://github.com/JiuYue0820/ChronoKey/releases',
      langs,
    };
  });

  // 语言包在线更新:从最新 release 下载全部语言包(逐个校验 SHA-256)装入 userData\locales,
  // 与安装器装的 <安装目录>\locales 互不覆盖;渲染进程随后重新 registerLocale 即时生效。
  handle('locales:update', async () => {
    const manifest = JSON.parse(await httpsGetText(RELEASE_BASE + 'languages.json'));
    if (!manifest || !Array.isArray(manifest.languages) || !manifest.languages.length) throw mkErr('badLangManifest');
    const dir = path.join(app.getPath('userData'), 'locales');
    fs.mkdirSync(dir, { recursive: true });
    let installed = 0;
    for (const lang of manifest.languages) {
      const code = String(lang.code || '');
      const file = String(lang.file || '');
      const sha = String(lang.sha256 || '');
      if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code) || file !== code + '.json' || !/^[0-9a-fA-F]{64}$/.test(sha)) continue;
      if (['zh', 'en', 'ru'].includes(code)) continue; // 内置语言不走语言包
      const raw = await httpsGetText(RELEASE_BASE + file);
      const hash = require('node:crypto').createHash('sha256').update(Buffer.from(raw, 'utf8')).digest('hex');
      if (hash !== sha.toLowerCase()) continue; // 校验失败跳过该语言
      fs.writeFileSync(path.join(dir, code + '.json'), raw, 'utf8');
      installed++;
    }
    const version = String(manifest.version || '');
    fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version, at: new Date().toISOString(), installed }, null, 2));
    return { version, installed };
  });

  // ---------- 程序文件完整性 ----------
  // 与 GitHub release 附带的 app-manifest.json(逐文件 SHA-256)核对当前安装的程序文件。
  // 只读程序文件;用户数据(ChronoKeyData、vault、prefs)不在清单里,永不触碰。
  // 修补时从该版本 zip 按需 Range 下载对应条目(先解中央目录),不必重下整个安装包。
  const TAG_BASE = (v) => `https://github.com/JiuYue0820/ChronoKey/releases/download/v${v}`;

  const httpsGetBuffer = (url, headers = {}) => new Promise((resolve, reject) => {
    const https = require('node:https');
    const get = (u, redirects) => {
      if (redirects > 5) { reject(new Error('重定向次数过多')); return; }
      const req = https.get(u, { timeout: 20000, headers: { 'User-Agent': 'ChronoKey', ...headers } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          const next = new URL(res.headers.location, u).href;
          res.resume();
          get(next, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) { res.resume(); reject(Object.assign(new Error('HTTP ' + res.statusCode), { statusCode: res.statusCode })); return; }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
      req.on('error', reject);
    };
    get(url, 0);
  });

  const sha256Buf = (buf) => require('node:crypto').createHash('sha256').update(buf).digest('hex');

  // zip 中央目录解析(传入文件尾部的缓冲区):EOCD 紧跟中央目录,据此把绝对偏移换算成缓冲区内偏移
  function zipEntries(tail) {
    const idx = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (idx < 0 || tail.readUInt32LE(idx) !== 0x06054b50) throw new Error('不是有效的 zip');
    const count = tail.readUInt16LE(idx + 10);
    const cdSize = tail.readUInt32LE(idx + 12);
    const cdOffset = tail.readUInt32LE(idx + 16);
    const bufferStart = cdOffset + cdSize - idx;
    let p = cdOffset - bufferStart;
    if (p < 0 || p + 46 > tail.length) throw new Error('中央目录超出已获取范围');
    const entries = new Map();
    for (let i = 0; i < count; i++) {
      if (tail.readUInt32LE(p) !== 0x02014b50) break;
      const method = tail.readUInt16LE(p + 10);
      const size = tail.readUInt32LE(p + 20);
      const nameLen = tail.readUInt16LE(p + 28);
      const extraLen = tail.readUInt16LE(p + 30);
      const commentLen = tail.readUInt16LE(p + 32);
      const localOff = tail.readUInt32LE(p + 42);
      const name = tail.slice(p + 46, p + 46 + nameLen).toString('utf8');
      entries.set(name, { method, size, localOff });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  const installRoot = () => {
    if (!app.isPackaged) return null; // 开发模式没有"程序文件"可核对
    return path.dirname(app.getPath('exe'));
  };

  handle('repair:list', async () => {
    const dir = installRoot();
    if (!dir) return { supported: false };
    let manifest;
    try {
      manifest = JSON.parse(await httpsGetText(`${TAG_BASE(app.getVersion())}/app-manifest.json`));
    } catch (e) {
      if (e && e.statusCode === 404) return { supported: true, manifest: false };
      throw e;
    }
    const files = Array.isArray(manifest.files) ? manifest.files : null;
    if (!files || !files.length) return { supported: true, manifest: false };
    const issues = [];
    for (const f of files) {
      const rel = String(f.path || '');
      const dest = path.resolve(dir, rel);
      if (!dest.startsWith(path.resolve(dir) + path.sep)) continue; // 清单路径越界一律忽略
      let st;
      try { st = fs.statSync(dest); } catch { issues.push({ path: rel, status: 'missing' }); continue; }
      if (st.size !== f.size) { issues.push({ path: rel, status: 'modified' }); continue; }
      if (sha256Buf(fs.readFileSync(dest)) !== String(f.sha256 || '').toLowerCase()) issues.push({ path: rel, status: 'modified' });
    }
    return { supported: true, manifest: true, total: files.length, version: String(manifest.version || app.getVersion()), issues };
  });

  handle('repair:fix', async (paths) => {
    const dir = installRoot();
    if (!dir) return { supported: false };
    const v = app.getVersion();
    const zipName = `ChronoKey-${v}-win-x64.zip`;
    const zipBase = `${TAG_BASE(v)}/${zipName}`;
    const manifest = JSON.parse(await httpsGetText(`${TAG_BASE(v)}/app-manifest.json`));
    const byPath = new Map((manifest.files || []).map((f) => [f.path, f]));
    const want = (Array.isArray(paths) ? paths : []).filter((p) => byPath.has(p));
    if (!want.length) return { fixed: 0, failed: [] };

    // 中央目录在 zip 尾部:先取末尾 64 KB 解出条目表
    const tail = await httpsGetBuffer(zipBase, { Range: 'bytes=-65536' });
    const entries = zipEntries(tail);

    let fixed = 0;
    const failed = [];
    for (const rel of want) {
      try {
        const meta = byPath.get(rel);
        const e = entries.get(rel);
        if (!e) throw new Error('zip 里没有该文件');
        // 本地文件头(30 字节)里才有真正的数据偏移(文件名/extra 长度可能与中央目录不同)
        const lfh = await httpsGetBuffer(zipBase, { Range: `bytes=${e.localOff}-${e.localOff + 29}` });
        if (lfh.readUInt32LE(0) !== 0x04034b50) throw new Error('zip 条目头损坏');
        const dataStart = e.localOff + 30 + lfh.readUInt16LE(26) + lfh.readUInt16LE(28);
        let data = await httpsGetBuffer(zipBase, { Range: `bytes=${dataStart}-${dataStart + e.size - 1}` });
        if (e.method === 8) data = require('node:zlib').inflateRawSync(data);
        // 修补的第一原则:下载内容必须与清单哈希一致才允许落盘
        if (sha256Buf(data) !== String(meta.sha256 || '').toLowerCase()) throw new Error('SHA-256 校验失败');
        const dest = path.resolve(dir, rel);
        if (!dest.startsWith(path.resolve(dir) + path.sep)) throw new Error('非法路径');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const tmpFile = dest + '.repairing';
        fs.writeFileSync(tmpFile, data);
        fs.renameSync(tmpFile, dest);
        fixed++;
      } catch (e) {
        failed.push({ path: rel, error: e.message });
      }
    }
    return { fixed, failed };
  });
  handle('win:toggleMaximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  handle('win:close', () => win.close());
  handle('shell:openExternal', (url) => {
    if (!/^https?:\/\//i.test(url)) throw mkErr('externalLinkOnly');
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
  createTray();
  applyHotkey(!!vault.getPrefs().globalHotkey);
  if (vault.getPrefs().browserBridge && vault.getPrefs().bridgeToken) startBridge();

  nativeTheme.on('updated', syncChrome);
  powerMonitor.on('lock-screen', () => lockVault('screen-lock'));
  powerMonitor.on('suspend', () => { if (settings.lockOnSleep) lockVault('sleep'); });

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { app.isQuitting = true; globalShortcut.unregisterAll(); clearClipboardNow(); vault.lock(); });
app.on('window-all-closed', () => { lockVault('closed'); if (!isMac && !vault.getPrefs().closeToTray) app.quit(); });

// 拒绝任何额外的 webContents(例如 <webview>)
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
});
