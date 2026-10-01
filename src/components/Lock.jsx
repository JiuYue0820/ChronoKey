import { useEffect, useState } from 'react';
import { BrandMark, Button, Field, Icon, Modal, SecretInput, StrengthMeter } from './ui.jsx';
import { estimate } from '../lib/strength.js';
import { emptyVault, appendAudit } from '../lib/model.js';
import { MatrixBackdrop } from './Backdrop.jsx';
import { t, tr } from '../i18n-react.js';

const resetWord = () => t('lock.resetWord');

function Screen({ children }) {
  return (
    <div className="lock-screen">
      <MatrixBackdrop />
      {children}
    </div>
  );
}

function Brand({ subtitle }) {
  return (
    <div className="lock-brand">
      <span className="lock-mark"><BrandMark size={40} /></span>
      <h1>ChronoKey</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function RecoveryCodeCard({ code, onDone, doneLabel = t('lock.enter') }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="lock-card">
      <Brand subtitle={t('lock.keepRecovery')} />
      <div className="callout warning">
        <Icon name="alert" size={16} />
        <p>{t('lock.recoveryOnly')}</p>
      </div>
      <div className="recovery-code" aria-label={t('lock.recoveryCode')}>
        {code.split('-').map((g, i) => <span key={i}>{g}</span>)}
      </div>
      <div className="row gap-2 center">
        <Button icon={copied ? 'check' : 'copy'} onClick={async () => { await window.ck.copy(code, { sensitive: true }); setCopied(true); }}>
          {copied ? t('lock.copied') : t('lock.copy')}
        </Button>
        <Button icon="download" onClick={() => window.ck.saveFile({
          title: t('lock.saveRecovery'), defaultName: t('lock.recoveryFileName'),
          content: t('lock.recoveryFileContent', { date: new Date().toLocaleString(), code }),
          filters: [{ name: t('lock.text'), extensions: ['txt'] }],
        })}>{t('lock.saveAsFile')}</Button>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>{t('lock.checkedSaved')}</span>
      </label>
      <Button variant="primary" size="lg" className="w-full" disabled={!saved} onClick={onDone}>{doneLabel}</Button>
    </div>
  );
}

function NewPasswordForm({ submitLabel, busy, onSubmit, extra }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const est = pw ? estimate(pw) : null;
  const submit = (e) => {
    e.preventDefault();
    if (pw.length < 10) return setErr(t('lock.masterHint'));
    if (est.score < 2) return setErr(t('lock.masterWeak') + tr(est.warnings[0] || t('lock.increaseLen')));
    if (pw !== pw2) return setErr(t('lock.mismatch'));
    setErr('');
    onSubmit(pw);
  };
  return (
    <form onSubmit={submit} className="stack gap-3">
      <Field label={t('lock.master')} hint={t('lock.masterFieldHint')}>
        {(id) => <SecretInput id={id} value={pw} onChange={setPw} autoFocus autoComplete="new-password" />}
      </Field>
      <StrengthMeter result={est} />
      <Field label={t('lock.master2')} error={err}>
        {(id) => <SecretInput id={id} value={pw2} onChange={setPw2} autoComplete="new-password" />}
      </Field>
      {extra}
      <Button variant="primary" size="lg" className="w-full" type="submit" disabled={busy}>
        {busy ? t('lock.deriving') : submitLabel}
      </Button>
    </form>
  );
}

export function Setup({ onReady }) {
  const [step, setStep] = useState('welcome');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [sk, setSk] = useState('');
  const [skPass, setSkPass] = useState('');

  const create = async (pw) => {
    setBusy(true);
    try {
      const data = appendAudit(emptyVault(), 'create', t('lock.auditCreate'));
      const r = await window.ck.create(pw, data);
      setResult({ data, recoveryCode: r.recoveryCode });
      setStep('recovery');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const importSk = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await window.ck.superKeyCreate(sk, skPass);
      setResult({ data: appendAudit(r.data, 'import', t('lock.auditMigrate')), recoveryCode: r.recoveryCode });
      setStep('recovery');
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  if (step === 'recovery') return <Screen><RecoveryCodeCard code={result.recoveryCode} onDone={() => onReady(result.data)} /></Screen>;

  return (
    <Screen>
      <div className="lock-card">
        {step === 'welcome' && (
          <>
            <Brand subtitle={t('lock.tagline')} />
            <p className="lock-lede">
              {t('lock.welcomeLede')}
            </p>
            <div className="stack gap-2">
              <Button variant="primary" size="lg" className="w-full" onClick={() => setStep('create')}>{t('lock.createNew')}</Button>
              <Button size="lg" className="w-full" icon="superkey" onClick={() => setStep('import')}>{t('lock.iHaveSk')}</Button>
            </div>
          </>
        )}
        {step === 'create' && (
          <>
            <Brand subtitle={t('lock.setMaster')} />
            <NewPasswordForm submitLabel={t('lock.create')} busy={busy} onSubmit={create} />
            {error && <p className="field-error" role="alert">{tr(error)}</p>}
            <Button variant="ghost" onClick={() => setStep('welcome')}>{t('lock.back')}</Button>
          </>
        )}
        {step === 'import' && (
          <form className="stack gap-3" onSubmit={importSk}>
            <Brand subtitle={t('lock.restoreSuperkey')} />
            <Field label={t('lock.superkey')} hint={t('lock.superkeyHint')}>
              {(id) => <textarea id={id} className="input mono sk-input" rows={5} value={sk} onChange={(e) => setSk(e.target.value)} spellCheck={false} autoFocus />}
            </Field>
            <Field label={t('lock.skPassphrase')} hint={t('lock.skPassphraseHint')} error={error}>
              {(id) => <SecretInput id={id} value={skPass} onChange={setSkPass} />}
            </Field>
            <Button variant="primary" size="lg" className="w-full" type="submit" disabled={busy || !sk.trim() || !skPass}>
              {busy ? t('lock.decrypting') : t('lock.restoreCreate')}
            </Button>
            <Button variant="ghost" onClick={() => setStep('welcome')}>{t('lock.back')}</Button>
          </form>
        )}
      </div>
    </Screen>
  );
}

export function Unlock({ status, onReady, onReset }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);
  const [mode, setMode] = useState('unlock');
  const [code, setCode] = useState('');
  const [recovered, setRecovered] = useState(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetErr, setResetErr] = useState('');

  useEffect(() => {
    const until = status?.guard?.lockedUntil || 0;
    if (until > Date.now()) setWait(Math.ceil((until - Date.now()) / 1000));
  }, [status]);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const unlock = async (e) => {
    e.preventDefault();
    if (!pw || wait > 0) return;
    setBusy(true); setError('');
    try {
      const r = await window.ck.unlock(pw);
      setPw('');
      let data = appendAudit(r.data, 'unlock', '');
      if (r.failedAttempts) data = appendAudit(data, 'warn', t('lock.priorFailures', { n: r.failedAttempts }));
      onReady(data, r.failedAttempts);
    } catch (e2) {
      setError(e2.message);
      if (e2.code === 'LOCKED_OUT') setWait(Math.ceil(e2.waitMs / 1000));
      if (e2.code === 'WIPED') setTimeout(() => onReset?.(), 1500);
      setPw('');
    } finally { setBusy(false); }
  };

  const recover = async (newPw) => {
    if (code.replace(/[\s-]/g, '').length !== 25) { setError(t('lock.recoveryLen')); return; }
    setBusy(true); setError('');
    try {
      const r = await window.ck.recover(code, newPw);
      setRecovered({ data: appendAudit(r.data, 'recover', t('lock.auditRecover')), code: r.recoveryCode });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const closeReset = () => { if (resetBusy) return; setResetConfirm(false); setResetText(''); setResetErr(''); };
  // 用户已没有任何凭据,用输入确认词代替密码,防止误点
  const doReset = async () => {
    if (resetText.trim() !== resetWord()) return;
    setResetBusy(true); setResetErr('');
    try {
      await window.ck.reset();
      onReset?.();
    } catch (e) {
      setResetErr(e.message);
      setResetBusy(false);
    }
  };

  if (recovered) {
    return (
      <Screen>
        <RecoveryCodeCard code={recovered.code} onDone={() => onReady(recovered.data)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="lock-card">
        {mode === 'unlock' ? (
          <form onSubmit={unlock} className="stack gap-3">
            <Brand subtitle={t('lock.enterToUnlock')} />
            <Field label={t('lock.master')} error={error || (wait > 0 ? t('lock.waitRetry', { wait }) : '')}>
              {(id) => <SecretInput id={id} value={pw} onChange={setPw} autoFocus autoComplete="current-password" />}
            </Field>
            <Button variant="primary" size="lg" className="w-full" type="submit" disabled={busy || !pw || wait > 0} icon="unlock">
              {busy ? t('lock.unlocking') : t('lock.unlock')}
            </Button>
            <div className="row gap-2 wrap" style={{ justifyContent: 'center' }}>
              <Button variant="ghost" onClick={() => { setMode('recover'); setError(''); }}>{t('lock.forgotMaster')}</Button>
              <Button variant="ghost" onClick={() => setResetConfirm(true)}>{t('lock.forgotAll')}</Button>
            </div>
            {status?.platform === 'browser' && <p className="field-hint center">{t('lock.browserMode')}</p>}
          </form>
        ) : mode === 'recover' ? (
          <div className="stack gap-3">
            <Brand subtitle={t('lock.resetWithRecovery')} />
            <Field label={t('lock.recoveryCode')} hint={t('lock.recoveryHint')}>
              {(id) => <input id={id} className="input mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autoFocus spellCheck={false} />}
            </Field>
            <NewPasswordForm submitLabel={t('lock.verifySet')} busy={busy} onSubmit={recover} />
            {error && <p className="field-error" role="alert"><Icon name="alert" size={14} />{tr(error)}</p>}
            <Button variant="ghost" onClick={() => { setMode('unlock'); setError(''); }}>{t('lock.back')}</Button>
          </div>
        ) : null}
      </div>
      {resetConfirm && (
        <Modal title={t('lock.confirmDelete')} width={480} onClose={closeReset}
          footer={(
            <>
              <Button onClick={closeReset} disabled={resetBusy}>{t('lock.cancel')}</Button>
              <Button variant="danger" icon="trash" disabled={resetBusy || resetText.trim() !== resetWord()} onClick={doReset}>
                {resetBusy ? t('lock.deleting') : t('lock.deleteDesc')}
              </Button>
            </>
          )}>
          <div className="stack gap-3">
            <div className="callout warning">
              <Icon name="alert" size={16} />
              <div>
                <p><strong>{t('lock.bothForgotten')}</strong></p>
                <p>{t('lock.noServer')}</p>
              </div>
            </div>
            <p>{t('lock.willBeDeleted')}</p>
            <ul className="bullet-list">
              <li>{t('lock.delLi1')}</li>
              <li>{t('lock.delLi2')}</li>
              <li>{t('lock.delLi3')}</li>
              <li>{t('lock.delLi4')}</li>
            </ul>
            <p className="field-hint">{t('lock.savedElsewhere')}</p>
            <Field label={t('lock.typeConfirm', { w: resetWord() })} error={resetErr}>
              {(id) => (
                <input id={id} className="input" value={resetText} autoComplete="off" spellCheck={false}
                  onChange={(e) => setResetText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doReset(); } }} />
              )}
            </Field>
          </div>
        </Modal>
      )}
    </Screen>
  );
}
