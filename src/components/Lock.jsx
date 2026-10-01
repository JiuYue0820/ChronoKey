import { useEffect, useState } from 'react';
import { BrandMark, Button, Field, Icon, Modal, SecretInput, StrengthMeter } from './ui.jsx';
import { estimate } from '../lib/strength.js';
import { emptyVault, appendAudit } from '../lib/model.js';
import { MatrixBackdrop } from './Backdrop.jsx';

const RESET_WORD = '删除';

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

function RecoveryCodeCard({ code, onDone, doneLabel = '进入保险库' }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="lock-card">
      <Brand subtitle="请妥善保存你的恢复代码" />
      <div className="callout warning">
        <Icon name="alert" size={16} />
        <p>忘记主密码时,这是唯一的找回方式。ChronoKey 没有服务器,也没有后门,这串代码只显示这一次。</p>
      </div>
      <div className="recovery-code" aria-label="恢复代码">
        {code.split('-').map((g, i) => <span key={i}>{g}</span>)}
      </div>
      <div className="row gap-2 center">
        <Button icon={copied ? 'check' : 'copy'} onClick={async () => { await window.ck.copy(code, { sensitive: true }); setCopied(true); }}>
          {copied ? '已复制(稍后自动清空)' : '复制'}
        </Button>
        <Button icon="download" onClick={() => window.ck.saveFile({
          title: '保存恢复代码', defaultName: 'ChronoKey-恢复代码.txt',
          content: `ChronoKey 恢复代码\n生成时间:${new Date().toLocaleString()}\n\n${code}\n\n请离线保存(打印或写在纸上),不要和电脑放在一起。\n`,
          filters: [{ name: '文本', extensions: ['txt'] }],
        })}>保存为文件</Button>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>我已把恢复代码抄写或保存在安全的地方</span>
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
    if (pw.length < 10) return setErr('主密码至少 10 位。推荐 4 个以上随机单词组成的口令。');
    if (est.score < 2) return setErr('主密码太弱了:' + (est.warnings[0] || '请增加长度'));
    if (pw !== pw2) return setErr('两次输入不一致');
    setErr('');
    onSubmit(pw);
  };
  return (
    <form onSubmit={submit} className="stack gap-3">
      <Field label="主密码" hint="主密码不会被存储,只用于派生加密密钥(Argon2id)。">
        {(id) => <SecretInput id={id} value={pw} onChange={setPw} autoFocus autoComplete="new-password" />}
      </Field>
      <StrengthMeter result={est} />
      <Field label="再次输入" error={err}>
        {(id) => <SecretInput id={id} value={pw2} onChange={setPw2} autoComplete="new-password" />}
      </Field>
      {extra}
      <Button variant="primary" size="lg" className="w-full" type="submit" disabled={busy}>
        {busy ? '正在派生密钥…' : submitLabel}
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
      const data = appendAudit(emptyVault(), 'create', '创建保险库');
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
      setResult({ data: appendAudit(r.data, 'import', '从历史超密钥迁移'), recoveryCode: r.recoveryCode });
      setStep('recovery');
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  if (step === 'recovery') return <Screen><RecoveryCodeCard code={result.recoveryCode} onDone={() => onReady(result.data)} /></Screen>;

  return (
    <Screen>
      <div className="lock-card">
        {step === 'welcome' && (
          <>
            <Brand subtitle="离线密码管理器" />
            <p className="lock-lede">
              {'保险库只存在这台电脑上,用 Argon2id 派生的密钥和 AES-256-GCM 加密。换电脑时导出一串"历史超密钥",在新电脑粘贴即可带走全部条目、验证码和设置。'}
            </p>
            <div className="stack gap-2">
              <Button variant="primary" size="lg" className="w-full" onClick={() => setStep('create')}>创建新保险库</Button>
              <Button size="lg" className="w-full" icon="superkey" onClick={() => setStep('import')}>我有历史超密钥(从旧电脑迁移)</Button>
            </div>
          </>
        )}
        {step === 'create' && (
          <>
            <Brand subtitle="设置主密码" />
            <NewPasswordForm submitLabel="创建保险库" busy={busy} onSubmit={create} />
            {error && <p className="field-error" role="alert">{error}</p>}
            <Button variant="ghost" onClick={() => setStep('welcome')}>返回</Button>
          </>
        )}
        {step === 'import' && (
          <form className="stack gap-3" onSubmit={importSk}>
            <Brand subtitle="从历史超密钥恢复" />
            <Field label="历史超密钥" hint="以 CK1. 开头的一整串文本。换行、空格会被自动忽略。">
              {(id) => <textarea id={id} className="input mono sk-input" rows={5} value={sk} onChange={(e) => setSk(e.target.value)} spellCheck={false} autoFocus />}
            </Field>
            <Field label="超密钥口令" hint="导出时使用的口令(默认就是旧电脑上的主密码)。它会成为这台电脑上的主密码。" error={error}>
              {(id) => <SecretInput id={id} value={skPass} onChange={setSkPass} />}
            </Field>
            <Button variant="primary" size="lg" className="w-full" type="submit" disabled={busy || !sk.trim() || !skPass}>
              {busy ? '正在解密…' : '恢复并创建保险库'}
            </Button>
            <Button variant="ghost" onClick={() => setStep('welcome')}>返回</Button>
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
      if (r.failedAttempts) data = appendAudit(data, 'warn', `上次解锁前有 ${r.failedAttempts} 次失败尝试`);
      onReady(data, r.failedAttempts);
    } catch (e2) {
      setError(e2.message);
      if (e2.code === 'LOCKED_OUT') setWait(Math.ceil(e2.waitMs / 1000));
      if (e2.code === 'WIPED') setTimeout(() => onReset?.(), 1500);
      setPw('');
    } finally { setBusy(false); }
  };

  const recover = async (newPw) => {
    if (code.replace(/[\s-]/g, '').length !== 25) { setError('恢复代码应为 25 位(不含横线)'); return; }
    setBusy(true); setError('');
    try {
      const r = await window.ck.recover(code, newPw);
      setRecovered({ data: appendAudit(r.data, 'recover', '使用恢复代码重置主密码'), code: r.recoveryCode });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const closeReset = () => { if (resetBusy) return; setResetConfirm(false); setResetText(''); setResetErr(''); };
  // 用户已没有任何凭据,用输入确认词代替密码,防止误点
  const doReset = async () => {
    if (resetText.trim() !== RESET_WORD) return;
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
            <Brand subtitle="输入主密码以解锁" />
            <Field label="主密码" error={error || (wait > 0 ? `请等待 ${wait} 秒后再试` : '')}>
              {(id) => <SecretInput id={id} value={pw} onChange={setPw} autoFocus autoComplete="current-password" />}
            </Field>
            <Button variant="primary" size="lg" className="w-full" type="submit" disabled={busy || !pw || wait > 0} icon="unlock">
              {busy ? '正在解锁…' : '解锁'}
            </Button>
            <div className="row gap-2 wrap" style={{ justifyContent: 'center' }}>
              <Button variant="ghost" onClick={() => { setMode('recover'); setError(''); }}>忘记主密码?</Button>
              <Button variant="ghost" onClick={() => setResetConfirm(true)}>全部忘记?</Button>
            </div>
            {status?.platform === 'browser' && <p className="field-hint center">浏览器预览模式 · 演示密码:demo</p>}
          </form>
        ) : mode === 'recover' ? (
          <div className="stack gap-3">
            <Brand subtitle="使用恢复代码重置主密码" />
            <Field label="恢复代码" hint="25 位,大小写和横线都可以忽略">
              {(id) => <input id={id} className="input mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autoFocus spellCheck={false} />}
            </Field>
            <NewPasswordForm submitLabel="验证并设置新主密码" busy={busy} onSubmit={recover} />
            {error && <p className="field-error" role="alert"><Icon name="alert" size={14} />{error}</p>}
            <Button variant="ghost" onClick={() => { setMode('unlock'); setError(''); }}>返回</Button>
          </div>
        ) : null}
      </div>
      {resetConfirm && (
        <Modal title="删除当前保险库?" width={480} onClose={closeReset}
          footer={(
            <>
              <Button onClick={closeReset} disabled={resetBusy}>取消</Button>
              <Button variant="danger" icon="trash" disabled={resetBusy || resetText.trim() !== RESET_WORD} onClick={doReset}>
                {resetBusy ? '正在删除…' : '删除全部数据并重新开始'}
              </Button>
            </>
          )}>
          <div className="stack gap-3">
            <div className="callout warning">
              <Icon name="alert" size={16} />
              <div>
                <p><strong>主密码和恢复代码都忘记了?</strong></p>
                <p>ChronoKey 没有服务器和后门,任何人都无法解开这个保险库。唯一的办法是删除它,然后从头创建新的。</p>
              </div>
            </div>
            <p>以下内容会被永久删除,无法撤销:</p>
            <ul className="bullet-list">
              <li>所有登录、密码、两步验证密钥</li>
              <li>银行卡、身份、地址、笔记、API 密钥、SSH 密钥</li>
              <li>文件夹、标签、废纸篓与历史版本</li>
              <li>本机备份目录中的全部加密快照</li>
            </ul>
            <p className="field-hint">如果你在别处保存过"历史超密钥"并记得它的口令,删除后可以在初始界面用它恢复。</p>
            <Field label={`输入"${RESET_WORD}"以确认`} error={resetErr}>
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
