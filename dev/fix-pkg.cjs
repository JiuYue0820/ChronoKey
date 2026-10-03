'use strict';
// 用 asar.extractFile 把旧 asar 里的生产版 package.json 取出来放进新 stage
const asar = require('@electron/asar');
const fs = require('fs');
const buf = asar.extractFile('release/win-unpacked/resources/app.asar', 'package.json');
fs.writeFileSync('dev/asar-stage-new/package.json', buf);
const p = JSON.parse(buf.toString());
console.log('asar package.json -> main =', p.main, '| version =', p.version, '| deps =', JSON.stringify(p.dependencies));
