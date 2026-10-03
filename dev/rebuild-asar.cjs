'use strict';
// 离线重建 0.2.0:用 @electron/asar 重打 app.asar(新 dist + 现源码 electron/ + 原 node_modules/hash-wasm
// + 原 build/icon.png + 生产版 package.json),再用缓存里的 7za 离线重打 zip(保持原 19 文件布局)。
// 全程不碰网络。
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const asar = require('@electron/asar');

const ROOT = path.join(__dirname, '..');
const OLD_STAGE = path.join(__dirname, 'asar-stage-old'); // 上一步已解压的旧 asar 内容
const NEW_STAGE = path.join(__dirname, 'asar-stage-new');
const UNPACKED = path.join(ROOT, 'release', 'win-unpacked');

// 1) 组装新 stage:旧结构为模板
fs.rmSync(NEW_STAGE, { recursive: true, force: true });
fs.cpSync(OLD_STAGE, NEW_STAGE, { recursive: true });

// 2) 换入新 dist(vite build 产物,含 0a40fb0 修复)
fs.rmSync(path.join(NEW_STAGE, 'dist'), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'dist'), path.join(NEW_STAGE, 'dist'), { recursive: true });

// 3) 换入当前源码 electron/(确保 main/preload/vault/crypto 是最新提交版本)
fs.rmSync(path.join(NEW_STAGE, 'electron'), { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'electron'), path.join(NEW_STAGE, 'electron'), { recursive: true });

// 4) build/icon.png 同步(若源码有更新)
if (fs.existsSync(path.join(ROOT, 'build', 'icon.png'))) {
  fs.copyFileSync(path.join(ROOT, 'build', 'icon.png'), path.join(NEW_STAGE, 'build', 'icon.png'));
}

// 5) 打 asar(输出到 dev/ 下,避免卷进自己的包; 本包全部纯 JS/WASM, 无 unpack 需求)
const asarPath = path.join(__dirname, 'app-new.asar');
asar.createPackage(NEW_STAGE, asarPath).then(() => {
  console.log('asar rebuilt:', fs.statSync(asarPath).size, 'bytes (old was 2460459)');
}).catch((e) => {
  console.error('createPackage failed:', e.message);
  process.exit(1);
});
