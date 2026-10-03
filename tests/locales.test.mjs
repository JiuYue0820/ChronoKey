// 语言包完整性测试:
//   - 应用语言包(locales/*.json)与内置 ru.js 必须与 en.js 键位一一对应
//   - 官网语言(docs/js/lang/*.js)必须与 i18n.en.js 键位一一对应
//   - {var} 占位符集合一致、HTML 标签一致、_lib 中文查找键不被翻译
// 翻译漏键/多键/改占位符都会在这里红,防止某个语言界面出英文兜底或渲染出坏标签。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const placeholders = (s) => (String(s).match(/\{[a-zA-Z_][a-zA-Z0-9]*\}/g) || []).sort().join(',');
const htmlTags = (s) => (String(s).match(/<\/?[a-zA-Z][^>]*>/g) || []).sort().join(',');
const flatKeys = (o, prefix = '') =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flatKeys(v, prefix + k + '.') : [prefix + k]));
const getByPath = (o, p) => p.split('.').reduce((v, c) => (v == null ? v : v[c]), o);

// ---------------- 应用词典 ----------------
import en from '../src/i18n/en.js';
import zh from '../src/i18n/zh.js';
import ru from '../src/i18n/ru.js';

const enKeys = flatKeys(en);
// zh 是 lib 层中文文案的源头,没有 _lib 映射段;audit.d 同理(仅非 zh 渲染时经 i18n.js 映射使用)
const stripLib = (o) => { const c = { ...o, audit: { ...o.audit } }; delete c._lib; delete c.audit.d; return c; };

test('内置词典 zh/en/ru 键位一致', () => {
  assert.deepEqual(flatKeys(stripLib(zh)).sort(), flatKeys(stripLib(en)).sort(), 'zh 与 en 键位不一致');
  assert.deepEqual(flatKeys(ru).sort(), [...enKeys].sort(), 'ru 与 en 键位不一致');
});

function checkAgainstEn(dict, name) {
  assert.deepEqual(flatKeys(dict).sort(), [...enKeys].sort(), `${name} 键位与 en 不一致`);
  for (const k of enKeys) {
    const ev = getByPath(en, k), tv = getByPath(dict, k);
    if (typeof ev !== 'string') continue;
    assert.equal(placeholders(tv), placeholders(ev), `${name}.${k} 占位符不一致`);
    // HTML 标签必须是 zh∪en 的子集:允许保留或省略强调标签(如 hero 高亮),禁止引入两边都没有的标签
    const allowed = new Set([...htmlTags(getByPath(zh, k) ?? '').split(','), ...htmlTags(ev).split(',')].filter(Boolean));
    for (const tag of htmlTags(tv).split(',').filter(Boolean)) {
      assert.ok(allowed.has(tag), `${name}.${k} 引入了 zh/en 都没有的 HTML 标签: ${tag}`);
    }
  }
}

test('ru 占位符与 HTML 一致', () => checkAgainstEn(ru, 'ru'));

const packDir = path.join(root, 'locales');
// languages.json 是安装器语言清单,不是语言包
const packFiles = readdirSync(packDir).filter((f) => f.endsWith('.json') && f !== 'languages.json');

test('语言包元信息与文件名一致', () => {
  for (const f of packFiles) {
    const pack = JSON.parse(readFileSync(path.join(packDir, f), 'utf8'));
    assert.equal(pack.code, f.replace(/\.json$/, ''), `${f} 的 code 字段与文件名不符`);
    assert.ok(typeof pack.label === 'string' && pack.label.length > 0, `${f} 缺少本族语 label`);
    assert.ok(pack.dict && typeof pack.dict === 'object', `${f} 缺少 dict`);
  }
});

for (const f of packFiles) {
  const pack = JSON.parse(readFileSync(path.join(packDir, f), 'utf8'));
  test(`语言包 ${pack.code} 键位/占位符/HTML 与 en 一致`, () => checkAgainstEn(pack.dict, pack.code));
  test(`语言包 ${pack.code} 的 _lib 查找键保持中文原文`, () => {
    // _lib 的键是 lib 层输出的中文文案(en 词典的键即原文),只允许翻译值
    assert.deepEqual(Object.keys(pack.dict._lib.errors).sort(), Object.keys(en._lib.errors).sort());
    assert.deepEqual(Object.keys(pack.dict._lib.strength).sort(), Object.keys(en._lib.strength).sort());
    assert.deepEqual(Object.keys(pack.dict._lib.audit).sort(), Object.keys(en._lib.audit).sort());
  });
}

// ---------------- 官网词典 ----------------
const { EN } = await import('../docs/js/i18n.en.js');
const { ZH: SITE_ZH, LANGUAGES } = await import('../docs/js/i18n.js');
const enSiteKeys = Object.keys(EN);
const siteLangDir = path.join(root, 'docs', 'js', 'lang');
const siteLangFiles = readdirSync(siteLangDir).filter((f) => f.endsWith('.js'));

for (const f of siteLangFiles) {
  const code = f.replace(/\.js$/, '');
  test(`官网语言 ${code} 键位/占位符/HTML 与 EN 一致`, async () => {
    const mod = await import(`../docs/js/lang/${f}`);
    const dict = mod[code.toUpperCase()];
    assert.ok(dict, `${f} 未导出 ${code.toUpperCase()}`);
    assert.deepEqual(Object.keys(dict).sort(), [...enSiteKeys].sort(), `${code} 键位与 EN 不一致`);
    for (const k of enSiteKeys) {
      assert.equal(placeholders(dict[k]), placeholders(EN[k]), `${code}.${k} 占位符不一致`);
      // 标签必须是 zh∪en 的子集(hero.t2 的强调标签可留可省)
      const allowed = new Set([...htmlTags(SITE_ZH[k]).split(','), ...htmlTags(EN[k]).split(',')].filter(Boolean));
      for (const tag of htmlTags(dict[k]).split(',').filter(Boolean)) {
        assert.ok(allowed.has(tag), `${code}.${k} 引入了 zh/en 都没有的 HTML 标签: ${tag}`);
      }
    }
    assert.equal(dict['brand.zh'], '', `${code} 的 brand.zh 应为空串`);
  });
}

test('官网语言注册表与 lang 目录一一对应', () => {
  // en 内置在 i18n.en.js(无独立语言文件),不在对比范围
  const registered = LANGUAGES.map((l) => l.code).filter((c) => c !== 'en').sort();
  const files = siteLangFiles.map((f) => f.replace(/\.js$/, '')).sort();
  assert.deepEqual(registered, files, 'docs/js/i18n.js 的 LANGUAGES 与 docs/js/lang/ 目录不一致');
});
