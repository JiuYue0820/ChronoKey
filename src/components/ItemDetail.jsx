import { useState } from 'react';
import { Avatar, Button, Icon, IconButton, useToast, formatTime, relTime, Modal, StrengthMeter } from './ui.jsx';
import { TotpCode, safeParseTotp } from './TotpCode.jsx';
import { TYPES, hostOf, restoreVersion } from '../lib/model.js';
import { estimate } from '../lib/strength.js';
import { t, typeLabel, fieldLabel } from '../i18n-react.js';

function FieldRow({ label, value, secret, mono, multiline, kind, strength }) {
  const [show, setShow] = useState(false);
  const toast = useToast();
  if (!value) return null;
  const copy = async () => {
    const r = await window.ck.copy(value, { sensitive: !!secret });
    toast(t('common.copyFieldClear', { label, n: r.clearsIn }), 'ok');
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
        {secret && <IconButton icon={show ? 'eyeOff' : 'eye'} label={show ? t('common.hide') : t('common.show')} onClick={() => setShow((s) => !s)} />}
        {kind === 'url' && <IconButton icon="external" label={t('detail.openInBrowser')} onClick={() => window.ck.openExternal(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`)} />}
        <IconButton icon="copy" label={t('detail.copyLabel', { label })} onClick={copy} />
      </div>
    </div>
  );
}

function VersionHistory({ item, onRestore }) {
  const [open, setOpen] = useState(null);
  if (!item.versions?.length) return null;
  return (
    <section className="detail-section">
      <h3 className="section-title">{t('detail.versions')} <span className="count">{item.versions.length}</span></h3>
      <ul className="versions">
        {item.versions.map((v, i) => {
          const pwChanged = (v.fields.password || v.fields.secret) && (v.fields.password || v.fields.secret) !== (item.fields.password || item.fields.secret);
          return (
            <li key={i} className="version-row">
              <div>
                <div>{formatTime(v.savedAt)}</div>
                <div className="field-hint">{v.title}{pwChanged ? t('detail.oldPassword') : ''}</div>
              </div>
              <div className="row gap-1">
                <Button size="sm" variant="ghost" onClick={() => setOpen(i)}>{t('detail.view')}</Button>
                <Button size="sm" onClick={() => onRestore(restoreVersion(item, i))}>{t('detail.rollback')}</Button>
              </div>
            </li>
          );
        })}
      </ul>
      {open !== null && (
        <Modal title={t('detail.versionModal', { time: formatTime(item.versions[open].savedAt) })} onClose={() => setOpen(null)} >
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
        <FieldRow key={f.key} label={fieldLabel(f.key)} value={item.fields[f.key]} secret={f.secret} mono={f.mono} multiline={f.multiline} kind={f.kind} strength={f.key === 'password'} />
      ))}
      {item.custom?.map((c) => <FieldRow key={c.id} label={c.label || t('detail.custom')} value={c.value} secret={c.hidden} />)}
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
          <h1>{item.title || t('common.unnamed')}</h1>
          <p>
            <span>{typeLabel(item.type)}</span>
            {folder && <span>{folder.name}</span>}
            {item.fields.url && <span>{hostOf(item.fields.url)}</span>}
          </p>
        </div>
        <div className="detail-actions">
          {trashed ? (
            <>
              <Button icon="refresh" onClick={onRestore}>{t('detail.restore')}</Button>
              <Button variant="danger" icon="trash" onClick={() => setConfirmPurge(true)}>{t('detail.permanent')}</Button>
            </>
          ) : (
            <>
              <IconButton icon="star" label={item.favorite ? t('detail.unfavorite') : t('detail.favorite')} className={item.favorite ? 'tone-warning fill' : ''} onClick={onFavorite} />
              <IconButton icon="copy" label={t('detail.duplicate')} onClick={onDuplicate} />
              <IconButton icon="trash" label={t('detail.toTrash')} onClick={onTrash} />
              <Button variant="primary" icon="edit" onClick={onEdit}>{t('detail.edit')}</Button>
            </>
          )}
        </div>
      </header>

      {trashed && <p className="notice">{t('detail.trashedNotice', { time: formatTime(item.deletedAt) })}</p>}

      <FieldsView
        item={item}
        lead={totpCfg && (
          <div className="frow frow-totp">
            <div className="frow-label">{t('detail.otpLabel')}</div>
            <div className="frow-main">
              <TotpCode value={item.fields.totp} size="lg" />
              <span className="field-hint">{t('detail.otpMeta', { alg: totpCfg.algorithm, digits: totpCfg.digits, period: totpCfg.period })}</span>
            </div>
            <div />
          </div>
        )}
      />

      {item.notes && (
        <section className="detail-section">
          <h3 className="section-title">{t('detail.notes')}</h3>
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
        <span>{t('detail.created', { time: formatTime(item.createdAt) })}</span>
        <span>{t('detail.modified', { time: relTime(item.updatedAt) })}</span>
        {(item.type === 'login' || item.type === 'apikey') && <span>{t('detail.pwChanged', { time: relTime(item.passwordChangedAt || item.createdAt) })}</span>}
      </footer>

      {confirmPurge && (
        <Modal title={t('detail.confirmPurge')} onClose={() => setConfirmPurge(false)} width={420}
          footer={<><Button onClick={() => setConfirmPurge(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={onPurge}>{t('detail.permanent')}</Button></>}>
          <p>{t('detail.purgeDesc', { title: item.title })}</p>
        </Modal>
      )}
    </article>
  );
}
