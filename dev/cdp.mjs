// 通过裸 CDP WebSocket 检查正在运行的 Electron 应用:求值表达式、抓控制台错误、截图
// 用法: node cdp.mjs eval "<js>" | node cdp.mjs shot <file.png> | node cdp.mjs console
import fs from 'node:fs';
const OUTFILE = process.env.CK_OUT ?? 'dev/_cdp-out.txt';
const _lines = [];
function OUT(...a) { _lines.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); }
process.on('exit', () => fs.writeFileSync(OUTFILE, _lines.join(String.fromCharCode(10))));

const list = await (await fetch('http://127.0.0.1:9223/json/list')).json();
const page = list.find((t) => t.type === 'page');
if (!page) { console.error('no page target'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

ws.addEventListener('message', (ev) => { const data = ev.data;
  const m = JSON.parse(data);
  if (m.id && pending.has(m.id)) {
    const { resolve } = pending.get(m.id);
    pending.delete(m.id);
    resolve(m.result ?? m);
  } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    OUT('[console.' + m.params.type + ']', m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 500));
  } else if (m.method === 'Runtime.exceptionThrown') {
    OUT('[exception]', (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 500));
  }
});

await new Promise((r) => ws.addEventListener('open', r, { once: true }));

const [, cmd, ...rest] = process.argv;
if (cmd === 'eval') {
  const r = await send('Runtime.evaluate', { expression: rest[0], awaitPromise: true, returnByValue: true });
  OUT('RAW:', JSON.stringify(r).slice(0, 300));
  if (r.exceptionDetails) OUT('EVAL ERROR:', r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  else OUT(JSON.stringify(r.result?.value, null, 1));
} else if (cmd === 'shot') {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(rest[0], Buffer.from(r.data, 'base64'));
  OUT('saved', rest[0]);
} else if (cmd === 'console') {
  await send('Runtime.enable');
  OUT('listening 3s...');
  await new Promise((r) => setTimeout(r, 3000));
}
await new Promise((r) => setTimeout(r, 500));
process.exit(0);
