'use strict';
// 从 zip 里解出的 asar 验证装的是不是新构建
const asar = require('@electron/asar');
const p = 'dev/ziptest/app.asar';
const buf = asar.extractFile(p, 'dist\\index.html');
const html = buf.toString();
const ref = html.match(/assets\/index-[A-Za-z0-9]+\.js/)[0];
console.log('JS bundle ref in ZIP asar index.html:', ref);
console.log('IS NEW BUILD (X0jpFPXk):', ref.includes('X0jpFPXk') ? 'YES' : 'NO (' + ref + ')');
const js = asar.extractFile(p, 'dist\\' + ref).toString();
console.log('bundle bytes:', js.length);
console.log('has i18n key set.tabAppearance:', js.includes('set.tabAppearance'));
console.log('has i18n key side.trash:', js.includes('side.trash'));
console.log('has TYPE_ORDER:', js.includes('TYPE_ORDER'));
