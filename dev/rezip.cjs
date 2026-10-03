'use strict';
// 离线重打 0.2.0 zip: 替换 win-unpacked 里的 app.asar → 用缓存的 7za 打 zip(顶层无前缀,与旧布局一致)
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const WU = path.join(ROOT, 'release', 'win-unpacked');
const OLD_ZIP = path.join(ROOT, 'release', 'ChronoKey-0.2.0-win-x64.zip');

// 1) 把新 asar 覆盖进 win-unpacked
const newAsar = path.join(__dirname, 'app-new.asar');
const targetAsar = path.join(WU, 'resources', 'app.asar');
fs.copyFileSync(newAsar, targetAsar);
console.log('app.asar replaced:', fs.statSync(targetAsar).size, 'bytes');

// 2) 定位缓存里的 7za
const cacheRoot = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache');
const za = path.join(cacheRoot, '7zip@1.0.0', '7zip-win-x64-1nrf7', 'bin', '7za.exe');
if (!fs.existsSync(za)) {
  console.error('7za not found at', za);
  process.exit(1);
}

// 3) 备份旧 zip, 重新打包(zip 顶层 = win-unpacked 内容, 无 win-unpacked/ 前缀)
const STAGE = path.join(ROOT, 'dev', 'zip-stage');
fs.rmSync(STAGE, { recursive: true, force: true });
fs.cpSync(WU, STAGE, { recursive: true });
// 清理 stage 里可能混入的旧 asar 备份等 —— 保持与 win-unpacked 完全一致
const zipPath = path.join(ROOT, 'release', 'ChronoKey-0.2.0-win-x64.zip');
if (fs.existsSync(zipPath)) fs.renameSync(zipPath, zipPath + '.bak-old');

const r = spawnSync(za, ['a', '-tzip', '-mx=9', zipPath, '*'], { cwd: STAGE, encoding: 'utf8' });
if (r.status !== 0) {
  console.error('7za failed:', r.stdout, r.stderr);
  process.exit(1);
}
console.log('zip rebuilt:', fs.statSync(zipPath).size, 'bytes');

// 4) 新旧 zip 文件清单对比(确保布局一致)
const list = (z) => execSync(`"${za}" l "${z}"`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  .split('\n').filter(l => /\S/.test(l.trim()) && !/^[0-9]{4}-/.test(l)).join('\n');
const oldNames = (fs.existsSync(zipPath + '.bak-old') ? execSync(`"${za}" l "${zipPath}.bak-old"`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }) : '').split('\n');
const newNames = execSync(`"${za}" l "${zipPath}"`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split('\n');
const norm = (lines) => lines.map(l => l.replace(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+/, '').replace(/^\s*\d+\s+/, '').trim()).filter(l => l && !/^-+$/.test(l) && !l.startsWith('Date') && !l.startsWith('Name') && !l.startsWith('New zip') && !l.startsWith('New Volume') && !l.startsWith('Length') && !l.startsWith('Blocks') && !l.startsWith('Method') && !/^[0-9]+$/.test(l));
const o = new Set(norm(oldNames).filter(Boolean));
const n = new Set(norm(newNames).filter(Boolean));
const missing = [...o].filter(x => !n.has(x));
const extra = [...n].filter(x => !o.has(x));
console.log('old entries:', o.size, '| new entries:', n.size);
console.log('missing in new:', missing.length ? missing : '(none)');
console.log('extra in new:', extra.length ? extra : '(none)');

// 5) SHA256
const crypto = require('crypto');
const sha = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
console.log('sha256:', sha);

// 6) 更新 latest.json
const lj = path.join(ROOT, 'release', 'latest.json');
const data = JSON.parse(fs.readFileSync(lj, 'utf8'));
data.sha256 = sha;
data.size = fs.statSync(zipPath).size;
fs.writeFileSync(lj, JSON.stringify(data, null, 2) + '\n');
console.log('latest.json updated:', JSON.stringify(data));

fs.rmSync(STAGE, { recursive: true, force: true });
console.log('DONE');
