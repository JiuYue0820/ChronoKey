import { useEffect, useState } from 'react';
import { Button, Icon, IconButton, Segmented, Toggle, StrengthMeter, useToast, modKey } from './ui.jsx';
import { generate, generatorEntropy, DEFAULT_GEN } from '../lib/generator.js';
import { estimate, crackTime } from '../lib/strength.js';
import { t, crackTimeLabel, strengthWarning } from '../i18n-react.js';

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
    toast(t('gen.copied', { n: r.clearsIn }), 'ok');
  };

  return (
    <div className="tool">
      <header className="tool-head">
        <h1>{t('gen.title')}</h1>
        <p>{t('gen.subtitle', { mod: modKey })}</p>
      </header>

      <div className="gen-hero">
        <output className="gen-output mono" aria-live="polite">
          {[...pw].map((ch, i) => <span key={i} className={/[0-9]/.test(ch) ? 'c-digit' : /[^a-zA-Z0-9]/.test(ch) ? 'c-sym' : ''}>{ch}</span>)}
        </output>
        <div className="gen-actions">
          <IconButton icon="refresh" label={t('gen.regenerate')} onClick={regen} />
          <Button variant="primary" icon="copy" onClick={() => copy(pw)}>{t('common.copy')}</Button>
        </div>
      </div>
      <div className="gen-meta">
        <span className={`strength-label ${bits >= 80 ? 'ok' : bits >= 60 ? 'warning' : 'danger'}`}>{bits} bit</span>
        <span className="field-hint">{t('gen.crackHint', { time: crackTimeLabel(crackTime(bits)) })}</span>
      </div>

      <div className="form-card">
        <Segmented label={t('gen.type')} value={opts.mode} onChange={(mode) => set({ mode })}
          options={[{ value: 'random', label: t('gen.mode_random') }, { value: 'passphrase', label: t('gen.mode_passphrase') }, { value: 'pin', label: t('gen.mode_pin') }]} />

        {opts.mode === 'random' && (
          <>
            <label className="range-row">{t('gen.length')}<input type="range" min="8" max="128" value={opts.length} onChange={(e) => set({ length: +e.target.value })} /><b>{opts.length}</b></label>
            <div className="grid-2">
              <Toggle label={t('gen.lower')} checked={opts.lower} onChange={(v) => set({ lower: v })} />
              <Toggle label={t('gen.upper')} checked={opts.upper} onChange={(v) => set({ upper: v })} />
              <Toggle label={t('gen.digits')} checked={opts.digits} onChange={(v) => set({ digits: v })} />
              <Toggle label={t('gen.symbols')} checked={opts.symbols} onChange={(v) => set({ symbols: v })} />
            </div>
            <Toggle label={t('gen.avoidAmbig')} description={t('gen.avoidAmbigHint')} checked={opts.avoidAmbiguous} onChange={(v) => set({ avoidAmbiguous: v })} />
          </>
        )}
        {opts.mode === 'passphrase' && (
          <>
            <label className="range-row">{t('gen.wordCount')}<input type="range" min="3" max="12" value={opts.words} onChange={(e) => set({ words: +e.target.value })} /><b>{opts.words}</b></label>
            <div className="row gap-3 wrap">
              <span className="field-label">{t('gen.separator')}</span>
              <Segmented label={t('gen.separator')} value={opts.separator} onChange={(separator) => set({ separator })}
                options={[{ value: '-', label: '-' }, { value: '.', label: '.' }, { value: '_', label: '_' }, { value: ' ', label: t('gen.space') }]} />
            </div>
            <div className="grid-2">
              <Toggle label={t('gen.capitalize')} checked={opts.capitalize} onChange={(v) => set({ capitalize: v })} />
              <Toggle label={t('gen.addNumber')} checked={opts.addNumber} onChange={(v) => set({ addNumber: v })} />
            </div>
            <p className="field-hint">{t('gen.wordlistHint')}</p>
          </>
        )}
        {opts.mode === 'pin' && (
          <label className="range-row">{t('gen.pinDigits')}<input type="range" min="4" max="16" value={opts.pinLength} onChange={(e) => set({ pinLength: +e.target.value })} /><b>{opts.pinLength}</b></label>
        )}
        <div className="row gap-2">
          <Button size="sm" variant="ghost" icon="check" onClick={() => { onSaveDefaults(opts); toast(t('gen.defaultsSaved'), 'ok'); }}>{t('gen.setDefault')}</Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="form-card">
          <h3 className="section-title">{t('gen.historyTitle')}</h3>
          <ul className="gen-history">
            {history.map((h, i) => (
              <li key={i}><span className="mono">{h}</span><IconButton icon="copy" label={t('gen.historyCopy')} onClick={() => copy(h)} /></li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-card">
        <h3 className="section-title">{t('gen.testTitle')}</h3>
        <input className="input mono" type="password" value={check} onChange={(e) => setCheck(e.target.value)} placeholder={t('gen.testHint')} aria-label={t('gen.testLabel')} autoComplete="off" />
        {check && (() => {
          const r = estimate(check);
          return (
            <>
              <StrengthMeter result={r} />
              <p className="field-hint">{t('gen.crackPrefix', { time: crackTimeLabel(crackTime(r.bits)) })}</p>
              {r.warnings.length > 0 && <ul className="warn-list">{r.warnings.map((w) => <li key={w}><Icon name="alert" size={14} />{strengthWarning(w)}</li>)}</ul>}
            </>
          );
        })()}
      </div>
    </div>
  );
}
