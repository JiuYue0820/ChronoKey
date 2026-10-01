// 离线密码强度估计:字符集熵 + 常见模式惩罚。
// 这是估计而非保证;真正随机生成的密码请以生成器熵为准。

// 最常见的泄露密码(节选)。完整离线字典可在"安全审计"中导入。
const COMMON = new Set(`123456 password 123456789 12345678 12345 qwerty 1234567 111111 1234567890 123123 abc123
1234 password1 iloveyou 1q2w3e4r 000000 qwerty123 zaq12wsx dragon sunshine princess letmein 654321 monkey 27653
1qaz2wsx 123321 qwertyuiop superman asdfghjkl 666666 888888 football baseball welcome admin login master hello
freedom whatever qazwsx trustno1 passw0rd starwars shadow michael jennifer 121212 aa123456 woaini 5201314 520520
woaini1314 a123456 qq123456 147258369 159753 112233 password123 admin123 root toor changeme default secret 7777777
abcd1234 11111111 987654321 asdf1234 qwer1234 1q2w3e 123qwe 123abc test test123 guest user 00000000 88888888
iloveyou1 lovely flower hottie loveme ashley bailey charlie donald jordan hunter ranger buster soccer harley`
  .split(/\s+/));

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', '1qaz2wsx3edc4rfv5tgb'];

function charsetSize(pw) {
  let n = 0;
  if (/[a-z]/.test(pw)) n += 26;
  if (/[A-Z]/.test(pw)) n += 26;
  if (/[0-9]/.test(pw)) n += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) n += 33;
  if (/[^\x00-\x7f]/.test(pw)) n += 100;
  return n || 1;
}

function sequencePenalty(pw) {
  const s = pw.toLowerCase();
  let run = 0;
  let penalty = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (d === 1 || d === -1 || d === 0) run++;
    else { if (run >= 2) penalty += run; run = 0; }
  }
  if (run >= 2) penalty += run;
  for (const row of KEYBOARD_ROWS) {
    for (let len = 4; len <= row.length; len++) {
      for (let i = 0; i + len <= row.length; i++) {
        if (s.includes(row.slice(i, i + len))) penalty = Math.max(penalty, len);
      }
    }
  }
  return penalty;
}

export function estimate(pw) {
  if (!pw) return { score: 0, bits: 0, label: '空', warnings: [] };
  const warnings = [];
  const lower = pw.toLowerCase();
  const unique = new Set(pw).size;

  let effectiveLen = pw.length - sequencePenalty(pw) * 0.75;
  if (unique < pw.length / 2) effectiveLen *= unique / (pw.length / 2);
  let bits = Math.max(0, effectiveLen) * Math.log2(charsetSize(pw));

  const stripped = lower.replace(/[^a-z]/g, '');
  const unleet = lower.replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o')
    .replace(/[$5]/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');
  if (COMMON.has(lower) || COMMON.has(stripped) || COMMON.has(unleet)) {
    bits = Math.min(bits, 10);
    warnings.push('这是最常见的泄露密码之一');
  } else if (unleet !== stripped && unleet.length >= 5 && unleet.length >= pw.length - 3
    // 只针对"像一个单词"的密码:不太长、除首字母外没有大写。否则随机密码也会被误判
    && pw.length <= 16 && /^[A-Za-z0-9@$!|]?[^A-Z]*$/.test(pw)) {
    // 单个单词 + 字母数字替换(如 P@ssw0rd):攻击字典会自动尝试这些变形
    bits = Math.min(bits, 36);
    warnings.push('只是把字母换成了相似的数字/符号,很容易被猜到');
  }
  if (/^(19|20)\d{2}$|(19|20)\d{2}[01]\d[0-3]\d/.test(pw)) { bits -= 8; warnings.push('包含日期,容易被猜到'); }
  if (/(.)\1{2,}/.test(pw)) warnings.push('包含重复字符');
  if (sequencePenalty(pw) >= 4) warnings.push('包含键盘序列或连续字符');
  if (pw.length < 12) warnings.push('长度少于 12 位');
  // 少于 12 位的密码,对离线破解而言上限就是"一般"
  if (pw.length < 12) bits = Math.min(bits, 59);
  bits = Math.max(0, Math.round(bits));

  const score = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  const label = ['非常弱', '弱', '一般', '强', '非常强'][score];
  return { score, bits, label, warnings };
}

// 按"每秒 1e10 次离线猜测"给出人类可读的破解时间
export function crackTime(bits) {
  const sec = 2 ** bits / 2 / 1e10;
  if (sec < 1) return '瞬间';
  const units = [[60, '秒'], [60, '分钟'], [24, '小时'], [365, '天'], [100, '年'], [Infinity, '世纪']];
  let v = sec;
  for (const [n, u] of units) {
    if (v < n) return `约 ${Math.round(v)} ${u}`;
    v /= n;
  }
  return '远超宇宙年龄';
}

export function isInDictionary(pw, dict) {
  if (!pw) return false;
  const l = pw.toLowerCase();
  return COMMON.has(l) || (dict ? dict.has(l) : false);
}
