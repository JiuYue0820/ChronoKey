// 生成 locales/languages.json:安装器的语言清单(与 latest.json 同源托管在 Releases)。
// 字段与键序是安装器里 LangEntry 正则的解析契约,不要改动顺序。
// 用法:node dev/gen-languages.cjs
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dir = path.join(root, 'locales');
const files = fs.readdirSync(dir).filter((f) => /^[a-z]{2,3}(-[A-Za-z]{2,4})?\.json$/.test(f));

const languages = files
  .map((f) => {
    const buf = fs.readFileSync(path.join(dir, f));
    const pack = JSON.parse(buf.toString('utf8'));
    if (pack.code !== f.replace(/\.json$/, '')) throw new Error(`${f} 的 code 与文件名不符`);
    return { code: pack.code, label: pack.label, file: f, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
  })
  .sort((a, b) => a.code.localeCompare(b.code));

const out = { version: pkg.version, languages };
fs.writeFileSync(path.join(dir, 'languages.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`languages.json: ${languages.length} packs, v${out.version}`);
for (const l of languages) console.log(`  ${l.code.padEnd(4)} ${l.label}`);
