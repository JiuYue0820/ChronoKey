'use strict';
// 保险库存储层:DEK/KEK 包裹、原子写入、快照备份、防暴力破解。
// 数据密钥 (DEK) 只在解锁期间存在于主进程内存,锁定时清零。

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('./crypto.cjs');

const VAULT_FILE = 'vault.ckv';
const GUARD_FILE = 'guard.json';
const PREFS_FILE = 'prefs.json';
const DATA_AAD = 'chronokey/vault/v1';
const KEY_AAD = 'chronokey/dek/v1';

class Vault {
  constructor(dir) {
    this.dir = dir;
    this.backupDir = path.join(dir, 'backups');
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.dek = null;
    this.lastSnapshot = 0;
    this.backupKeep = 20;
  }

  get file() { return path.join(this.dir, VAULT_FILE); }
  exists() { return fs.existsSync(this.file); }
  isUnlocked() { return this.dek !== null; }

  // ---------- 文件 IO ----------
  readVault() { return JSON.parse(fs.readFileSync(this.file, 'utf8')); }

  atomicWrite(file, content) {
    const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
      fs.writeSync(fd, content);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
  }

  readJson(name, fallback) {
    try { return JSON.parse(fs.readFileSync(path.join(this.dir, name), 'utf8')); } catch { return fallback; }
  }
  writeJson(name, obj) { this.atomicWrite(path.join(this.dir, name), JSON.stringify(obj, null, 2)); }

  // 锁屏前可读的非敏感偏好(主题、自毁阈值等)
  getPrefs() { return { theme: 'system', contentProtection: true, wipeAfter: 0, ...this.readJson(PREFS_FILE, {}) }; }
  setPrefs(patch) {
    const allowed = ['theme', 'contentProtection', 'wipeAfter', 'bounds'];
    const next = this.getPrefs();
    for (const k of allowed) if (k in patch) next[k] = patch[k];
    this.writeJson(PREFS_FILE, next);
    return next;
  }

  // ---------- 防暴力破解 ----------
  getGuard() { return { failures: 0, lockedUntil: 0, lastFailure: 0, ...this.readJson(GUARD_FILE, {}) }; }

  checkGuard() {
    const g = this.getGuard();
    const wait = g.lockedUntil - Date.now();
    if (wait > 0) {
      const err = new Error(`尝试次数过多,请 ${Math.ceil(wait / 1000)} 秒后再试`);
      err.code = 'LOCKED_OUT';
      err.waitMs = wait;
      throw err;
    }
    return g;
  }

  recordFailure() {
    const g = this.getGuard();
    g.failures += 1;
    g.lastFailure = Date.now();
    // 前 3 次不延迟,之后指数退避:5s, 10s, 20s … 最长 15 分钟
    if (g.failures > 3) g.lockedUntil = Date.now() + Math.min(5000 * 2 ** (g.failures - 4), 15 * 60 * 1000);
    this.writeJson(GUARD_FILE, g);

    const { wipeAfter } = this.getPrefs();
    if (wipeAfter > 0 && g.failures >= wipeAfter) {
      this.selfDestruct();
      const err = new Error('失败次数达到上限,本地保险库已被擦除');
      err.code = 'WIPED';
      throw err;
    }
    return g;
  }

  resetGuard() {
    const prev = this.getGuard();
    this.writeJson(GUARD_FILE, { failures: 0, lockedUntil: 0, lastFailure: 0 });
    return prev;
  }

  // 用随机数据覆盖后删除主库文件(备份不动,由用户自己决定)
  selfDestruct() {
    try {
      const size = fs.statSync(this.file).size;
      fs.writeFileSync(this.file, crypto.randomBytes(size));
      fs.unlinkSync(this.file);
    } catch { /* 已不存在 */ }
    this.lock();
  }

  // 彻底重置("全部忘记"):主库 + 全部快照 + 失败计数。偏好(主题、窗口位置)保留。
  reset() {
    this.selfDestruct();
    for (const b of this.listBackups()) fs.rmSync(path.join(this.backupDir, b.name), { force: true });
    fs.rmSync(path.join(this.dir, GUARD_FILE), { force: true });
    this.lastSnapshot = 0;
  }

  // ---------- 创建 / 解锁 ----------
  async create(password, initialData) {
    if (this.exists()) throw new Error('保险库已存在');
    const kdf = { ...C.DEFAULT_KDF };
    const dek = crypto.randomBytes(32);
    const recoveryCode = C.generateRecoveryCode();
    const vault = { format: 'chronokey-vault', version: 1, kdf, createdAt: Date.now() };
    await this.wrapWithPassword(vault, dek, password);
    await this.wrapWithRecovery(vault, dek, recoveryCode);
    vault.data = C.seal(dek, Buffer.from(JSON.stringify(initialData)), DATA_AAD);
    vault.updatedAt = Date.now();
    this.atomicWrite(this.file, JSON.stringify(vault));
    this.dek = dek;
    this.resetGuard();
    return { recoveryCode };
  }

  async wrapWithPassword(vault, dek, password) {
    const salt = crypto.randomBytes(16);
    const kek = await C.deriveKey(password, salt, vault.kdf);
    vault.passwordSalt = C.b64(salt);
    vault.passwordKey = C.seal(kek, dek, KEY_AAD);
    C.wipe(kek);
  }

  async wrapWithRecovery(vault, dek, code) {
    const salt = crypto.randomBytes(16);
    const kek = await C.deriveKey(C.normalizeRecoveryCode(code), salt, vault.kdf);
    vault.recoverySalt = C.b64(salt);
    vault.recoveryKey = C.seal(kek, dek, KEY_AAD);
    C.wipe(kek);
  }

  async unwrap(vault, secret, which) {
    const salt = C.unb64(vault[`${which}Salt`]);
    const kek = await C.deriveKey(secret, salt, vault.kdf);
    try {
      return C.open(kek, vault[`${which}Key`], KEY_AAD);
    } catch {
      return null;
    } finally {
      C.wipe(kek);
    }
  }

  decryptData(vault, dek) {
    return JSON.parse(C.open(dek, vault.data, DATA_AAD).toString('utf8'));
  }

  async unlock(password) {
    this.checkGuard();
    const vault = this.readVault();
    const dek = await this.unwrap(vault, password, 'password');
    if (!dek) {
      const g = this.recordFailure();
      const err = new Error('主密码错误');
      err.code = 'BAD_PASSWORD';
      err.failures = g.failures;
      throw err;
    }
    const prev = this.resetGuard();
    this.dek = dek;
    return { data: this.decryptData(vault, dek), failedAttempts: prev.failures, lastFailure: prev.lastFailure };
  }

  // 用恢复代码解锁 → 必须立即设置新主密码,并轮换出新的恢复代码
  async recover(code, newPassword) {
    this.checkGuard();
    const vault = this.readVault();
    const dek = await this.unwrap(vault, C.normalizeRecoveryCode(code), 'recovery');
    if (!dek) {
      this.recordFailure();
      throw new Error('恢复代码无效');
    }
    this.resetGuard();
    await this.wrapWithPassword(vault, dek, newPassword);
    const recoveryCode = C.generateRecoveryCode();
    await this.wrapWithRecovery(vault, dek, recoveryCode);
    vault.updatedAt = Date.now();
    this.atomicWrite(this.file, JSON.stringify(vault));
    this.dek = dek;
    return { data: this.decryptData(vault, dek), recoveryCode };
  }

  async verifyPassword(password) {
    const dek = await this.unwrap(this.readVault(), password, 'password');
    const ok = !!dek;
    C.wipe(dek);
    return ok;
  }

  lock() {
    C.wipe(this.dek);
    this.dek = null;
  }

  requireUnlocked() {
    if (!this.dek) {
      const err = new Error('保险库已锁定');
      err.code = 'LOCKED';
      throw err;
    }
  }

  // ---------- 保存 ----------
  save(data, { snapshot = 'auto' } = {}) {
    this.requireUnlocked();
    const vault = this.readVault();
    vault.data = C.seal(this.dek, Buffer.from(JSON.stringify(data)), DATA_AAD);
    vault.updatedAt = Date.now();
    this.atomicWrite(this.file, JSON.stringify(vault));
    this.backupKeep = data?.settings?.backupKeep ?? this.backupKeep;
    if (snapshot === 'force' || (snapshot === 'auto' && Date.now() - this.lastSnapshot > 10 * 60 * 1000)) {
      this.snapshot();
    }
    return { updatedAt: vault.updatedAt };
  }

  async changePassword(oldPassword, newPassword) {
    this.requireUnlocked();
    const vault = this.readVault();
    const dek = await this.unwrap(vault, oldPassword, 'password');
    if (!dek) throw new Error('当前主密码错误');
    C.wipe(dek);
    await this.wrapWithPassword(vault, this.dek, newPassword);
    vault.updatedAt = Date.now();
    this.atomicWrite(this.file, JSON.stringify(vault));
    this.snapshot();
  }

  async rotateRecovery(password) {
    this.requireUnlocked();
    if (!(await this.verifyPassword(password))) throw new Error('主密码错误');
    const vault = this.readVault();
    const recoveryCode = C.generateRecoveryCode();
    await this.wrapWithRecovery(vault, this.dek, recoveryCode);
    vault.updatedAt = Date.now();
    this.atomicWrite(this.file, JSON.stringify(vault));
    return { recoveryCode };
  }

  // ---------- 快照备份(整个加密文件的副本,仍需主密码才能打开) ----------
  snapshot(keep = this.backupKeep) {
    if (!this.exists()) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `vault-${stamp}.ckv`;
    fs.copyFileSync(this.file, path.join(this.backupDir, name));
    this.lastSnapshot = Date.now();
    const all = this.listBackups();
    for (const b of all.slice(keep)) fs.rmSync(path.join(this.backupDir, b.name), { force: true });
    return name;
  }

  listBackups() {
    return fs.readdirSync(this.backupDir)
      .filter((f) => f.endsWith('.ckv'))
      .map((name) => {
        const st = fs.statSync(path.join(this.backupDir, name));
        return { name, size: st.size, time: st.mtimeMs };
      })
      .sort((a, b) => b.time - a.time);
  }

  // 恢复快照:当前文件先做一份快照,再替换。之后需要用"那个时间点"的主密码解锁。
  restoreBackup(name) {
    if (!/^vault-[\w-]+\.ckv$/.test(name)) throw new Error('非法的备份名');
    const src = path.join(this.backupDir, name);
    const probe = JSON.parse(fs.readFileSync(src, 'utf8'));
    if (probe.format !== 'chronokey-vault') throw new Error('备份文件无效');
    this.snapshot();
    fs.copyFileSync(src, this.file);
    this.lock();
  }

  // ---------- 历史超密钥 ----------
  async exportSuperKey(data, masterPassword, transferPassphrase) {
    this.requireUnlocked();
    if (!(await this.verifyPassword(masterPassword))) throw new Error('主密码错误');
    const payload = {
      app: 'ChronoKey',
      kind: 'history-super-key',
      version: 1,
      exportedAt: Date.now(),
      data,
    };
    return C.encodeSuperKey(payload, transferPassphrase || masterPassword);
  }

  // 新电脑上:用超密钥直接建库(口令即新主密码)
  async createFromSuperKey(superKey, passphrase) {
    if (this.exists()) throw new Error('保险库已存在,请在设置中选择"导入超密钥"');
    const payload = await C.decodeSuperKey(superKey, passphrase);
    if (payload.kind !== 'history-super-key' || !payload.data) throw new Error('超密钥内容不是 ChronoKey 数据');
    const { recoveryCode } = await this.create(passphrase, payload.data);
    return { data: payload.data, recoveryCode, exportedAt: payload.exportedAt };
  }

  // 已有保险库:只解开,合并由渲染进程完成后再 save
  async peekSuperKey(superKey, passphrase) {
    this.requireUnlocked();
    const payload = await C.decodeSuperKey(superKey, passphrase);
    if (payload.kind !== 'history-super-key' || !payload.data) throw new Error('超密钥内容不是 ChronoKey 数据');
    return { data: payload.data, exportedAt: payload.exportedAt };
  }
}

module.exports = { Vault };
