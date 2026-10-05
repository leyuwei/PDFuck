# PDFuck 2.1.0 macOS 安装器与 Markdown 验收

日期：2026-10-05（Asia/Shanghai）。环境：macOS 27.0.1 / Apple Silicon arm64，Node.js 26.8.1，Electron 43.4.0，electron-builder 26.15.3。版本保持 **2.1.0**；package.json、package-lock.json 两处记录、Info.plist 和 app.asar 一致。没有新增依赖，没有修改 Markdown 产品逻辑。

## 安装器

- 应用、挂载卷和 DMG 文件使用现有 `resources/icon.icns` 小纸鸭 Logo。新增 artifactBuildCompleted hook 调用系统 NSWorkspace，为 DMG 文件写入自定义图标；其他格式和平台自动跳过。
- `resources/dmg-background.svg` 为可维护矢量源，复用原 Logo，包含蓝紫/奶油渐变、云朵、星光、纸鸭、铅笔和中英安装说明。既有 Electron 绘图脚本生成 760×520、1520×1040 PNG，electron-builder 将两份表示合成为镜像内的 Retina TIFF。
- Finder 窗口 760×520，真实图标大小 108px，应用中心 (210, 280)、Applications 中心 (550, 280)。实际打开最终 DMG，目视确认标题/路径栏 Logo、可拖动图标、文件名、箭头与底部插画/说明完整可见。
- 初次检查发现系统选中的 Xcode 未完成许可，dmgbuild 的 SetFile 静默失败：卷内虽有 ICNS，Finder 仍显示磁盘图标。使用本机已安装 Command Line Tools 的临时 DEVELOPER_DIR 重建，未接受许可或更改系统开发目录。新增打包前检查和卷 Finder 自定义图标标志断言，避免再次漏设。
- 首帧 paint 可能早于实际绘图，生成空白背景。共享绘图脚本改为等待 SVG 解码和绘制，再调用 capturePage；生成结果尺寸、内容和实机背景已核验。另在临时目录验证应用 ICNS 分支，全部 10 个标准/Retina 表示可由 iconutil 解码。

## 已通过的检查

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| 三个 Markdown 单元测试文件 | 13 项通过：UTF-8/BOM/CRLF、输入边界、安全图片、GFM/HTML 隔离、插入语法、五模板、偏好迁移/恢复、十语言、关联和版本 |
| `npx --no-install electron-vite build` | 通过；既有 PDF.js 资源 URL 提示由复制插件补齐，包内资源已核验 |
| `scripts/markdown-ui-smoke.cjs` 源码和最终应用 | 各 80 组语言×主题×字号布局通过；真实 `.MD` 冷启动、源码保存/另存/⌘+S、语法浮窗、分栏、五模板四页 A4 PDF、可选择文字、PDF 水印编辑与保存、更新保护/刷新确认、关闭取消/保存、普通 PDF 标签隔离 |
| `scripts/markdown-layout-template-check.cjs` 最终应用 | 80 组紧凑标题/窄分栏布局；实际隔离打印窗口的五种区域样式、深色代码/表头可读性；商务和学术独立设置切换、重选、应用重启后恢复 |
| `scripts/markdown-macos-launch-smoke.cjs` | 实际 LaunchServices 冷启动文档 Apple 事件打开 Unicode `.MD`，源码完全一致、真实 PDF 文本可选择；成品 Markdown Editor 声明正确 |
| `npm run test:macos-installer` | DMG 文件图标及 hook、卷自定义图标标志、应用/卷 ICNS、双倍率背景、镜像完整性、Finder 元数据、Applications 链接、非嵌套应用及版本通过 |
| 成品资源 | 210 个生产文件与本轮 out 逐字节一致；应用/文档 ICNS 与源文件一致 |
| ZIP | 全部 CRC 校验通过；ZIP 内 app.asar 与签名应用逐字节一致 |
| 签名 | `codesign --verify --deep --strict` 通过，ad-hoc |
| 脚本语法及 `git diff --check` | 通过 |

将旧 UI 测试的渲染标记移到首页，避免 macOS 对远页虚拟化造成取样超时；仍生成并检查五种多页 PDF。插入测试使用 macOS 的 ⌘+↓ 将光标移至文末，避免 Windows 的 Ctrl+End 行为被错误套用。没有削减功能断言，也没有修改应用行为。

本轮只执行 Markdown 和安装器相关验证，未运行旧测试全集或完整一键打包脚本。测试使用独立临时资料及生成文档，不替换 `/Applications` 安装，不修改系统默认 PDF/Markdown 应用，不派发外部 AI 请求。原生打开测试验证指定应用的 LaunchServices 行为，未宣称默认程序设置已改变。

机器可读结果、界面截图和五模板 PDF 位于 `output/playwright/markdown-2.1.0-*`；安装器图标及检查结果为 `macos-installer-file-icon.png`、`macos-installer.json`；成品资源记录为 `macos-2.1.0-package-verification.json`。实际 Finder 窗口截图保留在本轮聊天记录。

## 交付

最终应用：`release/mac-arm64/PDFuck.app`。签名后由 electron-builder 从具体应用生成 DMG，ZIP 由 ditto 生成；没有手工重封装镜像。安装器、生成流程和验收要求已写入 PACKAGING_GUIDE.md，并接入未来 macOS 一键打包脚本。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `PDFuck-2.1.0-macOS.dmg` | 278354079 | `b22869c068385d3f8b1ebd2c80a6dec6bd5ca67e3bf2fbeb5b338703d4241aab` |
| `PDFuck-2.1.0-macOS.zip` | 277080473 | `d59c94d3038c0a8c05d51c43b0433a3cf2624e04e3741eb3290d218a0b7b4aba` |

发布清单：`release/PDFuck-2.1.0-macOS-release.json`。校验文件：`release/PDFuck-2.1.0-macOS-SHA256SUMS.txt`。

没有可用 Developer ID 身份，产物为 ad-hoc 签名、未公证；本机 Gatekeeper assessments disabled，不能据此宣称获得 Gatekeeper 接受。DMG 文件自定义图标使用 macOS 元数据，普通 HTTP 传输可能丢失；镜像内的卷 Logo 和背景完整内嵌。
