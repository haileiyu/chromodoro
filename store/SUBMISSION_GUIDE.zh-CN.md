# Chromodoro：Chrome Web Store 上架填写指南

本文件说明每份材料的用途。英文商店文案、权限理由和审核员测试说明统一维护在 `store/listing.md`，提交时从那里复制，以免出现多个版本。

本次更新准备为 **1.1.0**。完整检查清单见 `store/RELEASE_CHECKLIST.md`，更新说明见 `store/RELEASE_NOTES.md`。新生成的整套素材包已包含单独的 `icons/icon128.png`；请使用新 ZIP，不要沿用旧的解压文件夹。

## 先准备账号与隐私政策网址

1. 在开发者后台的 **Settings（设置）** 页面将公开发布者名称设为 **Chromodoro**，联系邮箱设为 **chromodoro.contact@gmail.com**，并完成邮箱验证。账号需要启用两步验证；如果界面显示 **Account**，则在该页面查找相同的联系邮箱设置。
2. 你已选择 **Non-Trader**；提交前确认后台仍显示这个状态，并按真实经营情况填写。请确认公开的发布者信息没有个人姓名或个人邮箱。
3. 将根目录的 `PRIVACY.md` 发布到一个无需登录即可访问的、不会暴露个人账号的网页。可使用以 Chromodoro 品牌账号管理的网站或公开页面。用退出登录或无痕窗口打开最终网址，检查全文、联系邮箱和访问权限。
4. 把最终网址填入后台 **Privacy practices → Privacy policy URL**。目前项目没有这个网址；不要填本地文件路径或旧的个人 GitHub 链接。

## 后台逐项填写

| 后台位置 | 填写内容 |
| --- | --- |
| 已有条目 → Package → Upload New Package | 上传 `release/chromodoro-1.1.0.zip`；不要上传整套素材包。更新使用原条目；仅首次发布使用 Add new item |
| Store listing → 名称、简短说明、详细说明 | 从 `store/listing.md` 的 Name、Short description、Detailed description 复制 |
| Store listing → Category / Language | Productivity / English |
| Store listing → 图标 | `icons/icon128.png` |
| Store listing → 截图 | 上传 `store/assets/history-1280x800.jpg`、`settings-1280x800.jpg`、`completion-1280x800.jpg` |
| Store listing → Small promotional tile | `store/assets/promo-440x280.png` |
| Store listing → Homepage / Support URL | 目前留空；公开联系邮箱使用 `chromodoro.contact@gmail.com` |
| Privacy practices → Single purpose | 复制 `store/listing.md` 的 Single purpose |
| Privacy practices → Permission justifications | 按 `store/listing.md` 分别填写 storage、alarms、contextMenus、notifications |
| Privacy practices → Remote code | 选择不执行远程代码；理由见 `store/listing.md` 的 Remote code |
| Privacy practices → Data usage | 参照下面的数据清单，并逐项按后台当前类别定义填写与认证 |
| Privacy practices → Privacy policy URL | 填写第 3 步准备的公开网址 |
| Distribution | 免费、Public、All regions，除非你希望限制发布范围 |
| Test instructions | 复制 `store/listing.md` 的 Reviewer test instructions；核心计时功能不需要测试账号 |

## 隐私申报依据

即使数据只保存在本地，后台也要求申报数据处理。Chromodoro 在本地保存计时状态、用户设置、每日完成次数与专注分钟数。用户可以主动导出 CSV 文件；插件不再提供 Google Sheets 备份。启用 Chrome 扩展同步后，最近 24 个自然月的每日次数、分钟数、日期及随机安装标识会通过 Google 在同一账号的 Chrome 实例之间同步；旧记录仍保留在已经拥有它们的设备本地。计时器和设置保持各设备独立。

填写 Data usage 时应考虑 **User activity**（专注记录，包括通过 Google Chrome 同步的记录），并按后台当前类别定义填写。不要选择笼统的“完全不处理用户数据”。插件不读取浏览历史、网页内容、位置或个人通讯；没有开发者运营的接收历史记录的服务器、广告或分析追踪器。申报内容必须与公开隐私政策一致。

## 提交前检查

- 用无痕窗口确认隐私政策网址可访问，内容与 `PRIVACY.md` 相同。
- 确认开发者后台的公开联系邮箱、发布者名称和 Non-Trader 状态。
- 确认图片尺寸与界面一致；历史截图中的数据明确标为 **Example history**。
- 确认后台中若已有旧版本，待上传版本号必须高于已发布版本；本包版本是 `1.1.0`。
- 上传后完成 Store listing、Privacy practices、Distribution 和 Test instructions，再点击 **Submit for Review**。可选择审核通过后自动发布，或选择延迟发布后手动上线。

官方说明：[发布流程](https://developer.chrome.com/docs/webstore/publish)、[隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、[图片规格](https://developer.chrome.com/docs/webstore/images)、[发布范围](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)。
