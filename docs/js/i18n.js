// 官网双语 i18n —— 以 index.html 静态文案为唯一真相源
// ZH 值 = 页面现有中文原文（保证切中文时一字不变）；EN = 对应翻译。
import { EN } from './i18n.en.js';

export const ZH = {
  // nav / brand
  'page.title': 'ChronoKey 时钥 · 离线密码管理器',
  'nav.skip': '跳到正文',
  'brand.zh': '时钥',
  'nav.crypto': '加密',
  'nav.generator': '生成器',
  'nav.totp': '验证码',
  'nav.superkey': '超密钥',
  'nav.download': '下载',
  'nav.faq': '问答',
  'nav.open': '打开菜单',
  'nav.close': '关闭菜单',
  'nav.lang': '切换语言',
  'nav.github': 'GitHub 仓库',
  'theme.toggle': '切换深浅色',
  // hero
  'hero.badge': '离线 · 开源 · 免费',
  'hero.t1': '你的密码,',
  'hero.t2': '只属于<span class="hl">这台电脑</span>。',
  'hero.lead': 'ChronoKey 时钥是一款完全离线的密码管理器。Argon2id + AES-256-GCM 本地加密,内置两步验证码;换电脑时,一串"历史超密钥"就能带走全部数据。没有账号,没有云,没有服务器。',
  'hero.cta1': '下载 Windows 版',
  'hero.cta2': '看看它如何加密',
  'hero.f1': '网络请求',
  'hero.f2': '位 AES 密钥',
  'hero.f3': 'MiB Argon2 内存',
  'hero.c1t': 'AES-256-GCM',
  'hero.c1d': '认证加密',
  'hero.c2t': '抗显卡破解',
  'hero.c2d': 'Argon2id',
  'hero.c3t': '离线',
  'hero.c3d': '零网络',
  'hero.c4t': '加密',
  'hero.c4d': '开源可审',
  'mock.pw': '密码',
  'mock.otp': '两步验证',
  // 加密演示
  'sec.badge': '加密演示 · 真实运行',
  'sec.title': '亲眼看着一条密码被锁起来',
  'sec.lead': '下面不是动画录像。输入一个主密码,浏览器会用与应用相同的参数真实运行 Argon2id 和 AES-256-GCM。全部在本页面内完成,不发送任何数据。',
  'sec.pwLabel': '主密码(随便输入,仅用于演示)',
  'sec.run': '加密',
  'sec.s1t': '随机盐',
  'sec.s1d': '16 字节,来自系统安全随机源。相同的密码每次都得到不同的密钥。',
  'sec.s2t': 'Argon2id 派生密钥',
  'sec.s2d': '占用 64 MiB 内存、3 轮迭代。显卡和专用芯片难以并行暴力破解。',
  'sec.s3t': 'AES-256-GCM 加密',
  'sec.s3d': '96 位随机 IV;认证标签保证密文一旦被改动一个字节就无法解开。',
  'sec.s4t': '篡改测试',
  'sec.s4d': '翻转密文里的一个比特再解密,看看会发生什么。',
  'sec.tamperBtn': '翻转一个比特并解密',
  'sec.decryptBtn': '正常解密',
  'sec.t1t': '拦截全部网络请求',
  'sec.t1d': '应用主进程拦截一切 http / https / ws 请求,内容安全策略禁止连接。断网、防火墙全封都能正常用。',
  'sec.t2t': '双重包裹的数据密钥',
  'sec.t2d': '保险库由随机数据密钥加密,它再分别被主密码和恢复代码包裹。改密码不必重新加密全部数据。',
  'sec.t3t': '自动锁定与剪贴板清理',
  'sec.t3d': '闲置、睡眠、锁屏时自动锁定;复制的密码 20 秒后自动清除,窗口默认防截屏。',
  'sec.t4t': '加密代码完全开源',
  'sec.t4d': '只用公开、经过审计的标准算法,没有自创加密。任何人都可以审查,这正是它可信的原因。',
  // 生成器
  'gen.badge': '密码生成器 · 强度评估',
  'gen.title': '好密码,一键生成',
  'gen.lead': '随机密码、可读的口令短语、PIN 码。所有字符都来自密码学安全随机源,并用拒绝采样消除偏差。下方就是应用里同一份代码,在你的浏览器里运行。',
  'gen.c1': 'EFF 7776 词表口令短语,每词约 12.9 bit',
  'gen.c2': '可避开 0/O、1/l/I 这类易混淆字符',
  'gen.c3': '实时检测常见泄露密码、键盘序列、日期与字母替换',
  'gen.modeAria': '生成模式',
  'gen.m1': '随机密码',
  'gen.m2': '口令短语',
  'gen.m3': 'PIN',
  'gen.refreshAria': '重新生成',
  'gen.copyAria': '复制',
  'gen.lenLabel': '长度',
  'gen.o1': '大写字母',
  'gen.o2': '数字',
  'gen.o3': '符号',
  'gen.o4': '避开易混淆字符',
  'gen.tryLabel': '或者测测你自己的密码有多强',
  'gen.tryPh': '例如 P@ssw0rd',
  'gen.tryNote': '只在本页面计算,不会离开浏览器。',
  'gen.bit': 'bit',
  // 验证码
  'totp.badge': '两步验证 · RFC 6238',
  'totp.title': '验证码,不用再掏手机',
  'totp.lead': '直接粘贴二维码截图或 otpauth 链接,ChronoKey 就会每 30 秒生成一组新的 6 位验证码,与 Google Authenticator 等应用完全兼容。右边的验证码由本页面实时计算。',
  'totp.c1': '支持 SHA-1 / SHA-256 / SHA-512、6–8 位、自定义周期',
  'totp.c2': '截图或剪贴板图片中的二维码可直接识别',
  'totp.c3': '备用恢复码与密钥一起加密保存',
  'totp.note': '演示密钥为公开测试值,与任何真实账户无关。',
  // 超密钥
  'sk.badge': '历史超密钥 · 换电脑',
  'sk.title': '一串文字,带走整个保险库',
  'sk.lead': '没有云同步,也能搬家。在旧电脑导出"历史超密钥",它是压缩后再加密的全部条目、验证码和设置;在新电脑粘贴,输入口令,一切原样恢复。',
  'sk.old': '旧电脑',
  'sk.new': '新电脑',
  'sk.s1t': '导出',
  'sk.s1d': '设置 → 迁移 → 生成超密钥。内容先 gzip 压缩,再用 Argon2id + AES-256-GCM 加密。',
  'sk.s2t': '搬运',
  'sk.s2d': '以 <code>CK1.</code> 开头的一串文本,可以存进 U 盘、写在纸上,或用你信任的方式传过去。',
  'sk.s3t': '导入',
  'sk.s3d': '新电脑首次启动选"我有历史超密钥"。已有保险库也能合并,较新的条目胜出,旧版进入历史。',
  // 功能
  'feat.badge': '更多功能',
  'feat.title': '日常需要的,都在这里',
  'feat.f1t': '八种条目',
  'feat.f1d': '登录、验证码、银行卡、身份、地址、安全笔记、API 密钥、SSH 密钥。',
  'feat.f2t': '版本历史',
  'feat.f2d': '每个条目保留最近 15 个版本,改错了随时回滚,也能看到旧密码。',
  'feat.f3t': '安全审计',
  'feat.f3d': '找出弱密码、重复密码、过期密码和没开两步验证的账户,给出总评分。',
  'feat.f4t': '导入导出',
  'feat.f4d': '支持 Bitwarden JSON、KeePass XML、CSV 与 ChronoKey JSON。',
  'feat.f5t': 'SSH 密钥生成',
  'feat.f5d': '一键生成 OpenSSH 格式的 ed25519 密钥对和指纹。',
  'feat.f6t': '恢复代码',
  'feat.f6d': '25 位 Crockford Base32,约 125 bit 熵。忘了主密码也能找回。',
  'feat.f7t': '自动快照',
  'feat.f7d': '重要操作前自动备份,保留最近 20 份,可在设置中一键还原。',
  'feat.f8t': '便携模式',
  'feat.f8d': '程序旁放一个 <code>ChronoKeyData</code> 文件夹,数据就跟着 U 盘走。',
  // 下载
  'dl.badge': '下载 · v{v}',
  'dl.title': '三步装好,装完安装程序自己消失',
  'dl.s1': '选择安装位置(默认用户目录,无需管理员权限)',
  'dl.s2': '多线程从 GitHub 下载,自动校验 SHA-256',
  'dl.s3': '创建快捷方式;安装程序删除自身,卸载程序留在安装目录',
  'dl.setupBtn': '下载安装程序',
  'dl.zipBtn': '便携版 zip',
  'dl.req': 'Windows 10 / 11 x64。程序未做代码签名,SmartScreen 若提示"未知发布者",点"更多信息 → 仍要运行"。',
  'dl.sha': '校验文件(SHA-256)',
  'dl.ps': 'PowerShell:',
  'dl.sw1': '选择位置',
  'dl.sw2': '下载',
  'dl.sw3': '安装',
  'dl.sw4': '完成',
  'sw.tag': '离线密码库 · 数据只在本机',
  'sw.s1': '选择位置',
  'sw.s2': '下载',
  'sw.s3': '安装',
  'sw.s4': '完成',
  'sw.t1': '选择安装位置',
  'sw.b1': '开始安装',
  'sw.dl': '正在下载',
  'sw.ver': '正在校验',
  'sw.inst': '正在安装',
  'sw.done': '安装完成',
  // 问答
  'faq.badge': '问答',
  'faq.title': '常见问题',
  'faq.q1': '数据存在哪里?会上传吗?',
  'faq.a1': '只存在你的电脑:<code>%APPDATA%\\\\ChronoKey\\\\vault</code>(便携模式下在程序旁的 <code>ChronoKeyData</code>)。应用拦截所有网络请求,没有任何上传、统计或更新检查。',
  'faq.q2': '忘记主密码怎么办?',
  'faq.a2': '用创建保险库时得到的 25 位恢复代码重设密码。如果恢复代码也丢了,但你保存过历史超密钥并记得它的口令,可以删除当前保险库后从超密钥恢复。没有任何"后门"能帮你找回,这正是安全的代价。',
  'faq.q3': '加密代码开源,不会被破解吗?',
  'faq.a3': '不会因为开源而变弱。ChronoKey 只使用公开的标准算法(Argon2id、AES-256-GCM),安全性来自你的密码而不是代码保密,这是密码学的 Kerckhoffs 原则。公开反而让任何人都能检查实现有没有问题。',
  'faq.q4': '能在多台电脑之间同步吗?',
  'faq.a4': '没有自动同步,因为那需要服务器。你可以用历史超密钥在电脑之间迁移或合并:同一条目以较新的修改为准,另一份进入版本历史。',
  'faq.q5': '怎么卸载?会删掉我的密码吗?',
  'faq.a5': '在"设置 → 应用 → 已安装的应用"里卸载,或运行安装目录中的 <code>Uninstall.exe</code>。默认保留保险库数据,重新安装后可以直接解锁;取消勾选才会永久删除。',
  'faq.q6': '支持 macOS / Linux / 手机吗?',
  'faq.a6': '目前只发布 Windows x64 版本。代码基于 Electron,理论上可以构建其他桌面平台,欢迎在 GitHub 上参与。',
  // 页脚
  'footer.brand': 'ChronoKey 时钥',
  'footer.made': 'MIT 许可证 · 由 JiuYue0820 制作',
  'footer.src': '源代码',
  'footer.releases': '所有版本',
  'footer.crypto': '加密实现',
  'footer.sec': '报告安全问题',
  'footer.note': '配色来自日本传统色:柳染、苔、朽葉、紅樺。本页面同样不加载任何第三方资源。',
  // toast
  'toast.copied': '已复制',
  'toast.copyFail': '复制失败,请手动选择',
};

// ---- 运行时 ----
let _lang = 'en';
try { _lang = localStorage.getItem('ck-site-lang') || 'en'; } catch {}

export function getSiteLang() { return _lang; }

export function setSiteLang(lang) {
  _lang = lang;
  try { localStorage.setItem('ck-site-lang', lang); } catch {}
  applyI18n();
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  dispatchEvent(new CustomEvent('ck-lang-change', { detail: lang }));
}

export function t(key, vars) {
  const dict = _lang === 'en' ? EN : ZH;
  let s = dict[key] ?? ZH[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v);
  return s;
}

export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPh));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  document.title = t('page.title');
}

// 页面加载时应用(浏览器环境)
if (typeof document !== 'undefined') {
  applyI18n();
  document.documentElement.lang = _lang === 'zh' ? 'zh-CN' : 'en';
}
