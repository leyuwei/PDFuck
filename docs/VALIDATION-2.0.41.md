# PDFuck 2.0.41 验收记录

日期：2026-09-18  
平台：Windows x64

## 根因与修复

- 连续阅读模式的 `.page-stack` 会按整份文档中的最宽页面扩展；较窄页面在该容器内居中，而滚动视口初始仍位于最左端。因此混有横向页、超宽页或不同裁切尺寸的文档会把当前页推向右侧，严重时越出窗口。
- 视口现在按当前页的实际中心校正横向滚动，覆盖首次打开、页面尺寸就绪、工具栏缩放、跳页以及窗口或侧栏引起的工作区宽度变化。
- Ctrl/Command + 滚轮缩放继续使用既有鼠标锚点，不被居中逻辑覆盖。
- `package.json`、`package-lock.json`、包内清单和 Windows 文件属性均为 `2.0.41`。

## 执行结果

按用户要求，仅执行本次新增测试项，未运行既有回归套件。

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run test:release-2.0.41-ui` | 通过，源码态；用窄页、超宽页、窄页组合覆盖首次打开、工具栏缩放、窗口缩放与跳页后的水平居中 |
| `PDFUCK_SMOKE_EXECUTABLE=release/win-unpacked/PDFuck.exe node scripts/release-2.0.41-ui-smoke.cjs` | 通过，Windows 成品态 |
| `git diff --check` | 通过；仅 Git 提示工作区换行符将来可能转为 CRLF |
| 包内 `app.asar` | 清单版本 `2.0.41`；成品 UI 测试已直接验证本次居中修复 |

生产资源使用 `electron-vite build` 重新生成，Windows 安装版与便携版使用 `electron-builder --win` 生成。视觉记录：`output/playwright/release-2.0.41-centering.png` 与 `output/playwright/release-2.0.41-centering-packaged.png`。

## Windows 产物

| 产物 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `release/PDFuck-2.0.41-Windows-Setup.exe` | 221,496,417 | `26CA73026D0DF484033748F60519FBB517BAD0F50ABDC2DAAD5853A964AEA8AF` |
| `release/PDFuck-2.0.41-Windows.exe` | 221,156,058 | `390819A751DAF74C711C87EBE2889C6335DC355EDECD1F678EA5590FA4A34A75` |
| `release/win-unpacked/PDFuck.exe` | 225,589,248 | `C68138BFFF6145F53D6C1752AAC34E9357CDC525443FB7D264125ECFAF76D793` |

三个文件的 Authenticode 状态均为 `NotSigned`；它们适用于内部验收，公开分发仍应使用可信代码签名证书。当前为 Windows 环境，未生成或验证 macOS `.app`、DMG 和 ZIP。

## 未执行范围

- 按用户“仅对新增测试项做好简单测试”的要求，未执行 OCR、打印、框选、AI、书签等既有回归。
- 未执行安装器的真实安装、卸载及系统文件关联变更。
- 未进行实体打印、外部 AI 请求或 macOS 构建。
