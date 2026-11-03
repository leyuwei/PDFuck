# 2.1.13 验收与交付

日期：2026-11-03（Asia/Singapore）。平台：macOS arm64。计划见 [PLAN-2.1.13.md](PLAN-2.1.13.md)。本记录对应普通弹窗范围修复后的重新交付。

恢复 OCR 组件及其被“关于”复用的样式，移除误加的缩放和最小高度；普通批注恢复原有 hook 与布局，不再读取实验室尺寸记录，保留升级前已有的缩放行为。实验室继续支持独立尺寸持久化和提示词随窗口增高。修复工具面板后加载的滚动条样式覆盖实验室规则、导致右侧多留 15px 的问题，覆盖范围仅限实验室。

本轮只运行新增 `tests/scripts/release-2.1.13-dialog-scope-ui.cjs`，使用源码构建的 Electron 和隔离配置。首轮 6 项单元测试属于历史结果，本轮未重跑；已修正其中误将 OCR/普通批注归为实验室的范围断言。历史测试全集未运行。

## 结果

| 检查 | 结果 |
| --- | --- |
| 新增源码 UI：十语言“关于” | 通过：不支持缩放，无误加尺寸/最小高度，底部留白 18px，无横向溢出 |
| 新增源码 UI：OCR 与普通批注 | 通过：忽略误写的实验室尺寸记录；OCR 不支持缩放；普通批注保留原有行为 |
| 新增源码 UI：润色、全文评价、自动批注 | 通过：真实拖动调整至 700×460、700×630，关闭重开恢复，各窗口独立持久化 |
| 新增源码 UI：提示词与间距 | 通过：润色输入框增高 165.57px、全文评价增高 170px；左右边距均 20px，控件间距至少 12px，底部 20px，无横向溢出 |
| 新增源码 UI：运行错误 | 无 renderer pageerror |
| `npm run typecheck` | 通过 |
| `npx --no-install electron-vite build` | 通过，生成 main/preload/renderer 生产资源；仅有既有 pdfjs 运行时路径提示 |
| `git diff --check` | 通过 |

新增 UI 命令：`node tests/scripts/release-2.1.13-dialog-scope-ui.cjs`。报告及源码截图位于已忽略的 `tests/output/release-2.1.13-dialog-scope/`，包括中文/阿拉伯语“关于”和实验室放大态截图。

按用户最新要求，打包成品不复测：不启动 APP，不运行静态包检查、签名验证、DMG 挂载/完整性或 ZIP 测试。SHA-256 与文件大小仅作为交付元数据生成，不代表完成成品验收。

交付文件：

- [APP](../../release/mac-arm64/PDFuck.app)
- [PDFuck-2.1.13-macOS.dmg](../../release/PDFuck-2.1.13-macOS.dmg)
- [PDFuck-2.1.13-macOS.zip](../../release/PDFuck-2.1.13-macOS.zip)
- [发布清单](../../release/PDFuck-2.1.13-macOS-release.json)
- [SHA-256](../../release/PDFuck-2.1.13-macOS-SHA256.txt)

## 产物

- APP：`release/mac-arm64/PDFuck.app`
- DMG/ZIP：文件大小、生成时间和 SHA-256 见发布清单及 SHA-256 文件
- 签名方式：ad-hoc；无 Developer ID，未公证
- 本轮没有执行任何成品复测；不宣称 Windows 或真实系统安装验收
