import { Avatar, Button, EmptyState, useTick } from './ui.jsx';
import { TotpCode, safeParseTotp } from './TotpCode.jsx';
import { TYPES } from '../lib/model.js';

function ClockCheck() {
  const now = useTick();
  const d = new Date(now);
  const off = -d.getTimezoneOffset();
  const tz = `UTC${off >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}:${String(Math.abs(off) % 60).padStart(2, '0')}`;
  return (
    <p className="clock-check">
      本机时间 <b className="mono">{d.toLocaleTimeString('zh-CN', { hour12: false })}</b> {tz}。
      验证码依赖系统时钟,网站提示验证码错误时,先在系统设置里同步时间。
    </p>
  );
}

export function TotpBoard({ items, query, onOpen, onAdd }) {
  const list = items.filter((i) => safeParseTotp(i.fields.totp));
  return (
    <div className="tool">
      <header className="tool-head row">
        <div>
          <h1>验证码</h1>
          <p>点击数字复制。按 RFC 6238 在本机计算。</p>
        </div>
        <div className="spacer" />
        <Button variant="primary" icon="plus" onClick={onAdd}>添加两步验证</Button>
      </header>
      <ClockCheck />
      {list.length ? (
        <ul className="totp-list">
          {list.map((i) => {
            const cfg = safeParseTotp(i.fields.totp);
            return (
              <li key={i.id} className="totp-row">
                <Avatar type={TYPES[i.type].icon} size={32} />
                <button type="button" className="list-text totp-row-name" onClick={() => onOpen(i.id)} title="打开条目">
                  <span className="list-name">{i.title}</span>
                  <span className="list-sub">{cfg.account || i.fields.username || i.fields.account || cfg.issuer}</span>
                </button>
                <TotpCode value={i.fields.totp} size="lg" />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={query ? `没有匹配"${query}"的验证码` : '还没有两步验证'}>
          <p>在任意登录条目中粘贴网站给出的设置密钥或二维码截图即可。</p>
        </EmptyState>
      )}
    </div>
  );
}
