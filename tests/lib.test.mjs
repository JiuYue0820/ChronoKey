import test from 'node:test';
import assert from 'node:assert';
import { totp, base32Encode, base32Decode, parseOtpauth, buildOtpauth } from '../src/lib/totp.js';
import { generate, generatorEntropy } from '../src/lib/generator.js';
import { estimate } from '../src/lib/strength.js';
import { parseCsv, importCsv, importBitwardenJson, exportCsv } from '../src/lib/importers.js';
import { newItem, updateItem, restoreVersion, mergeVaults, emptyVault, matches } from '../src/lib/model.js';
import { runAudit } from '../src/lib/audit.js';

const enc = (s) => base32Encode(new TextEncoder().encode(s));

test('TOTP RFC 6238 附录 B 测试向量', async () => {
  const s1 = enc('12345678901234567890');
  const s256 = enc('12345678901234567890123456789012');
  const s512 = enc('1234567890123456789012345678901234567890123456789012345678901234');
  const cases = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1234567890, '89005924', '91819424', '93441116'],
    [2000000000, '69279037', '90698825', '38618901'],
    [20000000000, '65353130', '77737706', '47863826'],
  ];
  for (const [t, a, b, c] of cases) {
    assert.equal((await totp({ secret: s1, digits: 8 }, t * 1000)).code, a);
    assert.equal((await totp({ secret: s256, digits: 8, algorithm: 'SHA256' }, t * 1000)).code, b);
    assert.equal((await totp({ secret: s512, digits: 8, algorithm: 'SHA512' }, t * 1000)).code, c);
  }
});

test('base32 往返与 otpauth 解析', () => {
  assert.equal(new TextDecoder().decode(base32Decode('jbsw y3dp ehpk 3pxp').slice(0, 6)), 'Hello!');
  assert.equal(base32Encode(base32Decode('JBSWY3DPEHPK3PXP')), 'JBSWY3DPEHPK3PXP');
  const p = parseOtpauth('otpauth://totp/GitHub:alice%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub');
  assert.deepEqual(p, { secret: 'JBSWY3DPEHPK3PXP', issuer: 'GitHub', account: 'alice@example.com', algorithm: 'SHA1', digits: 6, period: 30 });
  assert.deepEqual(parseOtpauth(buildOtpauth(p)), p);
  assert.equal(parseOtpauth('jbsw y3dp ehpk 3pxp').secret, 'JBSWY3DPEHPK3PXP');
  assert.throws(() => parseOtpauth('otpauth://hotp/x?secret=JBSWY3DP'), /HOTP/);
  assert.throws(() => parseOtpauth('not base32 !!'), /非法字符/);
});

test('生成器:长度、字符集覆盖、无歧义字符、口令短语', () => {
  for (let i = 0; i < 200; i++) {
    const pw = generate({ mode: 'random', length: 16, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: true });
    assert.equal(pw.length, 16);
    assert.match(pw, /[a-z]/); assert.match(pw, /[A-Z]/); assert.match(pw, /[0-9]/); assert.match(pw, /[^a-zA-Z0-9]/);
    assert.doesNotMatch(pw, /[Il1O0o|`'"]/);
  }
  const phrase = generate({ mode: 'passphrase', words: 5, separator: '-', capitalize: true, addNumber: true });
  assert.equal(phrase.split('-').length, 5);
  assert.match(generate({ mode: 'pin', pinLength: 6 }), /^\d{6}$/);
  assert.ok(generatorEntropy({ mode: 'passphrase', words: 5 }) > 64);
});

test('强度估计', () => {
  assert.equal(estimate('password').score, 0);
  assert.equal(estimate('qwerty123').score, 0);
  assert.ok(estimate('Tr0ub4dor&3').score <= 2);
  assert.ok(estimate(generate({ length: 24 })).score === 4);
});

test('CSV 解析(引号、换行、BOM)与 Chrome 格式导入', () => {
  assert.deepEqual(parseCsv('﻿a,"b,""c""",d\r\n"x\ny",2,3\n'), [['a', 'b,"c"', 'd'], ['x\ny', '2', '3']]);
  const r = importCsv('name,url,username,password,note\nGitHub,https://github.com/login,alice,"p,w",hi\n');
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].fields.password, 'p,w');
  assert.equal(r.items[0].notes, 'hi');
  const back = importCsv(exportCsv(r.items));
  assert.equal(back.items[0].fields.url, 'https://github.com/login');
});

test('Bitwarden JSON 导入', () => {
  const r = importBitwardenJson({
    encrypted: false,
    folders: [{ id: 'f1', name: 'Work' }],
    items: [
      { type: 1, name: 'GitLab', folderId: 'f1', login: { username: 'bob', password: 'x', totp: 'JBSWY3DPEHPK3PXP', uris: [{ uri: 'https://gitlab.com' }] } },
      { type: 3, name: 'Visa', card: { number: '4111111111111111', expMonth: '4', expYear: '2031' } },
      { type: 2, name: 'Memo', notes: 'hello' },
    ],
  });
  assert.equal(r.items.length, 3);
  assert.equal(r.folders[0].name, 'Work');
  assert.equal(r.items[0].folderId, r.folders[0].id);
  assert.equal(r.items[0].fields.totp, 'JBSWY3DPEHPK3PXP');
  assert.equal(r.items[1].fields.expiry, '04/31');
  assert.equal(r.items[2].fields.body, 'hello');
});

test('版本历史、回滚、合并、搜索不泄露机密', () => {
  const a = newItem('login', { title: 'Site', fields: { password: 'one' } });
  const b = updateItem(a, { ...a, fields: { password: 'two' } });
  assert.equal(b.versions.length, 1);
  assert.equal(b.versions[0].fields.password, 'one');
  const c = restoreVersion(b, 0);
  assert.equal(c.fields.password, 'one');
  assert.equal(c.versions.length, 2);
  assert.ok(!matches(c, 'one'), '搜索不应命中密码字段');
  assert.ok(matches(c, 'site'));

  const local = { ...emptyVault(), items: [a] };
  const newer = { ...b, updatedAt: a.updatedAt + 1000 };
  const extra = newItem('note', { title: 'N' });
  const m = mergeVaults(local, { items: [newer, extra], folders: [] });
  assert.equal(m.added, 1);
  assert.equal(m.updated, 1);
  assert.equal(m.data.items.find((i) => i.id === a.id).fields.password, 'two');
});

test('安全审计:弱、重复、2FA 覆盖', () => {
  const items = [
    newItem('login', { title: 'GH', fields: { password: 'password', url: 'https://github.com' } }),
    newItem('login', { title: 'X', fields: { password: 'password', url: 'https://example.org' } }),
    newItem('login', { title: 'OK', fields: { password: generate({ length: 24 }), url: 'https://gitlab.com', totp: 'JBSWY3DPEHPK3PXP' } }),
  ];
  const r = runAudit(items);
  assert.equal(r.issues.weak.length, 2);
  assert.equal(r.issues.reused.length, 2);
  assert.equal(r.issues.no2fa.length, 1);
  assert.equal(r.issues.no2fa[0].item.title, 'GH');
  assert.ok(r.score < 60);
});

test('normalizeVault:补齐缺失字段、去重 id、清理失效文件夹引用', async () => {
  const { normalizeVault } = await import('../src/lib/model.js');
  const d = normalizeVault({
    items: [{ id: 'a', title: 'x', folderId: 'gone' }, { id: 'a', type: 'bogus' }, null],
    folders: [{ id: 'f', name: '工作' }, { name: '无 id' }],
  });
  assert.equal(d.items.length, 3);
  assert.equal(new Set(d.items.map((i) => i.id)).size, 3);
  for (const i of d.items) {
    assert.ok(i.fields && Array.isArray(i.tags) && Array.isArray(i.custom) && Array.isArray(i.versions));
  }
  assert.equal(d.items[0].folderId, null);
  assert.equal(d.items[1].type, 'note');
  assert.equal(d.folders.length, 1);
  assert.equal(d.settings.backupKeep, 20);
  assert.ok(matches(d.items[0], 'x'));
});
