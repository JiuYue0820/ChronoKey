import { useEffect, useState } from 'react';
import { Button, Field, Icon, Modal, SecretInput, Segmented, Toggle, useToast, formatTime, StrengthMeter, modKey } from './ui.jsx';
import { appendAudit, mergeVaults, normalizeItem } from '../lib/model.js';
import { importAuto, exportCsv, exportBitwardenJson, exportChronoJson } from '../lib/importers.js';
import { estimate } from '../lib/strength.js';

const TABS = [
  { id: 'security', label: '安全' },
  { id: 'superkey', label: '历史超密钥' },
  { id: 'backup', label: '备份' },
  { id: 'data', label: '导入导出' },
  { id: 'account', label: '主密码' },
  { id: 'appearance', label: '外观' },
  { id: 'about', label: '关于' },
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
  const s = data.settings;
  const [prefs, setPrefs] = useState(status.prefs);
  const set = (patch) => {
    commit((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));
    window.ck.applySettings({ ...s, ...patch });
  };
  const setPref = async (patch) => { setPrefs(await window.ck.setPrefs(patch)); refresh(); };
  return (
    <div className="stack gap-4">
      <section className="settings-group">
        <h3>自动锁定</h3>
        <NumberSelect label="闲置后锁定" value={s.autoLockMinutes} onChange={(v) => set({ autoLockMinutes: v })}
          options={[[1, '1 分钟'], [2, '2 分钟'], [5, '5 分钟'], [10, '10 分钟'], [30, '30 分钟'], [60, '1 小时'], [0, '从不(不推荐)']]}
          hint="以系统级键鼠闲置时间为准" />
        <Toggle label="系统锁屏时锁定" description="Windows + L / 屏幕保护 / 合上盖子" checked disabled onChange={() => {}} />
        <Toggle label="系统休眠时锁定" checked={s.lockOnSleep} onChange={(v) => set({ lockOnSleep: v })} />
        <Toggle label="窗口最小化时锁定" checked={s.lockOnMinimize} onChange={(v) => set({ lockOnMinimize: v })} />
      </section>
      <section className="settings-group">
        <h3>剪贴板</h3>
        <NumberSelect label="复制密码后自动清空" value={s.clipboardSeconds} onChange={(v) => set({ clipboardSeconds: v })}
          options={[[10, '10 秒'], [15, '15 秒'], [20, '20 秒'], [30, '30 秒'], [60, '60 秒'], [0, '不清空']]}
          hint="只有剪贴板内容仍是 ChronoKey 复制的内容时才会清空,锁定时也会立即清空" />
      </section>
      <section className="settings-group">
        <h3>防护</h3>
        <Toggle label="防截屏 / 防录屏" description="Windows 使用 SetWindowDisplayAffinity,macOS 使用 NSWindow sharingType。截图工具中窗口会显示为黑色。"
          checked={prefs.contentProtection !== false} onChange={(v) => setPref({ contentProtection: v })} />
        <NumberSelect label="紧急自毁" value={prefs.wipeAfter || 0} onChange={(v) => setPref({ wipeAfter: v })}
          options={[[0, '关闭'], [10, '连续失败 10 次后擦除'], [20, '连续失败 20 次后擦除']]}
          hint="谨慎开启!擦除本机主库文件(备份目录保留)。连续失败 3 次后会进入指数退避等待。" />
        <NumberSelect label="密码过期提醒" value={s.passwordMaxAgeDays} onChange={(v) => set({ passwordMaxAgeDays: v })}
          options={[[90, '90 天'], [180, '180 天'], [365, '1 年'], [730, '2 年'], [0, '关闭']]} />
      </section>
      <p className="field-hint">内存保护:加密密钥只在主进程中,锁定时立即清零。已解密的条目要在界面进程显示,JavaScript 无法锁定内存页,锁定后这部分数据会被丢弃,由垃圾回收释放。</p>
    </div>
  );
}

function SuperKeyTab({ data, commit }) {
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
      commit((cur) => appendAudit(cur, 'superkey', `${out.length.toLocaleString()} 字符`));
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
    commit((cur) => { const m = mergeVaults(cur, preview.incoming); return appendAudit(m.data, 'import', `超密钥合并:新增 ${m.added},更新 ${m.updated}`); }, { snapshot: 'force' });
    toast(`已合并:新增 ${preview.added} 条,更新 ${preview.updated} 条`, 'ok');
    setPreview(null); setInput(''); setPass('');
  };

  return (
    <div className="stack gap-4">
      <p>历史超密钥把整个保险库,包括条目、历史版本、文件夹、设置和审计日志,压缩并加密成一串以 <code>CK1.</code> 开头的文本。在新电脑的 ChronoKey 里粘贴它并输入口令,就能完整迁移,不需要服务器。</p>
      <dl className="spec">
        <div><dt>密钥派生</dt><dd>Argon2id,64 MiB,3 轮,随机盐</dd></div>
        <div><dt>加密</dt><dd>AES-256-GCM,内容被改动时解密直接失败</dd></div>
        <div><dt>编码</dt><dd>gzip 压缩后 Base64URL,末尾 CRC32 用于发现复制错误</dd></div>
      </dl>
      <Segmented label="操作" value={mode} onChange={(m) => { setMode(m); setErr(''); }} options={[{ value: 'export', label: '导出(旧电脑)' }, { value: 'import', label: '导入合并(已有保险库)' }]} />

      {mode === 'export' ? (
        sk ? (
          <div className="stack gap-3">
            <Field label={`你的历史超密钥 · ${sk.length.toLocaleString()} 字符`}>
              {(id) => <textarea id={id} className="input mono sk-output" rows={8} readOnly value={sk} onFocus={(e) => e.target.select()} />}
            </Field>
            <div className="row gap-2 wrap">
              <Button variant="primary" icon="copy" onClick={async () => { await window.ck.copy(sk, { sensitive: false }); toast('已复制超密钥', 'ok'); }}>复制全部</Button>
              <Button icon="download" onClick={() => window.ck.saveFile({ title: '保存历史超密钥', defaultName: `ChronoKey-超密钥-${new Date().toISOString().slice(0, 10)}.cksk`, content: sk, filters: [{ name: 'ChronoKey 超密钥', extensions: ['cksk', 'txt'] }] })}>保存为文件</Button>
              <Button variant="ghost" onClick={() => setSk('')}>完成</Button>
            </div>
            <p className="field-hint">超密钥是导出那一刻的快照。复制后不会自动清空剪贴板(因为内容较长,方便粘贴到 U 盘文件或聊天窗口);用完请自行清除。</p>
          </div>
        ) : (
          <div className="stack gap-3">
            <Field label="确认主密码" error={err}>
              {(id) => <SecretInput id={id} value={master} onChange={setMaster} autoComplete="current-password" />}
            </Field>
            <Toggle label="使用单独的传输口令" description="默认用主密码加密。若要把超密钥交给他人保管或通过不太安全的渠道传输,可以另设一个更长的口令。" checked={useTransfer} onChange={setUseTransfer} />
            {useTransfer && (
              <>
                <Field label="传输口令" hint="在新电脑导入时,这个口令将成为新的主密码">
                  {(id) => <SecretInput id={id} value={transfer} onChange={setTransfer} />}
                </Field>
                {transfer && <StrengthMeter result={estimate(transfer)} />}
              </>
            )}
            <Button variant="primary" icon="superkey" disabled={busy || !master || (useTransfer && transfer.length < 10)} onClick={doExport}>
              {busy ? '正在生成…' : '生成历史超密钥'}
            </Button>
          </div>
        )
      ) : preview ? (
        <div className="stack gap-3">
          <p>超密钥导出于 {formatTime(preview.exportedAt)},共 {preview.total} 个条目。合并后将新增 <b>{preview.added}</b> 条,更新 <b>{preview.updated}</b> 条。同一条目以较新的修改为准,旧内容保留在历史版本中,本地独有的条目不受影响。</p>
          <div className="row gap-2">
            <Button variant="primary" onClick={doMerge} disabled={!preview.added && !preview.updated}>确认合并</Button>
            <Button onClick={() => setPreview(null)}>取消</Button>
          </div>
        </div>
      ) : (
        <div className="stack gap-3">
          <Field label="历史超密钥" hint="粘贴以 CK1. 开头的文本;也可以打开 .cksk 文件">
            {(id) => <textarea id={id} className="input mono sk-input" rows={5} value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />}
          </Field>
          <Button size="sm" icon="upload" onClick={async () => { const f = await window.ck.openFile({ title: '打开超密钥文件', filters: [{ name: 'ChronoKey 超密钥', extensions: ['cksk', 'txt'] }] }); if (f) setInput(f.content); }}>打开文件…</Button>
          <Field label="超密钥口令" error={err}>
            {(id) => <SecretInput id={id} value={pass} onChange={setPass} />}
          </Field>
          <Button variant="primary" disabled={busy || !input.trim() || !pass} onClick={doPeek}>{busy ? '正在解密…' : '解密并预览'}</Button>
        </div>
      )}
    </div>
  );
}

function BackupTab({ data, commit }) {
  const [list, setList] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();
  const load = () => window.ck.backupList().then(setList);
  useEffect(() => { load(); }, []);
  return (
    <div className="stack gap-4">
      <p className="field-hint">每次修改后最多每 10 分钟自动保存一份加密快照,删除条目前也会强制快照。快照是完整的加密保险库文件,需要当时的主密码才能打开。可以把整个备份目录用 U 盘 / Syncthing / 网盘同步到其他地方。</p>
      <div className="row gap-2 wrap">
        <Button variant="primary" icon="download" onClick={async () => { try { await window.ck.backupCreate(); commit((cur) => appendAudit(cur, 'backup', '手动快照')); toast('已创建快照', 'ok'); load(); } catch (e) { toast(e.message, 'danger'); } }}>立即备份</Button>
        <Button icon="folder" onClick={() => window.ck.backupOpenFolder()}>打开备份目录</Button>
      </div>
      <NumberSelect label="保留快照数量" value={data.settings.backupKeep} onChange={(v) => commit((cur) => ({ ...cur, settings: { ...cur.settings, backupKeep: v } }))}
        options={[[5, '5 份'], [10, '10 份'], [20, '20 份'], [50, '50 份'], [100, '100 份']]} />
      <ul className="backup-list">
        {list?.map((b) => (
          <li key={b.name}>
            <Icon name="history" />
            <div className="list-text">
              <span className="list-name">{formatTime(b.time)}</span>
              <span className="list-sub mono">{b.name} · {(b.size / 1024).toFixed(1)} KB</span>
            </div>
            <Button size="sm" onClick={() => setConfirm(b)}>恢复</Button>
          </li>
        ))}
        {list && !list.length && <li className="field-hint">还没有快照</li>}
      </ul>
      {confirm && (
        <Modal title="恢复到此快照?" width={440} onClose={() => setConfirm(null)}
          footer={<><Button onClick={() => setConfirm(null)}>取消</Button><Button variant="primary" onClick={async () => { try { await window.ck.backupRestore(confirm.name); } catch (e) { toast(e.message, 'danger'); setConfirm(null); } }}>恢复并锁定</Button></>}>
          <p>当前保险库会先自动快照一次,然后替换为 {formatTime(confirm.time)} 的版本并锁定。之后需要用<strong>那个时间点</strong>的主密码解锁。</p>
        </Modal>
      )}
    </div>
  );
}

function DataTab({ data, commit }) {
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [exportFmt, setExportFmt] = useState(null);
  const [pw, setPw] = useState('');
  const toast = useToast();

  const doImport = async () => {
    setErr('');
    try {
      const f = await window.ck.openFile({ title: '选择要导入的文件', filters: [{ name: '密码导出文件', extensions: ['csv', 'json', 'xml'] }] });
      if (!f) return;
      const r = importAuto(f.name, f.content);
      if (!r.items.length) throw new Error('文件里没有可导入的条目');
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
      return appendAudit({ ...cur, folders, items: [...items, ...cur.items] }, 'import', `${result.format} · ${n} 条`);
    }, { snapshot: 'force' });
    toast(`已导入 ${n} 条`, 'ok');
    setResult(null);
  };

  const doExport = async () => {
    if (!pw) return;
    if (!(await window.ck.verify(pw))) { setErr('主密码错误'); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    const cfg = {
      csv: { content: exportCsv(data.items), name: `ChronoKey-${stamp}.csv`, ext: 'csv' },
      bitwarden: { content: exportBitwardenJson(data), name: `ChronoKey-bitwarden-${stamp}.json`, ext: 'json' },
      json: { content: exportChronoJson(data), name: `ChronoKey-${stamp}.json`, ext: 'json' },
    }[exportFmt];
    const path = await window.ck.saveFile({ title: '导出(明文)', defaultName: cfg.name, content: cfg.content, filters: [{ name: cfg.ext.toUpperCase(), extensions: [cfg.ext] }] });
    if (path) { commit((cur) => appendAudit(cur, 'export', `${exportFmt} 明文导出`)); toast('已导出,请用完后立即删除该文件', 'info', 5000); }
    setExportFmt(null); setPw(''); setErr('');
  };

  return (
    <div className="stack gap-4">
      <section className="settings-group">
        <h3>导入</h3>
        <p className="field-hint">支持:Chrome / Edge / Firefox / Safari / 1Password / LastPass / Bitwarden 的 CSV,Bitwarden JSON(未加密),KeePass 2 XML,ChronoKey JSON。格式会自动识别。</p>
        <Button icon="upload" onClick={doImport}>选择文件…</Button>
        {err && !exportFmt && <p className="field-error" role="alert"><Icon name="alert" size={14} />{err}</p>}
        {result && (
          <div className="stack gap-2">
            <p><b>{result.name}</b> 识别为 {result.format}:{result.items.length} 个条目,{result.folders.length} 个文件夹,其中 {result.items.filter((i) => i.fields.totp).length} 个含两步验证。</p>
            <div className="row gap-2"><Button variant="primary" size="sm" onClick={confirmImport}>导入</Button><Button size="sm" onClick={() => setResult(null)}>取消</Button></div>
          </div>
        )}
      </section>
      <section className="settings-group">
        <h3>导出(明文)</h3>
        <div className="callout warning"><Icon name="alert" size={16} /><p>导出文件<strong>未加密</strong>,仅用于迁移到其他密码管理器。在 ChronoKey 之间迁移请使用"历史超密钥"。</p></div>
        <div className="row gap-2 wrap">
          <Button onClick={() => setExportFmt('csv')}>CSV(通用)</Button>
          <Button onClick={() => setExportFmt('bitwarden')}>Bitwarden JSON</Button>
          <Button onClick={() => setExportFmt('json')}>ChronoKey JSON(全部类型)</Button>
        </div>
      </section>
      {exportFmt && (
        <Modal title="确认明文导出" width={420} onClose={() => { setExportFmt(null); setErr(''); }}
          footer={<><Button onClick={() => setExportFmt(null)}>取消</Button><Button variant="danger" disabled={!pw} onClick={doExport}>导出</Button></>}>
          <Field label="输入主密码以确认" error={err}>{(id) => <SecretInput id={id} value={pw} onChange={setPw} onKeyDown={(e) => e.key === 'Enter' && pw && doExport()} />}</Field>
        </Modal>
      )}
    </div>
  );
}

function AccountTab({ data, commit }) {
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
    if (next !== next2) return setMsg({ tone: 'danger', text: '两次输入不一致' });
    if (next.length < 10 || est.score < 2) return setMsg({ tone: 'danger', text: '新主密码太弱(至少 10 位且强度"一般"以上)' });
    setBusy(true);
    try {
      await window.ck.changePassword(cur, next);
      commit((cur) => appendAudit(cur, 'password', ''));
      setMsg({ tone: 'ok', text: '主密码已更改。恢复代码保持不变。' });
      setCur(''); setNext(''); setNext2('');
    } catch (e) { setMsg({ tone: 'danger', text: e.message }); } finally { setBusy(false); }
  };

  const rotate = async () => {
    setBusy(true);
    try {
      const r = await window.ck.rotateRecovery(rcPw);
      setNewCode(r.recoveryCode); setRcPw('');
      commit((cur) => appendAudit(cur, 'recovery', '重新生成恢复代码'));
    } catch (e) { setMsg({ tone: 'danger', text: e.message }); } finally { setBusy(false); }
  };

  const doReset = async () => {
    if (!resetPw || busy) return;
    setResetErr(''); setBusy(true);
    try {
      if (!(await window.ck.verify(resetPw))) { setResetErr('主密码错误'); return; }
      // 主进程删除后会发出 vault:locked('reset'),界面自动回到初始设置
      await window.ck.reset();
    } catch (e) { setResetErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="stack gap-4">
      <section className="settings-group">
        <h3>更改主密码</h3>
        <p className="field-hint">只会重新包裹数据密钥,不需要重新加密全部条目,也不影响恢复代码。</p>
        <Field label="当前主密码">{(id) => <SecretInput id={id} value={cur} onChange={setCur} autoComplete="current-password" />}</Field>
        <Field label="新主密码">{(id) => <SecretInput id={id} value={next} onChange={setNext} autoComplete="new-password" />}</Field>
        <StrengthMeter result={est} />
        <Field label="再次输入新主密码">{(id) => <SecretInput id={id} value={next2} onChange={setNext2} autoComplete="new-password" />}</Field>
        {msg && <p className={msg.tone === 'ok' ? 'field-ok' : 'field-error'} role="status">{msg.text}</p>}
        <Button variant="primary" disabled={busy || !cur || !next} onClick={change}>更改主密码</Button>
      </section>
      <section className="settings-group">
        <h3>恢复代码</h3>
        <p className="field-hint">重新生成后,旧的恢复代码立即失效。</p>
        {newCode ? (
          <>
            <div className="recovery-code">{newCode.split('-').map((g, i) => <span key={i}>{g}</span>)}</div>
            <Button icon="copy" onClick={() => window.ck.copy(newCode, { sensitive: true })}>复制</Button>
          </>
        ) : (
          <div className="row gap-2">
            <SecretInput value={rcPw} onChange={setRcPw} ariaLabel="主密码" placeholder="输入主密码" />
            <Button disabled={!rcPw || busy} onClick={rotate}>重新生成</Button>
          </div>
        )}
      </section>
      <section className="settings-group">
        <h3>重置保险库</h3>
        <p className="field-hint">如果忘记主密码和恢复代码,可删除当前保险库并从头创建新的。<strong>此操作无法撤销</strong>,所有数据将永久丢失。</p>
        <Button variant="danger" icon="trash" onClick={() => setResetConfirm(true)}>删除保险库并重新开始</Button>
      </section>
      {resetConfirm && (
        <Modal title="删除当前保险库?" width={480} onClose={() => { setResetConfirm(false); setResetPw(''); setResetErr(''); }}
          footer={<><Button onClick={() => { setResetConfirm(false); setResetPw(''); setResetErr(''); }}>取消</Button><Button variant="danger" disabled={!resetPw || busy} onClick={doReset}>{busy ? '正在删除…' : '删除全部数据'}</Button></>}>
          <div className="stack gap-3">
            <div className="callout warning"><Icon name="alert" size={16} /><p><strong>警告:</strong>此操作将永久删除当前保险库的全部内容,包括:</p></div>
            <ul className="bullet-list">
              <li>所有登录、密码、2FA 密钥</li>
              <li>信用卡、身份、地址信息</li>
              <li>笔记、API 密钥、SSH 密钥</li>
              <li>文件夹、标签和回收站</li>
              <li>所有备份快照</li>
            </ul>
            <p>删除后,程序会立即回到初始设置界面,你可以创建新的保险库。</p>
            <Field label="输入主密码以确认删除" error={resetErr}>{(id) => <SecretInput id={id} value={resetPw} onChange={setResetPw} onKeyDown={(e) => e.key === 'Enter' && resetPw && doReset()} />}</Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AppearanceTab({ status, refresh }) {
  const [theme, setTheme] = useState(status.prefs.theme);
  return (
    <div className="stack gap-4">
      <section className="settings-group">
        <h3>主题</h3>
        <Segmented label="主题" value={theme} onChange={async (t) => { setTheme(t); await window.ck.setPrefs({ theme: t }); refresh(); }}
          options={[{ value: 'system', label: '跟随系统' }, { value: 'light', label: '和纸(浅色)' }, { value: 'dark', label: '墨(深色)' }]} />
        <div className="swatches" aria-hidden="true">
          {[['#F6F3EC', '和纸'], ['#5E6420', '深苔'], ['#91AD70', '柳染'], ['#B54434', '紅樺'], ['#E2943B', '朽葉'], ['#B4A582', '利休白茶'], ['#1F1E1B', '墨']].map(([c, n]) => (
            <span key={c} className="swatch"><i style={{ background: c }} />{n}</span>
          ))}
        </div>
        <p className="field-hint">配色取自日本传统色(nipponcolors.com),所有文字对比度均满足 WCAG AA 4.5:1。</p>
      </section>
      <section className="settings-group">
        <h3>键盘快捷键</h3>
        <dl className="shortcuts">
          {[[`${modKey}F`, '搜索'], [`${modKey}N`, '新建登录'], [`${modKey}S`, '保存编辑'], [`${modKey}G`, '密码生成器'], [`${modKey}L`, '立即锁定'], [`${modKey},`, '设置'], ['↑ ↓', '在列表中移动'], ['Esc', '取消 / 关闭']].map(([k, v]) => (
            <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function AboutTab({ status }) {
  return (
    <div className="stack gap-3">
      <p><b>ChronoKey 时钥</b> v{status.version} · MIT 开源</p>
      <dl className="spec">
        <div><dt>加密</dt><dd>Argon2id + AES-256-GCM,随机数据密钥分别由主密码和恢复代码包裹</dd></div>
        <div><dt>网络</dt><dd>拦截全部请求,没有自动更新、遥测或账号系统</dd></div>
        <div><dt>数据目录</dt><dd><code className="break">{status.dataDir}</code>{status.portable && '(便携模式)'}</dd></div>
      </dl>
      <p className="field-hint">便携模式:在程序同目录下创建 <code>ChronoKeyData</code> 文件夹,数据就会保存在那里,可随 U 盘携带。</p>
      <p className="field-hint">词库:EFF Large Wordlist (CC BY 3.0)。配色:nipponcolors.com。</p>
    </div>
  );
}

export function Settings({ initialTab = 'security', data, status, commit, refresh, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const props = { data, status, commit, refresh };
  return (
    <Modal title="设置" onClose={onClose} width={820}>
      <div className="settings">
        <nav className="settings-nav" aria-label="设置分类">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`side-row ${tab === t.id ? 'active' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <span className="side-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-body">
          <h2 className="settings-title">{TABS.find((t) => t.id === tab).label}</h2>
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
