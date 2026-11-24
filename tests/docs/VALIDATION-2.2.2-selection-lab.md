# PDFuck 2.2.2 搜索定位和实验室验收

## 改动

- PDF 正文只对当前匹配填色，并在匹配框旁显示“当前选择”。点击结果、用键盘切换、跨页定位和默认选中视口内第一条时共用同一状态。提示靠近视口上沿时显示在框下方。浮动搜索窗遮住框和提示时优先平移，可用空间不足时收窄或降低窗口。
- 实验室七个入口只保留主标题、图标和适用的快捷键或开关状态。同行高随最长译文的换行自适应。翻译目标放在已启用按钮的悬浮提示中。

## 定向验证

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.2-selection-lab-ui.cjs
git diff --check
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
$env:PDFUCK_SMOKE_EXECUTABLE = (Resolve-Path release/win-unpacked/PDFuck.exe).Path
node tests/scripts/release-2.2.2-selection-lab-ui.cjs
node tests/scripts/release-2.2.2-selection-lab-ui.cjs --portable
node tests/scripts/release-2.2.2-package-check.cjs --selection-lab
```

本轮新增专项覆盖跨页点击、键盘切换、搜索清空、视口边缘提示换位、搜索窗避让、拖回遮挡位置后的重复点击、实验室入口尺寸和开关。十种语言、两种主题、四档字号的窗口矩阵使用最小支持桌面尺寸 1080 × 680。结果与截图位于 `tests/output/release-2.2.2-selection-lab/`。

## 交付结果

- 2026-11-24，类型检查、生产构建及本轮新增专项通过。生产构建和解包成品分别通过搜索提示 80 组、实验室按钮 80 组的窗口检查。便携版在实际启动后通过定位、重复点击和实验室交互检查。
- 包核验逐字节比对了 197 个生产文件，并核对 Windows x64 架构、2.2.2 版本、安装包更新元数据和 SHA-256。可执行文件签名状态为 `NotSigned`。
- 本轮验收范围覆盖 Windows 成品启动和新增交互。系统安装、卸载和 macOS 打包未执行。README 已核对与提交基线一致。
