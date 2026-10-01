import { useEffect, useState } from 'react';
import { BrandMark, Icon, IconButton, modKey } from './ui.jsx';

// 标题栏,按 Windows 11 规范:高 48px(含搜索框),图标 16px,搜索框居中且可伸缩。
// - Windows / Linux:系统原生最小化 / 最大化 / 关闭(Window Controls Overlay,支持贴靠布局),
//   这里只用 env(titlebar-area-*) 让出位置。
// - macOS:系统红绿灯在左侧。
// - 浏览器预览:按 Fluent 规格自绘同款按钮,方便开发时对照。

function CaptionButtons() {
  const [max, setMax] = useState(false);
  useEffect(() => window.ck.onWinState((s) => setMax(!!s.maximized)), []);
  return (
    <div className="caption" role="group" aria-label="窗口控制">
      <button type="button" className="cap" aria-label="最小化" onClick={() => window.ck.win.minimize()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5h10" stroke="currentColor" /></svg>
      </button>
      <button type="button" className="cap" aria-label={max ? '还原' : '最大化'} onClick={() => window.ck.win.toggleMaximize()}>
        {max ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor"><rect x="0.5" y="2.5" width="7" height="7" rx="1" /><path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" /></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor"><rect x="0.5" y="0.5" width="9" height="9" rx="1" /></svg>
        )}
      </button>
      <button type="button" className="cap cap-close" aria-label="关闭" onClick={() => window.ck.win.close()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" /></svg>
      </button>
    </div>
  );
}

// 剪贴板倒计时:只有复制了敏感内容时才出现,点击立即清空
function ClipboardChip() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => window.ck.onClipboard((s) => setUntil(s.until || 0)), []);
  useEffect(() => {
    if (until <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [until]);
  const left = Math.ceil((until - now) / 1000);
  if (left <= 0) return null;
  return (
    <button type="button" className="clip-chip" onClick={() => window.ck.clearClipboard()} title={`剪贴板将在 ${left} 秒后清空,点击立即清空`} aria-label={`剪贴板 ${left} 秒后清空,点击立即清空`}>
      <Icon name="copy" size={14} />
      <span>{left}s</span>
    </button>
  );
}

export function Titlebar({ platform, locked, search, onSettings }) {
  const [focused, setFocused] = useState(document.hasFocus());
  useEffect(() => {
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    window.addEventListener('focus', on);
    window.addEventListener('blur', off);
    return () => { window.removeEventListener('focus', on); window.removeEventListener('blur', off); };
  }, []);

  return (
    <header className={`titlebar ${focused ? '' : 'blurred'}`} onDoubleClick={(e) => platform === 'browser' && e.target === e.currentTarget && window.ck.win.toggleMaximize()}>
      <div className="tb-left">
        <BrandMark size={16} />
        <span className="tb-title">ChronoKey</span>
        {locked && <span className="tb-state"><Icon name="lock" size={12} />已锁定</span>}
      </div>

      <div className="tb-center">
        {search && (
          <label className="tb-search">
            <Icon name="search" size={14} />
            <input
              ref={search.ref}
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              onKeyDown={search.onKeyDown}
              placeholder="搜索保险库"
              aria-label="搜索保险库"
              spellCheck={false}
            />
            {!search.value && <kbd>{modKey}F</kbd>}
          </label>
        )}
      </div>

      <div className="tb-right">
        {!locked && (
          <>
            <ClipboardChip />
            <IconButton icon="gear" label={`设置 (${modKey},)`} onClick={onSettings} />
            <IconButton icon="lock" label={`锁定 (${modKey}L)`} onClick={() => window.ck.lock()} />
          </>
        )}
        {platform === 'browser' && <CaptionButtons />}
      </div>
    </header>
  );
}
