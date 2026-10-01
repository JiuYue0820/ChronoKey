// 变焦方块矩阵(与应用锁屏同源):从焦点区域向外扩散的正弦缩放波纹,
// 指针附近的方块放大并转为朽葉色;焦点区域周围留白保证文字可读。
// 不在视口、页面隐藏或 prefers-reduced-motion 时停止动画。
const smooth = (v) => { const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t); };

export function initMatrix(canvas, { focus, pitch = 32, quiet = false } = {}) {
  if (!canvas) return;
  const host = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const MAX = pitch * 0.44;
  const t0 = performance.now();
  let w = 0, h = 0, raf = 0, last = 0, visible = false;
  let colors = { base: '#838A2D', hot: '#C9782A' };
  let card = { cx: 0, cy: 0, hw: 0, hh: 0 };
  const pointer = { x: -1e4, y: -1e4, k: 0, target: 0 };
  // 点击产生的冲击波
  const shocks = [];

  const active = () => visible && !reduce.matches && !document.hidden;

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = { base: cs.getPropertyValue('--matrix').trim() || colors.base, hot: cs.getPropertyValue('--matrix-hot').trim() || colors.hot };
  };

  const measure = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = focus && host.querySelector(focus)?.getBoundingClientRect();
    card = c && innerWidth >= 1024
      ? { cx: c.left - r.left + c.width / 2, cy: c.top - r.top + c.height / 2, hw: c.width / 2, hh: c.height / 2 }
      : { cx: w / 2, cy: h / 2, hw: 0, hh: 0 };
  };

  const draw = (now) => {
    const t = (now - t0) / 1000;
    const moving = !reduce.matches;
    pointer.k += (pointer.target - pointer.k) * 0.08;
    ctx.clearRect(0, 0, w, h);
    const cols = Math.ceil(w / pitch) + 1;
    const rows = Math.ceil(h / pitch) + 1;
    const ox = (w - (cols - 1) * pitch) / 2;
    const oy = (h - (rows - 1) * pitch) / 2;
    for (let i = shocks.length - 1; i >= 0; i--) if (t - shocks[i].t > 2.4) shocks.splice(i, 1);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = ox + i * pitch, y = oy + j * pitch;
        const edge = card.hw ? Math.hypot(Math.max(Math.abs(x - card.cx) - card.hw, 0), Math.max(Math.abs(y - card.cy) - card.hh, 0)) : 999;
        const clear = card.hw ? smooth((edge - 8) / 160) : 1;
        if (clear <= 0) continue;
        const d = Math.hypot(x - card.cx, y - card.cy);
        const intro = moving ? smooth((t * 900 - d) / 260) : 1;
        const ring = ((Math.sin(d * 0.022 - (moving ? t * 1.6 : 0)) + 1) / 2) ** 4;
        const hover = pointer.k * smooth(1 - Math.hypot(x - pointer.x, y - pointer.y) / 180);
        let shock = 0;
        for (const s of shocks) {
          const r = (t - s.t) * 520;
          const dd = Math.abs(Math.hypot(x - s.x, y - s.y) - r);
          shock = Math.max(shock, smooth(1 - dd / 60) * (1 - (t - s.t) / 2.4));
        }
        const hot = Math.max(hover, shock);
        const s = (0.12 + 0.88 * Math.max(ring * (quiet ? 0.6 : 1), hot)) * intro * clear;
        if (s < 0.05) continue;
        const size = MAX * s;
        ctx.globalAlpha = (quiet ? 0.08 : 0.12) + 0.5 * s;
        ctx.fillStyle = hot > ring ? colors.hot : colors.base;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  };

  const loop = (now) => {
    raf = 0;
    if (now - last >= 32) { last = now; draw(now); }
    if (active()) raf = requestAnimationFrame(loop);
  };
  const kick = () => { if (!raf && active()) raf = requestAnimationFrame(loop); };
  const redraw = () => { measure(); draw(performance.now()); kick(); };

  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    pointer.target = reduce.matches ? 0 : 1;
    kick();
  });
  host.addEventListener('pointerleave', () => { pointer.target = 0; });
  host.addEventListener('pointerdown', (e) => {
    if (reduce.matches || e.target.closest('a, button, input, .mock')) return;
    const r = canvas.getBoundingClientRect();
    shocks.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: (performance.now() - t0) / 1000 });
    kick();
  });

  readColors();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(canvas);
  new ResizeObserver(redraw).observe(host);
  new MutationObserver(() => { readColors(); draw(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', kick);
  reduce.addEventListener('change', redraw);
  redraw();
}
