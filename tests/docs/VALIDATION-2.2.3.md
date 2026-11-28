# PDFuck 2.2.3 验收

- PDF 选区通过本地模拟翻译服务打开结果窗，拖动标题后核对窗口坐标和屏幕边界。
- 文档备忘验证多行回行、鼠标框选和系统剪贴板、拖动缩放、文档切换，以及重启后恢复正文、尺寸和打开或关闭状态。便签按本机文档路径保存。
- 缓存设置以隔离配置验证容量、资源与更新包状态、删除确认、按项清理和重启清理。检查已有文档、未选资源和代理设置仍可读取。单元测试覆盖 Windows 与 macOS 的目录布局、旧存储副本和链接边界。
- 窗口布局在 Windows 最小支持尺寸下检查十种语言、浅色和深色主题、四档字号，共 80 个组合，含阿拉伯语从右至左排版。

```powershell
npm run typecheck
node tests/scripts/run-vitest.cjs run tests/unit/main/cache-storage-223.test.ts
npx --no-install electron-vite build
node tests/scripts/release-2.2.3-ui.cjs
git diff --check
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
$env:PDFUCK_SMOKE_EXECUTABLE = (Resolve-Path 'release/win-unpacked/PDFuck.exe').Path
node tests/scripts/release-2.2.3-ui.cjs
Remove-Item Env:PDFUCK_SMOKE_EXECUTABLE
node tests/scripts/release-2.2.3-portable.cjs
node tests/scripts/release-2.2.3-package-check.cjs
```

2026-11-27，Windows x64 的两项缓存单元测试、类型检查、生产构建、源码与解包程序的各 80 个布局组合，以及便携版启动均通过。核对包内 199 个构建文件及安装版的文件版本、签名状态和更新摘要。安装版与便携版签名状态均为 `NotSigned`。macOS 缓存路径采用模拟目录验证。

专项结果与截图写入 `tests/output/release-2.2.3`。发布记录及 SHA-256 清单位于 `release`。

## 文档偏好修订

便签标题使用正文档字号，标题栏缩至约 33 CSS 像素。查看模块的缓存设置入口只显示图标和标题。“重置所有文档偏好”清除阅读位置及缩放、阅读工具、纸张背景、手动分栏和备忘窗口的显示状态与几何信息。便签正文、文档文件、应用外观和资源缓存继续保留。

新增定向测试覆盖十种语言和四档预置字号，验证取消后保存内容仍在、确认后多文档偏好清空、退出重启后旧值未恢复，以及新阅读位置仍可保存。结果和截图写入 `tests/output/release-2.2.3-preferences`。

2026-11-27，类型检查、生产构建、源码及解包程序各 40 个布局组合均通过。便携版通过启动和重置入口检查。安装版核对包内文件、版本、更新摘要和 SHA-256。两个 Windows 包的签名状态均为 `NotSigned`。

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.3-preferences-ui.cjs
git diff --check
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
$env:PDFUCK_SMOKE_EXECUTABLE = (Resolve-Path 'release/win-unpacked/PDFuck.exe').Path
node tests/scripts/release-2.2.3-preferences-ui.cjs
Remove-Item Env:PDFUCK_SMOKE_EXECUTABLE
node tests/scripts/release-2.2.3-portable.cjs --preferences
node tests/scripts/release-2.2.3-package-check.cjs --preferences
```

## 文档窗口修订

PDF 画布和 Markdown／TXT 编辑区使用常驻垂直滚动条，内容横向溢出时显示横向滚动条。顶部文件名悬停或键盘聚焦时显示复制按钮，剪贴板保留完整文件名、原始空格和扩展名。标题空间较小时使用带提示文字的图标。

新增专项检查日间 PDF 和夜间 TXT 的滚动条在空闲后仍有可见轨道和滑块，并可拖动。验证长文件名鼠标复制、未保存文本文件的键盘复制，以及十种语言和四档字号下的按钮布局。输出位于 `tests/output/release-2.2.3-workspace`。

2026-11-27，类型检查、生产构建、源码及解包程序各 40 个布局组合通过。便携版验证启动、滚动条占位和悬停按钮。安装版核对包内文件、版本、更新摘要和 SHA-256。两份 Windows 包的签名状态均为 `NotSigned`。

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.3-workspace-ui.cjs
git diff --check
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
$env:PDFUCK_SMOKE_EXECUTABLE = (Resolve-Path 'release/win-unpacked/PDFuck.exe').Path
node tests/scripts/release-2.2.3-workspace-ui.cjs
Remove-Item Env:PDFUCK_SMOKE_EXECUTABLE
node tests/scripts/release-2.2.3-portable.cjs --workspace
node tests/scripts/release-2.2.3-package-check.cjs --workspace
```

## 标题滚动修订

超长文件名采用固定 300 毫秒启动延时，按文件名实际书写方向往返滚动。切换文档时从新标题的起点开始。上一轮成品在减少动画模式下仍会禁用标题滚动，本轮移除了这条标题专用的覆盖规则。

新增专项从 Logo 相邻的文件名实际画面取样，比较滚动前、滚动途中、末尾以及回程的像素。先在本机默认设置下测试，再模拟减少动画模式。在拉丁和阿拉伯文件名上核对起点、末尾与回程，并验证悬停复制及短标题静止。输出位于 `tests/output/release-2.2.3-marquee`。

2026-11-27，类型检查、生产构建及源码和解包程序的新增专项通过。便携版在减少动画模式下通过启动、超长标题滚动和悬停复制入口检查。安装版完成静态核验。两份 Windows 包的签名状态均为 `NotSigned`。

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.3-marquee-ui.cjs
git diff --check
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
$env:PDFUCK_SMOKE_EXECUTABLE = (Resolve-Path 'release/win-unpacked/PDFuck.exe').Path
node tests/scripts/release-2.2.3-marquee-ui.cjs
Remove-Item Env:PDFUCK_SMOKE_EXECUTABLE
node tests/scripts/release-2.2.3-portable.cjs --marquee
node tests/scripts/release-2.2.3-package-check.cjs --marquee
```
