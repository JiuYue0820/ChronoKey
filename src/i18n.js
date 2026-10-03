// 时钥 i18n 核心(零第三方依赖,Node 安全:测试不 import 本模块,故默认输出恒为 zh)。
//
// 设计:
//   - 词表嵌套,键用点号路径,如 nav.all / type.login / gen.length。
//   - 内置语言:zh(默认)/ en / ru;其他语言来自语言包(registerLocale 运行时注册,
//     安装器可把 locales/<code>.json 装到程序旁或数据目录,主进程经 IPC 读出)。
//   - 缺键回落:当前语言 → en(非 en/zh 时)→ zh → 键本身(永不返回 undefined)。
//   - 语言偏好持久化在主进程 prefs(electron/vault.cjs 的 allowed 列表 + getPrefs 默认),
//     浏览器预览走 mock.js 的 setPrefs;切换时 setLang 通知订阅者,React 端据此重渲染。
//   - 若偏好的语言是语言包且尚未加载,先记下 preferred,等 registerLocale 到位后自动切过去。
import zh from './i18n/zh.js';
import en from './i18n/en.js';
import ru from './i18n/ru.js';

// 内置语言的菜单项(语言包的菜单项由 getLangs() 动态拼出,名字用语言包自带的本族语 label)
export const BASE_LANGS = [
  { value: 'zh', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
];

const dicts = { zh, en, ru };
const packCodes = new Set();   // 已注册的语言包 code
const packLabels = new Map();  // code -> 本族语名字(菜单显示用)
let current = 'zh';
let preferred = 'zh';          // 用户想要的语言(即使语言包还没加载)
const listeners = new Set();

// 注册一个语言包(缺键自动回落,同 code 重复注册则覆盖)。注册后通知订阅者,
// 让语言选择菜单和当前界面即时刷新(比如启动时偏好的语言包此刻才加载完)。
export function registerLocale(code, label, dict) {
  if (typeof code !== 'string' || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code)) return false;
  if (!dict || typeof dict !== 'object') return false;
  dicts[code] = dict;
  packCodes.add(code);
  packLabels.set(code, typeof label === 'string' && label ? label : code);
  if (preferred === code && current !== code) current = code;
  listeners.forEach((l) => l());
  return true;
}

export function getLangs() {
  const builtin = ['zh', 'en', 'ru'];
  const packs = [...packCodes]
    .filter((c) => !builtin.includes(c))
    .map((c) => ({ value: c, label: packLabels.get(c) || c }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
  return [...BASE_LANGS, ...packs];
}

// 启动时用:应用已持久化的语言(不触发订阅通知,避免重复渲染)
export function initLang(lang) {
  preferred = lang || 'zh';
  current = dicts[preferred] ? preferred : 'zh';
}

// 运行时切换:更新并通知所有订阅者(React 的 useSyncExternalStore 会重渲染)
export function setLang(lang) {
  preferred = lang || 'zh';
  current = dicts[preferred] ? preferred : 'zh';
  listeners.forEach((l) => l());
}

export function getLang() {
  return current;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function resolve(dict, key) {
  if (dict == null) return undefined;
  let v = dict;
  for (const part of key.split('.')) {
    if (v == null || typeof v !== 'object') return undefined;
    v = v[part];
  }
  return v;
}

// 取译文(缺键:非 zh 先回落 en,再回落 zh,最后回落键本身),支持 {var} 占位
export function t(key, vars) {
  let s = resolve(dicts[current], key);
  if (s == null && current !== 'zh') s = resolve(en, key);
  if (s == null) s = resolve(zh, key);
  if (s == null) s = key;
  if (vars && typeof s === 'string') {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  }
  return s;
}

// 条目类型标签(Sidebar 文字、详情/审计里的「登录/银行卡…」)
export function typeLabel(typeId) {
  return t(`type.${typeId}`);
}

// 字段标签(条目编辑/详情:账号、备注、网址…)
export function fieldLabel(fieldKey) {
  return t(`field.${fieldKey}`);
}

// 通用:把 lib/主进程/mock 的中文文案翻译成当前语言;未收录则原样返回,保证永不崩
export function tr(text) {
  if (text == null) return '';
  const s = String(text);
  if (current === 'zh') return s;
  // 两个带变量的动态报错(totp.js):先按模板匹配(UI 侧 totp 域名为 otp)
  let m = s.match(/^不支持的算法[:：]\s*(.+)$/);
  if (m) return t('otp.errAlg', { alg: m[1] });
  m = s.match(/^密钥包含非法字符\s*"(.*)"\s*[(（]只允许 A-Z 和 2-7[)）]$/);
  if (m) return t('otp.errChar', { ch: m[1] });
  const map = dicts[current]._lib?.errors;
  return map && map[s] ? map[s] : s;
}

// 密码强度标签(强/中/弱/很弱…)(lib/strength.js estimate().label;zh 原样返回)
export function strengthLabel(label) {
  if (current === 'zh') return label;
  const map = dicts[current]._lib?.strength;
  return map && map[label] ? map[label] : label;
}

// 密码强度警告(estimate().warnings[] 里的固定串)
export function strengthWarning(w) {
  if (current === 'zh') return w;
  const map = dicts[current]._lib?.strength;
  return map && map[w] ? map[w] : w;
}

// 破解时间(strength.crackTime 输出:「约 N 秒/分钟/…」「瞬间」「远超宇宙年龄」)
export function crackTimeLabel(text) {
  if (text == null) return '';
  const s = String(text);
  if (current === 'zh') return s;
  const m = s.match(/^约 (\d+) (秒|分钟|小时|天|年|世纪)$/);
  if (m) {
    const unit = { 秒: 'crack.sec', 分钟: 'crack.min', 小时: 'crack.hour', 天: 'crack.day', 年: 'crack.year', 世纪: 'crack.century' }[m[2]];
    return t(unit, { n: m[1] });
  }
  if (s === '瞬间') return t('crack.instant');
  if (s === '远超宇宙年龄') return t('crack.forever');
  return s;
}

// 审计详情(lib/audit.js issues.*.detail 模板串;zh 原样返回)
export function auditDetail(detail) {
  if (detail == null) return '';
  const s = String(detail);
  if (current === 'zh') return s;
  if (s === '出现在泄露字典中') return t('audit.d.breached');
  let m = s.match(/^与 (\d+) 个条目相同$/);
  if (m) return t('audit.d.reused', { n: m[1] });
  m = s.match(/^(\d+) 天未更换$/);
  if (m) return t('audit.d.old', { n: m[1] });
  m = s.match(/^(\d+) 位$/);
  if (m) return t('audit.d.short', { n: m[1] });
  m = s.match(/^(.+) · (\d+) bit$/);
  if (m) return `${strengthLabel(m[1])} · ${m[2]} bits`;
  m = s.match(/^(.+) 支持两步验证$/);
  if (m) return t('audit.d.no2fa', { host: m[1] });
  return s;
}

// 审计等级(runAudit().grade:优秀/良好/需改进/危险)
export function auditGrade(grade) {
  if (current === 'zh') return grade;
  const map = dicts[current]._lib?.audit;
  return map && map[grade] ? map[grade] : grade;
}

// 相对时间(列表里的「刚刚 / 3 分钟前 / 5 天前」)
export function relTimeLabel(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return t('rel.just');
  if (d < 3600) return t('rel.min', { n: Math.floor(d / 60) });
  if (d < 86400) return t('rel.hour', { n: Math.floor(d / 3600) });
  if (d < 86400 * 30) return t('rel.day', { n: Math.floor(d / 86400) });
  const tag = { zh: 'zh-CN', en: 'en-US' }[current] || current;
  try { return new Date(ts).toLocaleDateString(tag); } catch { return new Date(ts).toLocaleDateString(); }
}
