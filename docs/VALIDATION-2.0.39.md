# PDFuck 2.0.39 验收记录

日期：2026-09-18  
平台：Windows x64

## 变更范围

- 编辑模块新增“在页面上添加水印”按钮和同风格矢量图标。
- 浮窗支持页码范围、文字、字体、字号、旋转角度、颜色、透明度、密度和实时预览。
- 水印覆盖层与 PDF 外观均按页面边界裁切；旋转后越界部分不显示。
- PDFuck 水印可整体更新、一键删除、撤销、保存和重开识别。
- 新增文案覆盖现有十种界面语言。
- `package.json`、`package-lock.json`、包内清单和 Windows 文件属性均为 `2.0.39`。

## 执行结果

按用户要求，仅执行本次新增测试项，未运行既有回归套件。

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run test:watermark` | 通过，1 个文件 / 3 项测试 |
| `npm run test:watermark-ui` | 通过，源码态；覆盖实时预览、页码范围、目标页、页面裁切、添加和删除 |
| `PDFUCK_SMOKE_EXECUTABLE=release/win-unpacked/PDFuck.exe node scripts/watermark-ui-smoke.cjs` | 通过，Windows 成品态 |
| `git diff --check` | 通过；仅 Git 提示工作区换行符将来可能转为 CRLF |
| 包内 `app.asar` | 版本 `2.0.39`；包含 `PDFuckWatermark`、`watermark-layer` 和中文入口文案 |

生产资源使用 `electron-vite build` 重新生成，Windows 安装版与便携版使用 `electron-builder --win` 生成。首次下载打包工具时网络超时，重试后成功。

## Windows 产物

| 产物 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `release/PDFuck-2.0.39-Windows-Setup.exe` | 221,511,920 | `C42BD0A3E05547A160393650C66D22795B42069A9ACCCF10AF4D62191126EC09` |
| `release/PDFuck-2.0.39-Windows.exe` | 221,171,554 | `8E483B9760694914453BAA00D4CCE40B96BC2AC0B1A0931EC753CD06E8ABE91C` |
| `release/win-unpacked/PDFuck.exe` | 225,589,248 | `0898B32EDEA5BFAF00676ADA3C4472874C49A9667140ABC764F4C18AFE8C1503` |

三个文件的 Authenticode 状态均为 `NotSigned`；它们适用于内部验收，公开分发仍应使用可信代码签名证书。当前为 Windows 环境，未生成或验证 macOS `.app`、DMG 和 ZIP。

## 未执行范围

- 按用户“仅对新增测试项做好简单测试”的要求，未执行 OCR、打印、框选、AI、书签等既有回归。
- 未执行安装器的真实安装、卸载及系统文件关联变更。
- 未进行实体打印、外部 AI 请求或 macOS 构建。
