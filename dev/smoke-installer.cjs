// 安装器冒烟测试:构造离线本地源(latest.json + stub zip + languages.json + de.json),
// 以 /auto /source /dir /lang:de 跑完整安装,断言程序与语言包落位,最后清理。
// 运行:node dev/smoke-installer.cjs(要求先编译 installer/ChronoKeySetup.exe)
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const installer = path.join(root, 'installer', 'ChronoKeySetup.exe');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-instsmoke-'));
const srcDir = path.join(tmp, 'src');
const installDir = path.join(tmp, 'app');
fs.mkdirSync(srcDir);

let failed = false;
const ok = (cond, name) => {
  console.log((cond ? '[PASS] ' : '[FAIL] ') + name);
  if (!cond) failed = true;
};

// stub zip:单个 ChronoKey.exe 占位文件(用 PowerShell 压缩,免去 zip 依赖)
const stubDir = path.join(tmp, 'stub');
fs.mkdirSync(stubDir);
fs.writeFileSync(path.join(stubDir, 'ChronoKey.exe'), 'ChronoKey stub for installer smoke test');
execFileSync('powershell', ['-NoProfile', '-Command',
  `Compress-Archive -Path '${stubDir}\\*' -DestinationPath '${path.join(srcDir, 'test.zip')}' -Force`]);

const zipBuf = fs.readFileSync(path.join(srcDir, 'test.zip'));
const zipSha = crypto.createHash('sha256').update(zipBuf).digest('hex');

// 最小德语语言包 + 清单(installer 的 LangEntry 正则要求键序 code,label,file,sha256)
const dePack = JSON.stringify({ code: 'de', label: 'Deutsch', dict: { ui: { close: 'Schließen' } } }, null, 2);
fs.writeFileSync(path.join(srcDir, 'de.json'), dePack);
const deSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(srcDir, 'de.json'))).digest('hex');
fs.writeFileSync(path.join(srcDir, 'languages.json'), JSON.stringify({
  version: '0.0.1-smoke',
  languages: [{ code: 'de', label: 'Deutsch', file: 'de.json', sha256: deSha }],
}, null, 2));
fs.writeFileSync(path.join(srcDir, 'latest.json'), JSON.stringify({
  version: '0.0.1-smoke',
  file: 'test.zip',
  size: zipBuf.length,
  sha256: zipSha,
}, null, 2));

// 安装器副本运行(安装完成会自删除)
const installerCopy = path.join(tmp, 'SetupCopy.exe');
fs.copyFileSync(installer, installerCopy);

const r = spawnSync(installerCopy, [
  '/auto', `/source:${srcDir}`, `/dir:${installDir}`, '/lang:de',
], { timeout: 90000 });
const exitedCleanly = r.status === 0;
ok(exitedCleanly, `安装器退出码 0(实际 ${r.status})`);
ok(fs.existsSync(path.join(installDir, 'ChronoKey.exe')), 'ChronoKey.exe 已安装');
ok(fs.existsSync(path.join(installDir, 'locales', 'de.json')), '语言包 de.json 已装到 locales\\');
if (fs.existsSync(path.join(installDir, 'locales', 'de.json'))) {
  const pack = JSON.parse(fs.readFileSync(path.join(installDir, 'locales', 'de.json'), 'utf8'));
  ok(pack.code === 'de' && pack.label === 'Deutsch', '语言包内容完整(code/label)');
}
ok(!fs.existsSync(installerCopy), '安装器副本已自删除');

// 清理:注册表卸载项 + 临时目录
try { execFileSync('reg', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ChronoKey', '/f'], { stdio: 'ignore' }); } catch { }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { }

console.log(failed ? 'INSTALLER SMOKE: FAIL' : 'INSTALLER SMOKE: OK');
process.exit(failed ? 1 : 0);
