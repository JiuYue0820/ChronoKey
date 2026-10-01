// 浏览器预览专用的内存模拟 API —— 不做真实加密,仅用于 UI 开发/截图。
// Electron 中永远不会加载此文件(window.ck 由 preload 提供)。
import { newItem, emptyVault } from './lib/model.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const DEMO_PASSWORD = 'demo';

export function seed() {
  const d = emptyVault();
  const day = 86400000;
  const work = { id: 'f-work', name: '工作' };
  const personal = { id: 'f-life', name: '生活' };
  d.folders = [work, personal];
  d.items = [
    newItem('login', {
      title: 'GitHub', favorite: true, folderId: work.id, tags: ['开发'],
      fields: { username: 'alice-dev', password: 'k7#Vq9!mZr2@Lw4pXs8e', url: 'https://github.com/login', totp: 'otpauth://totp/GitHub:alice-dev?secret=JBSWY3DPEHPK3PXP&issuer=GitHub' },
      notes: '主力账号,组织:chronokey-labs', createdAt: Date.now() - 200 * day, passwordChangedAt: Date.now() - 40 * day,
    }),
    newItem('login', {
      title: 'Google', folderId: personal.id, tags: ['邮箱'],
      fields: { username: 'alice@gmail.com', password: 'Moss-Paper-Lantern-River7', url: 'https://accounts.google.com' },
      createdAt: Date.now() - 500 * day, passwordChangedAt: Date.now() - 420 * day,
    }),
    newItem('login', {
      title: '哔哩哔哩', folderId: personal.id,
      fields: { username: '13800001234', password: 'password123', url: 'https://www.bilibili.com' },
    }),
    newItem('login', {
      title: '公司 VPN', folderId: work.id, tags: ['开发', '内网'],
      fields: { username: 'alice.w', password: 'password123', url: 'https://vpn.example.cn' },
    }),
    newItem('totp', {
      title: 'Cloudflare', tags: ['开发'],
      fields: { issuer: 'Cloudflare', account: 'alice@example.com', totp: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', backupCodes: 'a1b2-c3d4\ne5f6-g7h8' },
    }),
    newItem('card', {
      title: '招商银行 储蓄卡', folderId: personal.id,
      fields: { holder: 'ALICE WANG', number: '6225 8812 3456 7890', expiry: '08/29', cvv: '123', bank: '招商银行' },
    }),
    newItem('identity', { title: '身份证', fields: { fullName: '王爱丽', email: 'alice@example.com', phone: '138 0000 1234', idNumber: '110101199001011234' } }),
    newItem('note', { title: '路由器后台', favorite: true, fields: { body: '地址 192.168.31.1\n管理员密码见下方自定义字段' },
      custom: [{ id: 'c1', label: '管理员密码', value: 'router-Admin-2026', hidden: true }] }),
    newItem('apikey', { title: 'OpenAI 开发', tags: ['开发'], fields: { service: 'OpenAI', keyId: 'proj_demo', secret: 'sk-demo-xxxxxxxxxxxxxxxxxxxxxxxx', env: 'OPENAI_API_KEY' } }),
    newItem('ssh', { title: '阿里云 ECS', folderId: work.id, fields: { host: 'root@47.100.0.1', publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDemoDemoDemoDemoDemoDemoDemoDemoDemoDemo alice@laptop', fingerprint: 'SHA256:dEm0dEm0dEm0dEm0dEm0dEm0dEm0dEm0dEm0dEm0dEm' } }),
  ];
  d.audit = [{ t: Date.now() - 3600000, action: 'unlock', detail: '' }, { t: Date.now() - 7200000, action: 'create', detail: '创建保险库' }];
  return d;
}

export function installMock() {
  const params = new URLSearchParams(location.search);
  let exists = params.get('fresh') !== '1';
  let unlocked = false;
  let data = exists ? seed() : null;
  let password = DEMO_PASSWORD;
  let failures = 0;
  const prefs = { contentProtection: true, wipeAfter: 0, lang: 'zh' };
  const backups = [
    { name: 'vault-2026-09-30T10-00-00-000Z.ckv', size: 48213, time: Date.now() - 3600000 },
    { name: 'vault-2026-09-29T18-20-00-000Z.ckv', size: 47102, time: Date.now() - 86400000 },
  ];
  const listeners = new Set();
  const clipListeners = new Set();
  let clipTimer = null;

  const fail = (msg, code) => { const e = new Error(msg); e.code = code; throw e; };

  window.ck = {
    isElectron: false,
    status: async () => ({
      exists, unlocked, guard: { failures }, prefs: { ...prefs, theme: localStorage.getItem('ck-theme') || 'system', lang: localStorage.getItem('ck-lang') || prefs.lang || 'zh' },
      dataDir: '(浏览器预览 · 内存)', portable: false, platform: 'browser', version: '0.1.0',
    }),
    create: async (pw, d) => { await wait(400); password = pw; data = d; exists = true; unlocked = true; return { recoveryCode: 'DEMO0-RECOV-ERYC0-DE123-45678' }; },
    unlock: async (pw) => {
      await wait(350);
      if (pw !== password) { failures++; fail('主密码错误', 'BAD_PASSWORD'); }
      const prev = failures; failures = 0; unlocked = true;
      return { data: structuredClone(data), failedAttempts: prev };
    },
    recover: async (code, pw) => { await wait(400); password = pw; unlocked = true; return { data: structuredClone(data), recoveryCode: 'NEW00-RECOV-ERYC0-DE123-45678' }; },
    lock: async () => { unlocked = false; listeners.forEach((fn) => fn('manual')); },
    save: async (d) => { data = structuredClone(d); return { updatedAt: Date.now() }; },
    verify: async (pw) => pw === password,
    changePassword: async (a, b) => { if (a !== password) fail('当前主密码错误'); password = b; },
    reset: async () => { await wait(200); exists = false; unlocked = false; data = null; failures = 0; backups.length = 0; listeners.forEach((fn) => fn('reset')); },
    rotateRecovery: async (pw) => { if (pw !== password) fail('主密码错误'); return { recoveryCode: 'ROT00-RECOV-ERYC0-DE123-45678' }; },
    superKeyExport: async (d, master) => {
      await wait(500);
      if (master !== password) fail('主密码错误');
      return `CK1.${btoa(unescape(encodeURIComponent(JSON.stringify({ kind: 'history-super-key', data: d })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.00000000`;
    },
    superKeyPeek: async (sk) => ({ data: decodeMock(sk), exportedAt: Date.now() }),
    superKeyCreate: async (sk, pass) => { const d = decodeMock(sk); data = d; password = pass; exists = true; unlocked = true; return { data: d, recoveryCode: 'IMP00-RECOV-ERYC0-DE123-45678' }; },
    superKeyInspect: async () => ({ kdf: { m: 65536, t: 3, p: 1 }, bytes: 1234 }),
    backupList: async () => backups,
    backupCreate: async () => { backups.unshift({ name: `vault-${new Date().toISOString().replace(/[:.]/g, '-')}.ckv`, size: 48000, time: Date.now() }); },
    backupRestore: async () => { unlocked = false; listeners.forEach((fn) => fn('restore')); },
    backupOpenFolder: async () => {},
    applySettings: async (s) => s,
    // 返回完整偏好(与主进程一致),否则调用方会丢掉其他字段
    setPrefs: async (p) => { if (p.theme) localStorage.setItem('ck-theme', p.theme); if (p.lang) localStorage.setItem('ck-lang', p.lang); Object.assign(prefs, p); return { ...prefs, theme: localStorage.getItem('ck-theme') || 'system', lang: localStorage.getItem('ck-lang') || prefs.lang || 'zh' }; },
    copy: async (text, { sensitive = true } = {}) => {
      await navigator.clipboard?.writeText(text).catch(() => {});
      clearTimeout(clipTimer);
      const until = sensitive ? Date.now() + 20000 : 0;
      clipListeners.forEach((fn) => fn({ until }));
      if (sensitive) clipTimer = setTimeout(() => clipListeners.forEach((fn) => fn({ until: 0 })), 20000);
      return { clearsIn: sensitive ? 20 : 0 };
    },
    readClipboardImage: async () => {
      try {
        for (const it of await navigator.clipboard.read()) {
          const type = it.types.find((t) => t.startsWith('image/'));
          if (type) { const b = await it.getType(type); return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
        }
      } catch { /* 无权限 */ }
      return null;
    },
    clearClipboard: async () => { clearTimeout(clipTimer); clipListeners.forEach((fn) => fn({ until: 0 })); },
    sshGenerate: async (c) => ({ publicKey: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPreviewOnly ${c}`, privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\n(预览模式不生成真实密钥)\n-----END OPENSSH PRIVATE KEY-----\n', fingerprint: 'SHA256:preview' }),
    saveFile: async ({ defaultName, content }) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content]));
      a.download = defaultName;
      a.click();
      return defaultName;
    },
    openFile: async () => new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async () => { const f = input.files[0]; resolve(f ? { name: f.name, content: await f.text() } : null); };
      input.click();
    }),
    openExternal: async (url) => window.open(url, '_blank', 'noopener'),
    win: { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {} },
    onLocked: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    onWinState: () => () => {},
    onClipboard: (cb) => { clipListeners.add(cb); return () => clipListeners.delete(cb); },
  };
}

function decodeMock(sk) {
  const body = String(sk).replace(/\s+/g, '').split('.')[1] || '';
  try {
    return JSON.parse(decodeURIComponent(escape(atob(body.replace(/-/g, '+').replace(/_/g, '/'))))).data;
  } catch {
    throw new Error('不是有效的历史超密钥(格式错误)');
  }
}
