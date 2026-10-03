'use strict';
// 检查旧 asar 的顶层结构 + 里面的 index.html / package.json,作为重建模板
const asar = require('@electron/asar');
const p = 'release/win-unpacked/resources/app.asar';
const files = asar.listPackage(p);
const tops = [...new Set(files.map((f) => f.replace(/^\\/, '').split('\\')[0]))];
console.log('total entries:', files.length);
console.log('top-level:', tops.join(', '));
console.log('dist files:', files.filter((f) => f.includes('\\dist\\')).slice(0, 10).join('\n'));
console.log('electron files:', files.filter((f) => f.includes('\\electron\\')).join('\n'));
console.log('--- index.html inside asar:');
console.log(asar.extractFile(p, '\\dist\\index.html').toString());
console.log('--- package.json inside asar (first 150 chars):');
console.log(asar.extractFile(p, '\\package.json').toString().slice(0, 150));
