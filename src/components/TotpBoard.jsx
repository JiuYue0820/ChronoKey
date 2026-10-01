import { Avatar, Button, EmptyState, useTick } from './ui.jsx';
import { TotpCode, safeParseTotp } from './TotpCode.jsx';
import { TYPES } from '../lib/model.js';
import { t, getLang } from '../i18n-react.js';

function ClockCheck() {
  const now = useTick();
  const d = new Date(now);
  const off = -d.getTimezoneOffset();
  const tz = `UTC${off >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}:${String(Math.abs(off) % 60).padStart(2, '0')}`;
  const locale = getLang() === 'en' ? 'en-US' : 'zh-CN';
  return (
    <p className="clock-check">
      {t('totp.clockLabel')} <b className="mono">{d.toLocaleTimeString(locale, { hour12: false })}</b> {tz}。
      {t('totp.clockHint')}
    </p>
  );
}

export function TotpBoard({ items, query, onOpen, onAdd }) {
  const list = items.filter((i) => safeParseTotp(i.fields.totp));
  return (
    <div className="tool">
      <header className="tool-head row">
        <div>
          <h1>{t('totp.title')}</h1>
          <p>{t('totp.subtitle')}</p>
        </div>
        <div className="spacer" />
        <Button variant="primary" icon="plus" onClick={onAdd}>{t('totp.add')}</Button>
      </header>
      <ClockCheck />
      {list.length ? (
        <ul className="totp-list">
          {list.map((i) => {
            const cfg = safeParseTotp(i.fields.totp);
            return (
              <li key={i.id} className="totp-row">
                <Avatar type={TYPES[i.type].icon} size={32} />
                <button type="button" className="list-text totp-row-name" onClick={() => onOpen(i.id)} title={t('otp.openItem')} aria-label={t('otp.openItem')}>
                  <span className="list-name">{i.title}</span>
                  <span className="list-sub">{cfg.account || i.fields.username || i.fields.account || cfg.issuer}</span>
                </button>
                <TotpCode value={i.fields.totp} size="lg" />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={query ? t('totp.noneMatch', { q: query }) : t('otp.none')}>
          <p>{t('totp.hint')}</p>
        </EmptyState>
      )}
    </div>
  );
}
