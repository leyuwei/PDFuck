# PDFuck 2.2.2 布局修订验收

## 布局

- 识别书签窗口随内容收放。左侧规则卡片同排等高，右侧使用紧凑的预览、深度与额外标题词设置。窗高不足时，两侧内容可滚动，关闭和底栏操作保持可见。
- 批注人设置与识别书签共用标题栏、底栏和开关的尺寸。批注人名称输入与显示开关采用同一行高基准，预览徽标随内容收放。
- 欢迎页和最近文件的空态随内容收紧，工具模块首组间距和按钮最小高度统一。搜索窗口在清空查询或没有结果时收起结果区域，有结果时恢复可调整大小的窗口。

## 定向验证

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.2-layout-ui.cjs
git diff --check
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
$env:PDFUCK_SMOKE_EXECUTABLE = (Resolve-Path release/win-unpacked/PDFuck.exe).Path
node tests/scripts/release-2.2.2-layout-ui.cjs
node tests/scripts/release-2.2.2-layout-ui.cjs --portable
node tests/scripts/release-2.2.2-package-check.cjs --layout
```

测试包含书签识别空态、识别结果的移除与恢复、批注人设置保存、搜索窗口展开与收起，以及欢迎页和工具栏的间距。窗口组合使用十种语言、两种主题、四档字号，在 Windows 最小支持窗口 1080 × 680 下检查按钮边界、换行、同行控件对齐和底栏可达。截图与 JSON 位于 `tests/output/release-2.2.2-layout/`。

## 交付结果

- 2026-11-24，类型检查和生产构建通过。生产构建与解包成品分别通过书签布局 80 组、批注人布局 80 组及新增交互检查。Windows 便携版已实际启动并通过交互检查。
- 核对包内 197 个生产文件、Windows x64 架构、2.2.2 版本和 SHA-256。校验清单和发布 JSON 已更新为本轮布局修订。
- 可执行文件未签名。系统安装、卸载与 macOS 构建未纳入本轮验收。已核对 README 与基线一致。
