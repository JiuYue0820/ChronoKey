import { useEffect, useRef, useState } from 'react';
import { Button, Field, Icon, IconButton, SecretInput, StrengthMeter, Segmented, useToast, modKey } from './ui.jsx';
import { TotpSetup } from './TotpSetup.jsx';
import { TYPES, TYPE_ORDER, hostOf, uid } from '../lib/model.js';
import { estimate } from '../lib/strength.js';
import { generate, DEFAULT_GEN } from '../lib/generator.js';

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
    <div className="popover" ref={ref} role="dialog" aria-label="生成密码" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <Segmented label="类型" value={opts.mode} onChange={(mode) => setOpts({ ...opts, mode })}
        options={[{ value: 'random', label: '随机' }, { value: 'passphrase', label: '口令短语' }, { value: 'pin', label: 'PIN' }]} />
      <div className="gen-preview mono small">{pw}</div>
      {opts.mode === 'random' && (
        <label className="range-row">长度 <input type="range" min="8" max="64" value={opts.length} onChange={(e) => setOpts({ ...opts, length: +e.target.value })} /> <b>{opts.length}</b></label>
      )}
      {opts.mode === 'passphrase' && (
        <label className="range-row">单词 <input type="range" min="3" max="10" value={opts.words} onChange={(e) => setOpts({ ...opts, words: +e.target.value })} /> <b>{opts.words}</b></label>
      )}
      {opts.mode === 'pin' && (
        <label className="range-row">位数 <input type="range" min="4" max="12" value={opts.pinLength} onChange={(e) => setOpts({ ...opts, pinLength: +e.target.value })} /> <b>{opts.pinLength}</b></label>
      )}
      <div className="row gap-2">
        <Button size="sm" icon="refresh" onClick={() => setPw(generate(opts))}>换一个</Button>
        <Button size="sm" variant="primary" onClick={() => { onPick(pw); onClose(); }}>使用</Button>
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
          <button type="button" aria-label={`移除标签 ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><Icon name="x" size={10} /></button>
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
        placeholder={tags.length ? '' : '输入后回车'}
        aria-label="添加标签"
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
    if (!title) { setErr('请填写标题'); return; }
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
    toast('已生成 Ed25519 密钥对', 'ok');
  };

  return (
    <form className="editor" onSubmit={save} aria-label={isNew ? '新建条目' : '编辑条目'}>
      <header className="editor-head">
        <h1>{isNew ? `新建${def.label}` : `编辑 · ${item.title}`}</h1>
        <div className="row gap-2">
          <Button onClick={onCancel}>取消</Button>
          <Button variant="primary" type="submit" icon="check">保存 <kbd>{modKey}S</kbd></Button>
        </div>
      </header>

      {isNew && (
        <div className="type-picker" role="radiogroup" aria-label="条目类型">
          {TYPE_ORDER.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={draft.type === t} className={draft.type === t ? 'on' : ''} onClick={() => setDraft({ ...draft, type: t })}>
              <Icon name={TYPES[t].icon} /><span>{TYPES[t].label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="form-card">
        <Field label="标题" error={err}>
          {(id) => <input id={id} className="input input-lg" value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setErr(''); }} autoFocus placeholder={def.label} />}
        </Field>

        {def.fields.map((f) => {
          const v = draft.fields[f.key] || '';
          if (f.kind === 'totp') {
            return (
              <Field key={f.key} label={f.label}>
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
            <Field key={f.key} label={f.label}>
              {(id) => (f.multiline ? (
                <textarea id={id} className={`input ${f.mono ? 'mono' : ''}`} rows={f.key === 'privateKey' ? 6 : 3} value={v} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} spellCheck={false} />
              ) : f.secret ? (
                <div className="with-gen">
                  <SecretInput id={id} value={v} onChange={(val) => setField(f.key, val)} mono={f.mono} placeholder={f.placeholder} autoComplete="new-password" />
                  {f.generate && (
                    <div className="menu-anchor">
                      <IconButton icon="dice" label="生成" onClick={() => setGenFor(f.key)} />
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
        {draft.type === 'ssh' && <Button icon="terminal" onClick={genSsh}>生成 Ed25519 密钥对</Button>}
      </div>

      <div className="form-card">
        <div className="card-head">
          <h3 className="section-title">自定义字段</h3>
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setDraft({ ...draft, custom: [...draft.custom, { id: uid(), label: '', value: '', hidden: false }] })}>添加</Button>
        </div>
        {!draft.custom.length && <p className="field-hint">例如:安全问题、账户 ID、客户经理电话…</p>}
        {draft.custom.map((c, i) => {
          const set = (patch) => setDraft({ ...draft, custom: draft.custom.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={c.id} className="custom-row">
              <input className="input" value={c.label} onChange={(e) => set({ label: e.target.value })} placeholder="字段名" aria-label="字段名" />
              {c.hidden
                ? <SecretInput value={c.value} onChange={(v) => set({ value: v })} ariaLabel="字段值" />
                : <input className="input" value={c.value} onChange={(e) => set({ value: e.target.value })} placeholder="值" aria-label="字段值" />}
              <IconButton icon={c.hidden ? 'lock' : 'unlock'} label={c.hidden ? '已设为隐藏字段' : '设为隐藏字段'} className={c.hidden ? 'tone-accent' : ''} onClick={() => set({ hidden: !c.hidden })} />
              <IconButton icon="x" label="删除字段" onClick={() => setDraft({ ...draft, custom: draft.custom.filter((_, j) => j !== i) })} />
            </div>
          );
        })}
      </div>

      <div className="form-card grid-2">
        <Field label="文件夹">
          {(id) => (
            <select id={id} className="input" value={draft.folderId || ''} onChange={(e) => setDraft({ ...draft, folderId: e.target.value || null })}>
              <option value="">无</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="标签">
          <TagInput tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} suggestions={allTags} />
        </Field>
        <div className="span-2">
          <Field label="备注">
            {(id) => <textarea id={id} className="input" rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />}
          </Field>
        </div>
      </div>
    </form>
  );
}
