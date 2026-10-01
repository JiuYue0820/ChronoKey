import { useEffect, useState } from 'react';
import { Button, Icon, IconButton, Segmented, Toggle, StrengthMeter, useToast, modKey } from './ui.jsx';
import { generate, generatorEntropy, DEFAULT_GEN } from '../lib/generator.js';
import { estimate, crackTime } from '../lib/strength.js';

export function GeneratorView({ settings, onSaveDefaults }) {
  const [opts, setOpts] = useState({ ...DEFAULT_GEN, ...(settings.generator || {}) });
  const [pw, setPw] = useState(() => generate(opts));
  const [history, setHistory] = useState([]);
  const [check, setCheck] = useState('');
  const toast = useToast();
  const set = (patch) => setOpts((o) => ({ ...o, ...patch }));

  useEffect(() => { setPw(generate(opts)); }, [opts]);

  const bits = Math.round(generatorEntropy(opts));
  const regen = () => { setHistory((h) => [pw, ...h].slice(0, 8)); setPw(generate(opts)); };
  const copy = async (v) => {
    const r = await window.ck.copy(v, { sensitive: true });
    toast(`已复制 · ${r.clearsIn} 秒后清空剪贴板`, 'ok');
  };

  return (
    <div className="tool">
      <header className="tool-head">
        <h1>密码生成器</h1>
        <p>使用系统安全随机数,拒绝采样避免取模偏差。{modKey}G 随时打开。</p>
      </header>

      <div className="gen-hero">
        <output className="gen-output mono" aria-live="polite">
          {[...pw].map((ch, i) => <span key={i} className={/[0-9]/.test(ch) ? 'c-digit' : /[^a-zA-Z0-9]/.test(ch) ? 'c-sym' : ''}>{ch}</span>)}
        </output>
        <div className="gen-actions">
          <IconButton icon="refresh" label="重新生成" onClick={regen} />
          <Button variant="primary" icon="copy" onClick={() => copy(pw)}>复制</Button>
        </div>
      </div>
      <div className="gen-meta">
        <span className={`strength-label ${bits >= 80 ? 'ok' : bits >= 60 ? 'warning' : 'danger'}`}>{bits} bit</span>
        <span className="field-hint">按每秒 10¹⁰ 次离线猜测,破解需 {crackTime(bits)}</span>
      </div>

      <div className="form-card">
        <Segmented label="类型" value={opts.mode} onChange={(mode) => set({ mode })}
          options={[{ value: 'random', label: '随机字符' }, { value: 'passphrase', label: '口令短语' }, { value: 'pin', label: 'PIN 码' }]} />

        {opts.mode === 'random' && (
          <>
            <label className="range-row">长度<input type="range" min="8" max="128" value={opts.length} onChange={(e) => set({ length: +e.target.value })} /><b>{opts.length}</b></label>
            <div className="grid-2">
              <Toggle label="小写字母 a–z" checked={opts.lower} onChange={(v) => set({ lower: v })} />
              <Toggle label="大写字母 A–Z" checked={opts.upper} onChange={(v) => set({ upper: v })} />
              <Toggle label="数字 0–9" checked={opts.digits} onChange={(v) => set({ digits: v })} />
              <Toggle label="符号 !@#…" checked={opts.symbols} onChange={(v) => set({ symbols: v })} />
            </div>
            <Toggle label="避免易混淆字符" description="排除 I l 1 O 0 o | 等,方便手抄或口述" checked={opts.avoidAmbiguous} onChange={(v) => set({ avoidAmbiguous: v })} />
          </>
        )}
        {opts.mode === 'passphrase' && (
          <>
            <label className="range-row">单词数<input type="range" min="3" max="12" value={opts.words} onChange={(e) => set({ words: +e.target.value })} /><b>{opts.words}</b></label>
            <div className="row gap-3 wrap">
              <span className="field-label">分隔符</span>
              <Segmented label="分隔符" value={opts.separator} onChange={(separator) => set({ separator })}
                options={[{ value: '-', label: '-' }, { value: '.', label: '.' }, { value: '_', label: '_' }, { value: ' ', label: '空格' }]} />
            </div>
            <div className="grid-2">
              <Toggle label="首字母大写" checked={opts.capitalize} onChange={(v) => set({ capitalize: v })} />
              <Toggle label="加入一个数字" checked={opts.addNumber} onChange={(v) => set({ addNumber: v })} />
            </div>
            <p className="field-hint">词库为 EFF Large Wordlist,7776 词,每词约 12.9 bit。适合用作主密码。</p>
          </>
        )}
        {opts.mode === 'pin' && (
          <label className="range-row">位数<input type="range" min="4" max="16" value={opts.pinLength} onChange={(e) => set({ pinLength: +e.target.value })} /><b>{opts.pinLength}</b></label>
        )}
        <div className="row gap-2">
          <Button size="sm" variant="ghost" icon="check" onClick={() => { onSaveDefaults(opts); toast('已设为默认生成规则', 'ok'); }}>设为默认</Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="form-card">
          <h3 className="section-title">本次生成记录,不会保存</h3>
          <ul className="gen-history">
            {history.map((h, i) => (
              <li key={i}><span className="mono">{h}</span><IconButton icon="copy" label="复制" onClick={() => copy(h)} /></li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-card">
        <h3 className="section-title">检测已有密码的强度</h3>
        <input className="input mono" type="password" value={check} onChange={(e) => setCheck(e.target.value)} placeholder="输入要检测的密码(不会被保存)" aria-label="要检测的密码" autoComplete="off" />
        {check && (() => {
          const r = estimate(check);
          return (
            <>
              <StrengthMeter result={r} />
              <p className="field-hint">估计破解时间:{crackTime(r.bits)}</p>
              {r.warnings.length > 0 && <ul className="warn-list">{r.warnings.map((w) => <li key={w}><Icon name="alert" size={14} />{w}</li>)}</ul>}
            </>
          );
        })()}
      </div>
    </div>
  );
}
