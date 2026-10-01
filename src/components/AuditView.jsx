import { useMemo, useState } from 'react';
import { Avatar, Icon, formatTime, useToast } from './ui.jsx';
import { runAudit, buildDictionary } from '../lib/audit.js';
import { TYPES } from '../lib/model.js';

// 严重程度从高到低。方块标记与品牌矩阵同源;颜色之外同时给出文字和数量。
const GROUPS = [
  { key: 'breached', label: '出现在泄露字典', tone: 'danger' },
  { key: 'reused', label: '重复使用', tone: 'danger' },
  { key: 'weak', label: '弱密码', tone: 'danger' },
  { key: 'no2fa', label: '网站支持两步验证但未开启', tone: 'warning' },
  { key: 'old', label: '长期未更换', tone: 'warning' },
  { key: 'short', label: '短于 12 位', tone: 'warning' },
];

const ACTIONS = {
  create: '创建保险库', unlock: '解锁', add: '添加', edit: '修改', trash: '移到废纸篓', restore: '恢复',
  purge: '永久删除', rollback: '回滚版本', import: '导入', export: '导出', superkey: '导出超密钥',
  recover: '使用恢复代码', recovery: '重新生成恢复代码', password: '更改主密码', backup: '备份', warn: '安全提示',
};

function summary(report) {
  const n = (k) => report.issues[k].length;
  const bad = n('breached') + n('reused') + n('weak');
  if (!report.logins) return '还没有登录条目。';
  if (!bad && !n('no2fa') && !n('old') && !n('short')) return `${report.logins} 个登录都没有发现问题。`;
  const parts = [];
  if (n('reused')) parts.push(`${n('reused')} 个在重复使用同一密码`);
  if (n('weak')) parts.push(`${n('weak')} 个密码很弱`);
  if (n('breached')) parts.push(`${n('breached')} 个出现在泄露字典里`);
  if (n('no2fa')) parts.push(`${n('no2fa')} 个可以开启两步验证`);
  return `${report.logins} 个登录中,${parts.join(',') || '只有少量次要问题'}。先处理红色标记的项目。`;
}

export function AuditView({ data, dictionary, setDictionary, onOpen }) {
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const report = useMemo(
    () => runAudit(data.items, { maxAgeDays: data.settings.passwordMaxAgeDays, dictionary }),
    [data.items, data.settings.passwordMaxAgeDays, dictionary],
  );
  const tone = report.score >= 75 ? 'ok' : report.score >= 50 ? 'warning' : 'danger';

  const loadDict = async () => {
    setLoading(true);
    try {
      const f = await window.ck.openFile({ title: '选择离线泄露字典(每行一个密码)', filters: [{ name: '文本字典', extensions: ['txt', 'lst', 'dic'] }] });
      if (f) {
        const set = buildDictionary(f.content);
        setDictionary(set);
        toast(`已载入 ${set.size.toLocaleString()} 条,只保存在内存里,锁定后清除`, 'ok');
      }
    } catch (e) {
      toast(e.message, 'danger');
    } finally { setLoading(false); }
  };

  return (
    <div className="tool">
      <header className="tool-head">
        <h1>安全审计</h1>
        <p>在本机分析,不联网,也不上传任何哈希。</p>
      </header>

      <section className="audit-hero">
        <div className={`audit-score ${tone}`}>
          <b>{report.score}</b>
          <span>/ 100 · {report.grade}</span>
        </div>
        <p className="audit-lede">{summary(report)}</p>
        <p className="field-hint">
          两步验证:{report.totpCount} 个条目已配置。泄露字典:{dictionary ? `已载入 ${dictionary.size.toLocaleString()} 条` : '仅内置常见密码'}。
          <button type="button" className="link-btn" onClick={loadDict} disabled={loading}>{loading ? '载入中…' : '导入离线字典'}</button>
        </p>
      </section>

      <ul className="issue-list">
        {GROUPS.map((g) => {
          const list = report.issues[g.key];
          const isOpen = open === g.key;
          return (
            <li key={g.key} className={list.length ? g.tone : 'clean'}>
              <button type="button" className="issue-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.key)} disabled={!list.length}>
                <span className="sq" aria-hidden="true" />
                <span className="issue-label">{g.label}</span>
                <span className="issue-count">{list.length || '无'}</span>
                {list.length > 0 && <Icon name="chevronDown" size={14} className={isOpen ? '' : 'rot'} />}
              </button>
              {isOpen && (
                <ul className="issue-items">
                  {list.map(({ item, detail }) => (
                    <li key={item.id}>
                      <button type="button" className="audit-item" onClick={() => onOpen(item.id)}>
                        <Avatar type={TYPES[item.type].icon} size={24} />
                        <span className="list-name">{item.title}</span>
                        <span className="field-hint">{detail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <section className="detail-section">
        <h3 className="section-title">审计日志</h3>
        <ul className="audit-log">
          {(data.audit || []).slice(0, 40).map((a, i) => (
            <li key={i} className={a.action === 'warn' ? 'warn' : ''}>
              <span className="mono">{formatTime(a.t)}</span>
              <span>{ACTIONS[a.action] || a.action}</span>
              <span className="field-hint">{a.detail}</span>
            </li>
          ))}
        </ul>
        <p className="field-hint">日志加密保存在保险库内,保留最近 500 条。</p>
      </section>
    </div>
  );
}
