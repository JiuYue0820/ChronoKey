// 各演示模块共用的小工具
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion.matches ? 0 : ms));

let toastTimer = 0;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('已复制'); }
  catch { toast('复制失败,请手动选择'); }
}

// 进入视口才运行的模块:离开视口时暂停,节省 CPU
export function whenVisible(el, onEnter, onLeave, threshold = 0.15) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? onEnter : onLeave)?.();
  }, { threshold });
  io.observe(el);
  return io;
}

export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

// 文字"解码"效果:随机字符逐位稳定成目标文本
export function scramble(el, text, { duration = 700, charset = '0123456789abcdef' } = {}) {
  if (reduceMotion.matches) { el.textContent = text; return Promise.resolve(); }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / duration);
      const fixed = Math.floor(text.length * k);
      let s = text.slice(0, fixed);
      for (let i = fixed; i < text.length; i++) s += text[i] === ' ' ? ' ' : charset[(Math.random() * charset.length) | 0];
      el.textContent = s;
      if (k < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}
