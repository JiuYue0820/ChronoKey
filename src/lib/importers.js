import { mkErr } from '../../electron/errors.cjs';
// 导入:CSV(Chrome / Edge / Firefox / Safari / 1Password / Bitwarden / LastPass 通用映射)、
// Bitwarden JSON、KeePass 2 XML、ChronoKey JSON。导出:CSV / Bitwarden JSON / ChronoKey JSON。
import { newItem } from './model.js';
import { parseOtpauth } from './totp.js';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const csvEsc = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(csvEsc).join(',')).join('\r\n');

// 列名 → 字段 的模糊映射
const COLS = {
  title: ['name', 'title', '名称', '标题', 'account'],
  username: ['username', 'login_username', 'login', 'user', 'email', '用户名', '账号'],
  password: ['password', 'login_password', 'pass', '密码'],
  url: ['url', 'login_uri', 'website', 'web site', 'uri', 'origin', '网址'],
  totp: ['totp', 'login_totp', 'otp', 'otpauth', 'one-time password', '2fa'],
  notes: ['notes', 'note', 'comments', 'extra', '备注'],
  folder: ['folder', 'grouping', 'group', 'vault', '文件夹'],
  tags: ['tags', 'tag', '标签'],
  favorite: ['favorite', 'fav', 'favourite'],
};

function mapHeader(header) {
  const h = header.map((x) => x.trim().toLowerCase());
  const idx = {};
  for (const [key, names] of Object.entries(COLS)) {
    const i = h.findIndex((col) => names.includes(col));
    if (i >= 0) idx[key] = i;
  }
  return idx;
}

function totpFrom(raw) {
  if (!raw) return '';
  try {
    const p = parseOtpauth(raw);
    return raw.startsWith('otpauth://') ? raw : p.secret;
  } catch {
    return '';
  }
}

export function importCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw mkErr('csvEmpty');
  const idx = mapHeader(rows[0]);
  if (idx.password === undefined && idx.username === undefined) throw mkErr('csvUnknownColumns');
  const folderNames = new Set();
  const items = rows.slice(1).map((r) => {
    const g = (k) => (idx[k] !== undefined ? (r[idx[k]] || '').trim() : '');
    const folder = g('folder');
    if (folder) folderNames.add(folder);
    return {
      folder,
      item: newItem('login', {
        title: g('title') || g('url').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '未命名',
        fields: { username: g('username'), password: r[idx.password] ?? '', url: g('url'), totp: totpFrom(g('totp')) },
        notes: g('notes'),
        tags: g('tags') ? g('tags').split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [],
        favorite: /^(1|true|yes|\*)$/i.test(g('favorite')),
      }),
    };
  });
  return withFolders(items, [...folderNames]);
}

function withFolders(pairs, names) {
  const folders = names.map((name) => ({ id: crypto.randomUUID(), name }));
  const byName = new Map(folders.map((f) => [f.name, f.id]));
  return {
    folders,
    items: pairs.map(({ folder, item }) => ({ ...item, folderId: folder ? byName.get(folder) : null })),
  };
}

// ---------- Bitwarden JSON(未加密导出) ----------
export function importBitwardenJson(obj) {
  if (obj.encrypted) throw mkErr('bitwardenEncrypted');
  const fmap = new Map((obj.folders || []).map((f) => [f.id, f.name]));
  const pairs = (obj.items || []).map((b) => {
    const custom = (b.fields || []).map((f) => ({ id: crypto.randomUUID(), label: f.name, value: f.value ?? '', hidden: f.type === 1 }));
    const base = { title: b.name || '未命名', notes: b.notes || '', favorite: !!b.favorite, custom };
    let item;
    if (b.type === 1 || b.login) {
      item = newItem('login', { ...base, fields: {
        username: b.login?.username || '', password: b.login?.password || '',
        url: b.login?.uris?.[0]?.uri || '', totp: totpFrom(b.login?.totp),
      } });
    } else if (b.type === 3 && b.card) {
      const c = b.card;
      item = newItem('card', { ...base, fields: {
        holder: c.cardholderName || '', number: c.number || '', cvv: c.code || '', bank: c.brand || '',
        expiry: c.expMonth ? `${String(c.expMonth).padStart(2, '0')}/${String(c.expYear || '').slice(-2)}` : '',
      } });
    } else if (b.type === 4 && b.identity) {
      const d = b.identity;
      item = newItem('identity', { ...base, fields: {
        fullName: [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' '),
        email: d.email || '', phone: d.phone || '', idNumber: d.ssn || d.licenseNumber || '', passport: d.passportNumber || '',
      } });
    } else if (b.type === 5 && b.sshKey) {
      item = newItem('ssh', { ...base, fields: {
        publicKey: b.sshKey.publicKey || '', privateKey: b.sshKey.privateKey || '', fingerprint: b.sshKey.keyFingerprint || '',
      } });
    } else {
      item = newItem('note', { ...base, fields: { body: b.notes || '' }, notes: '' });
    }
    return { folder: fmap.get(b.folderId) || '', item };
  });
  return withFolders(pairs, [...new Set(pairs.map((p) => p.folder).filter(Boolean))]);
}

// ---------- KeePass 2 XML ----------
export function importKeepassXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw mkErr('xmlParse');
  if (!doc.querySelector('KeePassFile')) throw mkErr('notKeePassXml');
  const pairs = [];
  // here = 当前组相对根的路径(根组为 '')
  const walk = (group, here) => {
    for (const entry of group.querySelectorAll(':scope > Entry')) {
      const s = {};
      const custom = [];
      for (const st of entry.querySelectorAll(':scope > String')) {
        const k = st.querySelector('Key')?.textContent || '';
        const valEl = st.querySelector('Value');
        const v = valEl?.textContent || '';
        if (['Title', 'UserName', 'Password', 'URL', 'Notes', 'otp', 'TimeOtp-Secret-Base32'].includes(k)) s[k] = v;
        else if (v) custom.push({ id: crypto.randomUUID(), label: k, value: v, hidden: valEl?.getAttribute('ProtectInMemory') === 'True' });
      }
      const tags = (entry.querySelector(':scope > Tags')?.textContent || '').split(/[,;]/).map((t) => t.trim()).filter(Boolean);
      pairs.push({
        folder: here,
        item: newItem('login', {
          title: s.Title || '未命名',
          fields: { username: s.UserName || '', password: s.Password || '', url: s.URL || '', totp: totpFrom(s.otp || s['TimeOtp-Secret-Base32']) },
          notes: s.Notes || '', custom, tags,
        }),
      });
    }
    for (const g of group.querySelectorAll(':scope > Group')) {
      const name = g.querySelector(':scope > Name')?.textContent || '未命名';
      if (name === 'Recycle Bin' || name === '回收站') continue;
      walk(g, here ? `${here}/${name}` : name);
    }
  };
  const root = doc.querySelector('KeePassFile > Root > Group');
  if (root) walk(root, '');
  return withFolders(pairs, [...new Set(pairs.map((p) => p.folder).filter(Boolean))]);
}

// ---------- 自动识别 ----------
export function importAuto(name, text) {
  const t = text.trim();
  if (/\.xml$/i.test(name) || t.startsWith('<?xml') || t.startsWith('<KeePassFile')) return { format: 'KeePass XML', ...importKeepassXml(t) };
  if (t.startsWith('{')) {
    const obj = JSON.parse(t);
    if (obj.format === 'chronokey-export') return { format: 'ChronoKey JSON', items: obj.items || [], folders: obj.folders || [] };
    if (Array.isArray(obj.items)) return { format: 'Bitwarden JSON', ...importBitwardenJson(obj) };
    throw mkErr('unknownJsonFormat');
  }
  return { format: 'CSV', ...importCsv(t) };
}

// ---------- 导出(明文!仅用于迁移到其他管理器) ----------
export function exportCsv(items) {
  const rows = [['name', 'url', 'username', 'password', 'totp', 'notes', 'tags']];
  for (const i of items.filter((x) => !x.deletedAt && x.type === 'login')) {
    rows.push([i.title, i.fields.url, i.fields.username, i.fields.password, i.fields.totp, i.notes, i.tags.join(',')]);
  }
  return toCsv(rows);
}

export function exportBitwardenJson(data) {
  return JSON.stringify({
    encrypted: false,
    folders: data.folders.map((f) => ({ id: f.id, name: f.name })),
    items: data.items.filter((x) => !x.deletedAt && x.type === 'login').map((i) => ({
      id: i.id, folderId: i.folderId, type: 1, name: i.title, notes: i.notes, favorite: i.favorite,
      fields: i.custom.map((c) => ({ name: c.label, value: c.value, type: c.hidden ? 1 : 0 })),
      login: { username: i.fields.username, password: i.fields.password, totp: i.fields.totp || null, uris: i.fields.url ? [{ uri: i.fields.url }] : [] },
    })),
  }, null, 2);
}

export function exportChronoJson(data) {
  return JSON.stringify({ format: 'chronokey-export', version: 1, exportedAt: Date.now(), items: data.items.filter((x) => !x.deletedAt), folders: data.folders }, null, 2);
}
