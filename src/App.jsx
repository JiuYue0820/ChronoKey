import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Setup, Unlock } from './components/Lock.jsx';
import { Titlebar } from './components/Titlebar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { ItemList } from './components/ItemList.jsx';
import { ItemDetail } from './components/ItemDetail.jsx';
import { ItemEditor } from './components/ItemEditor.jsx';
import { GeneratorView } from './components/GeneratorView.jsx';
import { AuditView } from './components/AuditView.jsx';
import { TotpBoard } from './components/TotpBoard.jsx';
import { Settings } from './components/Settings.jsx';
import { ToastProvider, useToast, EmptyState, Button } from './components/ui.jsx';
import { t, initLang, getLang } from './i18n-react.js';
import { matches, newItem, updateItem, appendAudit, normalizeVault } from './lib/model.js';

function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </ToastProvider>
  );
}

// 渲染出错时不再整窗空白:给出错误信息和恢复手段(锁定会丢弃界面内存中的明文)
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error('[ChronoKey] UI error', error, info?.componentStack); }

  recover = async (lock) => {
    if (lock) { try { await window.ck.lock(); } catch { /* already locked */ } }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app">
        <div className="crash" role="alert">
          <h1>{t('app.crashTitle')}</h1>
          <p>{t('app.crashBody')}</p>
          <pre className="crash-msg mono">{String(this.state.error?.message || this.state.error)}</pre>
          <div className="row gap-2 center">
            <Button variant="primary" onClick={() => this.recover(false)}>{t('app.crashRetry')}</Button>
            <Button icon="lock" onClick={() => this.recover(true)}>{t('app.crashLock')}</Button>
            <Button variant="ghost" onClick={() => location.reload()}>{t('app.crashReload')}</Button>
          </div>
        </div>
      </div>
    );
  }
}

function Root() {
  const [status, setStatus] = useState(null);
  const [data, setData] = useState(null);
  const toast = useToast();

  const refresh = useCallback(async () => {
    const s = await window.ck.status();
    setStatus(s);
    applyTheme(s.prefs.theme);
    // 启动时应用已持久化的界面语言(不触发订阅通知);同时同步 <html lang> 便于辅助工具
    initLang(s.prefs.lang || 'zh');
    document.documentElement.lang = getLang();
    return s;
  }, []);

  useEffect(() => {
    refresh();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(document.documentElement.dataset.pref || 'system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [refresh]);

  useEffect(() => window.ck.onLocked((reason) => {
    setData(null);
    refresh();
    if (reason === 'reset') { toast(t('app.vaultDeleted'), 'info', 4000); return; }
    const why = {
      idle: t('app.idleTimeout'),
      'screen-lock': t('app.screenLock'),
      sleep: t('app.sleep'),
      minimize: t('app.windowMinimized'),
      restore: t('app.backupRestored'),
    }[reason];
    if (why) toast(t('app.autoLocked', { why }), 'info');
  }), [refresh, toast]);

  const onReady = useCallback(async (raw) => {
    const d = normalizeVault(raw);
    try {
      await window.ck.save(d, { snapshot: 'none' });
      await window.ck.applySettings(d.settings);
    } catch (e) {
      toast(t('app.saveFailed', { msg: e.message }), 'danger', 5000);
    }
    setData(d);
    refresh();
  }, [refresh, toast]);

  if (!status) return <div className="boot" />;
  const theme = status.prefs.theme;
  document.documentElement.dataset.pref = theme;

  return (
    <div className={`app platform-${status.platform}`}>
      {data ? <Vault data={data} setData={setData} status={status} refresh={refresh} /> : (
        <>
          <Titlebar platform={status.platform} locked />
          {!status.exists ? <Setup onReady={onReady} /> : <Unlock status={status} onReady={onReady} onReset={refresh} />}
        </>
      )}
    </div>
  );
}

function Vault({ data, setData, status, refresh }) {
  const toast = useToast();
  const [view, setView] = useState({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null); // 条目草稿
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dictionary, setDictionary] = useState(null);
  const searchRef = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // 统一写入口:更新状态 + 加密落盘。
  // 传函数时基于最新数据计算(异步回调里避免用到过期的 data 覆盖掉其间的修改)
  const commit = useCallback(async (nextOrFn, opts) => {
    const next = typeof nextOrFn === 'function' ? nextOrFn(dataRef.current) : nextOrFn;
    dataRef.current = next;
    setData(next);
    try {
      await window.ck.save(next, opts);
    } catch (e) {
      toast(t('app.saveFailed', { msg: e.message }), 'danger', 5000);
    }
  }, [setData, toast]);

  const saveItem = useCallback((draft) => {
    const cur = dataRef.current;
    const exists = cur.items.find((i) => i.id === draft.id);
    const item = exists ? updateItem(exists, draft) : { ...draft, createdAt: Date.now(), updatedAt: Date.now() };
    const items = exists ? cur.items.map((i) => (i.id === item.id ? item : i)) : [item, ...cur.items];
    commit(appendAudit({ ...cur, items }, exists ? 'edit' : 'add', item.title));
    setEditing(null);
    setSelectedId(item.id);
    toast(t(exists ? 'app.saved' : 'app.added'), 'ok');
  }, [commit, toast]);

  const patchItem = useCallback((id, patch, auditAction) => {
    const cur = dataRef.current;
    const items = cur.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    const next = { ...cur, items };
    commit(auditAction ? appendAudit(next, auditAction, cur.items.find((i) => i.id === id)?.title) : next);
  }, [commit]);

  const replaceItem = useCallback((item, auditAction) => {
    const cur = dataRef.current;
    commit(appendAudit({ ...cur, items: cur.items.map((i) => (i.id === item.id ? item : i)) }, auditAction, item.title));
  }, [commit]);

  const purgeItem = useCallback((id) => {
    const cur = dataRef.current;
    const title = cur.items.find((i) => i.id === id)?.title;
    commit(appendAudit({ ...cur, items: cur.items.filter((i) => i.id !== id) }, 'purge', title), { snapshot: 'force' });
    setSelectedId(null);
  }, [commit]);

  // ---------- 过滤 ----------
  const visible = useMemo(() => {
    const live = data.items.filter((i) => (view.kind === 'trash' ? i.deletedAt : !i.deletedAt));
    let list = live;
    if (view.kind === 'favorites') list = live.filter((i) => i.favorite);
    if (view.kind === 'type') list = live.filter((i) => i.type === view.type);
    if (view.kind === 'folder') list = live.filter((i) => i.folderId === view.id);
    if (view.kind === 'tag') list = live.filter((i) => i.tags.includes(view.tag));
    if (view.kind === 'totp') list = live.filter((i) => i.fields.totp);
    list = list.filter((i) => matches(i, query));
    return [...list].sort((a, b) => (b.favorite - a.favorite) || a.title.localeCompare(b.title, 'zh-CN'));
  }, [data.items, view, query]);

  const onSearch = (v) => {
    setQuery(v);
    if (v && (view.kind === 'generator' || view.kind === 'audit')) { setView({ kind: 'all' }); setEditing(null); }
  };
  const onSearchKey = (e) => {
    if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      const first = document.querySelector('.list-row');
      if (first) { e.preventDefault(); first.click(); first.focus(); }
    }
  };

  const selected = data.items.find((i) => i.id === selectedId) || null;
  const isTool = ['generator', 'audit', 'totp'].includes(view.kind);

  useEffect(() => {
    if (!isTool && !editing && selectedId && !visible.some((i) => i.id === selectedId)) setSelectedId(visible[0]?.id || null);
  }, [visible, selectedId, editing, isTool]);

  const startNew = useCallback((type = 'login', patch = {}) => {
    const folderId = view.kind === 'folder' ? view.id : null;
    const tags = view.kind === 'tag' ? [view.tag] : [];
    if (isTool) setView({ kind: 'all' });
    setEditing(newItem(type, { folderId, tags, ...patch }));
  }, [view, isTool]);

  // ---------- 键盘快捷键(⌘/Ctrl) ----------
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'f' || k === 'k') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      else if (k === 'n') { e.preventDefault(); startNew('login'); }
      else if (k === 'l') { e.preventDefault(); window.ck.lock(); }
      else if (k === ',') { e.preventDefault(); setSettingsOpen(true); }
      else if (k === 'g') { e.preventDefault(); setView({ kind: 'generator' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startNew, isTool]);

  const counts = useMemo(() => {
    const live = data.items.filter((i) => !i.deletedAt);
    const c = { all: live.length, favorites: live.filter((i) => i.favorite).length, totp: live.filter((i) => i.fields.totp).length, trash: data.items.length - live.length, type: {}, folder: {}, tag: {} };
    for (const i of live) {
      c.type[i.type] = (c.type[i.type] || 0) + 1;
      if (i.folderId) c.folder[i.folderId] = (c.folder[i.folderId] || 0) + 1;
      for (const t of i.tags) c.tag[t] = (c.tag[t] || 0) + 1;
    }
    return c;
  }, [data.items]);

  // 删除文件夹时,把其中的条目移出文件夹;正在查看的文件夹被删时回到"所有条目"
  const onFolders = useCallback((folders) => {
    const ids = new Set(folders.map((f) => f.id));
    commit((cur) => ({
      ...cur,
      folders,
      items: cur.items.map((i) => (i.folderId && !ids.has(i.folderId) ? { ...i, folderId: null } : i)),
    }));
    setView((v) => (v.kind === 'folder' && !ids.has(v.id) ? { kind: 'all' } : v));
  }, [commit]);

  // 标签被全部移除后,标签视图失效
  useEffect(() => {
    if (view.kind === 'tag' && !counts.tag[view.tag]) setView({ kind: 'all' });
  }, [view, counts]);

  const openItem = (id) => { setView({ kind: 'all' }); setQuery(''); setEditing(null); setSelectedId(id); };

  return (
    <>
    <Titlebar
      platform={status.platform}
      locked={false}
      onSettings={() => setSettingsOpen(true)}
      search={{ ref: searchRef, value: query, onChange: onSearch, onKeyDown: onSearchKey }}
    />
    <div className="vault">
      <Sidebar
        view={view}
        setView={(v) => { setView(v); setEditing(null); }}
        counts={counts}
        folders={data.folders}
        onFolders={onFolders}
      />
      {view.kind === 'generator' ? (
        <main className="tool-pane"><GeneratorView settings={data.settings} onSaveDefaults={(g) => commit((cur) => ({ ...cur, settings: { ...cur.settings, generator: g } }))} /></main>
      ) : view.kind === 'audit' ? (
        <main className="tool-pane"><AuditView data={data} dictionary={dictionary} setDictionary={setDictionary} onOpen={openItem} /></main>
      ) : view.kind === 'totp' ? (
        <main className="tool-pane"><TotpBoard items={visible} query={query} onOpen={openItem} onAdd={() => startNew('totp')} /></main>
      ) : (
        <>
          <ItemList
            items={visible}
            view={view}
            folders={data.folders}
            query={query}
            selectedId={editing ? editing.id : selectedId}
            onSelect={(id) => { setEditing(null); setSelectedId(id); }}
            onNew={startNew}
            onEmptyTrash={() => commit((cur) => appendAudit({ ...cur, items: cur.items.filter((i) => !i.deletedAt) }, 'purge', t('app.emptyTrash')), { snapshot: 'force' })}
          />
          <main className="detail-pane">
            {editing ? (
              <ItemEditor
                key={editing.id}
                item={editing}
                isNew={!data.items.some((i) => i.id === editing.id)}
                folders={data.folders}
                allTags={Object.keys(counts.tag)}
                generatorDefaults={data.settings.generator}
                onCancel={() => setEditing(null)}
                onSave={saveItem}
              />
            ) : selected ? (
              <ItemDetail
                key={selected.id}
                item={selected}
                folders={data.folders}
                onEdit={() => setEditing(structuredClone(selected))}
                onFavorite={() => patchItem(selected.id, { favorite: !selected.favorite })}
                onTrash={() => { patchItem(selected.id, { deletedAt: Date.now() }, 'trash'); toast(t('app.movedTrash'), 'info'); }}
                onRestore={() => patchItem(selected.id, { deletedAt: null }, 'restore')}
                onPurge={() => purgeItem(selected.id)}
                onRestoreVersion={(item) => { replaceItem(item, 'rollback'); toast(t('app.rolledBack'), 'ok'); }}
                onDuplicate={() => setEditing({ ...structuredClone(selected), id: crypto.randomUUID(), title: t('app.copyOf', { title: selected.title }), versions: [] })}
              />
            ) : (
              <EmptyState title={t(data.items.length ? 'app.selectItem' : 'app.emptyVault')}>
                {!data.items.length && (
                  <div className="stack gap-2 center">
                    <p>{t('app.emptyHint')}</p>
                    <div className="row gap-2 center">
                      <Button variant="primary" icon="plus" onClick={() => startNew('login')}>{t('app.newLogin')}</Button>
                      <Button icon="clock" onClick={() => startNew('totp')}>{t('app.addTotp')}</Button>
                      <Button icon="upload" onClick={() => setSettingsOpen('data')}>{t('app.import')}</Button>
                    </div>
                  </div>
                )}
              </EmptyState>
            )}
          </main>
        </>
      )}
      {settingsOpen && (
        <Settings
          initialTab={typeof settingsOpen === 'string' ? settingsOpen : 'security'}
          data={data}
          status={status}
          commit={commit}
          refresh={refresh}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
    </>
  );
}

