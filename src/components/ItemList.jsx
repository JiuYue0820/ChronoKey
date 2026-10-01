import { useEffect, useRef, useState } from 'react';
import { Avatar, Icon, IconButton, Button, Modal, modKey } from './ui.jsx';
import { TYPES, TYPE_ORDER, subtitle } from '../lib/model.js';

function viewTitle(view, folders) {
  switch (view.kind) {
    case 'all': return '所有条目';
    case 'favorites': return '收藏';
    case 'trash': return '废纸篓';
    case 'type': return TYPES[view.type].label;
    case 'folder': return folders.find((f) => f.id === view.id)?.name || '文件夹';
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
          <span>{TYPES[t].label}</span>
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
    <section className="list-pane" aria-label="条目列表">
      <header className="list-head">
        <div className="list-title-row">
          <h2 className="list-title">{viewTitle(view, folders)}</h2>
          <span className="list-count">{items.length}</span>
          <div className="spacer" />
          {view.kind === 'trash' ? (
            items.length > 0 && <Button size="sm" variant="danger-ghost" onClick={() => setConfirmEmpty(true)}>清空</Button>
          ) : (
            <div className="menu-anchor">
              <IconButton icon="plus" label={`新建条目 (${modKey}N)`} onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} />
              {menu && <NewMenu onPick={(t) => onNew(t)} onClose={() => setMenu(false)} />}
            </div>
          )}
        </div>
      </header>

      <ul className="list" ref={listRef} onKeyDown={onKeyDown} role="listbox" aria-label="条目">
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
                <span className="list-name">{item.title || '未命名'}</span>
                <span className="list-sub">{subtitle(item) || TYPES[item.type]?.label}</span>
              </span>
              <span className="list-flags">
                {item.fields.totp && <Icon name="clock" size={14} title="已配置两步验证" />}
                {item.favorite && <Icon name="star" size={14} className="tone-warning fill" title="已收藏" />}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!items.length && (
        <div className="list-empty">
          {query ? <p>没有匹配"{query}"的条目</p> : view.kind === 'trash' ? <p>废纸篓是空的</p> : <p>这里还没有条目</p>}
        </div>
      )}
      {confirmEmpty && (
        <Modal title="清空废纸篓?" width={420} onClose={() => setConfirmEmpty(false)}
          footer={<><Button onClick={() => setConfirmEmpty(false)}>取消</Button><Button variant="danger" onClick={() => { onEmptyTrash(); setConfirmEmpty(false); }}>永久删除 {items.length} 项</Button></>}>
          <p>这 {items.length} 个条目及其历史版本会被删除,无法撤销。删除前会自动保存一份加密快照。</p>
        </Modal>
      )}
    </section>
  );
}
