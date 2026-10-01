import { useEffect, useState } from 'react';
import { Ring, useTick, IconButton, useToast } from './ui.jsx';
import { parseOtpauth, totp } from '../lib/totp.js';

export function safeParseTotp(value) {
  try { return value ? parseOtpauth(value) : null; } catch { return null; }
}

export function useTotp(value) {
  const now = useTick();
  const [state, setState] = useState(null);
  const cfg = safeParseTotp(value);
  const key = cfg ? `${cfg.secret}|${cfg.algorithm}|${cfg.digits}|${cfg.period}` : '';
  const step = cfg ? Math.floor(now / 1000 / cfg.period) : 0;
  // 只在密钥或时间步变化时重新计算(而不是每秒)
  useEffect(() => {
    const c = safeParseTotp(value);
    if (!c) { setState(null); return undefined; }
    let live = true;
    totp(c).then((r) => live && setState(r));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, step]);
  if (!cfg) return { error: value ? '密钥无效' : null };
  const remaining = cfg.period - (Math.floor(now / 1000) % cfg.period);
  return { code: state?.code, remaining, period: cfg.period, cfg };
}

export const fmtCode = (c) => (c ? (c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c.length === 8 ? `${c.slice(0, 4)} ${c.slice(4)}` : c) : '––– –––');

export function TotpCode({ value, size = 'md', copyable = true }) {
  const t = useTotp(value);
  const toast = useToast();
  if (t.error) return <span className="totp-error">{t.error}</span>;
  if (!t.cfg) return null;
  const copy = async () => {
    if (!t.code) return;
    await window.ck.copy(t.code, { sensitive: true });
    toast(`验证码已复制 · ${t.remaining} 秒内有效`, 'ok');
  };
  return (
    <div className={`totp totp-${size} ${t.remaining <= 5 ? 'urgent' : ''}`}>
      <button type="button" className="totp-code" onClick={copyable ? copy : undefined} aria-label={`验证码 ${t.code || ''},点击复制`}>
        {fmtCode(t.code)}
      </button>
      <Ring remaining={t.remaining} period={t.period} size={size === 'lg' ? 36 : 28} />
      {copyable && <IconButton icon="copy" label="复制验证码" onClick={copy} />}
    </div>
  );
}
