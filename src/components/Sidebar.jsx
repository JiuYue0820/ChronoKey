import { useRef, useState } from 'react';
import { Icon, IconButton } from './ui.jsx';
import { t, typeLabel } from '../i18n-react.js';
import { TYPES, TYPE_ORDER, uid } from '../lib/model.js';

function Row({ active, icon, label, count, onClick, onContext, onDoubleClick, tone }) {
  return (
    <li>
      <button type="button" className={`side-row ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick} onContextMenu={onContext} onDoubleClick={onDoubleClick}>
        <Icon name={icon} className={tone ? `tone-${tone}` : ''} />
        <span className="side-label">{label}</span>
        {count > 0 && <span className="side-count">{count}</span>}
      </button>
    </li>
  );
}

function Section({ title, children, action }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="side-section">
      <div className="side-head">
        <button type="button" className="side-title" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {title}
          <Icon name="chevronDown" size={12} className={open ? '' : 'rot'} />
        </button>
        {action}
      </div>
      {open && <ul>{children}</ul>}
    </section>
  );
}

export function Sidebar({ view, setView, counts, folders, onFolders }) {
  const [newFolder, setNewFolder] = useState(null);
  const [renaming, setRenaming] = useState(null); // { id, name }
  const is = (kind, extra = {}) => view.kind === kind && Object.entries(extra).every(([k, v]) => view[k] === v);

  // 回车提交后输入框卸载时还会触发 blur,用 ref 防止重复创建 / 重复提交
  const done = useRef(false);
  const addFolder = (e) => {
    e?.preventDefault();
    if (done.current || newFolder === null) return;
    done.current = true;
    const name = newFolder.trim();
    if (name && !folders.some((f) => f.name === name)) onFolders([...folders, { id: uid(), name }]);
    setNewFolder(null);
  };
  const startNewFolder = () => { done.current = false; setNewFolder(''); };

  // 右键 / 双击:原地重命名;清空名称即删除文件夹(条目保留,移出文件夹)
  const folderMenu = (f) => (e) => { e.preventDefault(); done.current = false; setRenaming({ id: f.id, name: f.name }); };
  const commitRename = (e) => {
    e?.preventDefault();
    if (!renaming || done.current) return;
    done.current = true;
    const name = renaming.name.trim();
    onFolders(name ? folders.map((x) => (x.id === renaming.id ? { ...x, name } : x)) : folders.filter((x) => x.id !== renaming.id));
    setRenaming(null);
  };

  const tags = Object.keys(counts.tag).sort((a, b) => a.localeCompare(b, 'zh-CN'));

  return (
    <nav className="sidebar" aria-label={t('side.nav')}>
      <div className="side-scroll">
        <ul className="side-top">
          <Row active={is('all')} icon="grid" label={t('side.all')} count={counts.all} onClick={() => setView({ kind: 'all' })} />
          <Row active={is('favorites')} icon="star" label={t('side.fav')} count={counts.favorites} onClick={() => setView({ kind: 'favorites' })} tone="warning" />
          <Row active={is('totp')} icon="clock" label={t('side.otp')} count={counts.totp} onClick={() => setView({ kind: 'totp' })} tone="accent" />
        </ul>

        <Section title={t('side.categories')} >
          {TYPE_ORDER.map((typeId) => (
            <Row key={typeId} active={is('type', { type: typeId })} icon={TYPES[typeId].icon} label={typeLabel(typeId)} count={counts.type[typeId] || 0} onClick={() => setView({ kind: 'type', type: typeId })} />
          ))}
        </Section>

        <Section title={t('side.folders')} action={<IconButton icon="plus" label={t('side.newFolder')} className="side-add" onClick={startNewFolder} size={14} />}>
          {folders.map((f) => (renaming?.id === f.id ? (
            <li key={f.id}>
              <form onSubmit={commitRename} className="side-new">
                <Icon name="folder" />
                <input className="input input-sm" autoFocus value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} onBlur={commitRename} aria-label={t('side.folderRenameHint')} title={t('side.folderRenameHint2')} onKeyDown={(e) => { if (e.key === 'Escape') { done.current = true; setRenaming(null); } }} />
              </form>
            </li>
          ) : (
            <Row key={f.id} active={is('folder', { id: f.id })} icon="folder" label={f.name} count={counts.folder[f.id] || 0} onClick={() => setView({ kind: 'folder', id: f.id })} onContext={folderMenu(f)} onDoubleClick={folderMenu(f)} />
          )))}
          {newFolder !== null && (
            <li>
              <form onSubmit={addFolder} className="side-new">
                <Icon name="folder" />
                <input className="input input-sm" autoFocus value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onBlur={addFolder} placeholder={t('side.folderName')} aria-label={t('side.folderName')} onKeyDown={(e) => { if (e.key === 'Escape') { done.current = true; setNewFolder(null); } }} />
              </form>
            </li>
          )}
          {!folders.length && newFolder === null && <li className="side-empty">{t('side.newFolderHint')}</li>}
        </Section>

        {tags.length > 0 && (
          <Section title={t('side.tags')} >
            {tags.map((t) => (
              <Row key={t} active={is('tag', { tag: t })} icon="tag" label={t} count={counts.tag[t]} onClick={() => setView({ kind: 'tag', tag: t })} />
            ))}
          </Section>
        )}

        <Section title={t('side.tools')} >
          <Row active={is('generator')} icon="dice" label={t('side.generator')} onClick={() => setView({ kind: 'generator' })} />
          <Row active={is('audit')} icon="shield" label={t('side.audit')} onClick={() => setView({ kind: 'audit' })} />
        </Section>

        <ul className="side-top">
          <Row active={is('trash')} icon="trash" label={t('side.trash')} count={counts.trash} onClick={() => setView({ kind: 'trash' })} />
        </ul>
      </div>
    </nav>
  );
}
