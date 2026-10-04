// 词典静态检查(不依赖运行时对象,直接扫源码,能抓到 JS/JSON 解析时被"后值覆盖"的重复键):
//   1) 重复键扫描 —— 词典文件里同名键出现两次是隐形地雷(解析时后值静默覆盖)
//   2) 错误文案覆盖 —— electron/errors.cjs 的每个静态文案必须是 en 及所有语言包 _lib.errors 的键
//   3) 裸中文 Error 扫描 —— lib/主进程源码不允许再散落未编目的中文 Error 字面量
//   4) 强度/审计文案覆盖 —— strength.js/audit.js 的中文文案必须能被 i18n 映射
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const CJK = /[\u4e00-\u9fff]/;

// 行式缩进栈扫描:同一作用域内同名键出现两次即重复。只适配本仓库词典的书写格式。
function findDupKeys(text) {
  const dups = [];
  const stack = [{ indent: -1, keys: new Map() }];
  const keyRe = /^(\s*)(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([A-Za-z_$][\w$]*))\s*:/;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('// ')) continue;
    const indent = line.match(/^\s*/)[0].length;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    if (/^\s*[{[]\s*,?\s*$/.test(line)) { stack.push({ indent, keys: new Map() }); continue; }
    const m = line.match(keyRe);
    if (m) {
      const key = m[2] ?? m[3] ?? m[4];
      const top = stack[stack.length - 1];
      if (top.keys.has(key)) dups.push(`${key} (第 ${(top.keys.get(key) || 0) + 1} 次出现)`);
      top.keys.set(key, (top.keys.get(key) || 0) + 1);
      if (/\{\s*$|\[\s*$/.test(line)) stack.push({ indent, keys: new Map() });
    }
  }
  return dups;
}

const dictFiles = [
  'src/i18n/zh.js', 'src/i18n/en.js', 'src/i18n/ru.js',
  'docs/js/i18n.en.js',
  // docs/js/i18n.js 只扫词典区(运行时区有 LANGUAGES 数组,同键循环会误报)
  ...readdirSync(path.join(root, 'locales')).filter((f) => f.endsWith('.json')).map((f) => `locales/${f}`),
  ...readdirSync(path.join(root, 'docs', 'js', 'lang')).filter((f) => f.endsWith('.js')).map((f) => `docs/js/lang/${f}`),
];

for (const f of dictFiles) {
  test(`无重复键: ${f}`, () => {
    let text = read(f);
    if (f === 'docs/js/i18n.js') text = text.split('// ---- 运行时 ----')[0];
    const dups = findDupKeys(text);
    assert.deepEqual(dups, [], `${f} 存在重复键(后值静默覆盖): ${dups.join('; ')}`);
  });
}

// ---- 错误文案覆盖 ----
const { CODES } = await import(pathToFileURL(path.join(root, 'electron', 'errors.cjs')).href);
const en = (await import('../src/i18n/en.js')).default;

test('errors.cjs 静态文案全部收录在 en._lib.errors', () => {
  for (const [code, msg] of Object.entries(CODES)) {
    assert.ok(en._lib.errors[msg], `errors.cjs.${code} 的文案在 en._lib.errors 里没有键: ${msg}`);
  }
});

const packDir = path.join(root, 'locales');
for (const f of readdirSync(packDir).filter((x) => x.endsWith('.json') && x !== 'languages.json')) {
  const pack = JSON.parse(readFileSync(path.join(packDir, f), 'utf8'));
  test(`errors.cjs 文案收录在语言包 ${pack.code}`, () => {
    for (const [code, msg] of Object.entries(CODES)) {
      assert.ok(pack.dict._lib.errors[msg], `${pack.code}._lib.errors 缺少键: ${msg} (${code})`);
    }
  });
}

// ---- 裸中文 Error 扫描:lib/主进程不允许散落未编目的中文 Error 字面量 ----
// 允许的仅剩:动态模板(经 i18n.js 正则映射)与内部错误/网络层状态串(不会作为 UI 文案展示)。
const DYNAMIC_PREFIXES = ['不支持的算法: ', '密钥包含非法字符 "', '不支持的 KDF: ', '语言包不存在: '];
const INTERNAL_ALLOWED = ['非法来源', '重定向次数过多', '超时'];
const codeFiles = ['electron/vault.cjs', 'electron/crypto.cjs', 'electron/main.cjs', 'src/lib/totp.js', 'src/lib/importers.js'];

for (const f of codeFiles) {
  test(`无未编目中文 Error: ${f}`, () => {
    const text = read(f);
    const literals = [...text.matchAll(/new Error\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]).filter((s) => CJK.test(s));
    const bad = literals.filter((s) => !DYNAMIC_PREFIXES.some((p) => s.startsWith(p)) && !INTERNAL_ALLOWED.includes(s));
    assert.deepEqual(bad, [], `${f} 存在未编目的中文 Error 字面量,请改用 electron/errors.cjs 的 mkErr: ${bad.join(' | ')}`);
  });
}

// ---- 强度/审计文案覆盖 ----
test('strength.js 中文文案全部可映射', () => {
  const text = read('src/lib/strength.js');
  const literals = [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]).filter((s) => CJK.test(s));
  const units = ['秒', '分钟', '小时', '天', '年', '世纪']; // crackTime 动态拼接的单位词
  const bad = literals.filter((s) => !en._lib.strength[s] && !units.includes(s));
  assert.deepEqual(bad, [], `strength.js 存在无法映射的文案: ${bad.join(' | ')}`);
});

test('audit.js 中文文案全部可映射', () => {
  const text = read('src/lib/audit.js');
  const literals = [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]).filter((s) => CJK.test(s));
  // '出现在泄露字典中' 由 i18n.js auditDetail() 精确映射到 audit.d.breached
  const ok = ['出现在泄露字典中'];
  const bad = literals.filter((s) => !en._lib.audit[s] && !ok.includes(s));
  assert.deepEqual(bad, [], `audit.js 存在无法映射的文案: ${bad.join(' | ')}`);
});
