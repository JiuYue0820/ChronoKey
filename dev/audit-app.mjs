// 一次性驱动 Electron 应用完成整页检查:控制台错误、双语言逐页快照、交互冒烟
// 结果写入 dev/_audit.json,截图写入 dev/_shots/
import fs from 'node:fs';

const OUT = 'dev/_audit.json';
const SHOTS = 'dev/_shots';
fs.mkdirSync(SHOTS, { recursive: true });
const log = { console: [], exceptions: [], results: {} };

const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });

let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p(m); }
  else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    log.console.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  } else if (m.method === 'Runtime.exceptionThrown') {
    log.exceptions.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 300));
  }
});
const send = (method, params = {}) => new Promise((resolve) => { const mid = ++id; pending.set(mid, resolve); ws.send(JSON.stringify({ id: mid, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evalJs(expression) {
  const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (m.result?.exceptionDetails) return { error: m.result.exceptionDetails.exception?.description ?? m.result.exceptionDetails.text };
  return m.result?.result?.value;
}
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};

await send('Runtime.enable');
await send('Page.enable');
await sleep(800);

// ---------- 当前语言(启动态) ----------
log.results.startLang = await evalJs(`document.documentElement.lang`);
log.results.startText = await evalJs(`document.body.innerText.slice(0, 150).replace(/\\n/g, '|')`);

// 逐页走查(当前语言)
const pages = ['security', 'superkey', 'backup', 'data', 'account', 'appearance', 'about'];
for (const p of pages) {
  const r = await evalJs(`(async () => {
    const btn = [...document.querySelectorAll('.settings-nav button, [class*=settings] button')].find(b => b.dataset && b.dataset.tab === '${p}')
      || [...document.querySelectorAll('button')].find(b => (b.dataset?.tab ?? '') === '${p}');
    if (!btn) return 'NO-BUTTON';
    btn.click(); await new Promise(r => setTimeout(r, 350));
    return document.querySelector('.settings-title, h2')?.textContent + ' :: ' + document.body.innerText.slice(0, 200).replace(/\\n/g, '|');
  })()`);
  log.results['tab_' + p] = r;
  await shot('tab-' + p);
}

// 未解锁的其余页面(锁屏)截图
await shot('current');

fs.writeFileSync(OUT, JSON.stringify(log, null, 1));
process.exit(0);
