import { useEffect, useRef, useState } from 'react';
import { Button, Field, Icon, IconButton, SecretInput, StrengthMeter, Segmented, useToast, modKey } from './ui.jsx';
import { TotpSetup } from './TotpSetup.jsx';
import { TYPES, TYPE_ORDER, hostOf, uid } from '../lib/model.js';
import { estimate } from '../lib/strength.js';
import { generate, DEFAULT_GEN } from '../lib/generator.js';
import { t, typeLabel, fieldLabel } from '../i18n-react.js';

function GenPopover({ defaults, onPick, onClose }) {
  const [opts, setOpts] = useState({ ...DEFAULT_GEN, ...(defaults || {}) });
  const [pw, setPw] = useState(() => generate(opts));
  const ref = useRef(null);
  useEffect(() => { setPw(generate(opts)); }, [opts]);
  useEffect(() => {
    const off = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
    return () => document.removeEventListener('mousedown', off);
  }, [onClose]);
  return (
    <div className="popover" ref={ref} role="dialog" aria-label={t('editor.genPassword')} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <Segmented label={t('gen.type')} value={opts.mode} onChange={(mode) => setOpts({ ...opts, mode })}
        options={[{ value: 'random', label: t('gen.mode_random') }, { value: 'passphrase', label: t('gen.mode_passphrase') }, { value: 'pin', label: t('gen.mode_pin') }]} />
      <div className="gen-preview mono small">{pw}</div>
      {opts.mode === 'random' && (
        <label className="range-row">{t('gen.length')} <input type="range" min="8" max="64" value={opts.length} onChange={(e) => setOpts({ ...opts, length: +e.target.value })} /> <b>{opts.length}</b></label>
      )}
      {opts.mode === 'passphrase' && (
        <label className="range-row">{t('gen.words')} <input type="range" min="3" max="10" value={opts.words} onChange={(e) => setOpts({ ...opts, words: +e.target.value })} /> <b>{opts.words}</b></label>
      )}
      {opts.mode === 'pin' && (
        <label className="range-row">{t('gen.pinDigits')} <input type="range" min="4" max="12" value={opts.pinLength} onChange={(e) => setOpts({ ...opts, pinLength: +e.target.value })} /> <b>{opts.pinLength}</b></label>
      )}
      <div className="row gap-2">
        <Button size="sm" icon="refresh" onClick={() => setPw(generate(opts))}>{t('gen.regenerate')}</Button>
        <Button size="sm" variant="primary" onClick={() => { onPick(pw); onClose(); }}>{t('gen.use')}</Button>
      </div>
    </div>
  );
}

function TagInput({ tags, onChange, suggestions }) {
  const [draft, setDraft] = useState('');
  const add = (t) => {
    const v = t.trim().replace(/^#/, '');
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  return (
    <div className="tag-input">
      {tags.map((t) => (
        <span key={t} className="tag">
          {t}
          <button type="button" aria-label={t('editor.removeTag', { t })} onClick={() => onChange(tags.filter((x) => x !== t))}><Icon name="x" size={10} /></button>
        </span>
      ))}
      <input
        className="tag-draft"
        value={draft}
        list="tag-suggestions"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (['Enter', ',', ','].includes(e.key)) { e.preventDefault(); add(draft); }
          if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder={tags.length ? '' : t('editor.tagHint')}
        aria-label={t('editor.addTag')}
      />
      <datalist id="tag-suggestions">{suggestions.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  );
}

export function ItemEditor({ item, isNew, folders, allTags, generatorDefaults, onCancel, onSave }) {
  const [draft, setDraft] = useState(item);
  const [genFor, setGenFor] = useState(null);
  const [err, setErr] = useState('');
  const toast = useToast();
  const def = TYPES[draft.type];
  const setField = (k, v) => setDraft((d) => ({ ...d, fields: { ...d.fields, [k]: v } }));

  const save = (e) => {
    e?.preventDefault();
    let title = draft.title.trim();
    if (!title) title = draft.fields.issuer || hostOf(draft.fields.url) || draft.fields.service || '';
    if (!title) { setErr(t('editor.needTitle')); return; }
    onSave({ ...draft, title, custom: draft.custom.filter((c) => c.label || c.value) });
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      if (e.key === 'Escape' && !genFor && !document.querySelector('.scrim')) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const genSsh = async () => {
    const k = await window.ck.sshGenerate(draft.title || 'chronokey');
    setDraft((d) => ({ ...d, fields: { ...d.fields, publicKey: k.publicKey, privateKey: k.privateKey, fingerprint: k.fingerprint } }));
    toast(t('editor.sshGenerated'), 'ok');
  };

  return (
    <form className="editor" onSubmit={save} aria-label={isNew ? t('editor.newTitle') : t('editor.editTitle')}>
      <header className="editor-head">
        <h1>{isNew ? t('editor.newType', { label: typeLabel(draft.type) }) : t('editor.editType', { title: item.title })}</h1>
        <div className="row gap-2">
          <Button onClick={onCancel}>{t('editor.cancel')}</Button>
          <Button variant="primary" type="submit" icon="check">{t('editor.save')} <kbd>{modKey}S</kbd></Button>
        </div>
      </header>

      {isNew && (
        <div className="type-picker" role="radiogroup" aria-label={t('editor.itemType')}>
          {TYPE_ORDER.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={draft.type === t} className={draft.type === t ? 'on' : ''} onClick={() => setDraft({ ...draft, type: t })}>
              <Icon name={TYPES[t].icon} /><span>{typeLabel(t)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="form-card">
        <Field label={t('editor.title')} error={err}>
          {(id) => <input id={id} className="input input-lg" value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setErr(''); }} autoFocus placeholder={def.label} />}
        </Field>

        {def.fields.map((f) => {
          const v = draft.fields[f.key] || '';
          if (f.kind === 'totp') {
            return (
              <Field key={f.key} label={fieldLabel(f.key)}>
                <TotpSetup
                  value={v}
                  onChange={(val) => setField('totp', val)}
                  onParsed={(cfg) => setDraft((d) => ({
                    ...d,
                    title: d.title || cfg.issuer,
                    fields: { ...d.fields, totp: d.fields.totp, ...(d.type === 'totp' ? { issuer: d.fields.issuer || cfg.issuer, account: d.fields.account || cfg.account } : {}), ...(d.type === 'login' && !d.fields.username && cfg.account ? { username: cfg.account } : {}) },
                  }))}
                />
              </Field>
            );
          }
          return (
            <Field key={f.key} label={fieldLabel(f.key)}>
              {(id) => (f.multiline ? (
                <textarea id={id} className={`input ${f.mono ? 'mono' : ''}`} rows={f.key === 'privateKey' ? 6 : 3} value={v} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} spellCheck={false} />
              ) : f.secret ? (
                <div className="with-gen">
                  <SecretInput id={id} value={v} onChange={(val) => setField(f.key, val)} mono={f.mono} placeholder={f.placeholder} autoComplete="new-password" />
                  {f.generate && (
                    <div className="menu-anchor">
                      <IconButton icon="dice" label={t('editor.generate')} onClick={() => setGenFor(f.key)} />
                      {genFor === f.key && <GenPopover defaults={generatorDefaults} onPick={(p) => setField(f.key, p)} onClose={() => setGenFor(null)} />}
                    </div>
                  )}
                </div>
              ) : (
                <input id={id} className={`input ${f.mono ? 'mono' : ''}`} value={v} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} type={f.kind === 'url' ? 'url' : 'text'} spellCheck={false} />
              ))}
            </Field>
          );
        })}

        {draft.type === 'login' && draft.fields.password && <StrengthMeter result={estimate(draft.fields.password)} />}
        {draft.type === 'ssh' && <Button icon="terminal" onClick={genSsh}>{t('editor.sshGen')}</Button>}
      </div>

      <div className="form-card">
        <div className="card-head">
          <h3 className="section-title">{t('editor.customFields')}</h3>
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setDraft({ ...draft, custom: [...draft.custom, { id: uid(), label: '', value: '', hidden: false }] })}>{t('editor.addCustom')}</Button>
        </div>
        {!draft.custom.length && <p className="field-hint">{t('editor.customHint')}</p>}
        {draft.custom.map((c, i) => {
          const set = (patch) => setDraft({ ...draft, custom: draft.custom.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={c.id} className="custom-row">
              <input className="input" value={c.label} onChange={(e) => set({ label: e.target.value })} placeholder={t('editor.fieldName')} aria-label={t('editor.fieldName')} />
              {c.hidden
                ? <SecretInput value={c.value} onChange={(v) => set({ value: v })} ariaLabel={t('editor.fieldValue')} />
                : <input className="input" value={c.value} onChange={(e) => set({ value: e.target.value })} placeholder={t('editor.valuePlaceholder')} aria-label={t('editor.fieldValue')} />}
              <IconButton icon={c.hidden ? 'lock' : 'unlock'} label={t('editor.hideFieldLabel')} className={c.hidden ? 'tone-accent' : ''} onClick={() => set({ hidden: !c.hidden })} />
              <IconButton icon="x" label={t('editor.deleteField')} onClick={() => setDraft({ ...draft, custom: draft.custom.filter((_, j) => j !== i) })} />
            </div>
          );
        })}
      </div>

      <div className="form-card grid-2">
        <Field label={t('editor.folder')}>
          {(id) => (
            <select id={id} className="input" value={draft.folderId || ''} onChange={(e) => setDraft({ ...draft, folderId: e.target.value || null })}>
              <option value="">{t('editor.none')}</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </Field>
        <Field label={t('editor.tags')}>
          <TagInput tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} suggestions={allTags} />
        </Field>
        <div className="span-2">
          <Field label={t('editor.notes')}>
            {(id) => <textarea id={id} className="input" rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />}
          </Field>
        </div>
      </div>
    </form>
  );
}
