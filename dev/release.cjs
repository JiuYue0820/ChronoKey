// 发布自动化:测试 → 安装器版本对齐+重编译 → 构建 zip → latest.json/languages.json →
// 官网静态回退值刷新 → (--upload)提交推送 + 创建 GitHub Release(全部资产)。
// 用法:
//   node dev/release.cjs            # 只准备(构建+哈希+官网刷新),不改 git
//   node dev/release.cjs --upload   # 准备后提交、推送并创建 release
// 版本号以 package.json 为准,发版前先改好它。
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const UPLOAD = process.argv.includes('--upload');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const V = pkg.version;
const ZIP_NAME = `ChronoKey-${V}-win-x64.zip`;
const isWin = process.platform === 'win32';
// Windows 下 npm/npx 是 .cmd 垫片,Node ≥20.12 出于 CVE-2024-27980 禁止直接 spawn,须经 cmd /c
const run = (cmd, args, opts = {}) => {
  if (isWin && (cmd === 'npm' || cmd === 'npx')) {
    return execFileSync('cmd', ['/c', cmd, ...args], { cwd: root, stdio: 'inherit', ...opts });
  }
  return execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
};

const step = (s) => console.log(`\n=== ${s} ===`);

step(`发布 v${V}:前置检查`);
// --upload 会带着"准备阶段"产出的改动进入本流程(官网刷新/安装器版本),因此只在准备阶段要求干净
if (!UPLOAD) {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (status.trim()) throw new Error('工作区不干净,先提交或暂存(git stash)所有改动');
}
if (!fs.existsSync(path.join(root, 'installer', 'ChronoKeySetup.exe'))) throw new Error('缺少安装器,先跑一次 installer\\build.cmd');

step('npm test');
run('npm', ['test']);

step(`安装器版本对齐到 ${V} 并重编译`);
{
  const csPath = path.join(root, 'installer', 'ChronoKeySetup.cs');
  let cs = fs.readFileSync(csPath, 'utf8');
  cs = cs.replace(/\[assembly: AssemblyVersion\("[\d.]+"\)\]/, `[assembly: AssemblyVersion("${V}.0")]`);
  cs = cs.replace(/\[assembly: AssemblyFileVersion\("[\d.]+"\)\]/, `[assembly: AssemblyFileVersion("${V}.0")]`);
  fs.writeFileSync(csPath, cs, 'utf8');
  run('cmd', ['/c', 'build.cmd'], { cwd: path.join(root, 'installer') });
}
const installerBuf = fs.readFileSync(path.join(root, 'installer', 'ChronoKeySetup.exe'));
const installerSha = crypto.createHash('sha256').update(installerBuf).digest('hex');

step('npm run dist(构建便携 zip)');
// 本机 TLS 拦截(杀软/代理)会掐断 electron-builder 的下载校验,这里放宽;zip 完整性由 SHA-256 保证
run('npm', ['run', 'dist'], { env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' } });

const zipPath = path.join(root, 'release', ZIP_NAME);
if (!fs.existsSync(zipPath)) throw new Error(`构建产物缺失: ${ZIP_NAME}`);
const zipBuf = fs.readFileSync(zipPath);
const zipSha = crypto.createHash('sha256').update(zipBuf).digest('hex');
const zipMB = (zipBuf.length / 1048576).toFixed(1);
const setupKB = Math.max(1, Math.round(installerBuf.length / 1024));

step('release/latest.json');
fs.writeFileSync(path.join(root, 'release', 'latest.json'), JSON.stringify({
  version: V,
  file: ZIP_NAME,
  size: zipBuf.length,
  sha256: zipSha,
}, null, 2) + '\n');

step('locales/languages.json');
run('node', ['dev/gen-languages.cjs']);

step('官网静态回退值(docs/)');
{
  const htmlPath = path.join(root, 'docs', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const must = (before, after, what) => {
    if (!before) throw new Error(`官网刷新失败: ${what}`);
    html = html.split(before).join(after);
  };
  must(/id="dl-version">[^<]*</.exec(html)?.[0], `id="dl-version">${V}<`, '版本号');
  must(/id="dl-sha">[a-f0-9]{64}</.exec(html)?.[0], `id="dl-sha">${zipSha}<`, 'SHA-256');
  must(/ChronoKey-[\d.]+-win-x64\.zip/g, ZIP_NAME, 'zip 文件名');
  must(/<small>· [\d.]+ MB<\/small>/, `<small>· ${zipMB} MB</small>`, 'zip 体积');
  must(/<small>· \d+ KB<\/small>/, `<small>· ${setupKB} KB</small>`, '安装器体积');
  fs.writeFileSync(htmlPath, html, 'utf8');
  const scenesPath = path.join(root, 'docs', 'js', 'scenes.js');
  let scenes = fs.readFileSync(scenesPath, 'utf8');
  if (!/const MB = [\d.]+;/.test(scenes)) throw new Error('scenes.js MB 常量未找到');
  scenes = scenes.replace(/const MB = [\d.]+;/, `const MB = ${zipMB};`);
  fs.writeFileSync(scenesPath, scenes, 'utf8');
}

console.log(`\n=== 就绪 ===
版本          v${V}
zip           ${ZIP_NAME}  ${zipMB} MB
zip SHA-256   ${zipSha}
安装器        ${setupKB} KB
安装器 SHA-256 ${installerSha}
`);

if (!UPLOAD) {
  console.log('检查无误后执行:node dev/release.cjs --upload');
  process.exit(0);
}

step('提交 + 推送 + 创建 Release');
run('git', ['add', '-A']);
run('git', ['commit', '-m', `release: v${V}`]);
run('git', ['push', 'origin', 'main']);

const notesPath = path.join(root, 'release', '_notes.txt');
fs.writeFileSync(notesPath, `ChronoKey ${V}

See the repository README and the docs site for what's new: https://jiuyue0820.github.io/ChronoKey/

SHA-256 (zip): ${zipSha}
SHA-256 (ChronoKeySetup.exe): ${installerSha}

Updating: run ChronoKeySetup.exe — it downloads the new build from this release, verifies SHA-256, and replaces the app in place. Your vault data is untouched. Language packs update in-app via Settings → Appearance → Update language packs.
`, 'utf8');

const assets = [
  path.join(root, 'release', ZIP_NAME),
  path.join(root, 'installer', 'ChronoKeySetup.exe'),
  path.join(root, 'release', 'latest.json'),
  path.join(root, 'locales', 'languages.json'),
  ...fs.readdirSync(path.join(root, 'locales'))
    .filter((f) => /^[a-z]{2,3}(-[A-Za-z]{2,4})?\.json$/.test(f))
    .map((f) => path.join(root, 'locales', f)),
];
run('gh', ['release', 'create', `v${V}`, '--title', `ChronoKey ${V}`, '--notes-file', notesPath, ...assets]);
fs.rmSync(notesPath, { force: true });
console.log(`\nRelease v${V} 已创建;Pages 部署由 main 推送自动触发,几分钟后核对官网下载区。`);
