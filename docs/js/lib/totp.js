// 时钥 TOTP 模块:RFC 6238 / RFC 4226,纯 WebCrypto 实现,离线运行。

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input) {
  const s = String(input).toUpperCase().replace(/[\s=-]/g, '');
  if (!s) throw new Error('密钥为空');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of s) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error(`密钥包含非法字符 "${ch}"(只允许 A-Z 和 2-7)`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function normalizeSecret(secret) {
  return String(secret || '').toUpperCase().replace(/[\s=-]/g, '');
}

const HASHES = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };

export async function hotp(secretBytes, counter, { digits = 6, algorithm = 'SHA1' } = {}) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: HASHES[algorithm] || 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export async function totp(config, now = Date.now()) {
  const { secret, period = 30, digits = 6, algorithm = 'SHA1' } = config;
  const counter = Math.floor(now / 1000 / period);
  const code = await hotp(base32Decode(secret), counter, { digits, algorithm });
  const remaining = period - (Math.floor(now / 1000) % period);
  return { code, remaining, period };
}

// otpauth://totp/GitHub:alice?secret=XXXX&issuer=GitHub&algorithm=SHA1&digits=6&period=30
export function parseOtpauth(uri) {
  const s = String(uri).trim();
  if (!/^otpauth:\/\//i.test(s)) {
    // 允许直接粘贴裸密钥
    base32Decode(s);
    return { secret: normalizeSecret(s), issuer: '', account: '', algorithm: 'SHA1', digits: 6, period: 30 };
  }
  const url = new URL(s);
  if (url.host.toLowerCase() !== 'totp') throw new Error('只支持 TOTP(基于时间)类型,不支持 HOTP');
  const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  let [labelIssuer, account] = label.includes(':') ? label.split(/:(.*)/s) : ['', label];
  const p = url.searchParams;
  const secret = normalizeSecret(p.get('secret'));
  base32Decode(secret);
  const algorithm = (p.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
  if (!HASHES[algorithm]) throw new Error('不支持的算法: ' + algorithm);
  const digits = Number(p.get('digits') || 6);
  const period = Number(p.get('period') || 30);
  if (![6, 7, 8].includes(digits)) throw new Error('位数只能是 6–8');
  if (!(period >= 5 && period <= 300)) throw new Error('周期超出范围');
  return {
    secret,
    issuer: p.get('issuer') || labelIssuer.trim(),
    account: (account || '').trim(),
    algorithm,
    digits,
    period,
  };
}

export function buildOtpauth({ secret, issuer = '', account = '', algorithm = 'SHA1', digits = 6, period = 30 }) {
  const label = encodeURIComponent(issuer ? `${issuer}:${account}` : account);
  const q = new URLSearchParams({ secret: normalizeSecret(secret), algorithm, digits: String(digits), period: String(period) });
  if (issuer) q.set('issuer', issuer);
  return `otpauth://totp/${label}?${q}`;
}

// 从图片(截图/文件)中解析二维码
export async function decodeQrFromBlob(blob) {
  const { default: jsQR } = await import('jsqr');
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  if (!res) throw new Error('图片中没有识别到二维码');
  return res.data;
}
