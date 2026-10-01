import { useEffect, useRef, useState } from 'react';
import { Avatar, Icon, IconButton, Button, Modal, modKey } from './ui.jsx';
import { TYPES, TYPE_ORDER, subtitle } from '../lib/model.js';
import { t, typeLabel } from '../i18n-react.js';

function viewTitle(view, folders) {
  switch (view.kind) {
    case 'all': return t('list.all');
    case 'favorites': return t('list.fav');
    case 'trash': return t('list.trash');
    case 'type': return typeLabel(view.type);
    case 'folder': return folders.find((f) => f.id === view.id)?.name || t('list.folders');
    case 'tag': return `# ${view.tag}`;
    default: return '';
  }
}

function NewMenu({ onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const off = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  const onKey = (e) => {
    const btns = [...ref.current.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
  };
  return (
    <div className="menu" role="menu" ref={ref} onKeyDown={onKey}>
      {TYPE_ORDER.map((t) => (
        <button key={t} type="button" role="menuitem" className="menu-item" onClick={() => { onPick(t); onClose(); }}>
          <Icon name={TYPES[t].icon} />
          <span>{typeLabel(t)}</span>
        </button>
      ))}
    </div>
  );
}

export function ItemList({ items, view, folders, query, selectedId, onSelect, onNew, onEmptyTrash }) {
  const [menu, setMenu] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const listRef = useRef(null);

  // 上下方向键在列表中移动
  const onKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key) || !items.length) return;
    e.preventDefault();
    const i = items.findIndex((x) => x.id === selectedId);
    const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
    onSelect(items[next].id);
    listRef.current?.querySelectorAll('.list-row')[next]?.focus();
  };

  return (
    <section className="list-pane" aria-label={t('list.items')} >
      <header className="list-head">
        <div className="list-title-row">
          <h2 className="list-title">{viewTitle(view, folders)}</h2>
          <span className="list-count">{items.length}</span>
          <div className="spacer" />
          {view.kind === 'trash' ? (
            items.length > 0 && <Button size="sm" variant="danger-ghost" onClick={() => setConfirmEmpty(true)}>{t('list.emptyTrashBtn')}</Button>
          ) : (
            <div className="menu-anchor">
              <IconButton icon="plus" label={t('list.newItem', { mod: modKey })} onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} />
              {menu && <NewMenu onPick={(t) => onNew(t)} onClose={() => setMenu(false)} />}
            </div>
          )}
        </div>
      </header>

      <ul className="list" ref={listRef} onKeyDown={onKeyDown} role="listbox" aria-label={t('list.items')}>
        {items.map((item) => (
          <li key={item.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={item.id === selectedId}
              className={`list-row ${item.id === selectedId ? 'selected' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <Avatar type={TYPES[item.type]?.icon} size={32} />
              <span className="list-text">
                <span className="list-name">{item.title || t('common.unnamed')}</span>
                <span className="list-sub">{subtitle(item) || typeLabel(item.type)}</span>
              </span>
              <span className="list-flags">
                {item.fields.totp && <Icon name="clock" size={14} title={t('list.hasTotp')} />}
                {item.favorite && <Icon name="star" size={14} className="tone-warning fill" title={t('common.favorite')} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!items.length && (
        <div className="list-empty">
          {query ? <p>{t('list.noMatch', { query })}</p> : view.kind === 'trash' ? <p>{t('list.trashEmpty')}</p> : <p>{t('list.noneHere')}</p>}
        </div>
      )}
      {confirmEmpty && (
        <Modal title={t('list.emptyTrash')} width={420} onClose={() => setConfirmEmpty(false)}
          footer={<><Button onClick={() => setConfirmEmpty(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={() => { onEmptyTrash(); setConfirmEmpty(false); }}>{t('list.permanentDelete', { n: items.length })}</Button></>}>
          <p>{t('list.permanentDeleteDesc', { n: items.length })}</p>
        </Modal>
      )}
    </section>
  );
}
