import { useEffect, useRef } from 'react';

// 变焦方块矩阵:以表单为中心向外扩散的缩放波纹 + 指针附近的方块放大并转为朽葉色。
// 表单区域周围自动留白保证可读;遵循 prefers-reduced-motion;
// 窗口失焦或隐藏时停止动画,锁屏页长时间停留也不占 CPU。
const PITCH = 32;   // 8px 网格 × 4
const MAX = 14;     // 方块最大边长
const smooth = (v) => { const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t); };

export function MatrixBackdrop() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const t0 = performance.now();
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let colors = { base: '#838A2D', hot: '#E2943B' };
    let card = { cx: 0, cy: 0, hw: 0, hh: 0 };
    const pointer = { x: -1e4, y: -1e4, k: 0, target: 0 };

    const active = () => !reduce.matches && !document.hidden && document.hasFocus();

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      colors = {
        base: cs.getPropertyValue('--matrix').trim() || colors.base,
        hot: cs.getPropertyValue('--matrix-hot').trim() || colors.hot,
      };
    };

    const measure = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = host.querySelector('.lock-card')?.getBoundingClientRect();
      card = c
        ? { cx: c.left - r.left + c.width / 2, cy: c.top - r.top + c.height / 2, hw: c.width / 2, hh: c.height / 2 }
        : { cx: w / 2, cy: h / 2, hw: 0, hh: 0 };
    };

    const draw = (now) => {
      const t = (now - t0) / 1000;
      const moving = active();
      pointer.k += (pointer.target - pointer.k) * 0.08;
      ctx.clearRect(0, 0, w, h);
      const cols = Math.ceil(w / PITCH) + 1;
      const rows = Math.ceil(h / PITCH) + 1;
      const ox = (w - (cols - 1) * PITCH) / 2;
      const oy = (h - (rows - 1) * PITCH) / 2;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = ox + i * PITCH;
          const y = oy + j * PITCH;
          // 到表单矩形边缘的距离:越靠近表单方块越小,直至消失
          const edge = Math.hypot(Math.max(Math.abs(x - card.cx) - card.hw, 0), Math.max(Math.abs(y - card.cy) - card.hh, 0));
          const clear = smooth((edge - 16) / 140);
          if (clear <= 0) continue;
          const d = Math.hypot(x - card.cx, y - card.cy);
          const intro = moving ? smooth((t * 900 - d) / 260) : 1;       // 入场:由内向外逐格放大
          const ring = ((Math.sin(d * 0.022 - (reduce.matches ? 0 : t * 1.6)) + 1) / 2) ** 4;
          const hover = pointer.k * smooth(1 - Math.hypot(x - pointer.x, y - pointer.y) / 180);
          const s = (0.14 + 0.86 * Math.max(ring, hover)) * intro * clear;
          if (s < 0.05) continue;
          const size = MAX * s;
          ctx.globalAlpha = 0.12 + 0.5 * s;
          ctx.fillStyle = hover > ring ? colors.hot : colors.base;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now) => {
      raf = 0;
      if (now - last >= 32) { last = now; draw(now); }   // ≈30fps 足够顺滑
      if (active()) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && active()) raf = requestAnimationFrame(loop); };
    const redraw = () => { measure(); draw(performance.now()); kick(); };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.target = reduce.matches ? 0 : 1;
      kick();
    };
    const onLeave = () => { pointer.target = 0; };
    const onTheme = () => { readColors(); draw(performance.now()); };

    readColors();
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(host);
    const cardEl = host.querySelector('.lock-card');
    if (cardEl) ro.observe(cardEl);
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    window.addEventListener('focus', kick);
    window.addEventListener('blur', onLeave);
    document.addEventListener('visibilitychange', kick);
    host.addEventListener('scroll', redraw, { passive: true });
    reduce.addEventListener('change', redraw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('focus', kick);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', kick);
      host.removeEventListener('scroll', redraw);
      reduce.removeEventListener('change', redraw);
    };
  }, []);

  return <canvas ref={ref} className="matrix" aria-hidden="true" />;
}
