// 验证码墙:用应用的 totp.js 实时计算 RFC 6238 验证码;数字翻牌式滚动
import { totp } from './lib/totp.js';
import { copyText, whenVisible } from './util.js';

// 公开的测试密钥(RFC 6238 附录示例与常见文档示例),与任何真实账户无关
const ACCOUNTS = [
  { name: 'GitHub', acct: 'alice@example.com', secret: 'JBSWY3DPEHPK3PXP', ic: 'G' },
  { name: 'Google', acct: 'alice@gmail.com', secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', ic: 'G' },
  { name: 'Steam', acct: 'alice_gamer', secret: 'KRSXG5CTMVRXEZLUKN2XAZLSKNSWG4TFOQ', ic: 'S' },
  { name: '微软账户', acct: 'alice@outlook.com', secret: 'MFRGGZDFMZTWQ2LKNNWG23TPOBYXE43U', ic: 'M' },
];
const C = 2 * Math.PI * 15;

function card(a) {
  const el = document.createElement('div');
  el.className = 'totp-card';
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.innerHTML = `
    <span class="tc-ic" aria-hidden="true"></span>
    <div><div class="tc-name"></div><div class="tc-acct"></div></div>
    <span></span>
    <div class="tc-code">
      <div class="tc-digits" aria-hidden="true"></div>
      <svg class="tc-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="t"/><circle cx="18" cy="18" r="15" class="f" stroke-dasharray="${C}"/></svg>
    </div>
    <span class="tc-sec" aria-hidden="true"></span>`;
  el.querySelector('.tc-ic').textContent = a.ic;
  el.querySelector('.tc-name').textContent = a.name;
  el.querySelector('.tc-acct').textContent = a.acct;
  const digits = el.querySelector('.tc-digits');
  for (let i = 0; i < 6; i++) {
    if (i === 3) { const g = document.createElement('span'); g.className = 'gap'; digits.appendChild(g); }
    const d = document.createElement('span');
    d.className = 'tc-digit';
    d.innerHTML = '<span>–</span>';
    digits.appendChild(d);
  }
  return el;
}

// 单个数字换值:旧数字向上滑出,新数字从下方滑入
function setDigit(slot, ch) {
  const cur = slot.lastElementChild;
  if (cur && cur.textContent === ch) return;
  const next = document.createElement('span');
  next.textContent = ch;
  next.className = 'in';
  slot.appendChild(next);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    next.className = '';
    if (cur) { cur.className = 'out'; setTimeout(() => cur.remove(), 520); }
  }));
}

export function initTotp() {
  const board = document.getElementById('totp-board');
  const items = ACCOUNTS.map((a) => {
    const el = card(a);
    board.appendChild(el);
    return { a, el, slots: [...el.querySelectorAll('.tc-digit')], ring: el.querySelector('.tc-ring .f'), sec: el.querySelector('.tc-sec'), code: '' };
  });
  items.forEach((it) => {
    const copy = () => it.code && copyText(it.code);
    it.el.addEventListener('click', copy);
    it.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); } });
  });

  let timer = 0;
  async function tick() {
    const now = Date.now();
    for (const it of items) {
      const { code, remaining, period } = await totp({ secret: it.a.secret }, now);
      it.code = code;
      [...code].forEach((c, i) => setDigit(it.slots[i], c));
      it.ring.style.strokeDashoffset = String(C * (1 - remaining / period));
      it.sec.textContent = remaining;
      it.el.classList.toggle('urgent', remaining <= 5);
      it.el.setAttribute('aria-label', `${it.a.name} 验证码 ${code},剩余 ${remaining} 秒,按下复制`);
    }
  }
  const start = () => { if (timer) return; tick(); timer = setInterval(tick, 1000); };
  const stop = () => { clearInterval(timer); timer = 0; };
  whenVisible(board, start, stop, 0);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  // 首屏样机里的验证码同样实时计算
  const otp = document.getElementById('md-otp'), ring = document.getElementById('md-ring');
  if (otp) {
    const r = 2 * Math.PI * 9;
    ring.style.strokeDasharray = String(r);
    const hero = async () => {
      const { code, remaining, period } = await totp({ secret: ACCOUNTS[0].secret });
      otp.textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
      ring.style.strokeDashoffset = String(r * (1 - remaining / period));
    };
    hero();
    setInterval(() => { if (!document.hidden) hero(); }, 1000);
  }
}
