'use strict';
// ChronoKey 加密原语。全部使用经过审计的标准算法:
//   KDF:    Argon2id (hash-wasm, RFC 9106)
//   AEAD:   AES-256-GCM (Node crypto / OpenSSL)
//   随机数: crypto.randomBytes (CSPRNG)
// 不自创算法 —— "历史超密钥"只是对这些原语的封装格式。

const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { argon2id } = require('hash-wasm');

// 默认 KDF 参数:64 MiB 内存、3 轮、并行度 1(≈0.3–0.8s,视机器而定)
const DEFAULT_KDF = Object.freeze({ alg: 'argon2id', m: 65536, t: 3, p: 1 });
const KEY_LEN = 32;
const IV_LEN = 12;

const b64 = (buf) => Buffer.from(buf).toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64');

async function deriveKey(secret, salt, kdf = DEFAULT_KDF) {
  if (kdf.alg !== 'argon2id') throw new Error('不支持的 KDF: ' + kdf.alg);
  const out = await argon2id({
    password: secret,
    salt,
    parallelism: kdf.p,
    iterations: kdf.t,
    memorySize: kdf.m,
    hashLength: KEY_LEN,
    outputType: 'binary',
  });
  return Buffer.from(out);
}

// AES-256-GCM,aad 用于把密文绑定到上下文(防止拼接替换)
function seal(key, plaintext, aad) {
  const iv = crypto.randomBytes(IV_LEN);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return { iv: b64(iv), ct: b64(ct), tag: b64(c.getAuthTag()) };
}

function open(key, box, aad) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, unb64(box.iv));
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(unb64(box.tag));
  return Buffer.concat([d.update(unb64(box.ct)), d.final()]);
}

function wipe(buf) {
  if (buf && typeof buf.fill === 'function') buf.fill(0);
}

// ---------- 恢复代码:25 位 Crockford Base32,约 125 bit 熵 ----------
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateRecoveryCode() {
  const bytes = crypto.randomBytes(25);
  let s = '';
  for (const b of bytes) s += CROCKFORD[b & 31];
  return s.match(/.{5}/g).join('-');
}

function normalizeRecoveryCode(input) {
  return String(input)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
}

// ---------- CRC32(仅用于超密钥的输入错误检测,不是安全机制) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(str) {
  let c = 0xffffffff;
  for (const b of Buffer.from(str)) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

// ---------- 历史超密钥 (History Super Key) ----------
// 格式: CK1.<base64url(header+密文)>.<crc32>
// 负载 = gzip(JSON{ data, meta }) → AES-256-GCM(key = Argon2id(口令, 随机盐))
// GCM 认证标签保证完整性与真实性;CRC 只为了在耗时的 KDF 之前发现复制粘贴错误。
const SK_PREFIX = 'CK1';
const SK_MAGIC = Buffer.from('CKSK');

async function encodeSuperKey(payload, passphrase, kdf = DEFAULT_KDF) {
  const salt = crypto.randomBytes(16);
  const key = await deriveKey(passphrase, salt, kdf);
  try {
    const plain = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
    const header = Buffer.alloc(4 + 1 + 4 + 1 + 1 + 16);
    let o = 0;
    SK_MAGIC.copy(header, o); o += 4;
    header.writeUInt8(1, o); o += 1;                 // 版本
    header.writeUInt32BE(kdf.m, o); o += 4;          // Argon2 内存 KiB
    header.writeUInt8(kdf.t, o); o += 1;             // 迭代
    header.writeUInt8(kdf.p, o); o += 1;             // 并行
    salt.copy(header, o);
    const box = seal(key, plain, header);
    const body = Buffer.concat([header, unb64(box.iv), unb64(box.tag), unb64(box.ct)]).toString('base64url');
    const text = `${SK_PREFIX}.${body}`;
    return `${text}.${crc32(text)}`;
  } finally {
    wipe(key);
  }
}

function parseSuperKey(str) {
  const clean = String(str).replace(/\s+/g, '');
  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== SK_PREFIX) throw new Error('不是有效的历史超密钥(格式错误)');
  if (crc32(`${parts[0]}.${parts[1]}`) !== parts[2]) throw new Error('超密钥校验失败:内容不完整或复制时出错');
  const raw = Buffer.from(parts[1], 'base64url');
  if (raw.length < 27 + IV_LEN + 16 || !raw.subarray(0, 4).equals(SK_MAGIC)) throw new Error('超密钥头部损坏');
  const header = raw.subarray(0, 27);
  const kdf = { alg: 'argon2id', m: header.readUInt32BE(5), t: header.readUInt8(9), p: header.readUInt8(10) };
  if (kdf.m > 1048576 || kdf.t > 20 || kdf.p > 8) throw new Error('超密钥 KDF 参数超出允许范围');
  return {
    header,
    kdf,
    salt: header.subarray(11, 27),
    iv: raw.subarray(27, 27 + IV_LEN),
    tag: raw.subarray(27 + IV_LEN, 27 + IV_LEN + 16),
    ct: raw.subarray(27 + IV_LEN + 16),
  };
}

async function decodeSuperKey(str, passphrase) {
  const p = parseSuperKey(str);
  const key = await deriveKey(passphrase, p.salt, p.kdf);
  try {
    const plain = open(key, { iv: b64(p.iv), tag: b64(p.tag), ct: b64(p.ct) }, p.header);
    return JSON.parse(zlib.gunzipSync(plain).toString('utf8'));
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('超密钥内容损坏');
    throw new Error('口令错误,无法解开超密钥');
  } finally {
    wipe(key);
  }
}

// ---------- SSH ed25519 密钥(OpenSSH 格式) ----------
function sshString(buf) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(buf.length);
  return Buffer.concat([len, buf]);
}

function generateSshKey(comment = 'chronokey') {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubRaw = publicKey.export({ format: 'jwk' });
  const privRaw = privateKey.export({ format: 'jwk' });
  const pub = Buffer.from(pubRaw.x, 'base64url');
  const seed = Buffer.from(privRaw.d, 'base64url');
  const type = Buffer.from('ssh-ed25519');
  const pubBlob = Buffer.concat([sshString(type), sshString(pub)]);

  const check = crypto.randomBytes(4);
  let privSection = Buffer.concat([
    check, check,
    sshString(type), sshString(pub),
    sshString(Buffer.concat([seed, pub])),
    sshString(Buffer.from(comment)),
  ]);
  const pad = [];
  for (let i = 1; (privSection.length + pad.length) % 8 !== 0; i++) pad.push(i);
  privSection = Buffer.concat([privSection, Buffer.from(pad)]);

  const none = Buffer.from('none');
  const nkeys = Buffer.alloc(4); nkeys.writeUInt32BE(1);
  const blob = Buffer.concat([
    Buffer.from('openssh-key-v1\0'),
    sshString(none), sshString(none), sshString(Buffer.alloc(0)),
    nkeys, sshString(pubBlob), sshString(privSection),
  ]);
  const b = blob.toString('base64').match(/.{1,70}/g).join('\n');
  const fingerprint = 'SHA256:' + crypto.createHash('sha256').update(pubBlob).digest('base64').replace(/=+$/, '');
  wipe(seed);
  return {
    publicKey: `ssh-ed25519 ${pubBlob.toString('base64')} ${comment}`,
    privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----\n${b}\n-----END OPENSSH PRIVATE KEY-----\n`,
    fingerprint,
  };
}

module.exports = {
  DEFAULT_KDF,
  deriveKey,
  seal,
  open,
  wipe,
  b64,
  unb64,
  generateRecoveryCode,
  normalizeRecoveryCode,
  crc32,
  encodeSuperKey,
  decodeSuperKey,
  parseSuperKey,
  generateSshKey,
};
