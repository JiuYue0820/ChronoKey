// ChronoKey 官网入口:各模块独立初始化,任一模块失败不影响其他部分
import { initMatrix } from './matrix.js';
import { reduceMotion, whenVisible } from './util.js';
import { initCrypto } from './crypto-demo.js';
import { initGenerator } from './gen-demo.js';
import { initTotp } from './totp-demo.js';
import { initHeroMock, initSuperKey, initSetupWin } from './scenes.js';

function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const sync = () => btn.setAttribute('aria-label', root.dataset.theme === 'dark' ? '切换到浅色' : '切换到深色');
  sync();
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = next; sync(); };
    try { localStorage.setItem('ck-theme', next); } catch {}
    // 支持时用 View Transitions 从按钮处圆形展开新主题
    if (document.startViewTransition && !reduceMotion.matches) {
      const r = btn.getBoundingClientRect();
      root.style.setProperty('--vt-x', `${r.left + r.width / 2}px`);
      root.style.setProperty('--vt-y', `${r.top + r.height / 2}px`);
      document.startViewTransition(apply);
    } else apply();
  });
}

function initNav() {
  const nav = document.getElementById('nav');
  const menu = document.getElementById('nav-menu');
  const links = document.getElementById('nav-links');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const close = () => { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', '打开菜单'); };
  menu.addEventListener('click', () => {
    const open = !links.classList.contains('open');
    links.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  });
  links.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // 当前所在的章节高亮
  const map = new Map([...links.querySelectorAll('a')].map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      map.forEach((a) => a.classList.remove('active'));
      map.get(e.target.id)?.classList.add('active');
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el) => io.observe(el));
}

function initCounters() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (!target || reduceMotion.matches) return;
    el.textContent = '0';
    whenVisible(el, () => {
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 1200);
        el.textContent = String(Math.round(target * (1 - (1 - k) ** 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
}

// 功能卡片:光斑跟随指针
function initSpotlight() {
  document.querySelectorAll('.feat').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

function safe(name, fn) {
  try { const r = fn(); if (r && r.catch) r.catch((e) => console.error(name, e)); }
  catch (e) { console.error(name, e); }
}

safe('theme', initTheme);
safe('nav', initNav);
safe('reveal', initReveal);
safe('counters', initCounters);
safe('spotlight', initSpotlight);
safe('hero-matrix', () => initMatrix(document.getElementById('hero-matrix'), { focus: '.hero-copy', pitch: 32 }));
safe('dl-matrix', () => initMatrix(document.getElementById('dl-matrix'), { focus: '.dl-copy', pitch: 28, quiet: true }));
safe('hero-mock', initHeroMock);
safe('crypto', initCrypto);
safe('generator', initGenerator);
safe('totp', initTotp);
safe('superkey', initSuperKey);
safe('setup', initSetupWin);
