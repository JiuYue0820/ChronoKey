'use strict';
// 只暴露白名单 API,渲染进程拿不到 Node / ipcRenderer 本体。
const { contextBridge, ipcRenderer } = require('electron');

const call = async (channel, ...args) => {
  const r = await ipcRenderer.invoke(channel, ...args);
  if (!r.ok) {
    const err = new Error(r.error);
    err.code = r.code;
    err.waitMs = r.waitMs;
    throw err;
  }
  return r.value;
};

const on = (channel) => (cb) => {
  const fn = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

contextBridge.exposeInMainWorld('ck', {
  isElectron: true,
  status: () => call('vault:status'),
  create: (pw, data) => call('vault:create', pw, data),
  unlock: (pw) => call('vault:unlock', pw),
  recover: (code, pw) => call('vault:recover', code, pw),
  lock: () => call('vault:lock'),
  save: (data, opts) => call('vault:save', data, opts),
  verify: (pw) => call('vault:verify', pw),
  changePassword: (a, b) => call('vault:changePassword', a, b),
  rotateRecovery: (pw) => call('vault:rotateRecovery', pw),
  reset: () => call('vault:reset'),

  superKeyExport: (data, master, transfer) => call('superkey:export', data, master, transfer),
  superKeyCreate: (sk, pass) => call('superkey:create', sk, pass),
  superKeyPeek: (sk, pass) => call('superkey:peek', sk, pass),
  superKeyInspect: (sk) => call('superkey:inspect', sk),

  backupList: () => call('backup:list'),
  backupCreate: () => call('backup:create'),
  backupRestore: (name) => call('backup:restore', name),
  backupOpenFolder: () => call('backup:openFolder'),

  applySettings: (s) => call('settings:apply', s),
  setPrefs: (p) => call('prefs:set', p),
  listLocales: () => call('locales:list'),
  readLocale: (code) => call('locales:read', code),
  localesUpdate: () => call('locales:update'),
  copy: (text, opts) => call('clipboard:copy', text, opts),
  clearClipboard: () => call('clipboard:clear'),
  readClipboardImage: () => call('clipboard:readImage'),
  sshGenerate: (comment) => call('ssh:generate', comment),
  saveFile: (opts) => call('file:save', opts),
  openFile: (opts) => call('file:open', opts),
  openExternal: (url) => call('shell:openExternal', url),

  updateCheck: () => call('update:check'),
  repairList: () => call('repair:list'),
  repairFix: (paths) => call('repair:fix', paths),

  win: {
    minimize: () => call('win:minimize'),
    toggleMaximize: () => call('win:toggleMaximize'),
    close: () => call('win:close'),
  },
  onLocked: on('vault:locked'),
  onWinState: on('win:state'),
  onClipboard: on('clipboard:state'),
});
