# PDFuck 2.0.40 验收记录

日期：2026-09-18  
平台：Windows x64

## 变更范围

- 水印弹窗使用 PDF.js 渲染当前页真实内容，并按页面比例叠加实时水印预览。
- “实时预览”固定使用辅助字号；功能按钮说明在十种语言中同步精简。
- 欢迎页与打开 PDF 弹窗均可清空最近打开列表；确认文案明确不会删除本机 PDF。
- 清空操作通过主进程现有串行写入队列落盘，避免与最近文件更新相互覆盖。
- `package.json`、`package-lock.json`、包内清单和 Windows 文件属性均为 `2.0.40`。

## 执行结果

按用户要求，仅执行本次新增测试项，未运行既有回归套件。

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run test:release-2.0.40-ui` | 通过，源码态；覆盖真实页面像素、十语言、四档字号、精简说明、两处清空入口、取消保护和确认清空 |
| `PDFUCK_SMOKE_EXECUTABLE=release/win-unpacked/PDFuck.exe node scripts/release-2.0.40-ui-smoke.cjs` | 通过，Windows 成品态 |
| `git diff --check` | 通过；仅 Git 提示工作区换行符将来可能转为 CRLF |
| 包内 `app.asar` | 版本 `2.0.40`；生产渲染包包含“清空最近打开列表”关键文案 |

生产资源使用 `electron-vite build` 重新生成，Windows 安装版与便携版使用 `electron-builder --win` 生成。

## Windows 产物

| 产物 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `release/PDFuck-2.0.40-Windows-Setup.exe` | 221,522,435 | `649F92ED56F682AF43D1AC438C3DA4195F9B8538446E66B01556ED1BA88056CC` |
| `release/PDFuck-2.0.40-Windows.exe` | 221,182,078 | `E7B59D3070EC139DC6D4EBB5F2A6CB7A0722B7E6BEF27BAAF0BB4E82F835A573` |
| `release/win-unpacked/PDFuck.exe` | 225,589,248 | `6B58CFDE2EBA1A260E112BBEDCAAEDBD93DD490B4B5917C3737FE0CABA257C8E` |

三个文件的 Authenticode 状态均为 `NotSigned`；它们适用于内部验收，公开分发仍应使用可信代码签名证书。当前为 Windows 环境，未生成或验证 macOS `.app`、DMG 和 ZIP。

## 未执行范围

- 按用户“仅对新增测试项做好简单测试”的要求，未执行 OCR、打印、框选、AI、书签等既有回归。
- 未执行安装器的真实安装、卸载及系统文件关联变更。
- 未进行实体打印、外部 AI 请求或 macOS 构建。
