// 条目类型定义与数据模型操作(纯函数,便于测试)

export const TYPES = {
  login: {
    label: '登录', icon: 'key',
    fields: [
      { key: 'username', label: '用户名' },
      { key: 'password', label: '密码', secret: true, generate: true },
      { key: 'url', label: '网址', kind: 'url' },
      { key: 'totp', label: '两步验证 (TOTP)', kind: 'totp' },
    ],
  },
  totp: {
    label: '验证码', icon: 'clock',
    fields: [
      { key: 'issuer', label: '服务商' },
      { key: 'account', label: '账户' },
      { key: 'totp', label: 'TOTP 密钥', kind: 'totp' },
      { key: 'backupCodes', label: '备用恢复码', secret: true, multiline: true },
    ],
  },
  card: {
    label: '银行卡', icon: 'card',
    fields: [
      { key: 'holder', label: '持卡人' },
      { key: 'number', label: '卡号', secret: true, mono: true },
      { key: 'expiry', label: '有效期', placeholder: 'MM/YY' },
      { key: 'cvv', label: '安全码', secret: true, mono: true },
      { key: 'pin', label: 'PIN', secret: true, mono: true },
      { key: 'bank', label: '发卡行' },
    ],
  },
  identity: {
    label: '身份', icon: 'person',
    fields: [
      { key: 'fullName', label: '姓名' },
      { key: 'email', label: '邮箱' },
      { key: 'phone', label: '电话' },
      { key: 'idNumber', label: '证件号', secret: true, mono: true },
      { key: 'passport', label: '护照号', secret: true, mono: true },
      { key: 'birthday', label: '生日' },
    ],
  },
  address: {
    label: '地址', icon: 'pin',
    fields: [
      { key: 'recipient', label: '收件人' },
      { key: 'phone', label: '电话' },
      { key: 'street', label: '街道', multiline: true },
      { key: 'city', label: '城市' },
      { key: 'region', label: '省 / 州' },
      { key: 'postal', label: '邮编' },
      { key: 'country', label: '国家' },
    ],
  },
  note: {
    label: '安全笔记', icon: 'note',
    fields: [{ key: 'body', label: '内容', multiline: true, secret: false }],
  },
  apikey: {
    label: 'API 密钥', icon: 'code',
    fields: [
      { key: 'service', label: '服务' },
      { key: 'keyId', label: 'Key ID', mono: true },
      { key: 'secret', label: 'Secret', secret: true, mono: true, generate: true },
      { key: 'env', label: '环境变量名', mono: true, placeholder: 'OPENAI_API_KEY' },
      { key: 'expires', label: '过期时间' },
    ],
  },
  ssh: {
    label: 'SSH 密钥', icon: 'terminal',
    fields: [
      { key: 'host', label: '主机', mono: true },
      { key: 'publicKey', label: '公钥', mono: true, multiline: true },
      { key: 'privateKey', label: '私钥', secret: true, mono: true, multiline: true },
      { key: 'passphrase', label: '私钥口令', secret: true },
      { key: 'fingerprint', label: '指纹', mono: true },
    ],
  },
};

export const TYPE_ORDER = ['login', 'totp', 'card', 'identity', 'address', 'note', 'apikey', 'ssh'];
const MAX_VERSIONS = 15;

export const uid = () => crypto.randomUUID();

// 附件限额:单文件 5 MB、每条目最多 20 个、整库 25 MB。规范化时静默丢弃超限条目,
// 保证旧数据/手工改过的 JSON 导入时不会撑爆保险库文件。
export const FILE_MAX = 5 * 1024 * 1024;
export const FILE_COUNT_MAX = 20;
export const VAULT_FILES_MAX = 25 * 1024 * 1024;
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  const out = [];
  const seen = new Set();
  for (const f of files) {
    if (out.length >= FILE_COUNT_MAX) break;
    if (!f || typeof f !== 'object') continue;
    const data = typeof f.data === 'string' && B64_RE.test(f.data) ? f.data : '';
    const pad = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
    const size = data ? Math.floor(data.length * 3 / 4) - pad : 0; // base64 解码后的精确字节数
    if (size <= 0 || size > FILE_MAX) continue;
    const id = typeof f.id === 'string' && f.id && !seen.has(f.id) ? f.id : uid();
    seen.add(id);
    out.push({
      id,
      name: String(f.name || 'file').slice(0, 255),
      size,
      type: String(f.type || 'application/octet-stream').slice(0, 100),
      data,
    });
  }
  return out;
}

export function emptyVault() {
  return {
    schema: 1,
    items: [],
    folders: [],
    settings: {
      autoLockMinutes: 5,
      clipboardSeconds: 20,
      lockOnSleep: true,
      lockOnMinimize: false,
      backupKeep: 20,
      passwordMaxAgeDays: 365,
      generator: null,
    },
    audit: [],
  };
}

export function newItem(type = 'login', patch = {}) {
  const now = Date.now();
  return {
    id: uid(),
    type,
    title: '',
    fields: {},
    custom: [],
    tags: [],
    folderId: null,
    favorite: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
    passwordChangedAt: now,
    versions: [],
    files: [],
    deletedAt: null,
    ...patch,
  };
}

// 更新条目:把旧版本压入历史(不含 versions 本身),便于回滚与密码历史
export function updateItem(prev, next) {
  const { versions, ...snapshot } = prev;
  const changed = JSON.stringify({ ...snapshot, updatedAt: 0 }) !== JSON.stringify({ ...next, versions: undefined, updatedAt: 0 });
  if (!changed) return prev;
  const now = Date.now();
  const pwChanged = (prev.fields.password || '') !== (next.fields.password || '')
    || (prev.fields.secret || '') !== (next.fields.secret || '');
  return {
    ...next,
    updatedAt: now,
    passwordChangedAt: pwChanged ? now : prev.passwordChangedAt,
    versions: [{ ...snapshot, savedAt: now }, ...(versions || [])].slice(0, MAX_VERSIONS),
  };
}

export function restoreVersion(item, index) {
  const v = item.versions[index];
  if (!v) return item;
  const { savedAt, ...rest } = v;
  return updateItem(item, { ...rest, id: item.id, deletedAt: null });
}

export function primarySecret(item) {
  return item.fields.password || item.fields.secret || item.fields.number || '';
}

export function subtitle(item) {
  const f = item.fields;
  switch (item.type) {
    case 'login': return f.username || hostOf(f.url) || '';
    case 'totp': return f.account || f.issuer || '';
    case 'card': return f.number ? `•••• ${String(f.number).replace(/\s/g, '').slice(-4)}` : f.bank || '';
    case 'identity': return f.email || f.fullName || '';
    case 'address': return [f.city, f.country].filter(Boolean).join(', ');
    case 'note': return (f.body || '').split('\n')[0].slice(0, 60);
    case 'apikey': return f.service || f.env || '';
    case 'ssh': return f.host || f.fingerprint || '';
    default: return '';
  }
}

export function hostOf(url) {
  if (!url) return '';
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// 全文搜索:标题、非机密字段、标签、备注、自定义字段名
export function matches(item, q) {
  if (!q) return true;
  const hay = [
    item.title, item.notes, ...item.tags,
    ...Object.entries(item.fields).filter(([k]) => !isSecretKey(item.type, k)).map(([, v]) => v),
    ...item.custom.filter((c) => !c.hidden).flatMap((c) => [c.label, c.value]),
    ...item.custom.filter((c) => c.hidden).map((c) => c.label),
  ].join('\n').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

export function isSecretKey(type, key) {
  return !!TYPES[type]?.fields.find((f) => f.key === key)?.secret || key === 'totp';
}

// 合并两个保险库(超密钥同步):按 id 合并,updatedAt 较新者胜,另一方进入版本历史
export function mergeVaults(local, incoming) {
  const map = new Map(local.items.map((i) => [i.id, i]));
  let added = 0;
  let updated = 0;
  for (const inc of (incoming.items || []).map(normalizeItem)) {
    const cur = map.get(inc.id);
    if (!cur) { map.set(inc.id, inc); added++; continue; }
    if ((inc.updatedAt || 0) > (cur.updatedAt || 0)) {
      const { versions: _v, ...snap } = cur;
      map.set(inc.id, { ...inc, versions: [{ ...snap, savedAt: Date.now() }, ...(inc.versions || [])].slice(0, MAX_VERSIONS) });
      updated++;
    }
  }
  const folders = [...local.folders];
  for (const f of incoming.folders || []) if (!folders.some((x) => x.id === f.id)) folders.push(f);
  return { data: { ...local, items: [...map.values()], folders }, added, updated };
}

// 补齐缺失字段:旧版本 / 导入 / 超密钥数据可能缺 fields、tags 等,界面直接访问会崩溃
export function normalizeItem(raw) {
  const i = raw && typeof raw === 'object' ? raw : {};
  const type = TYPES[i.type] ? i.type : 'note';
  const created = Number(i.createdAt) || Date.now();
  return {
    ...newItem(type),
    ...i,
    id: typeof i.id === 'string' && i.id ? i.id : uid(),
    type,
    title: String(i.title ?? ''),
    fields: i.fields && typeof i.fields === 'object' ? i.fields : {},
    custom: Array.isArray(i.custom) ? i.custom.map((c) => ({ id: c?.id || uid(), label: String(c?.label ?? ''), value: String(c?.value ?? ''), hidden: !!c?.hidden })) : [],
    tags: Array.isArray(i.tags) ? i.tags.map(String).filter(Boolean) : [],
    folderId: i.folderId || null,
    favorite: !!i.favorite,
    notes: String(i.notes ?? ''),
    createdAt: created,
    updatedAt: Number(i.updatedAt) || created,
    passwordChangedAt: Number(i.passwordChangedAt) || created,
    versions: Array.isArray(i.versions) ? i.versions.filter((v) => v && typeof v === 'object').map((v) => ({ ...v, fields: v.fields || {}, custom: v.custom || [], tags: v.tags || [] })) : [],
    files: normalizeFiles(i.files),
    deletedAt: i.deletedAt || null,
  };
}

export function normalizeVault(raw) {
  const base = emptyVault();
  const d = raw && typeof raw === 'object' ? raw : {};
  const folders = Array.isArray(d.folders) ? d.folders.filter((f) => f && f.id && f.name) : [];
  const folderIds = new Set(folders.map((f) => f.id));
  const seen = new Set();
  const items = (Array.isArray(d.items) ? d.items : []).map(normalizeItem).map((i) => {
    // 去重 id(React key 冲突会导致列表错乱)、清理指向已删除文件夹的引用
    const id = seen.has(i.id) ? uid() : i.id;
    seen.add(id);
    return { ...i, id, folderId: i.folderId && folderIds.has(i.folderId) ? i.folderId : null };
  });
  return {
    ...base,
    ...d,
    items,
    folders,
    settings: { ...base.settings, ...(d.settings && typeof d.settings === 'object' ? d.settings : {}) },
    audit: Array.isArray(d.audit) ? d.audit : [],
  };
}

export function appendAudit(data, action, detail = '') {
  const entry = { t: Date.now(), action, detail };
  return { ...data, audit: [entry, ...(data.audit || [])].slice(0, 500) };
}
