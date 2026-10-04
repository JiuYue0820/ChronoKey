# 代码签名接入指南（Azure Trusted Signing）

ChronoKey 目前发布**未签名**的二进制：用户首次运行时 SmartScreen 会提示"未知发布者"，
需要点"更多信息 → 仍要运行"。这是安装转化率流失的最大单点。接入签名后提示消失。

推荐 **Azure Trusted Signing**（原 Microsoft Code Signing）：按月订阅、价格远低于 EV 证书、
私钥由微软托管、与 electron-builder 直接集成。以下是一次性接入步骤。

## 1. 开通 Trusted Signing（需要组织账号）

1. Azure 门户 → 创建资源 → **Trusted Signing**（免费层 5000 次签名/月足够本项目）
2. 创建账户与**证书档案（Certificate profile）**，选 **Public Trust**
3. 完成组织身份验证（个人开发者需提供身份证明材料，审核通常数天到数周）

## 2. 安装本地签名工具

- [Trusted Signing 的 Visual Studio 扩展 / DPAPI 工具包](https://learn.microsoft.com/azure/trusted-signing/quickstart)
  里带 `Azure.CodeSigning.Dlib` 与 `signtool` 联动组件；electron-builder 走 `signtool` 路径。

## 3. 配置 electron-builder

在 `package.json` 的 `build.win` 下加入（占位值换成自己的）：

```json
"azureSignOptions": {
  "publisherName": "JiuYue0820",
  "endpoint": "https://eus.codesigning.azure.net/",
  "certificateProfileName": "ChronoKey-PublicTrust",
  "codeSigningAccountName": "chronokey-signing"
}
```

electron-builder ≥ 25 会在构建 zip 时自动调用。**不要**把任何密钥提交进仓库——
Trusted Signing 的凭据走 `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID`
环境变量（服务主体在 Azure 里创建并授予 "Trusted Signing Certificate Profile Signer" 角色）。

## 4. 验证

```powershell
Get-AuthenticodeSignature .\ChronoKeySetup.exe | Format-List
# Status 应为 Valid，SignerCertificate 非空
```

## 5. 发布

之后正常走 `npm run release`。签名只影响本地构建产物（zip 内的 ChronoKey.exe 与
ChronoKeySetup.exe）；latest.json / 语言包是数据文件，无需签名（安装器与应用各自校验 SHA-256）。

## 备选：OV/EV 证书

若不愿走 Azure（如所在地区开通受限），可购买 OV/EV 证书后把 `certificateFile` /
`certificatePassword` 交给 electron-builder 的 `win.certificateFile` 配置。EV 证书可立即获得
SmartScreen 信誉，OV 需要一段时间的下载量积累。**证书密码务必放在 CI 环境变量，不要进仓库。**
