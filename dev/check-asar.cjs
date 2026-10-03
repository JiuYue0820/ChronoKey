'use strict';
const asar = require('@electron/asar');
const p = 'dev/app-new.asar';
const files = asar.listPackage(p);
console.log('total entries:', files.length);
const distFiles = files.filter(f => f.startsWith('dist'));
console.log('dist entries:', distFiles.length);
distFiles.forEach(f => console.log(' ', f));
// verify index.html references the new JS hash
const idxHtml = asar.extractFile(p, 'index.html');
const html = idxHtml.readFileSync().toString();
idxHtml.close();
console.log('index.html asset refs:', (html.match(/assets\/[A-Za-z0-9._-]+/g) || []).join(' | '));
// verify the new JS contains the settings fix
const jsMatch = html.match(/assets\/index-[A-Za-z0-9]+\.js/);
if (jsMatch) {
  const jsBuf = asar.extractFile(p, 'dist/' + jsMatch[0].replace('assets/', 'assets/').replace('dist/', ''));
  const js = jsBuf.readFileSync().toString();
  jsBuf.close();
  console.log('settings fix present (item.label()):', js.includes('item.label()'));
  console.log('typeLabel sidebar present:', js.includes('typeLabel') || js.includes('TYPE_ORDER'));
} else {
  console.log('could not find index js ref in html');
}
