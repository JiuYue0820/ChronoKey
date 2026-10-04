// ChronoKey 官网入口:各模块独立初始化,任一模块失败不影响其他部分
import { initMatrix } from './matrix.js';
import { reduceMotion, whenVisible } from './util.js';
import { initCrypto } from './crypto-demo.js';
import { initGenerator } from './gen-demo.js';
import { initTotp } from './totp-demo.js';
import { initHeroMock, initSuperKey, initSetupWin } from './scenes.js';
import { setSiteLang, getSiteLang, t, applyI18n, LANGUAGES } from './i18n.js';

function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const sync = () => btn.setAttribute('aria-label', root.dataset.theme === 'dark' ? t('theme.toLight') : t('theme.toDark'));
  sync();
  // 语言切换后 aria 文案也要跟上
  addEventListener('ck-lang-change', sync);
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

  const close = () => { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', t('nav.open')); };
  const open = () => { links.classList.add('open'); menu.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-label', t('nav.close')); };
  menu.addEventListener('click', () => { links.classList.contains('open') ? close() : open(); });
  links.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); closeLangMenu(); } });
  addEventListener('ck-lang-change', () => {
    menu.setAttribute('aria-label', links.classList.contains('open') ? t('nav.close') : t('nav.open'));
  });
  addEventListener('click', (e) => { if (!e.target.closest('#lang-wrap')) closeLangMenu(); });

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

// ---------- 语言菜单:zh + LANGUAGES 全部列出,点选即切换(首次切换动态加载词典) ----------
let langMenuOpen = false;

function closeLangMenu() {
  const menuEl = document.getElementById('lang-menu');
  const btn = document.getElementById('lang-toggle');
  if (!menuEl || !btn) return;
  langMenuOpen = false;
  menuEl.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}

function initLang() {
  const wrap = document.getElementById('lang-wrap');
  const btn = document.getElementById('lang-toggle');
  const label = document.getElementById('lang-label');
  const menuEl = document.getElementById('lang-menu');
  if (!wrap || !btn || !menuEl) return;

  // 菜单项:简体中文置顶(原生语言),其余按 LANGUAGES 顺序
  const items = [{ code: 'zh', label: '简体中文', short: '中' }, ...LANGUAGES];
  for (const { code, label: name } of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.dataset.lang = code;
    const span = document.createElement('span');
    span.textContent = name;
    const chk = document.createElement('span');
    chk.className = 'chk';
    chk.textContent = '✓';
    chk.setAttribute('aria-hidden', 'true');
    b.append(span, chk);
    b.addEventListener('click', () => {
      closeLangMenu();
      if (getSiteLang() !== code) setSiteLang(code);
    });
    menuEl.appendChild(b);
  }

  const sync = (lang) => {
    const cur = items.find((l) => l.code === lang);
    if (label) label.textContent = cur ? cur.short : lang.toUpperCase();
    menuEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
  };
  sync(getSiteLang());
  addEventListener('ck-lang-change', (e) => sync(e.detail));

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    langMenuOpen = !langMenuOpen;
    menuEl.hidden = !langMenuOpen;
    btn.setAttribute('aria-expanded', String(langMenuOpen));
  });
  btn.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLangMenu(); });
}

// 下载区元信息:从 GitHub API 拉取最新 release,动态填充版本/体积/SHA/链接;
// 失败(离线、限流)时保留页面内置的静态值。发布脚本只负责刷新静态回退值。
function initDlMeta() {
  const ver = document.getElementById('dl-version');
  if (!ver) return;
  const kb = (n) => Math.max(1, Math.round(n / 1024));
  const mb = (n) => (n / 1048576).toFixed(1);
  fetch('https://api.github.com/repos/JiuYue0820/ChronoKey/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((rel) => {
      if (!rel || typeof rel.tag_name !== 'string') return;
      const v = rel.tag_name.replace(/^v/, '');
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      const zip = assets.find((a) => a.name === `ChronoKey-${v}-win-x64.zip`);
      const setup = assets.find((a) => a.name === 'ChronoKeySetup.exe');
      ver.textContent = v;
      const zipBtn = document.getElementById('dl-zip');
      if (zip) {
        if (zipBtn) {
          zipBtn.href = zip.browser_download_url;
          const s = zipBtn.querySelector('small');
          if (s) s.textContent = ` · ${mb(zip.size)} MB`;
        }
        const sha = document.getElementById('dl-sha');
        if (sha && typeof zip.digest === 'string' && zip.digest.startsWith('sha256:')) sha.textContent = zip.digest.slice(7);
        const ps = document.querySelector('.dl-hash p.muted code');
        if (ps) ps.textContent = `Get-FileHash .\\ChronoKey-${v}-win-x64.zip`;
      }
      const setupBtn = document.getElementById('dl-setup');
      if (setup && setupBtn) {
        const s = setupBtn.querySelector('small');
        if (s) s.textContent = ` · ${kb(setup.size)} KB`;
      }
    })
    .catch(() => { });
}

function safe(name, fn) {
  try { const r = fn(); if (r && r.catch) r.catch((e) => console.error(name, e)); }
  catch (e) { console.error(name, e); }
}

safe('theme', initTheme);
safe('lang', initLang);
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
safe('dl-meta', initDlMeta);
