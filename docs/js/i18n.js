// 官网双语 i18n：字典 + 切换工具
export const I18N = {
  zh: {
    // ---------- header / hero ----------
    'hero.tagline': '把时间花在要紧的事上',
    'hero.title': '你的钥匙，只开自己的门',
    'hero.desc': '纯本地、离线的密码管理器。所有数据加密存储在这台电脑，不上传、不联网、不依赖任何服务器。',
    'hero.cta': '获取 Windows 版本',
    'hero.security': '下载并了解它的加密',
    // nav
    'nav.security': '安全性',
    'nav.generator': '生成器',
    'nav.totp': '两步验证',
    'nav.superkey': '迁移',
    'nav.features': '功能',
    'nav.download': '下载',
    'nav.faq': '问答',
    'nav.open': '打开菜单',
    'nav.close': '关闭菜单',
    // theme
    'theme.light': '切换到浅色',
    'theme.dark': '切换到深色',
    // lang btn
    'lang.switchToEn': 'EN',
    'lang.switchToZh': '中',
    // stats
    'stat.itemTypes': '条目类型',
    'stat.history': '历史版本',
    'stat.snapshots': '自动快照保留',
    // ---------- security ----------
    'sec.eyebrow': '安全性 · 无服务器',
    'sec.title': '你的密码不属于任何云',
    'sec.lead': 'ChronoKey 没有账号、没有同步、没有任何遥测——没有攻击面可以攻击。保险库是一个本地加密文件；只有主密码和恢复代码能打开它。下方就是应用实际执行的加密流水线，在浏览器里实时运行。',
    'sec.run': '在你的浏览器里运行',
    'sec.pw.label': '输入口令（默认 demo）',
    'sec.pw.ph': '输入主口令…',
    'sec.step.salt': '随机 16 字节盐',
    'sec.step.saltDesc': '每次加密都重新生成，使同样的口令产生不同的密钥。',
    'sec.step.kdf': 'Argon2id 密钥派生',
    'sec.step.kdfDesc': '内存困难的函数：64 MiB 内存、3 轮、并行度 1。暴力尝试每一次都很慢。',
    'sec.step.seal': 'AES-256-GCM 加密',
    'sec.step.sealDesc': '96 位随机 IV；认证标签保证密文一旦被改动一个字节就无法解开。',
    'sec.step.tamper': '篡改测试',
    'sec.step.tamperDesc': '翻转密文里的一个比特再解密，看看会发生什么。',
    'sec.tamperBtn': '翻转一个比特并解密',
    'sec.decryptBtn': '正常解密',
    'sec.trust.1t': '拦截全部网络请求',
    'sec.trust.1d': '应用主进程拦截一切 http / https / ws 请求，内容安全策略禁止连接。断网、防火墙全封都能正常用。',
    'sec.trust.2t': '双重包裹的数据密钥',
    'sec.trust.2d': '保险库由随机数据密钥加密，它再分别被主密码和恢复代码包裹。改密码不必重新加密全部数据。',
    'sec.trust.3t': '自动锁定与剪贴板清理',
    'sec.trust.3d': '闲置、睡眠、锁屏时自动锁定；复制的密码 20 秒后自动清除，窗口默认防截屏。',
    'sec.trust.4t': '加密代码完全开源',
    'sec.trust.4d': '只用公开、经过审计的标准算法，没有自创加密。任何人都可以审查，这正是它可信的原因。',
    // kdf result
    'sec.kdfTime': '在你的浏览器里用了 {ms} 毫秒、64 MiB 内存。攻击者每猜一次密码都要付出同样的代价。',
    'sec.decOk': '解密成功：{title} / {pw}',
    'sec.decFail': '认证失败，拒绝解密。哪怕只改动一个比特，GCM 标签也能发现。',
    'sec.demoErr': '演示出错：{msg}',
    // ---------- generator ----------
    'gen.eyebrow': '密码生成器 · 强度评估',
    'gen.title': '好密码，一键生成',
    'gen.lead': '随机密码、可读的口令短语、PIN 码。所有字符都来自密码学安全随机源，并用拒绝采样消除偏差。下方就是应用里同一份代码，在你的浏览器里运行。',
    'gen.c1': 'EFF 7776 词表口令短语，每词约 12.9 bit',
    'gen.c2': '可避开 0/O、1/l/I 这类易混淆字符',
    'gen.c3': '实时检测常见泄露密码、键盘序列、日期与字母替换',
    'gen.mode': '生成模式',
    'gen.random': '随机密码',
    'gen.passphrase': '口令短语',
    'gen.pin': 'PIN',
    'gen.reroll': '重新生成',
    'gen.copy': '复制',
    'gen.len': '长度',
    'gen.words': '单词数',
    'gen.digits': '位数',
    'gen.upper': '大写字母',
    'gen.digitsLabel': '数字',
    'gen.symbols': '符号',
    'gen.avoid': '避开易混淆字符',
    'gen.tryLabel': '或者测测你自己的密码有多强',
    'gen.tryPh': '例如 P@ssw0rd',
    'gen.tryNote': '只在本页面计算，不会离开浏览器。',
    'gen.crackTime': '离线破解约需：{t}',
    // strength labels
    'str.empty': '空',
    'str.0': '非常弱',
    'str.1': '弱',
    'str.2': '一般',
    'str.3': '强',
    'str.4': '非常强',
    // warnings
    'warn.common': '这是最常见的泄露密码之一',
    'warn.leet': '只是把字母换成了相似的数字/符号，很容易被猜到',
    'warn.date': '包含日期，容易被猜到',
    'warn.repeat': '包含重复字符',
    'warn.seq': '包含键盘序列或连续字符',
    'warn.short': '长度少于 12 位',
    // crack time units
    'time.instant': '瞬间',
    'time.s': '秒',
    'time.min': '分钟',
    'time.h': '小时',
    'time.d': '天',
    'time.y': '年',
    'time.century': '世纪',
    'time.about': '约 {n} {u}',
    'time.far': '远超宇宙年龄',
    // ---------- totp ----------
    'totp.eyebrow': '两步验证 · RFC 6238',
    'totp.title': '验证码，不用再掏手机',
    'totp.lead': '直接粘贴二维码截图或 otpauth 链接，ChronoKey 就会每 30 秒生成一组新的 6 位验证码，与 Google Authenticator 等应用完全兼容。右边的验证码由本页面实时计算。',
    'totp.c1': '支持 SHA-1 / SHA-256 / SHA-512、6–8 位、自定义周期',
    'totp.c2': '截图或剪贴板图片中的二维码可直接识别',
    'totp.c3': '备用恢复码与密钥一起加密保存',
    'totp.note': '演示密钥为公开测试值，与任何真实账户无关。',
    'totp.aria': '{name} 验证码 {code}，剩余 {s} 秒，按下复制',
    // totp account names
    'totp.account.ms': '微软账户',
    // ---------- superkey ----------
    'sk.eyebrow': '历史超密钥 · 换电脑',
    'sk.title': '一串文字，带走整个保险库',
    'sk.lead': '没有云同步，也能搬家。在旧电脑导出"历史超密钥"，它是压缩后再加密的全部条目、验证码和设置；在新电脑粘贴，输入口令，一切原样恢复。',
    'sk.old': '旧电脑',
    'sk.new': '新电脑',
    'sk.step1t': '导出',
    'sk.step1d': '设置 → 迁移 → 生成超密钥。内容先 gzip 压缩，再用 Argon2id + AES-256-GCM 加密。',
    'sk.step2t': '搬运',
    'sk.step2d': '以 CK1. 开头的一串文本，可以存进 U 盘、写在纸上，或用你信任的方式传过去。',
    'sk.step3t': '导入',
    'sk.step3d': '新电脑首次启动选"我有历史超密钥"。已有保险库也能合并，较新的条目胜出，旧版进入历史。',
    // features
    'feat.eyebrow': '更多功能',
    'feat.title': '日常需要的，都在这里',
    'feat.1t': '八种条目',
    'feat.1d': '登录、验证码、银行卡、身份、地址、安全笔记、API 密钥、SSH 密钥。',
    'feat.2t': '版本历史',
    'feat.2d': '每个条目保留最近 15 个版本，改错了随时回滚，也能看到旧密码。',
    'feat.3t': '安全审计',
    'feat.3d': '找出弱密码、重复密码、过期密码和没开两步验证的账户，给出总评分。',
    'feat.4t': '导入导出',
    'feat.4d': '支持 Bitwarden JSON、KeePass XML、CSV 与 ChronoKey JSON。',
    'feat.5t': 'SSH 密钥生成',
    'feat.5d': '一键生成 OpenSSH 格式的 ed25519 密钥对和指纹。',
    'feat.6t': '恢复代码',
    'feat.6d': '25 位 Crockford Base32，约 125 bit 熵。忘了主密码也能找回。',
    'feat.7t': '自动快照',
    'feat.7d': '重要操作前自动备份，保留最近 20 份，可在设置中一键还原。',
    'feat.8t': '便携模式',
    'feat.8d': '程序旁放一个 ChronoKeyData 文件夹，数据就跟着 U 盘走。',
    // ---------- download ----------
    'dl.eyebrow': '下载',
    'dl.title': '三步装好，装完安装程序自己消失',
    'dl.s1': '选择安装位置（默认用户目录，无需管理员权限）',
    'dl.s2': '多线程从 GitHub 下载，自动校验 SHA-256',
    'dl.s3': '创建快捷方式；安装程序删除自身，卸载程序留在安装目录',
    'dl.setup': '下载安装程序',
    'dl.zip': '便携版 zip',
    'dl.req': 'Windows 10 / 11 x64。程序未做代码签名，SmartScreen 若提示"未知发布者"，点"更多信息 → 仍要运行"。',
    'dl.sha': '校验文件（SHA-256）',
    'dl.ps': 'PowerShell：',
    // installer mock
    'sw.tag': '离线密码库 · 数据只在本机',
    'sw.s1': '选择位置',
    'sw.s2': '下载',
    'sw.s3': '安装',
    'sw.s4': '完成',
    'sw.title1': '选择安装位置',
    'sw.title2': '正在下载',
    'sw.title3': '正在校验',
    'sw.title4': '正在安装',
    'sw.title5': '安装完成',
    'sw.sub2': 'ChronoKey 0.2.0 · 8 线程',
    'sw.sub3': 'SHA-256 ✓',
    'sw.sub4': '正在解压文件…',
    'sw.sub5': '关闭后安装程序会自动删除自身',
    'sw.btn1': '开始安装',
    'sw.btn2': '取消',
    'sw.btn3': '完成',
    'sw.speed': '{sp} MB/s · 剩余 {s} 秒',
    'sw.dlDone': '下载完成',
    'sw.fileCount': '{n} / 21 个文件',
    // ---------- faq ----------
    'faq.eyebrow': '问答',
    'faq.title': '常见问题',
    'faq.q1': '数据存在哪里？会上传吗？',
    'faq.a1': '只存在你的电脑：%APPDATA%\\ChronoKey\\vault（便携模式下在程序旁的 ChronoKeyData）。应用拦截所有网络请求，没有任何上传、统计或后台行为；仅"设置 → 关于 → 检查更新"在你手动点击时才发一次请求。',
    'faq.q2': '忘记主密码怎么办？',
    'faq.a2': '用创建保险库时得到的 25 位恢复代码重设密码。如果恢复代码也丢了，但你保存过历史超密钥并记得它的口令，可以删除当前保险库后从超密钥恢复。没有任何"后门"能帮你找回，这正是安全的代价。',
    'faq.q3': '加密代码开源，不会被破解吗？',
    'faq.a3': '不会因为开源而变弱。ChronoKey 只使用公开的标准算法（Argon2id、AES-256-GCM），安全性来自你的密码而不是代码保密，这是密码学的 Kerckhoffs 原则。公开反而让任何人都能检查实现有没有问题。',
    'faq.q4': '能在多台电脑之间同步吗？',
    'faq.a4': '没有自动同步，因为那需要服务器。你可以用历史超密钥在电脑之间迁移或合并：同一条目以较新的修改为准，另一份进入版本历史。',
    'faq.q5': '怎么卸载？会删掉我的密码吗？',
    'faq.a5': '在"设置 → 应用 → 已安装的应用"里卸载，或运行安装目录中的 Uninstall.exe。默认保留保险库数据，重新安装后可以直接解锁；取消勾选才会永久删除。',
    'faq.q6': '支持 macOS / Linux / 手机吗？',
    'faq.a6': '目前只发布 Windows x64 版本。代码基于 Electron，理论上可以构建其他桌面平台，欢迎在 GitHub 上参与。',
    // ---------- footer ----------
    'footer.made': 'MIT 许可证 · 由 JiuYue0820 制作',
    'footer.src': '源代码',
    'footer.releases': '所有版本',
    'footer.crypto': '加密实现',
    'footer.security': '报告安全问题',
    'footer.note': '配色来自日本传统色：柳染、苔、朽葉、紅樺。本页面同样不加载任何第三方资源。',
    // ---------- toast ----------
    'toast.copied': '已复制',
    'toast.copyFail': '复制失败，请手动选择',
    // hero mock entries
    'mock.zhimai': '招商银行',
    'mock.openai': 'OpenAI 开发',
    'mock.wifi': '家里 Wi-Fi',
    'mock.note': '安全笔记',
  },
  en: {
    // ---------- header / hero ----------
    'hero.tagline': 'Spend your time on what matters',
    'hero.title': 'Your keys open only your own door',
    'hero.desc': 'A fully local, offline password manager. All data is encrypted and stored on this computer. No uploads, no network, no servers.',
    'hero.cta': 'Get it for Windows',
    'hero.security': 'Download & explore its cryptography',
    // nav
    'nav.security': 'Security',
    'nav.generator': 'Generator',
    'nav.totp': '2FA',
    'nav.superkey': 'Migrate',
    'nav.features': 'Features',
    'nav.download': 'Download',
    'nav.faq': 'FAQ',
    'nav.open': 'Open menu',
    'nav.close': 'Close menu',
    // theme
    'theme.light': 'Switch to light',
    'theme.dark': 'Switch to dark',
    // lang btn
    'lang.switchToEn': '中',
    'lang.switchToZh': 'EN',
    // stats
    'stat.itemTypes': 'Item types',
    'stat.history': 'History versions',
    'stat.snapshots': 'Auto-snapshots kept',
    // ---------- security ----------
    'sec.eyebrow': 'Security · No servers',
    'sec.title': 'Your passwords belong to no cloud',
    'sec.lead': 'ChronoKey has no accounts, no sync, and no telemetry — no attack surface to attack. Your vault is a local encrypted file; only your master password and recovery code can open it. Below is the exact encryption pipeline the app runs, live in your browser.',
    'sec.run': 'Run in your browser',
    'sec.pw.label': 'Passphrase (defaults to demo)',
    'sec.pw.ph': 'Enter master passphrase…',
    'sec.step.salt': 'Random 16-byte salt',
    'sec.step.saltDesc': 'A fresh salt on every seal, so the same passphrase yields different keys.',
    'sec.step.kdf': 'Argon2id key derivation',
    'sec.step.kdfDesc': 'A memory-hard function: 64 MiB of memory, 3 rounds, parallelism 1. Brute force gets slow on every guess.',
    'sec.step.seal': 'AES-256-GCM seal',
    'sec.step.sealDesc': '96-bit random IV; the auth tag guarantees that a single bit of tampering makes the ciphertext unopenable.',
    'sec.step.tamper': 'Tamper test',
    'sec.step.tamperDesc': 'Flip one bit in the ciphertext and decrypt, to see what happens.',
    'sec.tamperBtn': 'Flip a bit & decrypt',
    'sec.decryptBtn': 'Decrypt normally',
    'sec.trust.1t': 'Blocks all network requests',
    'sec.trust.1d': 'The app main process intercepts every http / https / ws request; the CSP forbids connections. Works fully offline, firewall-blocked, etc.',
    'sec.trust.2t': 'Doubly-wrapped data key',
    'sec.trust.2d': 'The vault is encrypted by a random data key, which is itself wrapped separately by your master password and recovery code. Changing the password does not re-encrypt all data.',
    'sec.trust.3t': 'Auto-lock & clipboard wipe',
    'sec.trust.3d': 'Locks on idle, sleep, or screen lock; copied passwords auto-clear after 20 s; the window is screenshot-protected by default.',
    'sec.trust.4t': 'Encryption code fully open source',
    'sec.trust.4d': 'Only public, audited standard algorithms — no home-grown crypto. Anyone can review it, which is exactly why it is trustworthy.',
    // kdf result
    'sec.kdfTime': 'Took {ms} ms and 64 MiB of memory in your browser. Every brute-force guess the attacker makes pays the same cost.',
    'sec.decOk': 'Decryption succeeded: {title} / {pw}',
    'sec.decFail': 'Authentication failed, decryption refused. Even a single bit change is detected by the GCM tag.',
    'sec.demoErr': 'Demo error: {msg}',
    // ---------- generator ----------
    'gen.eyebrow': 'Password generator · strength check',
    'gen.title': 'Good passwords, one click',
    'gen.lead': 'Random passwords, readable passphrases, PIN codes. Every character comes from a cryptographically secure random source, with rejection sampling to remove bias. This is the same code that runs in the app, live in your browser.',
    'gen.c1': 'EFF 7776-word passphrase, ~12.9 bits per word',
    'gen.c2': 'Avoids confusable characters (0/O, 1/l/I)',
    'gen.c3': 'Real-time detection of breached passwords, keyboard sequences, dates, and leet substitutions',
    'gen.mode': 'Generation mode',
    'gen.random': 'Random password',
    'gen.passphrase': 'Passphrase',
    'gen.pin': 'PIN',
    'gen.reroll': 'Regenerate',
    'gen.copy': 'Copy',
    'gen.len': 'Length',
    'gen.words': 'Word count',
    'gen.digits': 'Digits',
    'gen.upper': 'Uppercase',
    'gen.digitsLabel': 'Digits',
    'gen.symbols': 'Symbols',
    'gen.avoid': 'Avoid ambiguous chars',
    'gen.tryLabel': 'Or check how strong your own password is',
    'gen.tryPh': 'e.g. P@ssw0rd',
    'gen.tryNote': 'Computed on this page only; nothing leaves your browser.',
    'gen.crackTime': 'Offline cracking: {t}',
    // strength labels
    'str.empty': 'Empty',
    'str.0': 'Very weak',
    'str.1': 'Weak',
    'str.2': 'Fair',
    'str.3': 'Strong',
    'str.4': 'Very strong',
    // warnings
    'warn.common': 'One of the most commonly breached passwords',
    'warn.leet': 'Just swapping letters for similar digits/symbols — easily guessed',
    'warn.date': 'Contains a date, easy to guess',
    'warn.repeat': 'Contains repeated characters',
    'warn.seq': 'Contains keyboard sequences or consecutive characters',
    'warn.short': 'Fewer than 12 characters',
    // crack time units
    'time.instant': 'instantly',
    'time.s': 'sec',
    'time.min': 'min',
    'time.h': 'hr',
    'time.d': 'day',
    'time.y': 'yr',
    'time.century': 'century',
    'time.about': '~{n} {u}',
    'time.far': 'far beyond the age of the universe',
    // ---------- totp ----------
    'totp.eyebrow': '2FA · RFC 6238',
    'totp.title': 'One-time codes, no phone needed',
    'totp.lead': 'Paste a QR screenshot or an otpauth link and ChronoKey generates a fresh 6-digit code every 30 s, fully compatible with Google Authenticator and similar apps. The codes on the right are computed live by this page.',
    'totp.c1': 'SHA-1 / SHA-256 / SHA-512, 6–8 digits, custom period',
    'totp.c2': 'QR codes in screenshots or clipboard images recognized directly',
    'totp.c3': 'Backup recovery codes stored encrypted with the secret',
    'totp.note': 'Demo keys are public test values, unrelated to any real account.',
    'totp.aria': '{name} code {code}, {s}s left, press to copy',
    // totp account names
    'totp.account.ms': 'Microsoft',
    // ---------- superkey ----------
    'sk.eyebrow': 'History super key · migrate',
    'sk.title': 'One string carries your entire vault',
    'sk.lead': 'No cloud sync, still movable. Export the "history super key" on your old computer — it is all your entries, 2FA codes, and settings, compressed then encrypted. Paste it on a new computer, enter the passphrase, and everything is restored exactly as it was.',
    'sk.old': 'Old PC',
    'sk.new': 'New PC',
    'sk.step1t': 'Export',
    'sk.step1d': 'Settings → Migrate → Generate super key. Contents are gzip-compressed, then encrypted with Argon2id + AES-256-GCM.',
    'sk.step2t': 'Carry',
    'sk.step2d': 'A text string starting with CK1. — store it on a USB stick, write it down, or transfer it any way you trust.',
    'sk.step3t': 'Import',
    'sk.step3d': 'First launch on the new PC: choose "I have a history super key." An existing vault can also be merged — newer entries win, older versions enter history.',
    // features
    'feat.eyebrow': 'More features',
    'feat.title': 'Everything you need, day to day',
    'feat.1t': 'Eight item types',
    'feat.1d': 'Logins, 2FA codes, cards, identities, addresses, secure notes, API keys, SSH keys.',
    'feat.2t': 'Version history',
    'feat.2d': 'Each item keeps the last 15 versions. Roll back anytime, see old passwords.',
    'feat.3t': 'Security audit',
    'feat.3d': 'Finds weak, duplicate, expired, and no-2FA accounts; gives an overall score.',
    'feat.4t': 'Import / Export',
    'feat.4d': 'Bitwarden JSON, KeePass XML, CSV, and ChronoKey JSON.',
    'feat.5t': 'SSH key generation',
    'feat.5d': 'One click for an OpenSSH-format ed25519 key pair and fingerprint.',
    'feat.6t': 'Recovery code',
    'feat.6d': '25-char Crockford Base32, ~125 bits of entropy. Still recoverable if you forget the master password.',
    'feat.7t': 'Auto snapshots',
    'feat.7d': 'Automatic backup before important operations. Last 20 kept; one-click restore from Settings.',
    'feat.8t': 'Portable mode',
    'feat.8d': 'Place a ChronoKeyData folder next to the app — data lives on the USB stick with it.',
    // ---------- download ----------
    'dl.eyebrow': 'Download',
    'dl.title': 'Three steps to install, then the installer deletes itself',
    'dl.s1': 'Choose install location (default: user directory, no admin needed)',
    'dl.s2': 'Multi-threaded download from GitHub, SHA-256 verified automatically',
    'dl.s3': 'Shortcuts created; installer removes itself, uninstaller stays in the install folder',
    'dl.setup': 'Download installer',
    'dl.zip': 'Portable zip',
    'dl.req': 'Windows 10 / 11 x64. Not code-signed; if SmartScreen says "Unknown publisher," click "More info → Run anyway."',
    'dl.sha': 'Verify file (SHA-256)',
    'dl.ps': 'PowerShell:',
    // installer mock
    'sw.tag': 'Offline vault · data stays local',
    'sw.s1': 'Choose location',
    'sw.s2': 'Download',
    'sw.s3': 'Install',
    'sw.s4': 'Done',
    'sw.title1': 'Choose install location',
    'sw.title2': 'Downloading',
    'sw.title3': 'Verifying',
    'sw.title4': 'Installing',
    'sw.title5': 'Install complete',
    'sw.sub2': 'ChronoKey 0.2.0 · 8 threads',
    'sw.sub3': 'SHA-256 ✓',
    'sw.sub4': 'Extracting files…',
    'sw.sub5': 'Installer will delete itself on close',
    'sw.btn1': 'Start install',
    'sw.btn2': 'Cancel',
    'sw.btn3': 'Done',
    'sw.speed': '{sp} MB/s · {s}s left',
    'sw.dlDone': 'Download complete',
    'sw.fileCount': '{n} / 21 files',
    // ---------- faq ----------
    'faq.eyebrow': 'FAQ',
    'faq.title': 'Frequently asked questions',
    'faq.q1': 'Where is the data stored? Is anything uploaded?',
    'faq.a1': 'Only on your computer: %APPDATA%\\ChronoKey\\vault (or ChronoKeyData next to the app in portable mode). The app blocks all network requests — no uploads, no telemetry, no background activity. The only exception is Settings → About → Check for updates, which makes a single request when you click it.',
    'faq.q2': 'What if I forget my master password?',
    'faq.a2': 'Reset it with the 25-character recovery code you received when creating the vault. If you lost that too, but have a history super key and remember its passphrase, you can delete the current vault and restore from the super key. There is no "back door" — that is the price of security.',
    'faq.q3': "If the crypto is open source, can't it be broken?",
    'faq.a3': 'Open-sourcing it does not make it weaker. ChronoKey uses only public, standard algorithms (Argon2id, AES-256-GCM); security comes from your password, not code secrecy (Kerckhoffs\'s principle). Public code lets anyone check the implementation for flaws.',
    'faq.q4': 'Can I sync across multiple computers?',
    'faq.a4': 'No automatic sync, because that requires a server. Use the history super key to migrate or merge between computers: for the same entry, the newer version wins; the older one goes into version history.',
    'faq.q5': 'How do I uninstall? Will it delete my passwords?',
    'faq.a5': 'Uninstall from "Settings → Apps → Installed apps" or run Uninstall.exe in the install folder. Vault data is kept by default; you can unlock after reinstalling. Only unchecking the option deletes it permanently.',
    'faq.q6': 'Does it support macOS / Linux / mobile?',
    'faq.a6': 'Currently Windows x64 only. The code is based on Electron, so building for other desktop platforms is theoretically possible — feel free to contribute on GitHub.',
    // ---------- footer ----------
    'footer.made': 'MIT License · Made by JiuYue0820',
    'footer.src': 'Source code',
    'footer.releases': 'All releases',
    'footer.crypto': 'Crypto implementation',
    'footer.security': 'Report a security issue',
    'footer.note': 'Palette from Japanese traditional colors: Yanagi-zome, Koke, Kureha, Aka-hiragi. This page also loads zero third-party resources.',
    // ---------- toast ----------
    'toast.copied': 'Copied',
    'toast.copyFail': 'Copy failed, please select manually',
    // hero mock entries
    'mock.zhimai': 'China Merchants Bank',
    'mock.openai': 'OpenAI Dev',
    'mock.wifi': 'Home Wi-Fi',
    'mock.note': 'Secure note',
  },
};

let _lang = 'zh';
try { _lang = localStorage.getItem('ck-site-lang') || 'zh'; } catch {}

export function getSiteLang() { return _lang; }

export function setSiteLang(lang) {
  _lang = lang;
  try { localStorage.setItem('ck-site-lang', lang); } catch {}
  applyI18n();
  document.documentElement.lang = lang;
  dispatchEvent(new CustomEvent('ck-lang-change', { detail: lang }));
}

export function t(key, ...params) {
  const dict = I18N[_lang] || I18N.zh;
  let s = dict[key] ?? I18N.zh[key] ?? key;
  if (params.length) {
    params.forEach((p, i) => { s = s.replace(`{${i === 0 ? '' : ''}}`, ''); });
    // support named params via object
    if (typeof params[0] === 'object' && params[0] !== null) {
      s = dict[key] ?? I18N.zh[key] ?? key;
      for (const [k, v] of Object.entries(params[0])) s = s.replace(new RegExp(`{${k}}`, 'g'), String(v));
    }
  }
  return s;
}

export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const dict = I18N[_lang] || I18N.zh;
    el.textContent = dict[key] ?? I18N.zh[key] ?? key;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const key = el.dataset.i18nPh;
    const dict = I18N[_lang] || I18N.zh;
    el.setAttribute('placeholder', dict[key] ?? I18N.zh[key] ?? key);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset.i18nAria;
    const dict = I18N[_lang] || I18N.zh;
    el.setAttribute('aria-label', dict[key] ?? I18N.zh[key] ?? key);
  });
}

// init on load (browser only)
if (typeof document !== 'undefined') {
  applyI18n();
  document.documentElement.lang = _lang;
}
