// 生成器与强度评估演示:直接复用应用的 generator.js / strength.js
import { generate, generatorEntropy, DEFAULT_GEN } from './lib/generator.js';
import { estimate, crackTime } from './lib/strength.js';
import { copyText, reduceMotion } from './util.js';

const RANGES = {
  random: { label: '长度', key: 'length', min: 8, max: 64 },
  passphrase: { label: '单词数', key: 'words', min: 3, max: 10 },
  pin: { label: '位数', key: 'pinLength', min: 4, max: 12 },
};

function paintBars(el, score) {
  el.className = `meter-bars t${score}`;
  [...el.children].forEach((b, i) => b.classList.toggle('on', i <= score));
}

export function initGenerator() {
  const $ = (id) => document.getElementById(id);
  const opts = { ...DEFAULT_GEN };
  const out = $('gen-value'), range = $('gen-len'), rangeVal = $('gen-len-val'), rangeLabel = $('gen-len-label');
  const modeBtns = [...document.querySelectorAll('#gen-mode button')];
  const optBox = $('gen-opts');
  let value = '';

  function render() {
    value = generate(opts);
    out.textContent = '';
    const frag = document.createDocumentFragment();
    [...value].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch' + (/\d/.test(c) ? ' d' : /[^a-zA-Z\d]/.test(c) ? ' s' : '');
      s.textContent = c;
      if (!reduceMotion.matches) s.style.animationDelay = `${Math.min(i * 14, 500)}ms`;
      frag.appendChild(s);
    });
    out.appendChild(frag);
    out.setAttribute('aria-label', value);
    const bits = Math.round(generatorEntropy(opts));
    $('gen-entropy').textContent = `${bits} bit · ${crackTime(bits)}`;
    paintBars($('gen-bars'), bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4);
  }

  function setMode(mode) {
    opts.mode = mode;
    modeBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
    const r = RANGES[mode];
    rangeLabel.textContent = r.label;
    range.min = r.min; range.max = r.max; range.value = opts[r.key];
    range.setAttribute('aria-label', r.label);
    rangeVal.textContent = opts[r.key];
    optBox.hidden = mode !== 'random';
    render();
  }

  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  // 方向键切换模式(radiogroup 键盘行为)
  $('gen-mode').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const i = modeBtns.findIndex((b) => b.dataset.mode === opts.mode);
    const n = modeBtns[(i + (e.key === 'ArrowRight' ? 1 : modeBtns.length - 1)) % modeBtns.length];
    setMode(n.dataset.mode); n.focus();
  });
  range.addEventListener('input', () => {
    const key = RANGES[opts.mode].key;
    opts[key] = Number(range.value);
    rangeVal.textContent = range.value;
    render();
  });
  optBox.querySelectorAll('input').forEach((c) => c.addEventListener('change', () => { opts[c.dataset.opt] = c.checked; render(); }));
  $('gen-refresh').addEventListener('click', render);
  $('gen-copy').addEventListener('click', () => copyText(value));

  const tryIn = $('try-pw');
  const evaluate = () => {
    const r = estimate(tryIn.value);
    paintBars($('try-bars'), tryIn.value ? r.score : -1);
    $('try-label').textContent = tryIn.value ? `${r.label} · ${r.bits} bit` : '—';
    $('try-crack').textContent = tryIn.value ? `离线破解约需:${crackTime(r.bits)}` : '';
    const ul = $('try-warn');
    ul.textContent = '';
    r.warnings.forEach((w) => { const li = document.createElement('li'); li.textContent = w; ul.appendChild(li); });
  };
  tryIn.addEventListener('input', evaluate);

  setMode('random');
  evaluate();
}
