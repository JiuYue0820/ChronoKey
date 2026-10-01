'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const C = require('../electron/crypto.cjs');
const { Vault } = require('../electron/vault.cjs');

// 测试用低成本 KDF,生产默认值见 DEFAULT_KDF
const FAST = { alg: 'argon2id', m: 1024, t: 1, p: 1 };

test('Argon2id 已知向量 (RFC 9106 风格参数)', async () => {
  const k1 = await C.deriveKey('password', Buffer.from('somesaltsomesalt'), FAST);
  const k2 = await C.deriveKey('password', Buffer.from('somesaltsomesalt'), FAST);
  const k3 = await C.deriveKey('passwore', Buffer.from('somesaltsomesalt'), FAST);
  assert.equal(k1.length, 32);
  assert.deepEqual(k1, k2);
  assert.notDeepEqual(k1, k3);
});

test('AES-GCM 篡改检测与 AAD 绑定', () => {
  const key = Buffer.alloc(32, 7);
  const box = C.seal(key, Buffer.from('secret'), 'ctx');
  assert.equal(C.open(key, box, 'ctx').toString(), 'secret');
  assert.throws(() => C.open(key, box, 'other'));
  const bad = { ...box, ct: Buffer.from(Buffer.from(box.ct, 'base64').map((b, i) => (i === 0 ? b ^ 1 : b))).toString('base64') };
  assert.throws(() => C.open(key, bad, 'ctx'));
});

test('恢复代码格式与规范化', () => {
  const code = C.generateRecoveryCode();
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){4}$/);
  assert.equal(C.normalizeRecoveryCode(code.toLowerCase().replace(/-/g, ' ')), code.replace(/-/g, ''));
  assert.equal(C.normalizeRecoveryCode('oil'), '011');
});

test('历史超密钥往返、错误口令、复制错误', async () => {
  const payload = { kind: 'history-super-key', data: { items: [{ id: 'a', title: '测试 GitHub' }], settings: { x: 1 } } };
  const sk = await C.encodeSuperKey(payload, 'transfer-pass', FAST);
  assert.match(sk, /^CK1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  assert.deepEqual(await C.decodeSuperKey(sk, 'transfer-pass'), payload);
  // 带换行/空格粘贴依然可用
  assert.deepEqual(await C.decodeSuperKey(sk.replace(/(.{40})/g, '$1\n  '), 'transfer-pass'), payload);
  await assert.rejects(C.decodeSuperKey(sk, 'wrong'), /口令错误/);
  const broken = sk.slice(0, 20) + (sk[20] === 'A' ? 'B' : 'A') + sk.slice(21);
  await assert.rejects(C.decodeSuperKey(broken, 'transfer-pass'), /校验失败/);
});

test('SSH ed25519 生成 OpenSSH 格式', () => {
  const k = C.generateSshKey('me@host');
  assert.match(k.publicKey, /^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI[A-Za-z0-9+/=]+ me@host$/);
  assert.match(k.privateKey, /^-----BEGIN OPENSSH PRIVATE KEY-----\n/);
  assert.match(k.fingerprint, /^SHA256:/);
});

test('Vault:创建、解锁、错误密码退避、恢复代码、换密码、超密钥迁移', async (t) => {
  const orig = { ...C.DEFAULT_KDF };
  C.DEFAULT_KDF = FAST;
  t.after(() => { C.DEFAULT_KDF = orig; });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-'));
  const v = new Vault(dir);
  const data = { items: [{ id: '1', title: 'GitHub' }], settings: {} };
  const { recoveryCode } = await v.create('master-1', data);
  v.lock();
  assert.equal(v.isUnlocked(), false);

  // 磁盘上没有明文
  const raw = fs.readFileSync(path.join(dir, 'vault.ckv'), 'utf8');
  assert.ok(!raw.includes('GitHub'));

  for (let i = 0; i < 4; i++) await assert.rejects(v.unlock('nope'), /主密码错误/);
  await assert.rejects(v.unlock('master-1'), (e) => e.code === 'LOCKED_OUT');
  v.resetGuard();

  const r = await v.unlock('master-1');
  assert.deepEqual(r.data, data);
  v.save({ ...data, items: [...data.items, { id: '2', title: 'Mail' }] });
  v.lock();

  const rec = await v.recover(recoveryCode.toLowerCase(), 'master-2');
  assert.equal(rec.data.items.length, 2);
  assert.notEqual(rec.recoveryCode, recoveryCode);
  v.lock();
  await assert.rejects(v.unlock('master-1'));
  v.resetGuard();
  await v.unlock('master-2');

  await v.changePassword('master-2', 'master-3');
  const sk = await v.exportSuperKey(rec.data, 'master-3');
  v.lock();

  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-'));
  const v2 = new Vault(dir2);
  const imported = await v2.createFromSuperKey(sk, 'master-3');
  assert.equal(imported.data.items.length, 2);
  v2.lock();
  assert.equal((await v2.unlock('master-3')).data.items[1].title, 'Mail');

  assert.ok(v.listBackups().length >= 1);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(dir2, { recursive: true, force: true });
});

test('Vault.reset:删除主库、全部快照与失败计数,可重新创建', async (t) => {
  const orig = { ...C.DEFAULT_KDF };
  C.DEFAULT_KDF = FAST;
  t.after(() => { C.DEFAULT_KDF = orig; });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-'));
  const v = new Vault(dir);
  await v.create('master-1', { items: [], settings: {} });
  v.snapshot();
  v.lock();
  await assert.rejects(v.unlock('nope'));
  v.setPrefs({ theme: 'dark' });

  v.reset();
  assert.equal(v.exists(), false);
  assert.equal(v.isUnlocked(), false);
  assert.equal(v.listBackups().length, 0);
  assert.equal(v.getGuard().failures, 0);
  assert.equal(v.getPrefs().theme, 'dark');   // 偏好保留

  await v.create('master-2', { items: [], settings: {} });
  assert.equal(v.exists(), true);
  fs.rmSync(dir, { recursive: true, force: true });
});
