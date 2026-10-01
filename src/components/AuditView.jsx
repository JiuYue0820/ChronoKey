import { useMemo, useState } from 'react';
import { Avatar, Icon, formatTime, useToast } from './ui.jsx';
import { runAudit, buildDictionary } from '../lib/audit.js';
import { TYPES } from '../lib/model.js';
import { t, auditGrade, auditDetail, tr } from '../i18n-react.js';

// 严重程度从高到低。方块标记与品牌矩阵同源;颜色之外同时给出文字和数量。
const GROUPS = [
  { key: 'breached', labelKey: 'audit.breachedLabel', tone: 'danger' },
  { key: 'reused', labelKey: 'audit.reusedLabel', tone: 'danger' },
  { key: 'weak', labelKey: 'audit.weakLabel', tone: 'danger' },
  { key: 'no2fa', labelKey: 'audit.grpNo2fa', tone: 'warning' },
  { key: 'old', labelKey: 'audit.oldLabel', tone: 'warning' },
  { key: 'short', labelKey: 'audit.shortLabel', tone: 'warning' },
];

// 审计日志动作名 → 词表键(audit.actions.*)
const ACTION_KEYS = {
  create: 'newVault', unlock: 'unlock', add: 'add', edit: 'edit', trash: 'trash', restore: 'restore',
  purge: 'purge', rollback: 'rollback', import: 'import', export: 'export', superkey: 'superkey',
  recover: 'recovery', recovery: 'regenRecovery', password: 'changeMaster', backup: 'backup', warn: 'security',
};

function summary(report) {
  const n = (k) => report.issues[k].length;
  const bad = n('breached') + n('reused') + n('weak');
  if (!report.logins) return t('audit.noLogins');
  if (!bad && !n('no2fa') && !n('old') && !n('short')) return t('audit.noIssues', { logins: report.logins });
  const parts = [];
  if (n('reused')) parts.push(t('audit.p_reused', { n: n('reused') }));
  if (n('weak')) parts.push(t('audit.p_weak', { n: n('weak') }));
  if (n('breached')) parts.push(t('audit.p_breached', { n: n('breached') }));
  if (n('no2fa')) parts.push(t('audit.p_no2fa', { n: n('no2fa') }));
  return t('audit.lede', { logins: report.logins, parts: parts.join(', ') }) + ' ' + t('audit.summaryLead');
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
      const f = await window.ck.openFile({ title: t('audit.dictLabel'), filters: [{ name: t('audit.dictText'), extensions: ['txt', 'lst', 'dic'] }] });
      if (f) {
        const set = buildDictionary(f.content);
        setDictionary(set);
        toast(t('audit.loaded', { n: set.size.toLocaleString() }), 'ok');
      }
    } catch (e) {
      toast(tr(e.message), 'danger');
    } finally { setLoading(false); }
  };

  return (
    <div className="tool">
      <header className="tool-head">
        <h1>{t('audit.title')}</h1>
        <p>{t('audit.subtitle')}</p>
      </header>

      <section className="audit-hero">
        <div className={`audit-score ${tone}`}>
          <b>{report.score}</b>
          <span>{t('audit.scoreOf')} · {auditGrade(report.grade)}</span>
        </div>
        <p className="audit-lede">{summary(report)}</p>
        <p className="field-hint">
          {t('audit.twoFactor')}:{t('audit.tfaConfigured', { n: report.totpCount })}。{t('audit.breachDictLabel')}:{dictionary ? t('audit.dictLoadedShort', { n: dictionary.size.toLocaleString() }) : t('audit.builtInOnly')}

          <button type="button" className="link-btn" onClick={loadDict} disabled={loading}>{loading ? t('audit.loading') : t('audit.importDict')}</button>
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
                <span className="issue-label">{t(g.labelKey)}</span>
                <span className="issue-count">{list.length || t('audit.none')}</span>
                {list.length > 0 && <Icon name="chevronDown" size={14} className={isOpen ? '' : 'rot'} />}
              </button>
              {isOpen && (
                <ul className="issue-items">
                  {list.map(({ item, detail }) => (
                    <li key={item.id}>
                      <button type="button" className="audit-item" onClick={() => onOpen(item.id)}>
                        <Avatar type={TYPES[item.type].icon} size={24} />
                        <span className="list-name">{item.title}</span>
                        <span className="field-hint">{auditDetail(detail)}</span>
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
        <h3 className="section-title">{t('audit.logTitle')}</h3>
        <ul className="audit-log">
          {(data.audit || []).slice(0, 40).map((a, i) => (
            <li key={i} className={a.action === 'warn' ? 'warn' : ''}>
              <span className="mono">{formatTime(a.t)}</span>
              <span>{t(`audit.actions.${ACTION_KEYS[a.action]}`) || a.action}</span>
              <span className="field-hint">{a.detail}</span>
            </li>
          ))}
        </ul>
        <p className="field-hint">{t('audit.logHint')}</p>
      </section>
    </div>
  );
}
