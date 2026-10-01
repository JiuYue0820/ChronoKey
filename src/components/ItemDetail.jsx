import { useState } from 'react';
import { Avatar, Button, Icon, IconButton, useToast, formatTime, relTime, Modal, StrengthMeter } from './ui.jsx';
import { TotpCode, safeParseTotp } from './TotpCode.jsx';
import { TYPES, hostOf, restoreVersion } from '../lib/model.js';
import { estimate } from '../lib/strength.js';

function FieldRow({ label, value, secret, mono, multiline, kind, strength }) {
  const [show, setShow] = useState(false);
  const toast = useToast();
  if (!value) return null;
  const copy = async () => {
    const r = await window.ck.copy(value, { sensitive: !!secret });
    toast(r.clearsIn ? `已复制 ${label} · ${r.clearsIn} 秒后清空剪贴板` : `已复制 ${label}`, 'ok');
  };
  const masked = secret && !show;
  return (
    <div className="frow">
      <div className="frow-label">{label}</div>
      <div className="frow-main">
        <div className={`frow-value ${mono || secret ? 'mono' : ''} ${multiline ? 'multi' : ''} ${masked ? 'masked' : ''}`}>
          {masked ? '•'.repeat(Math.min(16, Math.max(8, value.length))) : kind === 'url'
            ? <a href={/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`} onClick={(e) => { e.preventDefault(); window.ck.openExternal(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`); }}>{value}</a>
            : value}
        </div>
        {strength && show && <StrengthMeter result={estimate(value)} />}
      </div>
      <div className="frow-actions">
        {secret && <IconButton icon={show ? 'eyeOff' : 'eye'} label={show ? '隐藏' : '显示'} onClick={() => setShow((s) => !s)} />}
        {kind === 'url' && <IconButton icon="external" label="在浏览器中打开" onClick={() => window.ck.openExternal(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`)} />}
        <IconButton icon="copy" label={`复制${label}`} onClick={copy} />
      </div>
    </div>
  );
}

function VersionHistory({ item, onRestore }) {
  const [open, setOpen] = useState(null);
  if (!item.versions?.length) return null;
  return (
    <section className="detail-section">
      <h3 className="section-title">历史版本 <span className="count">{item.versions.length}</span></h3>
      <ul className="versions">
        {item.versions.map((v, i) => {
          const pwChanged = (v.fields.password || v.fields.secret) && (v.fields.password || v.fields.secret) !== (item.fields.password || item.fields.secret);
          return (
            <li key={i} className="version-row">
              <div>
                <div>{formatTime(v.savedAt)}</div>
                <div className="field-hint">{v.title}{pwChanged ? ' · 旧密码' : ''}</div>
              </div>
              <div className="row gap-1">
                <Button size="sm" variant="ghost" onClick={() => setOpen(i)}>查看</Button>
                <Button size="sm" onClick={() => onRestore(restoreVersion(item, i))}>回滚</Button>
              </div>
            </li>
          );
        })}
      </ul>
      {open !== null && (
        <Modal title={`版本 · ${formatTime(item.versions[open].savedAt)}`} onClose={() => setOpen(null)}>
          <FieldsView item={{ ...item.versions[open], type: item.type }} />
        </Modal>
      )}
    </section>
  );
}

function FieldsView({ item, lead }) {
  const def = TYPES[item.type];
  return (
    <div className="fields-card">
      {lead}
      {def.fields.filter((f) => f.kind !== 'totp').map((f) => (
        <FieldRow key={f.key} label={f.label} value={item.fields[f.key]} secret={f.secret} mono={f.mono} multiline={f.multiline} kind={f.kind} strength={f.key === 'password'} />
      ))}
      {item.custom?.map((c) => <FieldRow key={c.id} label={c.label || '自定义'} value={c.value} secret={c.hidden} />)}
    </div>
  );
}

export function ItemDetail({ item, folders, onEdit, onFavorite, onTrash, onRestore, onPurge, onRestoreVersion, onDuplicate }) {
  const def = TYPES[item.type];
  const trashed = !!item.deletedAt;
  const folder = folders.find((f) => f.id === item.folderId);
  const totpCfg = safeParseTotp(item.fields.totp);
  const [confirmPurge, setConfirmPurge] = useState(false);

  return (
    <article className="detail" aria-label={item.title}>
      <header className="detail-head">
        <Avatar type={def.icon} size={48} />
        <div className="detail-titles">
          <h1>{item.title || '未命名'}</h1>
          <p>
            <span>{def.label}</span>
            {folder && <span>{folder.name}</span>}
            {item.fields.url && <span>{hostOf(item.fields.url)}</span>}
          </p>
        </div>
        <div className="detail-actions">
          {trashed ? (
            <>
              <Button icon="refresh" onClick={onRestore}>恢复</Button>
              <Button variant="danger" icon="trash" onClick={() => setConfirmPurge(true)}>永久删除</Button>
            </>
          ) : (
            <>
              <IconButton icon="star" label={item.favorite ? '取消收藏' : '收藏'} className={item.favorite ? 'tone-warning fill' : ''} onClick={onFavorite} />
              <IconButton icon="copy" label="创建副本" onClick={onDuplicate} />
              <IconButton icon="trash" label="移到废纸篓" onClick={onTrash} />
              <Button variant="primary" icon="edit" onClick={onEdit}>编辑</Button>
            </>
          )}
        </div>
      </header>

      {trashed && <p className="notice">此条目在废纸篓中,删除于 {formatTime(item.deletedAt)}。</p>}

      <FieldsView
        item={item}
        lead={totpCfg && (
          <div className="frow frow-totp">
            <div className="frow-label">验证码</div>
            <div className="frow-main">
              <TotpCode value={item.fields.totp} size="lg" />
              <span className="field-hint">{totpCfg.algorithm} · {totpCfg.digits} 位 · {totpCfg.period} 秒</span>
            </div>
            <div />
          </div>
        )}
      />

      {item.notes && (
        <section className="detail-section">
          <h3 className="section-title">备注</h3>
          <div className="notes">{item.notes}</div>
        </section>
      )}

      {item.tags.length > 0 && (
        <section className="detail-section">
          <div className="tags">{item.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>
        </section>
      )}

      <VersionHistory item={item} onRestore={onRestoreVersion} />

      <footer className="detail-meta">
        <span>创建于 {formatTime(item.createdAt)}</span>
        <span>修改于 {relTime(item.updatedAt)}</span>
        {(item.type === 'login' || item.type === 'apikey') && <span>密码更换于 {relTime(item.passwordChangedAt || item.createdAt)}</span>}
      </footer>

      {confirmPurge && (
        <Modal title="永久删除?" onClose={() => setConfirmPurge(false)} width={420}
          footer={<><Button onClick={() => setConfirmPurge(false)}>取消</Button><Button variant="danger" onClick={onPurge}>永久删除</Button></>}>
          <p>"{item.title}" 及其全部历史版本将被删除,无法撤销(之前的加密快照仍保留在备份目录中)。</p>
        </Modal>
      )}
    </article>
  );
}
