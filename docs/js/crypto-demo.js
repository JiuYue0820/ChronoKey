// 加密流水线演示:真实运行 Argon2id(hash-wasm,与应用相同参数)+ AES-256-GCM(WebCrypto)
import { sleep, hex, b64, scramble, reduceMotion } from './util.js';

const KDF = { m: 65536, t: 3, p: 1 };
const CELLS = 64; // 64 MiB → 64 格,每格 1 MiB

export function initCrypto() {
  const $ = (id) => document.getElementById(id);
  const pw = $('pipe-pw'), run = $('pipe-run'), pipe = run.closest('.pipe');
  const steps = Object.fromEntries([...document.querySelectorAll('.pipe .step')].map((s) => [s.dataset.step, s]));
  const mem = $('kdf-mem');
  for (let i = 0; i < CELLS; i++) mem.appendChild(document.createElement('i'));
  const cells = [...mem.children];
  const tamperBtn = $('tamper-btn'), decryptBtn = $('decrypt-btn'), result = $('tamper-result');
  let sealed = null, busy = false;

  const mark = (name, state) => {
    const s = steps[name];
    s.classList.toggle('active', state === 'active');
    s.classList.toggle('done', state === 'done');
  };

  // Argon2 运算期间,内存格按"填充 → 随机回访"的方式点亮,模拟内存困难函数的访问模式
  function animateMemory() {
    if (reduceMotion.matches) { cells.forEach((c) => c.classList.add('on')); return () => {}; }
    let i = 0, stop = false;
    const fill = setInterval(() => {
      if (i < CELLS) { cells[i].classList.add('on'); i++; return; }
      cells.forEach((c) => c.classList.remove('hot'));
      for (let k = 0; k < 4; k++) cells[(Math.random() * CELLS) | 0].classList.add('hot');
      if (stop) clearInterval(fill);
    }, 18);
    return () => { stop = true; setTimeout(() => { clearInterval(fill); cells.forEach((c) => { c.classList.remove('hot'); c.classList.add('on'); }); }, 40); };
  }

  async function derive(secret, salt) {
    const hw = window.hashwasm;
    if (!hw?.argon2id) throw new Error('Argon2 模块未加载');
    const out = await hw.argon2id({ password: secret, salt, parallelism: KDF.p, iterations: KDF.t, memorySize: KDF.m, hashLength: 32, outputType: 'binary' });
    return new Uint8Array(out);
  }

  async function encrypt() {
    if (busy) return;
    busy = true; run.disabled = true; tamperBtn.disabled = true; decryptBtn.disabled = true;
    result.textContent = ''; result.className = 'tamper-result';
    Object.keys(steps).forEach((k) => mark(k, null));
    cells.forEach((c) => c.classList.remove('on', 'hot'));
    ['out-salt', 'out-key', 'out-plain', 'out-cipher'].forEach((id) => { $(id).textContent = '—'; });
    $('out-kdf-time').textContent = '';
    try {
      const secret = pw.value || 'demo';
      const plain = JSON.stringify({ title: 'GitHub', username: 'alice@example.com', password: 'Moss-Paper-Lantern-River7' }, null, 1);

      mark('salt', 'active');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      await sleep(250);
      await scramble($('out-salt'), hex(salt));
      mark('salt', 'done');

      mark('kdf', 'active');
      const stopMem = animateMemory();
      const t0 = performance.now();
      const keyBytes = await derive(secret, salt);
      const ms = performance.now() - t0;
      await sleep(Math.max(0, 1300 - ms)); // 让内存格动画至少完整填满一次
      stopMem();
      await scramble($('out-key'), hex(keyBytes));
      $('out-kdf-time').textContent = `在你的浏览器里用了 ${Math.round(ms)} 毫秒、64 MiB 内存。攻击者每猜一次密码都要付出同样的代价。`;
      mark('kdf', 'done');

      mark('seal', 'active');
      const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
      keyBytes.fill(0);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
      $('out-plain').textContent = plain;
      await sleep(200);
      await scramble($('out-cipher'), b64(ct), { duration: 900, charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' });
      mark('seal', 'done');

      sealed = { key, iv, ct };
      mark('tamper', 'active');
      tamperBtn.disabled = false; decryptBtn.disabled = false;
    } catch (e) {
      result.textContent = '演示出错:' + e.message;
      result.className = 'tamper-result bad';
    } finally {
      busy = false; run.disabled = false;
    }
  }

  async function tryDecrypt(flip) {
    if (!sealed) return;
    const ct = sealed.ct.slice();
    const out = $('out-cipher');
    if (flip) {
      const byte = (Math.random() * ct.length) | 0;
      ct[byte] ^= 1 << ((Math.random() * 8) | 0);
      // 在密文展示中标出被改动的位置(Base64 每 3 字节对应 4 个字符)
      const s = b64(ct), at = Math.floor(byte / 3) * 4;
      out.innerHTML = '';
      out.append(s.slice(0, at));
      const mk = document.createElement('span'); mk.className = 'flip'; mk.textContent = s.slice(at, at + 4);
      out.append(mk, s.slice(at + 4));
    } else out.textContent = b64(sealed.ct);
    try {
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, sealed.key, ct);
      const obj = JSON.parse(new TextDecoder().decode(pt));
      result.textContent = `解密成功:${obj.title} / ${obj.password}`;
      result.className = 'tamper-result good';
    } catch {
      result.textContent = '认证失败,拒绝解密。哪怕只改动一个比特,GCM 标签也能发现。';
      result.className = 'tamper-result bad';
      if (!reduceMotion.matches) { pipe.classList.remove('shake'); void pipe.offsetWidth; pipe.classList.add('shake'); }
    }
    mark('tamper', 'done');
  }

  run.addEventListener('click', encrypt);
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') encrypt(); });
  tamperBtn.addEventListener('click', () => tryDecrypt(true));
  decryptBtn.addEventListener('click', () => tryDecrypt(false));

  // 第一次滚动到这里时自动演示一遍
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const go = () => (window.hashwasm ? encrypt() : setTimeout(go, 200));
    go();
  }, { threshold: 0, rootMargin: '0px 0px -30% 0px' }); // 卡片比视口高,用"顶部进入视口下方 70% 处"触发
  io.observe(pipe);
}
