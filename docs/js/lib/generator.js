// 密码生成器:全部使用 crypto.getRandomValues,并用拒绝采样消除取模偏差。
import WORDS from './wordlist.js';

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIGUOUS = /[Il1O0o|`'"]/g;

export function randomInt(max) {
  if (max <= 0) throw new Error('max must be > 0');
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

const pick = (s) => s[randomInt(s.length)];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const DEFAULT_GEN = {
  mode: 'random',
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
  words: 5,
  separator: '-',
  capitalize: true,
  addNumber: true,
  pinLength: 6,
};

export function generate(opts = DEFAULT_GEN) {
  const o = { ...DEFAULT_GEN, ...opts };
  if (o.mode === 'pin') {
    return Array.from({ length: o.pinLength }, () => pick(SETS.digits)).join('');
  }
  if (o.mode === 'passphrase') {
    const words = Array.from({ length: o.words }, () => {
      const w = WORDS[randomInt(WORDS.length)];
      return o.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
    });
    if (o.addNumber) {
      const i = randomInt(words.length);
      words[i] += String(randomInt(10));
    }
    return words.join(o.separator);
  }
  const pools = ['lower', 'upper', 'digits', 'symbols']
    .filter((k) => o[k])
    .map((k) => (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (!pools.length) pools.push(SETS.lower);
  const all = pools.join('');
  const len = Math.max(o.length, pools.length);
  // 每个启用的字符集至少出现一次
  const chars = pools.map(pick);
  while (chars.length < len) chars.push(pick(all));
  return shuffle(chars).join('');
}

// 生成器自身的理论熵(比强度估计更准确,因为知道生成方式)
export function generatorEntropy(opts = DEFAULT_GEN) {
  const o = { ...DEFAULT_GEN, ...opts };
  if (o.mode === 'pin') return o.pinLength * Math.log2(10);
  if (o.mode === 'passphrase') return o.words * Math.log2(WORDS.length) + (o.addNumber ? Math.log2(10 * o.words) : 0);
  let size = 0;
  for (const k of ['lower', 'upper', 'digits', 'symbols']) {
    if (o[k]) size += (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]).length;
  }
  return o.length * Math.log2(size || 26);
}
