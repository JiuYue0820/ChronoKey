// ChronoKey Bridge popup:列出与当前标签页站点匹配的登录项,点击即回填,或复制密码。
// 与桌面应用的通信只有 127.0.0.1:39781 的令牌鉴权接口;应用锁定/桥关闭时这里会如实提示。
'use strict';

const PORT = 39781;
const $ = (id) => document.getElementById(id);
let TOKEN = '';

const saveToken = () => chrome.storage.local.set({ token: $('token').value.trim() });

function render(state, entries) {
  const list = $('list');
  if (state === 'badtoken') { list.innerHTML = '<div class="err">Token rejected — paste the pairing token from ChronoKey → Settings → Browser integration.</div>'; return; }
  if (state === 'locked') { list.innerHTML = '<div class="err">ChronoKey is locked — unlock the app and reopen this popup.</div>'; return; }
  if (state === 'down') { list.innerHTML = '<div class="err">Cannot reach ChronoKey. Is it running with the browser bridge enabled?</div>'; return; }
  if (!entries.length) { list.innerHTML = '<div class="empty">No matching logins for this site.</div>'; return; }
  list.innerHTML = '';
  for (const e of entries) {
    const li = document.createElement('li');
    const box = document.createElement('div');
    box.style.minWidth = '0';
    const b = document.createElement('b');
    b.textContent = e.title || e.username || '(login)';
    const s = document.createElement('small');
    s.textContent = e.username || '';
    box.append(b, s);
    const copy = document.createElement('button');
    copy.className = 'copy';
    copy.textContent = '⧉';
    copy.title = 'Copy password';
    copy.onclick = (ev) => { ev.stopPropagation(); navigator.clipboard.writeText(e.password); copy.textContent = '✓'; setTimeout(() => { copy.textContent = '⧉'; }, 900); };
    li.append(box, copy);
    li.onclick = () => fill(e);
    list.appendChild(li);
  }
}

// 在页面里回填:找到密码框与其用户名框,用原生 setter 赋值并派发 input/change(兼容 React 站点)
function fillOnPage(username, password) {
  const pw = [...document.querySelectorAll('input[type=password]')].find((el) => el.offsetParent !== null || document.body === el.parentElement);
  if (!pw) return 'nopassword';
  const set = (el, v) => {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const scope = pw.closest('form') || document;
  const user = scope.querySelector('input[type=email], input[autocomplete*=email i], input[autocomplete*=username i], input[name*=user i], input[name*=login i], input[name*=email i], input[type=text]');
  if (user && username) set(user, username);
  set(pw, password);
  pw.focus();
  return 'ok';
}

async function fill(e) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillOnPage,
      args: [e.username, e.password],
    });
    if (res?.result === 'nopassword') {
      await navigator.clipboard.writeText(e.password);
      window.close();
    } else window.close();
  } catch {
    // 受限页面(chrome://、商店等)无法注入:退回复制
    await navigator.clipboard.writeText(e.password);
    window.close();
  }
}

async function load() {
  render('loading');
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch { }
  const host = tab?.url ? new URL(tab.url).hostname.replace(/^www\./, '') : '';
  let r;
  try {
    r = await fetch(`http://127.0.0.1:${PORT}/bridge/v1/entries?host=${encodeURIComponent(host)}`, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'X-ChronoKey-Bridge': '1' },
    });
  } catch {
    render('down');
    return;
  }
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) return render('badtoken');
  if (r.status === 423) return render('locked');
  if (!r.ok) return render('down');
  const q = $('q').value.trim().toLowerCase();
  const filtered = q
    ? body.entries.filter((e) => (e.title + ' ' + e.username).toLowerCase().includes(q))
    : body.entries;
  render('ok', filtered);
}

$('token').addEventListener('change', () => { saveToken(); load(); });
$('q').addEventListener('input', () => load());
chrome.storage.local.get(['token'], ({ token }) => {
  TOKEN = token || '';
  $('token').value = TOKEN;
  load();
});
