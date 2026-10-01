import { useEffect, useRef, useState, useId, createContext, useContext, useCallback } from 'react';

export const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl+';

// 品牌标志:3×3 大小不一的方块,与锁屏的变焦矩阵同源
export function BrandMark({ size = 16 }) {
  const cells = [[0, 0, 1], [1, 0, 0.6], [2, 0, 0.35], [0, 1, 0.6], [1, 1, 1], [2, 1, 0.6], [0, 2, 0.35], [1, 2, 0.6], [2, 2, 1]];
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {cells.map(([x, y, s]) => {
        const w = 6.4 * s;
        return <rect key={`${x}${y}`} x={x * 8 + 4 - w / 2} y={y * 8 + 4 - w / 2} width={w} height={w} rx="0.6" fill="currentColor" />;
      })}
    </svg>
  );
}

// ---------- 图标(24 网格、1.75 描边,风格接近 SF Symbols 细线) ----------
const P = {
  key: 'M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM12 11v10m0-4h3m-3 2h2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  card: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11ZM3 10h18M7 15h4',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  note: 'M6 3h9l4 4v14H6V3Zm9 0v4h4M9 12h6m-6 4h6',
  code: 'm8 8-4 4 4 4m8-8 4 4-4 4m-6 3 4-14',
  terminal: 'M4 5h16v14H4V5Zm4 5 2.5 2L8 14m5 0h3',
  star: 'm12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  folder: 'M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z',
  tag: 'M3.5 12.1V4.5a1 1 0 0 1 1-1h7.6a1 1 0 0 1 .7.3l7.7 7.7a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0l-7.7-7.7a1 1 0 0 1-.3-.7ZM8 8h.01',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3.5 4h.01M15.5 8h.01M12 12h.01M8.5 16h.01m7 0h.01',
  shield: 'M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7.3 7.3 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.3 7.3 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
  lock: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 1 1 8 0v3',
  unlock: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 7.7-1.5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.6-1.9L20 20',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v11H9V9Zm-4 6V4h10',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M4 4l16 16M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 7.3C4 9 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1.1M9.9 10a3 3 0 0 0 4.1 4.1',
  external: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9 6 6 6-6 6',
  chevronDown: 'm6 9 6 6 6-6',
  refresh: 'M20 11a8 8 0 0 0-14.8-4M4 5v3.5h3.5M4 13a8 8 0 0 0 14.8 4M20 19v-3.5h-3.5',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4h4M12 8v4.5l3 1.5',
  download: 'M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19h14',
  upload: 'M12 16V5m-4.5 4.5L12 5l4.5 4.5M5 19h14',
  image: 'M4 5h16v14H4V5Zm0 11 4.5-4.5 4 4 2.5-2.5L20 18M15 9.5h.01',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v4.5m0 2.5h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5.5M12 8h.01',
  display: 'M3 5h18v11H3V5Zm6 15h6m-3-4v4',
  superkey: 'M7 14a4 4 0 1 1 3.9-5H21v3h-2v2h-3v-2h-5.1A4 4 0 0 1 7 14Zm0-3h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  sidebar: 'M4 5h16v14H4V5Zm5 0v14',
  qr: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z',
};

export function Icon({ name, size = 16, className = '', title }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={P[name] || P.info} />
    </svg>
  );
}

// ---------- 条目图标:中性底 + 类型图标(类别才是有意义的信息,彩色字母不是) ----------
export function Avatar({ type, size = 32 }) {
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={type || 'key'} size={Math.round(size * 0.5)} />
    </span>
  );
}

// ---------- 按钮 ----------
export function Button({ variant = 'secondary', size, icon, children, className = '', ...rest }) {
  return (
    <button type="button" className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon, label, className = '', size = 16, ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

// ---------- 表单 ----------
export function Field({ label, hint, error, children, id: forcedId }) {
  const auto = useId();
  const id = forcedId || auto;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      {typeof children === 'function' ? children(id) : children}
      {error ? <p className="field-error" role="alert"><Icon name="alert" size={14} />{error}</p>
        : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function SecretInput({ id, value, onChange, placeholder, autoFocus, onKeyDown, mono, ariaLabel, autoComplete = 'off' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input
        id={id}
        className={`input ${mono ? 'mono' : ''}`}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
      />
      <IconButton className="input-adorn" icon={show ? 'eyeOff' : 'eye'} label={show ? '隐藏' : '显示'} onClick={() => setShow((s) => !s)} />
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <label htmlFor={id}>{label}</label>
        {description && <p className="field-hint">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} className="switch" disabled={disabled} onClick={() => onChange(!checked)}>
        <span className="switch-knob" />
      </button>
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- 强度条 ----------
export function StrengthMeter({ result }) {
  if (!result) return null;
  const tone = ['danger', 'danger', 'warning', 'ok', 'ok'][result.score];
  return (
    <div className="strength" aria-live="polite">
      <div className="strength-bars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i <= result.score ? `on ${tone}` : ''} />)}
      </div>
      <span className={`strength-label ${tone}`}>{result.label} · {result.bits} bit</span>
    </div>
  );
}

// ---------- 模态(Mac sheet 风格) ----------
export function Modal({ title, onClose, children, width = 560, footer }) {
  const ref = useRef(null);
  // onClose 通常是内联函数;放进 ref,避免父组件每次重渲染都重新抢焦点
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onClose = () => closeRef.current?.();
    const prev = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector('input, textarea, select, button:not(.modal-close)');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => { el?.removeEventListener('keydown', onKey); if (prev?.isConnected) prev.focus?.(); };
  }, []);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ width }}>
        <header className="modal-head">
          <h2>{title}</h2>
          {onClose && <IconButton className="modal-close" icon="x" label="关闭" onClick={onClose} />}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- Toast ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, tone = 'info', ms = 2600) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon name={t.tone === 'danger' ? 'alert' : t.tone === 'ok' ? 'check' : 'info'} size={16} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- 倒计时环 ----------
export function Ring({ remaining, period, size = 28 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const frac = remaining / period;
  const urgent = remaining <= 5;
  return (
    <svg className={`ring ${urgent ? 'urgent' : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`剩余 ${remaining} 秒`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{remaining}</text>
    </svg>
  );
}

// 共享 1s 心跳(所有 TOTP 共用一个定时器)
const tickSubs = new Set();
let tickTimer = null;
export function useTick() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    tickSubs.add(setNow);
    if (!tickTimer) {
      const loop = () => {
        const t = Date.now();
        tickSubs.forEach((fn) => fn(t));
        tickTimer = setTimeout(loop, 1000 - (t % 1000) + 5);
      };
      loop();
    }
    return () => {
      tickSubs.delete(setNow);
      if (!tickSubs.size) { clearTimeout(tickTimer); tickTimer = null; }
    };
  }, []);
  return now;
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function formatTime(t) {
  if (!t) return '—';
  return new Date(t).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function relTime(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 60) return '刚刚';
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)} 天前`;
  return formatTime(t).slice(0, 10);
}
