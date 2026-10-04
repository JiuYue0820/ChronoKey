import { useEffect, useState } from 'react';
import { Button, Field, Icon, Modal, SecretInput, Segmented, Toggle, useToast, formatTime, StrengthMeter, modKey } from './ui.jsx';
import { appendAudit, mergeVaults, normalizeItem } from '../lib/model.js';
import { importAuto, exportCsv, exportBitwardenJson, exportChronoJson } from '../lib/importers.js';
import { estimate } from '../lib/strength.js';
import { t, tr, useI18n, setLang, getLang, getLangs, registerLocale } from '../i18n-react.js';

const TABS = [
  { id: 'security', label: () => t('set.tabSecurity') },
  { id: 'superkey', label: () => t('set.tabSuperkey') },
  { id: 'backup', label: () => t('set.tabBackup') },
  { id: 'data', label: () => t('set.tabImport') },
  { id: 'account', label: () => t('set.tabAccount') },
  { id: 'appearance', label: () => t('set.tabAppearance') },
  { id: 'about', label: () => t('set.tabAbout') },
];

function NumberSelect({ label, value, onChange, options, hint }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
    </Field>
  );
}

function SecurityTab({ data, status, commit, refresh }) {
  useI18n();
  const s = data.settings;
  const [prefs, setPrefs] = useState(status.prefs);
  const set = (patch) => {
    commit((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));
    window.ck.applySettings({ ...s, ...patch });
  };
  const setPref = async (patch) => { setPrefs(await window.ck.setPrefs(patch)); refresh(); };
  const toast = useToast();
  const newToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const toggleBridge = async (v) => {
    if (v && !prefs.bridgeToken) await setPref({ browserBridge: true, bridgeToken: newToken() });
    else await setPref({ browserBridge: v });
  };
  const regenBridgeToken = async () => setPref({ bridgeToken: newToken() });
  return (
    <div className="stack gap-4">
      <section className="settings-group">
        <h3>{t('set.secAutoLock')}</h3>
        <NumberSelect label={t('set.idle')} value={s.autoLockMinutes} onChange={(v) => set({ autoLockMinutes: v })}
          options={[[1, t('set.idle1m')], [2, t('set.idle2m')], [5, t('set.idle5m')], [10, t('set.idle10m')], [30, t('set.idle30m')], [60, t('set.idle1h')], [0, t('set.idleNever')]]}
          hint={t('set.idleSystemHint')} />
        <Toggle label={t('set.idleScreenLock')} description={t('set.screenLockDesc')} checked disabled onChange={() => {}} />
        <Toggle label={t('set.idleSleep')} checked={s.lockOnSleep} onChange={(v) => set({ lockOnSleep: v })} />
        <Toggle label={t('set.idleMinimize')} checked={s.lockOnMinimize} onChange={(v) => set({ lockOnMinimize: v })} />
      </section>
      <section className="settings-group">
        <h3>{t('set.secClipboard')}</h3>
        <NumberSelect label={t('set.clip')} value={s.clipboardSeconds} onChange={(v) => set({ clipboardSeconds: v })}
          options={[[10, t('set.clip10')], [15, t('set.clip15')], [20, t('set.clip20')], [30, t('set.clip30')], [60, t('set.clip60')], [0, t('set.clipNever')]]}
          hint={t('set.clipHint')} />
      </section>
      <section className="settings-group">
        <h3>{t('set.secProtection')}</h3>
        <Toggle label={t('set.contentProtect')} description={t('set.cpDesc')}
          checked={prefs.contentProtection !== false} onChange={(v) => setPref({ contentProtection: v })} />
        <NumberSelect label={t('set.selfDestruct')} value={prefs.wipeAfter || 0} onChange={(v) => setPref({ wipeAfter: v })}
          options={[[0, t('set.sdOff')], [10, t('set.sd10')], [20, t('set.sd20')]]}
          hint={t('set.sdHint')} />
        <NumberSelect label={t('set.expiry')} value={s.passwordMaxAgeDays} onChange={(v) => set({ passwordMaxAgeDays: v })}
          options={[[90, t('set.exp90')], [180, t('set.exp180')], [365, t('set.exp1y')], [730, t('set.exp2y')], [0, t('set.expOff')]]} />
      </section>
      <section className="settings-group">
        <h3>{t('set.behavior')}</h3>
        <Toggle label={t('set.closeToTray')} description={t('set.closeToTrayHint')}
          checked={prefs.closeToTray === true} onChange={(v) => setPref({ closeToTray: v })} />
        <Toggle label={t('set.globalHotkey')} description={t('set.globalHotkeyHint')}
          checked={prefs.globalHotkey === true} onChange={(v) => setPref({ globalHotkey: v })} />
      </section>
      <section className="settings-group">
        <h3>{t('set.bridge')}</h3>
        <p className="field-hint">{t('set.bridgeHint')}</p>
        <Toggle label={t('set.bridgeEnable')} checked={prefs.browserBridge === true} onChange={toggleBridge} />
        {prefs.browserBridge && prefs.bridgeToken && (
          <div className="stack gap-2">
            <code className="break mono">{prefs.bridgeToken}</code>
            <div className="row gap-2">
              <Button size="sm" icon="copy" onClick={async () => { await window.ck.copy(prefs.bridgeToken, { sensitive: false }); toast(t('app.copied'), 'ok'); }}>{t('set.bridgeCopy')}</Button>
              <Button size="sm" variant="ghost" onClick={regenBridgeToken}>{t('set.bridgeRegen')}</Button>
            </div>
            <p className="field-hint">{t('set.bridgeTokenHint')}</p>
          </div>
        )}
      </section>
      <p className="field-hint">{t('set.memHint')}</p>
    </div>
  );
}

function SuperKeyTab({ data, commit }) {
  useI18n();
  const [mode, setMode] = useState('export');
  const [master, setMaster] = useState('');
  const [useTransfer, setUseTransfer] = useState(false);
  const [transfer, setTransfer] = useState('');
  const [sk, setSk] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [input, setInput] = useState('');
  const [pass, setPass] = useState('');
  const [preview, setPreview] = useState(null);
  const toast = useToast();

  const doExport = async () => {
    setBusy(true); setErr('');
    try {
      const out = await window.ck.superKeyExport(data, master, useTransfer ? transfer : undefined);
      setSk(out);
      setMaster('');
      commit((cur) => appendAudit(cur, 'superkey', t('set.skAuditChars', { n: out.length.toLocaleString() })));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const doPeek = async () => {
    setBusy(true); setErr('');
    try {
      const r = await window.ck.superKeyPeek(input, pass);
      const m = mergeVaults(data, r.data);
      setPreview({ ...m, incoming: r.data, exportedAt: r.exportedAt, total: (r.data.items || []).length });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const doMerge = () => {
    // 以当前最新数据重新合并,避免预览期间的修改被预览快照覆盖
    commit((cur) => { const m = mergeVaults(cur, preview.incoming); return appendAudit(m.data, 'import', t('set.skMerged', { added: m.added, updated: m.updated })); }, { snapshot: 'force' });
    toast(t('set.toastMerged', { added: preview.added, updated: preview.updated }), 'ok');
    setPreview(null); setInput(''); setPass('');
  };

  return (
    <div className="stack gap-4">
      <p>{t('set.skIntro')}</p>
      <dl className="spec">
        <div><dt>{t('set.specDeriveDt')}</dt><dd>{t('set.specDerive')}</dd></div>
        <div><dt>{t('set.specEncryptDt')}</dt><dd>{t('set.specEncrypt')}</dd></div>
        <div><dt>{t('set.specEncDt')}</dt><dd>{t('set.specEnc')}</dd></div>
      </dl>
      <Segmented label={t('set.skSegmented')} value={mode} onChange={(m) => { setMode(m); setErr(''); }} options={[{ value: 'export', label: t('set.skExport') }, { value: 'import', label: t('set.skImport') }]} />

      {mode === 'export' ? (
        sk ? (
          <div className="stack gap-3">
            <Field label={t('set.skYourChars', { n: sk.length.toLocaleString() })}>
              {(id) => <textarea id={id} className="input mono sk-output" rows={8} readOnly value={sk} onFocus={(e) => e.target.select()} />}
            </Field>
            <div className="row gap-2 wrap">
              <Button variant="primary" icon="copy" onClick={async () => { await window.ck.copy(sk, { sensitive: false }); toast(t('set.skCopy'), 'ok'); }}>{t('set.skCopy')}</Button>
              <Button icon="download" onClick={() => window.ck.saveFile({ title: t('set.skSaveTitle'), defaultName: `ChronoKey-${t('set.skFileBase')}-${new Date().toISOString().slice(0, 10)}.cksk`, content: sk, filters: [{ name: t('set.skFile'), extensions: ['cksk', 'txt'] }] })}>{t('set.skSaveAs')}</Button>
              <Button variant="ghost" onClick={() => setSk('')}>{t('set.skDone')}</Button>
            </div>
            <p className="field-hint">{t('set.skSnapshotNote')}</p>
          </div>
        ) : (
          <div className="stack gap-3">
            <Field label={t('set.skConfirmMaster')} error={err}>
              {(id) => <SecretInput id={id} value={master} onChange={setMaster} autoComplete="current-password" />}
            </Field>
            <Toggle label={t('set.skTransferToggle')} description={t('set.skTransferHint')} checked={useTransfer} onChange={setUseTransfer} />
            {useTransfer && (
              <>
                <Field label={t('set.skTransferPass')} hint={t('set.skTransferPassHint')}>
                  {(id) => <SecretInput id={id} value={transfer} onChange={setTransfer} />}
                </Field>
                {transfer && <StrengthMeter result={estimate(transfer)} />}
              </>
            )}
            <Button variant="primary" icon="superkey" disabled={busy || !master || (useTransfer && transfer.length < 10)} onClick={doExport}>
              {busy ? t('set.skGenerating') : t('set.skGenerate')}
            </Button>
          </div>
        )
      ) : preview ? (
        <div className="stack gap-3">
          <p dangerouslySetInnerHTML={{ __html: t('set.skImportNote', { at: formatTime(preview.exportedAt), total: preview.total, added: preview.added, updated: preview.updated }) }} />
          <div className="row gap-2">
            <Button variant="primary" onClick={doMerge} disabled={!preview.added && !preview.updated}>{t('set.skConfirmMerge')}</Button>
            <Button onClick={() => setPreview(null)}>{t('set.skCancel')}</Button>
          </div>
        </div>
      ) : (
        <div className="stack gap-3">
          <Field label={t('set.skField')} hint={t('set.skFieldHint')}>
            {(id) => <textarea id={id} className="input mono sk-input" rows={5} value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />}
          </Field>
          <Button size="sm" icon="upload" onClick={async () => { const f = await window.ck.openFile({ title: t('set.skOpenFileTitle'), filters: [{ name: t('set.skFile'), extensions: ['cksk', 'txt'] }] }); if (f) setInput(f.content); }}>{t('set.skOpenFileBtn')}</Button>
          <Field label={t('set.skPassField')} error={err}>
            {(id) => <SecretInput id={id} value={pass} onChange={setPass} />}
          </Field>
          <Button variant="primary" disabled={busy || !input.trim() || !pass} onClick={doPeek}>{busy ? t('set.skDecrypting') : t('set.skDecryptPreview')}</Button>
        </div>
      )}
    </div>
  );
}

function BackupTab({ data, commit }) {
  useI18n();
  const [list, setList] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();
  const load = () => window.ck.backupList().then(setList);
  useEffect(() => { load(); }, []);
  return (
    <div className="stack gap-4">
      <p className="field-hint">{t('set.snapHint')}</p>
      <div className="row gap-2 wrap">
        <Button variant="primary" icon="download" onClick={async () => { try { await window.ck.backupCreate(); commit((cur) => appendAudit(cur, 'backup', t('set.snapshotManual'))); toast(t('set.snapshotCreated'), 'ok'); load(); } catch (e) { toast(tr(e.message), 'danger'); } }}>{t('set.snapNow')}</Button>
        <Button icon="folder" onClick={() => window.ck.backupOpenFolder()}>{t('set.snapOpenDir')}</Button>
      </div>
      <NumberSelect label={t('set.snapKeepLabel')} value={data.settings.backupKeep} onChange={(v) => commit((cur) => ({ ...cur, settings: { ...cur.settings, backupKeep: v } }))}
        options={[[5, t('set.keep5')], [10, t('set.keep10')], [20, t('set.keep20')], [50, t('set.keep50')], [100, t('set.keep100')]]} />
      <ul className="backup-list">
        {list?.map((b) => (
          <li key={b.name}>
            <Icon name="history" />
            <div className="list-text">
              <span className="list-name">{formatTime(b.time)}</span>
              <span className="list-sub mono">{b.name} · {(b.size / 1024).toFixed(1)} KB</span>
            </div>
            <Button size="sm" onClick={() => setConfirm(b)}>{t('set.snapRestore')}</Button>
          </li>
        ))}
        {list && !list.length && <li className="field-hint">{t('set.snapEmpty')}</li>}
      </ul>
      {confirm && (
        <Modal title={t('set.snapModalTitle')} width={440} onClose={() => setConfirm(null)}
          footer={<><Button onClick={() => setConfirm(null)}>{t('set.snapCancel')}</Button><Button variant="primary" onClick={async () => { try { await window.ck.backupRestore(confirm.name); } catch (e) { toast(tr(e.message), 'danger'); setConfirm(null); } }}>{t('set.snapRestoreLock')}</Button></>}>
          <p dangerouslySetInnerHTML={{ __html: t('set.snapRestoreNote', { at: formatTime(confirm.time) }) }} />
        </Modal>
      )}
    </div>
  );
}

function DataTab({ data, commit }) {
  useI18n();
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [exportFmt, setExportFmt] = useState(null);
  const [pw, setPw] = useState('');
  const toast = useToast();

  const doImport = async () => {
    setErr('');
    try {
      const f = await window.ck.openFile({ title: t('set.importChoose'), filters: [{ name: t('set.importLabel'), extensions: ['csv', 'json', 'xml'] }] });
      if (!f) return;
      const r = importAuto(f.name, f.content);
      if (!r.items.length) throw new Error(tr('文件里没有可导入的条目'));
      setResult({ name: f.name, ...r });
    } catch (e) { setErr(e.message); }
  };

  const confirmImport = () => {
    const n = result.items.length;
    commit((cur) => {
      const folders = [...cur.folders];
      const remap = new Map();
      for (const f of result.folders || []) {
        if (!f?.id || !f?.name) continue;
        const hit = folders.find((x) => x.name === f.name);
        if (hit) remap.set(f.id, hit.id); else { folders.push(f); remap.set(f.id, f.id); }
      }
      const taken = new Set(cur.items.map((i) => i.id));
      const items = result.items.map(normalizeItem).map((i) => ({
        ...i,
        id: taken.has(i.id) ? crypto.randomUUID() : i.id,   // 重复导入同一文件时不覆盖已有条目
        folderId: i.folderId ? remap.get(i.folderId) || null : null,
      }));
      return appendAudit({ ...cur, folders, items: [...items, ...cur.items] }, 'import', t('set.importedAudit', { fmt: result.format, n }));
    }, { snapshot: 'force' });
    toast(t('set.importedToast', { n }), 'ok');
    setResult(null);
  };

  const doExport = async () => {
    if (!pw) return;
    if (!(await window.ck.verify(pw))) { setErr(tr('主密码错误')); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    const cfg = {
      csv: { content: exportCsv(data.items), name: `ChronoKey-${stamp}.csv`, ext: 'csv' },
      bitwarden: { content: exportBitwardenJson(data), name: `ChronoKey-bitwarden-${stamp}.json`, ext: 'json' },
      json: { content: exportChronoJson(data), name: `ChronoKey-${stamp}.json`, ext: 'json' },
    }[exportFmt];
    const path = await window.ck.saveFile({ title: t('set.exportTitleWin'), defaultName: cfg.name, content: cfg.content, filters: [{ name: cfg.ext.toUpperCase(), extensions: [cfg.ext] }] });
    if (path) { commit((cur) => appendAudit(cur, 'export', t('set.exportPlainAudit', { fmt: exportFmt }))); toast(t('set.exportDone'), 'info', 5000); }
    setExportFmt(null); setPw(''); setErr('');
  };

  return (
    <div className="stack gap-4">
      <section className="settings-group">
        <h3>{t('set.importTitle')}</h3>
        <p className="field-hint">{t('set.importHint')}</p>
        <Button icon="upload" onClick={doImport}>{t('set.importBtn')}</Button>
        {err && !exportFmt && <p className="field-error" role="alert"><Icon name="alert" size={14} />{err}</p>}
        {result && (
          <div className="stack gap-2">
            <p dangerouslySetInnerHTML={{ __html: t('set.importPreview', { name: result.name, fmt: result.format, items: result.items.length, folders: result.folders.length, totp: result.items.filter((i) => i.fields.totp).length }) }} />
            <div className="row gap-2"><Button variant="primary" size="sm" onClick={confirmImport}>{t('set.importBtnSm')}</Button><Button size="sm" onClick={() => setResult(null)}>{t('set.importCancel')}</Button></div>
          </div>
        )}
      </section>
      <section className="settings-group">
        <h3>{t('set.exportTitle')}</h3>
        <div className="callout warning"><Icon name="alert" size={16} /><p dangerouslySetInnerHTML={{ __html: t('set.exportWarn') }} /></div>
        <div className="row gap-2 wrap">
          <Button onClick={() => setExportFmt('csv')}>{t('set.exportCsv')}</Button>
          <Button onClick={() => setExportFmt('bitwarden')}>{t('set.exportBitwarden')}</Button>
          <Button onClick={() => setExportFmt('json')}>{t('set.exportJson')}</Button>
        </div>
      </section>
      {exportFmt && (
        <Modal title={t('set.exportConfirmTitle')} width={420} onClose={() => { setExportFmt(null); setErr(''); }}
          footer={<><Button onClick={() => setExportFmt(null)}>{t('set.importCancel')}</Button><Button variant="danger" disabled={!pw} onClick={doExport}>{t('set.exportBtn')}</Button></>}>
          <Field label={t('set.exportConfirmLabel')} error={err}>{(id) => <SecretInput id={id} value={pw} onChange={setPw} onKeyDown={(e) => e.key === 'Enter' && pw && doExport()} />}</Field>
        </Modal>
      )}
    </div>
  );
}

function AccountTab({ data, commit }) {
  useI18n();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rcPw, setRcPw] = useState('');
  const [newCode, setNewCode] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetPw, setResetPw] = useState('');
  const [resetErr, setResetErr] = useState('');
  const est = next ? estimate(next) : null;

  const change = async () => {
    if (next !== next2) return setMsg({ tone: 'danger', text: t('set.accountMismatch') });
    if (next.length < 10 || est.score < 2) return setMsg({ tone: 'danger', text: t('set.accountTooWeak') });
    setBusy(true);
    try {
      await window.ck.changePassword(cur, next);
      commit((cur) => appendAudit(cur, 'password', ''));
      setMsg({ tone: 'ok', text: t('set.accountChanged') });
      setCur(''); setNext(''); setNext2('');
    } catch (e) { setMsg({ tone: 'danger', text: tr(e.message) }); } finally { setBusy(false); }
  };

  const rotate = async () => {
    setBusy(true);
    try {
      const r = await window.ck.rotateRecovery(rcPw);
      setNewCode(r.recoveryCode); setRcPw('');
      commit((cur) => appendAudit(cur, 'recovery', t('set.regenRecovery')));
    } catch (e) { setMsg({ tone: 'danger', text: tr(e.message) }); } finally { setBusy(false); }
  };

  const doReset = async () => {
    if (!resetPw || busy) return;
    setResetErr(''); setBusy(true);
    try {
      if (!(await window.ck.verify(resetPw))) { setResetErr(tr('主密码错误')); return; }
      // 主进程删除后会发出 vault:locked('reset'),界面自动回到初始设置
      await window.ck.reset();
    } catch (e) { setResetErr(tr(e.message)); } finally { setBusy(false); }
  };

  return (
    <div className="stack gap-4">
      <section className="settings-group">
        <h3>{t('set.accountChgTitle')}</h3>
        <p className="field-hint">{t('set.accountChgHint')}</p>
        <Field label={t('set.accountCur')}>{(id) => <SecretInput id={id} value={cur} onChange={setCur} autoComplete="current-password" />}</Field>
        <Field label={t('set.accountNew')}>{(id) => <SecretInput id={id} value={next} onChange={setNext} autoComplete="new-password" />}</Field>
        <StrengthMeter result={est} />
        <Field label={t('set.accountNew2')}>{(id) => <SecretInput id={id} value={next2} onChange={setNext2} autoComplete="new-password" />}</Field>
        {msg && <p className={msg.tone === 'ok' ? 'field-ok' : 'field-error'} role="status">{msg.text}</p>}
        <Button variant="primary" disabled={busy || !cur || !next} onClick={change}>{t('set.accountChgBtn')}</Button>
      </section>
      <section className="settings-group">
        <h3>{t('set.recoveryTitle')}</h3>
        <p className="field-hint">{t('set.recoveryHint')}</p>
        {newCode ? (
          <>
            <div className="recovery-code">{newCode.split('-').map((g, i) => <span key={i}>{g}</span>)}</div>
            <Button icon="copy" onClick={() => window.ck.copy(newCode, { sensitive: true })}>{t('set.recoveryCopy')}</Button>
          </>
        ) : (
          <div className="row gap-2">
            <SecretInput value={rcPw} onChange={setRcPw} ariaLabel={t('set.recoveryAria')} placeholder={t('set.recoveryMaster')} />
            <Button disabled={!rcPw || busy} onClick={rotate}>{t('set.recoveryRegen')}</Button>
          </div>
        )}
      </section>
      <section className="settings-group">
        <h3>{t('set.resetTitle')}</h3>
        <p className="field-hint" dangerouslySetInnerHTML={{ __html: t('set.resetHint') }} />
        <Button variant="danger" icon="trash" onClick={() => setResetConfirm(true)}>{t('set.resetBtn')}</Button>
      </section>
      {resetConfirm && (
        <Modal title={t('set.resetModalTitle')} width={480} onClose={() => { setResetConfirm(false); setResetPw(''); setResetErr(''); }}
          footer={<><Button onClick={() => { setResetConfirm(false); setResetPw(''); setResetErr(''); }}>{t('set.importCancel')}</Button><Button variant="danger" disabled={!resetPw || busy} onClick={doReset}>{busy ? t('set.resetDelAlling') : t('set.resetDelAll')}</Button></>}>
          <div className="stack gap-3">
            <div className="callout warning"><Icon name="alert" size={16} /><p dangerouslySetInnerHTML={{ __html: t('set.resetWarn') }} /></div>
            <ul className="bullet-list">
              <li>{t('set.resetL1')}</li>
              <li>{t('set.resetL2')}</li>
              <li>{t('set.resetL3')}</li>
              <li>{t('set.resetL4')}</li>
              <li>{t('set.resetL5')}</li>
            </ul>
            <p>{t('set.resetNote')}</p>
            <Field label={t('set.resetConfirm')} error={resetErr}>{(id) => <SecretInput id={id} value={resetPw} onChange={setResetPw} onKeyDown={(e) => e.key === 'Enter' && resetPw && doReset()} />}</Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AppearanceTab({ status, refresh }) {
  useI18n();
  const toast = useToast();
  const [theme, setTheme] = useState(status.prefs.theme);
  const [langUpd, setLangUpd] = useState(null); // null | 'busy'

  // 从最新 release 拉取全部语言包(SHA-256 由主进程校验),成功后即时重新注册
  const updateLangPacks = async () => {
    setLangUpd('busy');
    try {
      const r = await window.ck.localesUpdate();
      for (const { code, label } of await window.ck.listLocales()) {
        if (['zh', 'en', 'ru'].includes(code)) continue;
        const pack = await window.ck.readLocale(code);
        registerLocale(pack.code, pack.label || label, pack.dict);
      }
      toast(t('set.langUpdDone', { v: r.version, n: r.installed }), 'info', 4000);
    } catch (e) {
      toast(tr(e), 'danger', 5000);
    }
    setLangUpd(null);
  };
  return (
    <div className="stack gap-4">
      <section className="settings-group">
        <h3>{t('set.appearanceTheme')}</h3>
        <Segmented label={t('set.appearanceTheme')} value={theme} onChange={async (v) => { setTheme(v); await window.ck.setPrefs({ theme: v }); refresh(); }}
          options={[{ value: 'system', label: t('set.themeSystem') }, { value: 'light', label: t('set.themeWashi') }, { value: 'dark', label: t('set.themeInk') }]} />
        <div className="swatches" aria-hidden="true">
          {[['#F6F3EC', t('set.paletteWashi')], ['#5E6420', t('set.paletteMoss')], ['#91AD70', t('set.paletteWillow')], ['#B54434', t('set.paletteBirch')], ['#E2943B', t('set.paletteBasswood')], ['#B4A582', t('set.paletteMatcha')], ['#1F1E1B', t('set.paletteInk')]].map(([c, n]) => (
            <span key={c} className="swatch"><i style={{ background: c }} />{n}</span>
          ))}
        </div>
        <p className="field-hint">{t('set.appearanceNote')}</p>
      </section>
      <section className="settings-group">
        <h3>{t('set.appearanceKbd')}</h3>
        <dl className="shortcuts">
          {[[`${modKey}F`, t('set.aboutSearch')], [`${modKey}N`, t('set.aboutNewLogin')], [`${modKey}S`, t('set.aboutSaveEdit')], [`${modKey}G`, t('set.aboutGenerator')], [`${modKey}L`, t('set.aboutLockNow')], [`${modKey},`, t('set.aboutSettings')], ['↑ ↓', t('set.aboutMoveList')], ['Esc', t('set.aboutCancel')]].map(([k, v]) => (
            <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>
      <section className="settings-group">
        <h3>{t('set.language')}</h3>
        <Field label={t('set.language')}>
          {(id) => (
            <select id={id} className="input" value={getLang()}
              onChange={async (e) => { const v = e.target.value; setLang(v); document.documentElement.lang = getLang(); await window.ck.setPrefs({ lang: v }); refresh(); }}>
              {getLangs().map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          )}
        </Field>
        {window.ck?.localesUpdate && (
          <p>
            <Button size="small" disabled={langUpd === 'busy'} onClick={updateLangPacks}>
              {langUpd === 'busy' ? t('set.langUpdDoing') : t('set.langUpdBtn')}
            </Button>
          </p>
        )}
        <p className="field-hint">{t('set.languageHint')}</p>
      </section>
    </div>
  );
}

function AboutTab({ status }) {
  useI18n();
  const [updState, setUpdState] = useState(null); // null | 'checking' | {ok, data} | {err, msg}
  const [integ, setInteg] = useState(null); // null | 'checking' | {state, ...}
  const doCheck = async () => {
    setUpdState('checking');
    try {
      const data = await window.ck.updateCheck();
      setUpdState({ ok: true, data });
    } catch (e) {
      setUpdState({ err: e.message || String(e) });
    }
  };

  // 程序文件完整性:与 GitHub 上当前版本的清单逐文件核对;只读,不动任何用户数据
  const doVerify = async () => {
    setInteg('checking');
    try {
      const r = await window.ck.repairList();
      setInteg({ state: r.supported === false ? 'unsupported' : r.manifest === false ? 'nomanifest' : r.issues.length ? 'issues' : 'ok', data: r });
    } catch (e) {
      setInteg({ state: 'error', msg: e.message || String(e) });
    }
  };
  const doRepair = async () => {
    setInteg((s) => ({ ...s, state: 'repairing' }));
    try {
      const r = await window.ck.repairFix(integ.data.issues.map((i) => i.path));
      const again = await window.ck.repairList();
      setInteg({ state: again.supported && again.manifest && again.issues.length ? 'issues' : 'ok', data: again, repaired: r.fixed, failed: r.failed || [] });
    } catch (e) {
      setInteg({ state: 'error', msg: e.message || String(e) });
    }
  };
  return (
    <div className="stack gap-3">
      <p><b>{t('set.aboutName')}</b> v{status.version} · {t('set.aboutLic')}</p>
      <dl className="spec">
        <div><dt>{t('set.aboutEnc')}</dt><dd>{t('set.aboutEncVal')}</dd></div>
        <div><dt>{t('set.aboutNet')}</dt><dd>{t('set.aboutNetVal')}</dd></div>
        <div><dt>{t('set.aboutDataDir')}</dt><dd><code className="break">{status.dataDir}</code>{status.portable && ` ${t('set.portable')}`}</dd></div>
      </dl>
      {updState === null && (
        <Button variant="ghost" onClick={doCheck}>{t('set.updCheckBtn')}</Button>
      )}
      {updState === 'checking' && (
        <p className="field-hint">{t('set.updChecking')}</p>
      )}
      {updState && updState.ok && !updState.data.updateAvailable && (
        <p className="field-hint ok">{t('set.updUpToDate', { v: updState.data.latest })}</p>
      )}
      {updState && updState.ok && updState.data.updateAvailable && (
        <a className="link" href="#" onClick={(e) => { e.preventDefault(); window.ck.openExternal(updState.data.url); }}
           dangerouslySetInnerHTML={{ __html: t('set.updNew', { v: updState.data.latest }) }} />
      )}
      {updState && updState.err && (
        <p className="field-hint warn">{t('set.updError')}: {updState.err}</p>
      )}

      {window.ck?.repairList && integ === null && (
        <Button variant="ghost" onClick={doVerify}>{t('set.integrityBtn')}</Button>
      )}
      {integ === 'checking' && <p className="field-hint">{t('set.integrityChecking')}</p>}
      {integ === 'repairing' && <p className="field-hint">{t('set.integrityRepairing')}</p>}
      {integ && integ.state === 'unsupported' && <p className="field-hint">{t('set.integrityUnsupported')}</p>}
      {integ && integ.state === 'nomanifest' && <p className="field-hint">{t('set.integrityNoManifest')}</p>}
      {integ && integ.state === 'ok' && (
        <p className="field-hint ok">
          {t('set.integrityOk', { n: integ.data.total })}
          {integ.repaired > 0 && ` · ${t('set.integrityRepaired', { n: integ.repaired })}`}
        </p>
      )}
      {integ && integ.state === 'issues' && (
        <div className="stack gap-2">
          <p className="field-hint warn">{t('set.integrityIssues', { n: integ.data.issues.length })}</p>
          <ul className="bullet-list mono">
            {integ.data.issues.map((i) => (
              <li key={i.path}><code className="break">{i.path}</code> — {i.status === 'missing' ? t('set.integrityMissing') : t('set.integrityModified')}</li>
            ))}
          </ul>
          <p><Button variant="primary" onClick={doRepair}>{t('set.integrityRepair')}</Button></p>
        </div>
      )}
      {integ && integ.state === 'error' && (
        <p className="field-hint warn">{t('set.updError')}: {integ.msg}</p>
      )}
      <p className="field-hint" dangerouslySetInnerHTML={{ __html: t('set.portableNote') }} />
      <p className="field-hint">{t('set.wordlistNote')}</p>
    </div>
  );
}

export function Settings({ initialTab = 'security', data, status, commit, refresh, onClose }) {
  useI18n();
  const [tab, setTab] = useState(initialTab);
  const props = { data, status, commit, refresh };
  return (
    <Modal title={t('set.settingsTitle')} onClose={onClose} width={820}>
      <div className="settings">
        <nav className="settings-nav" aria-label={t('set.settingsNavLabel')}>
          {TABS.map((item) => (
            <button key={item.id} type="button" className={`side-row ${tab === item.id ? 'active' : ''}`} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>
              <span className="side-label">{item.label()}</span>
            </button>
          ))}
        </nav>
        <div className="settings-body">
          <h2 className="settings-title">{TABS.find((item) => item.id === tab).label()}</h2>
          {tab === 'security' && <SecurityTab {...props} />}
          {tab === 'superkey' && <SuperKeyTab {...props} />}
          {tab === 'backup' && <BackupTab {...props} />}
          {tab === 'data' && <DataTab {...props} />}
          {tab === 'account' && <AccountTab {...props} />}
          {tab === 'appearance' && <AppearanceTab {...props} />}
          {tab === 'about' && <AboutTab {...props} />}
        </div>
      </div>
    </Modal>
  );
}
