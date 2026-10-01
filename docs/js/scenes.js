// 场景动画:首屏样机、超密钥迁移、安装程序复刻
import { reduceMotion, sleep, scramble, whenVisible } from './util.js';

// ---------- 首屏样机:3D 跟随指针倾斜 + 条目轮播 ----------
const ENTRIES = [
  { t: 'GitHub', s: 'alice@example.com' },
  { t: 'Google', s: 'alice@gmail.com' },
  { t: '招商银行', s: '•••• 4821' },
  { t: 'Steam', s: 'alice_gamer' },
  { t: 'OpenAI 开发', s: 'OPENAI_API_KEY' },
  { t: '家里 Wi-Fi', s: '安全笔记' },
  { t: 'homelab', s: 'ssh-ed25519' },
];

export function initHeroMock() {
  const mock = document.getElementById('hero-mock');
  const list = document.getElementById('mock-list');
  const title = document.getElementById('md-title'), sub = document.getElementById('md-sub'), pw = document.getElementById('md-pw');
  const strength = mock.querySelector('.md-strength');
  ENTRIES.forEach((e) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="av"></span><div><b></b><small></small></div>';
    li.querySelector('b').textContent = e.t;
    li.querySelector('small').textContent = e.s;
    list.appendChild(li);
  });
  const lis = [...list.children];

  let idx = 0, timer = 0;
  async function select(i) {
    idx = i;
    lis.forEach((li, k) => li.classList.toggle('sel', k === i));
    title.textContent = ENTRIES[i].t;
    sub.textContent = ENTRIES[i].s;
    strength.classList.remove('s4');
    pw.textContent = '••••••••••••••••';
    await sleep(500);
    // "显示密码"的解码效果
    mock.classList.add('decrypting');
    await scramble(pw, ['Moss-Paper-Lantern-River7', 'r8#Kq!vZ2m@Lw9xT', 'cedar.ember.quill.43', 'Wq7$nB2!pXk9'][i % 4], {
      duration: 800, charset: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%',
    });
    mock.classList.remove('decrypting');
    strength.classList.add('s4');
  }
  const start = () => { if (!timer && !reduceMotion.matches) timer = setInterval(() => select((idx + 1) % lis.length), 3200); };
  const stop = () => { clearInterval(timer); timer = 0; };
  select(0);
  whenVisible(mock, start, stop, 0);

  // 3D 倾斜
  const hero = mock.closest('.hero');
  hero.addEventListener('pointermove', (e) => {
    if (reduceMotion.matches || e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    mock.style.transform = `rotateY(${-8 + x * 14}deg) rotateX(${4 - y * 10}deg)`;
  });
  hero.addEventListener('pointerleave', () => { mock.style.transform = ''; });
}

// ---------- 超密钥:旧电脑的条目被"吸"进密钥,沿曲线飞到新电脑后逐个展开 ----------
export function initSuperKey() {
  const stage = document.getElementById('sk-stage');
  const oldBox = document.getElementById('sk-items-old'), newBox = document.getElementById('sk-items-new');
  const N = 12;
  for (let i = 0; i < N; i++) { oldBox.appendChild(document.createElement('i')); newBox.appendChild(document.createElement('i')); }
  const olds = [...oldBox.children], news = [...newBox.children];
  let running = false, visible = false;

  async function play() {
    if (running) return;
    running = true;
    while (visible) {
      olds.forEach((i) => i.classList.remove('gone'));
      news.forEach((i) => i.classList.add('gone'));
      stage.classList.remove('fly');
      await sleep(900);
      for (let i = N - 1; i >= 0; i--) { olds[i].classList.add('gone'); await sleep(55); }
      if (reduceMotion.matches) { news.forEach((i) => i.classList.remove('gone')); break; }
      void stage.offsetWidth;
      stage.classList.add('fly');
      await sleep(2200);
      for (let i = 0; i < N; i++) { news[i].classList.remove('gone'); await sleep(70); }
      await sleep(1000);
      for (let i = 0; i < N; i++) olds[i].classList.remove('gone');
      await sleep(2400);
    }
    running = false;
  }
  if (reduceMotion.matches) news.forEach((i) => i.classList.remove('gone'));
  whenVisible(stage, () => { visible = true; play(); }, () => { visible = false; }, 0.3);
}

// ---------- 安装程序的网页复刻:选择位置 → 下载 → 安装 → 完成,循环播放 ----------
export function initSetupWin() {
  const win = document.getElementById('setup-win');
  const $ = (id) => document.getElementById(id);
  const steps = [...$('sw-steps').children];
  const bar = $('sw-bar'), btn = $('sw-btn'), title = $('sw-title'), sub = $('sw-sub'), l = $('sw-l'), r = $('sw-r');

  // 侧栏的循环方阵(与安装程序同款:5×5 正弦波纹,完成时收拢成品牌标志)
  const anim = $('sw-anim');
  const cv = document.createElement('canvas');
  anim.appendChild(cv);
  const ctx = cv.getContext('2d');
  const BRAND = [1, .6, .35, .6, 1, .6, .35, .6, 1];
  let mode = 0, t = 0, settle = 0, visible = false;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function paint() {
    const size = anim.clientWidth, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); cv.style.width = cv.style.height = size + 'px'; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const pitch = size / 5, base = css('--matrix'), hot = css('--matrix-hot'), acc = css('--accent');
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const dx = x - 2, dy = y - 2, dist = Math.hypot(dx, dy);
      const wave = Math.sin(t * 2.2 - dist * 1.15) * 0.5 + 0.5;
      let s = mode === 1 ? 0.28 + 0.72 * wave : 0.42 + 0.4 * wave;
      const inner = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      const target = inner ? BRAND[(y - 1) * 3 + (x - 1)] : 0;
      s += (target - s) * settle;
      const alpha = inner ? 1 : 1 - settle;
      const w = pitch * 0.8 * s;
      if (w < 0.5 || alpha < 0.01) continue;
      const heat = mode === 1 ? wave ** 6 * (1 - settle) : 0;
      ctx.globalAlpha = alpha * (0.55 + 0.45 * Math.max(s, settle));
      ctx.fillStyle = settle > 0.5 && inner ? acc : heat > 0.5 ? hot : base;
      const cx = x * pitch + pitch / 2, cy = y * pitch + pitch / 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cx - w / 2, cy - w / 2, w, w, w * 0.12) : ctx.rect(cx - w / 2, cy - w / 2, w, w);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  (function loop() {
    if (visible && !reduceMotion.matches) {
      t += mode === 1 ? 0.075 : 0.035;
      settle = mode === 2 ? Math.min(1, settle + 0.05) : Math.max(0, settle - 0.05);
      paint();
    }
    setTimeout(() => requestAnimationFrame(loop), 33);
  })();

  const setStep = (i) => steps.forEach((s, k) => { s.className = k < i ? 'done' : k === i ? 'cur' : ''; });
  const press = async () => { btn.classList.add('press'); await sleep(150); btn.classList.remove('press'); };
  const MB = 135.2;
  let running = false;

  async function play() {
    if (running) return;
    running = true;
    while (visible) {
      mode = 0; setStep(0); bar.style.width = '0'; l.textContent = ''; r.textContent = '';
      title.textContent = '选择安装位置'; sub.textContent = '%LOCALAPPDATA%\\Programs\\ChronoKey'; btn.textContent = '开始安装'; btn.style.opacity = 1;
      await sleep(1800); await press();
      mode = 1; setStep(1); title.textContent = '正在下载'; sub.textContent = 'ChronoKey 0.1.0 · 8 线程'; btn.textContent = '取消';
      for (let p = 0; p <= 100 && visible; p += 2) {
        bar.style.width = p + '%';
        const speed = 2.1 + Math.sin(p / 9) * 0.3;
        l.textContent = `${(MB * p / 100).toFixed(1)} MB / ${MB} MB`;
        r.textContent = `${speed.toFixed(1)} MB/s · 剩余 ${Math.max(1, Math.ceil(MB * (100 - p) / 100 / speed))} 秒`;
        await sleep(70);
      }
      title.textContent = '正在校验'; sub.textContent = 'SHA-256 ✓'; r.textContent = '下载完成';
      await sleep(700);
      setStep(2); title.textContent = '正在安装'; sub.textContent = '正在解压文件…'; btn.style.opacity = 0.4;
      bar.style.width = '0'; await sleep(60);
      for (let p = 0; p <= 21 && visible; p++) { bar.style.width = (p / 21 * 100) + '%'; l.textContent = `${p} / 21 个文件`; r.textContent = ''; await sleep(60); }
      mode = 2; setStep(3); title.textContent = '安装完成'; sub.textContent = '关闭后安装程序会自动删除自身'; btn.textContent = '完成'; btn.style.opacity = 1;
      l.textContent = ''; await sleep(2600); await press();
      await sleep(600);
    }
    running = false;
  }
  whenVisible(win, () => { visible = true; paint(); play(); }, () => { visible = false; }, 0.3);
  paint();
}
