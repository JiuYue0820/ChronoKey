import { useRef, useState } from 'react';
import { Button, Icon, useToast } from './ui.jsx';
import { TotpCode } from './TotpCode.jsx';
import { parseOtpauth, decodeQrFromBlob, buildOtpauth } from '../lib/totp.js';

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
      toast('两步验证已识别', 'ok');
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
      if (!url) { setError('剪贴板里没有图片。先截图二维码(Win+Shift+S 或 ⌘⇧4)再点这里'); return; }
      fromImage(await (await fetch(url)).blob());
    } catch {
      setError('无法读取剪贴板图片,请改用"选择图片"');
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
            <div className="field-hint">当前验证码 · 把它填回网站完成绑定</div>
            <TotpCode value={value} size="lg" />
          </div>
          <Button size="sm" variant="ghost" icon="x" onClick={() => onChange('')}>移除</Button>
        </div>
        <button type="button" className="link-btn" onClick={() => setAdvanced((a) => !a)}>
          {advanced ? '收起' : '高级参数'}(算法 {cfg.algorithm} · {cfg.digits} 位 · {cfg.period} 秒)
        </button>
        {advanced && (
          <div className="grid-3">
            <label className="mini-field">算法
              <select className="input" value={cfg.algorithm} onChange={(e) => onChange(buildOtpauth({ ...cfg, algorithm: e.target.value }))}>
                <option>SHA1</option><option>SHA256</option><option>SHA512</option>
              </select>
            </label>
            <label className="mini-field">位数
              <select className="input" value={cfg.digits} onChange={(e) => onChange(buildOtpauth({ ...cfg, digits: Number(e.target.value) }))}>
                <option value={6}>6</option><option value={7}>7</option><option value={8}>8</option>
              </select>
            </label>
            <label className="mini-field">周期(秒)
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
          aria-label="TOTP 设置密钥"
          spellCheck={false}
        />
      </div>
      <div className="row gap-2 wrap">
        <Button size="sm" variant="primary" disabled={!raw.trim()} onClick={() => accept(raw)}>识别</Button>
        <Button size="sm" icon="image" onClick={pasteImage}>粘贴二维码截图</Button>
        <Button size="sm" icon="qr" onClick={() => fileRef.current?.click()}>选择图片</Button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && fromImage(e.target.files[0])} />
      </div>
      {error && <p className="field-error" role="alert"><Icon name="alert" size={14} />{error}</p>}
      {value && !cfg && <p className="field-error">已保存的密钥无效:{value.slice(0, 24)}…</p>}
      <details className="howto">
        <summary>GitHub 卡在 2FA 这一步?</summary>
        <ol>
          <li>GitHub 显示二维码时,点击下方的 <strong>setup key</strong> 链接,复制那串字母数字。</li>
          <li>粘贴到上面的输入框,点"识别"(或直接截图二维码后点"粘贴二维码截图")。</li>
          <li>这里会出现 6 位验证码,点击复制,填回 GitHub 的 "Verify the code from the app"。</li>
          <li>GitHub 接着会给出 <strong>Recovery codes</strong>,下载后粘贴到"备用恢复码"字段一起保存。</li>
        </ol>
        <p className="field-hint">验证码依赖系统时间。如果网站总说验证码错误,请先在系统设置里"立即同步时间"。</p>
      </details>
    </div>
  );
}
