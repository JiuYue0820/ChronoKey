'use strict';
// lib/主进程用户可见错误的单一来源:code → 中文文案。
// 翻译链路:这些中文串同时是 en._lib.errors(及各语言包)的查找键;i18n.js 的 tr() 按
// message 映射,Error.code 供未来 code-first 查找与日志过滤使用。
// tests/dicts-static.test.mjs 保证:这里出现的每个静态文案都在 en._lib.errors 里有键,
// 且源码里不再散落裸的中文 Error 字面量。动态模板(errAlg/errChar/kdfUnsupported 等)
// 由 i18n.js 的正则映射到专用词典键。
const CODES = {
  wrongMaster: '主密码错误',
  wrongCurrentMaster: '当前主密码错误',
  invalidRecovery: '恢复代码无效',
  vaultExists: '保险库已存在',
  vaultLocked: '保险库已锁定',
  vaultExistsImport: '保险库已存在,请在设置中选择"导入超密钥"',
  wipeLimit: '失败次数达到上限,本地保险库已被擦除',
  notChronoKeyData: '超密钥内容不是 ChronoKey 数据',
  badBackupName: '非法的备份名',
  badBackupFile: '备份文件无效',
  badSuperKeyFormat: '不是有效的历史超密钥(格式错误)',
  superKeyChecksum: '超密钥校验失败:内容不完整或复制时出错',
  superKeyHeader: '超密钥头部损坏',
  superKeyKdfRange: '超密钥 KDF 参数超出允许范围',
  superKeyCorrupt: '超密钥内容损坏',
  wrongPassphrase: '口令错误,无法解开超密钥',
  emptySecret: '密钥为空',
  hotpUnsupported: '只支持 TOTP(基于时间)类型,不支持 HOTP',
  digitsRange: '位数只能是 6–8',
  periodRange: '周期超出范围',
  qrNotFound: '图片中没有识别到二维码',
  csvEmpty: 'CSV 为空或缺少表头',
  csvUnknownColumns: '无法识别 CSV 列(需要 username / password 列)',
  bitwardenEncrypted: '这是加密的 Bitwarden 导出,请选择"JSON(未加密)"格式重新导出',
  xmlParse: 'XML 解析失败',
  notKeePassXml: '不是 KeePass 2 XML 导出文件',
  unknownJsonFormat: '无法识别的 JSON 格式',
  fileTooBig: '文件过大(>64MB)',
  externalLinkOnly: '只允许打开 http/https 链接',
  badLangCode: '非法语言代码',
  badLangManifest: '语言包清单格式不正确',
};

// 构造带 code 的 Error;消息即上面的中文文案(zh 为默认输出,UI 经 tr() 翻译)
function mkErr(code, detail) {
  const base = CODES[code];
  const e = new Error(detail == null ? base : base + detail);
  e.code = code;
  return e;
}

module.exports = { CODES, mkErr };
