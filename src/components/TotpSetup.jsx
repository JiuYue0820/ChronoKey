import { useRef, useState } from 'react';
import { Button, Icon, useToast } from './ui.jsx';
import { TotpCode } from './TotpCode.jsx';
import { parseOtpauth, decodeQrFromBlob, buildOtpauth } from '../lib/totp.js';
import { t, tr } from '../i18n-react.js';

// 两步验证设置:粘贴"设置密钥"、粘贴 otpauth:// 链接、或导入二维码截图。
// 以 GitHub 为例:Settings → Password and authentication → Enable 2FA →
// 点击 "setup key" 显示密钥 → 粘贴到这里 → 把下方 6 位码填回 GitHub。
export function TotpSetup({ value, onChange, onParsed }) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();

  const accept = (text) => {
    setError('');
    try {
      const cfg = parseOtpauth(text);
      const stored = String(text).trim().startsWith('otpauth://') ? String(text).trim() : cfg.secret;
      onChange(stored);
      onParsed?.(cfg);
      setRaw('');
      toast(t('otp.detected'), 'ok');
    } catch (e) {
      setError(e.message);
    }
  };

  const fromImage = async (blob) => {
    setError('');
    try {
      accept(await decodeQrFromBlob(blob));
    } catch (e) {
      setError(e.message);
    }
  };

  const pasteImage = async () => {
    try {
      const url = await window.ck.readClipboardImage();
      if (!url) { setError(t('otp.noImage')); return; }
      fromImage(await (await fetch(url)).blob());
    } catch {
      setError(t('otp.clipboardReadFail'));
    }
  };

  const onPaste = (e) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); fromImage(file); }
  };

  let cfg = null;
  try { cfg = value ? parseOtpauth(value) : null; } catch { /* 显示错误 */ }

  if (value && cfg) {
    return (
      <div className="totp-setup done">
        <div className="totp-setup-live">
          <div>
            <div className="field-hint">{t('otp.fillBack')}</div>
            <TotpCode value={value} size="lg" />
          </div>
          <Button size="sm" variant="ghost" icon="x" onClick={() => onChange('')}>{t('otp.remove')}</Button>
        </div>
        <button type="button" className="link-btn" onClick={() => setAdvanced((a) => !a)}>
          {advanced ? t('otp.collapse') : t('otp.advanced')}({t('otp.algLabel')} {cfg.algorithm} · {t('otp.digitsLabel')} {cfg.digits} · {t('otp.periodLabel')} {cfg.period})
        </button>
        {advanced && (
          <div className="grid-3">
            <label className="mini-field">{t('otp.algLabel')}
              <select className="input" value={cfg.algorithm} onChange={(e) => onChange(buildOtpauth({ ...cfg, algorithm: e.target.value }))}>
                <option>SHA1</option><option>SHA256</option><option>SHA512</option>
              </select>
            </label>
            <label className="mini-field">{t('otp.digitsLabel')}
              <select className="input" value={cfg.digits} onChange={(e) => onChange(buildOtpauth({ ...cfg, digits: Number(e.target.value) }))}>
                <option value={6}>6</option><option value={7}>7</option><option value={8}>8</option>
              </select>
            </label>
            <label className="mini-field">{t('otp.periodLabel')}
              <select className="input" value={cfg.period} onChange={(e) => onChange(buildOtpauth({ ...cfg, period: Number(e.target.value) }))}>
                <option value={30}>30</option><option value={60}>60</option>
              </select>
            </label>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="totp-setup" onPaste={onPaste}>
      <div className="input-wrap">
        <input
          className="input mono"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); accept(raw); } }}
          placeholder="粘贴设置密钥(如 JBSW Y3DP …)或 otpauth:// 链接"
          aria-label={t('otp.secretLabel')}
          spellCheck={false}
        />
      </div>
      <div className="row gap-2 wrap">
        <Button size="sm" variant="primary" disabled={!raw.trim()} onClick={() => accept(raw)}>{t('otp.detect')}</Button>
        <Button size="sm" icon="image" onClick={pasteImage}>{t('otp.pasteQr')}</Button>
        <Button size="sm" icon="qr" onClick={() => fileRef.current?.click()}>{t('otp.chooseImage')}</Button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && fromImage(e.target.files[0])} />
      </div>
      {error && <p className="field-error" role="alert"><Icon name="alert" size={14} />{error}</p>}
      {value && !cfg && <p className="field-error">{t('otp.invalidSaved', { v: value.slice(0, 24) })}</p>}
      <details className="howto">
        <summary>{t('otp.ghTitle')}</summary>
        <ol>
          <li dangerouslySetInnerHTML={{ __html: t('otp.gh1') }} />
          <li dangerouslySetInnerHTML={{ __html: t('otp.gh2') }} />
          <li dangerouslySetInnerHTML={{ __html: t('otp.gh3') }} />
          <li dangerouslySetInnerHTML={{ __html: t('otp.gh4') }} />
        </ol>
        <p className="field-hint">{t('otp.ghHint')}</p>
      </details>
    </div>
  );
}
