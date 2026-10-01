// 本地安全审计:弱 / 重复 / 过期 / 过短 / 字典命中 / 缺少 2FA
import { estimate, isInDictionary } from './strength.js';
import { hostOf } from './model.js';

// 已知支持 TOTP 的常见服务(用于 2FA 覆盖率提示,离线内置)
const TOTP_CAPABLE = [
  'github.com', 'gitlab.com', 'google.com', 'microsoft.com', 'live.com', 'apple.com', 'amazon.com', 'aws.amazon.com',
  'dropbox.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'discord.com', 'reddit.com', 'twitch.tv',
  'npmjs.com', 'pypi.org', 'docker.com', 'cloudflare.com', 'digitalocean.com', 'heroku.com', 'vercel.com',
  'linkedin.com', 'slack.com', 'notion.so', 'figma.com', 'atlassian.com', 'bitbucket.org', 'paypal.com',
  'stripe.com', 'coinbase.com', 'binance.com', 'steamcommunity.com', 'steampowered.com', 'epicgames.com',
  'openai.com', 'anthropic.com', 'proton.me', 'tutanota.com', 'zoom.us', 'adobe.com', 'wordpress.com',
  'shopify.com', 'bilibili.com', 'aliyun.com', 'cloud.tencent.com', 'huaweicloud.com', 'gitee.com',
];

export function supportsTotp(url) {
  const h = hostOf(url);
  return !!h && TOTP_CAPABLE.some((d) => h === d || h.endsWith(`.${d}`));
}

export function runAudit(items, { maxAgeDays = 365, dictionary = null } = {}) {
  const live = items.filter((i) => !i.deletedAt);
  const logins = live.filter((i) => i.type === 'login' && i.fields.password);
  const byPw = new Map();
  for (const i of logins) {
    const k = i.fields.password;
    byPw.set(k, [...(byPw.get(k) || []), i]);
  }

  const now = Date.now();
  const issues = { weak: [], reused: [], old: [], short: [], breached: [], no2fa: [] };
  for (const i of logins) {
    const pw = i.fields.password;
    const est = estimate(pw);
    if (est.score <= 1) issues.weak.push({ item: i, detail: `${est.label} · ${est.bits} bit` });
    if (pw.length < 12) issues.short.push({ item: i, detail: `${pw.length} 位` });
    if (byPw.get(pw).length > 1) issues.reused.push({ item: i, detail: `与 ${byPw.get(pw).length - 1} 个条目相同` });
    const age = (now - (i.passwordChangedAt || i.createdAt)) / 86400000;
    if (maxAgeDays > 0 && age > maxAgeDays) issues.old.push({ item: i, detail: `${Math.floor(age)} 天未更换` });
    if (isInDictionary(pw, dictionary)) issues.breached.push({ item: i, detail: '出现在泄露字典中' });
    if (!i.fields.totp && supportsTotp(i.fields.url)) issues.no2fa.push({ item: i, detail: `${hostOf(i.fields.url)} 支持两步验证` });
  }

  const withTotp = live.filter((i) => i.fields.totp).length;
  const total = logins.length || 1;
  const bad = new Set([...issues.weak, ...issues.reused, ...issues.breached].map((x) => x.item.id)).size;
  const minor = new Set([...issues.old, ...issues.short, ...issues.no2fa].map((x) => x.item.id)).size;
  const score = logins.length ? Math.max(0, Math.round(100 - (bad / total) * 70 - (minor / total) * 30)) : 100;

  return {
    score,
    grade: score >= 90 ? '优秀' : score >= 75 ? '良好' : score >= 50 ? '需改进' : '危险',
    logins: logins.length,
    totpCount: withTotp,
    issues,
  };
}

// 导入离线泄露字典(如 rockyou.txt):只在内存中保留小写形式,不写入磁盘
export function buildDictionary(text, limit = 2_000_000) {
  const set = new Set();
  let start = 0;
  while (start < text.length && set.size < limit) {
    let end = text.indexOf('\n', start);
    if (end < 0) end = text.length;
    const w = text.slice(start, end).trim().toLowerCase();
    if (w) set.add(w);
    start = end + 1;
  }
  return set;
}
