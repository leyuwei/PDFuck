# PDFuck 2.2.2 定向验收

## 改动范围

- 搜索列表和正文使用同一批匹配坐标。搜索完成时选中视口里首个可见结果，视口里没有匹配时从当前页向后查找并在末尾回绕。切换结果只填色高亮当前项，其他结果使用空心框。超过 500 条时暂停非当前项的框选，用户可随时恢复。结果分组显示，仍可浏览全文匹配项。
- 选区、原文定位和实验室输入共用字形分组。根据基线、字号和字距识别分离的大写首字母，保留原始字母大小写和实际词间空格。
- 自由批注增加 PDFuck 标志的眼睛和嘴部图形，新建批注将图标写入标准 PDF `Text` 批注的矢量外观。支持原生批注的阅读器可以显示外观，使用标准图标的阅读器可回退到 `Comment`。
- Markdown 开关放入批注内容标题行，批注正文和自定义回复共用左右预览。清理欢迎页、工具面板、实验室入口、批注人设置和部分弹窗的重复副标题。保留快捷键、异常状态、数据发送、文件安全和具体操作说明。

## 本轮命令

```powershell
npm run typecheck
$env:PDFUCK_222_NOTE_SAMPLE = '1'
node tests/scripts/run-vitest.cjs run tests/unit/renderer/release-222.test.ts
npx --no-install electron-vite build
node tests/scripts/release-2.2.2-ui.cjs
pdftoppm -r 200 -png -singlefile tests/output/release-2.2.2/native-note.pdf tests/output/release-2.2.2/native-note
git diff --check
npm run render:windows-installer
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
$env:PDFUCK_SMOKE_EXECUTABLE = (Resolve-Path release/win-unpacked/PDFuck.exe).Path
node tests/scripts/release-2.2.2-ui.cjs
node tests/scripts/release-2.2.2-ui.cjs --portable
node tests/scripts/release-2.2.2-package-check.cjs
```

本轮测试范围是新增单测与专项窗口验收。源码窗口检查 530 条结果的框选控制、视口定位与切换、布局和 Markdown 草稿，覆盖十种语言、两种主题和四档字号。独立 Poppler 渲染用于确认 PDF 保存后可显示新图标。截图与测试记录位于 `tests/output/release-2.2.2/`。

## 交付结果

- 2026-11-24，类型检查、生产构建和 8 项新增单测通过。生产构建窗口与解包成品分别通过 80 组布局及搜索专项。实际启动 Windows 便携程序并完成搜索专项。
- 比对 `app.asar` 中 197 个生产文件，验证版本、Windows x64 架构、安装包更新元数据和 SHA-256。原生批注样本经 Poppler 渲染后可见 PDFuck 图标。
- `release/` 包含 Windows x64 安装版、便携版和配套更新文件。`PDFuck-2.2.2-Windows-release.json` 记录成品信息，`PDFuck-2.2.2-Windows-SHA256SUMS.txt` 包含校验值。Windows EXE 的签名状态为 `NotSigned`。系统实际安装、卸载及 macOS 打包未纳入本轮验收。
- `README.md` 与提交基线一致。
