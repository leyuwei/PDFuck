# PDFuck macOS / Windows 打包指引

本文档用于版本更新后的桌面端发布。后续会话应按顺序完成版本同步、检查、生产构建、签名、打包和产物验证，不要只改版本号或只生成其中一个文件。

## 1. 发布产物

macOS（建议在 macOS 上构建）：

- `release/mac-arm64/PDFuck.app`：Apple Silicon 可运行应用；Intel 构建目录通常为 `release/mac/PDFuck.app`。
- `release/PDFuck-<version>-macOS.dmg`：带 Finder 布局的安装镜像。
- `release/PDFuck-<version>-macOS.zip`：便于传输的 `.app` 压缩包。

Windows（建议在 Windows 上构建）：

- `release/win-unpacked/PDFuck.exe`：解包后的可运行程序。
- `release/PDFuck-<version>-Windows-Setup.exe`：NSIS 安装包。
- `release/PDFuck-<version>-Windows.exe`：便携版，实际名称以 `package.json` 的 `artifactName` 为准。

## 2. 环境准备

- Node.js 22 或更高版本。
- 使用仓库锁文件安装依赖：`npm ci`。
- macOS 的 `.app`、DMG、Apple 签名和公证应在 macOS 上完成。
- Windows 的 NSIS 安装包和 Windows 签名应在 Windows 上完成。不要把跨平台构建成功等同于已经在目标系统验证。
- Codex Desktop 中如果 `node` 或 `npm` 不在 `PATH`，先使用工作区依赖定位工具查找内置 Node.js，再用返回的绝对路径运行命令；不要把某台机器的缓存路径写入项目脚本。

开始前运行 `git status --short`。工作区可能包含用户尚未提交的修改，不要清理、覆盖或回滚无关文件。

## 3. 更新版本号

版本号现在只有一个来源：`package.json`。渲染界面在构建时直接读取该文件，electron-builder 与主进程也读取同一版本；不再需要手工同步 `APP_VERSION`。假设新版本为 `X.Y.Z`：

```bash
npm version X.Y.Z --no-git-tag-version
```

该命令会同步 `package.json` 和 `package-lock.json`。修改后检查两个版本来源：

```bash
node -p "require('./package.json').version"
node -p "require('./package-lock.json').version"
```

两处必须一致。最终的一键脚本还会核对 `app.asar`、Windows 可执行文件属性或 macOS `Info.plist`，并实际启动打包后的应用检查界面版本。

## 4. 一键打包（推荐）

Windows PowerShell：

```powershell
.\scripts\package-windows.ps1 1.20.8
```

macOS：

```bash
bash scripts/package-macos.sh 1.20.8
```

版本参数可省略；省略时脚本自动读取 `package.json`。传入版本时脚本先用 `npm version --no-git-tag-version` 同步清单和锁文件。两个脚本都会重新安装锁定依赖、执行生产构建和完整发布回归、复用 `npm ci` 已安装的相同版本 Electron 运行时生成目标平台产物、检查包内版本、实际启动打包应用验证未保存关闭弹窗，并生成带 SHA-256、签名状态和测试清单的发布 JSON。macOS 没有 Developer ID 时会明确使用 ad-hoc 签名；设置 `REQUIRE_NOTARIZATION=1` 可要求 Gatekeeper 验证必须通过。

## 5. 构建前检查

按顺序执行：

```bash
npm run typecheck
npm test
npm run build
npm run test:i18n-catalogue
npm run test:i18n-ui
npm run test:print-native
npm run test:print-ui
npm run test:window-tabs
npm run test:page-text-edit-ui
git diff --check
```

多栏文字选择回归还应运行：

```bash
npm run test:selection-scheduling
npm run test:selection-scheduling-ui
npm run test:selection-scheduling-0826
npm run test:selection-scheduling-0826-ui
npm run test:selection-chinese
npm run test:selection-chinese-ui
```

前两项使用 `tmp/Scheduling0821m.pdf`，验证内部对象顺序异常时当前行选区不会带入下一行项目符号。中间两项使用 `tmp/Scheduling0826m.pdf`，在第 5、10、11 页同时验证公式碎片保留、图表文字隔离、单双栏流域裁剪、正反向拖拽一致性，并在真实 Electron 窗口核对选区矩形与剪贴板文本。最后两项使用 `tmp/7.申报书原件.pdf` 第 3 页，验证异常子集字体的纵向度量归一化，并让真实 Electron 对中文标题、正文的选区矩形与渲染像素逐项比较。目标平台产物生成后，打包脚本还会用最终 `PDFuck` 可执行文件再次运行两组新增 UI 回归。缺少任一测试 PDF 时应先补齐样本，不要跳过回归。`test:i18n-catalogue` 必须覆盖 JSX 文案、`ui()` 文案和可外显错误的日语、俄语、西班牙语词条；`test:i18n-ui` 必须逐一切换五种界面语言，验证重启后的语言持久化、平台自适应快捷键、搜索 PDF 的单行同款按钮布局、七项编辑图标、批注人浮窗拖动与唯一外显开关、姓名和外显偏好持久化、新批注作者写入、作者标签位于正文上方且列表无新增列，以及主要工作区标签、打印设置、PDF 右键菜单与页面删除弹窗，且不允许在非中文界面残留中文控件。Windows 上的 `test:print-native` 会通过 CJS 实际枚举打印机、加载 PDFium、绑定系统默认设备，并让双面打印机驱动验证单面/短边/长边三个逐任务 DEVMODE 值，但不会发送纸张；非 Windows 平台安全跳过。`test:print-ui` 会在 900×760 的真实 Electron 窗口中核对系统设备名与双面能力，检查 25%–200% 缩放、五种语言、方向区域无溢出，并验证最终作业预览至少达到显示尺寸的两倍清晰度。两项测试都不会真正派发纸张，以免自动化误触实体打印机。

涉及文档标签页时，`test:window-tabs` 使用真实 Electron 窗口验证：打开两个标签、启用一次“适合宽度”后新打开文档自动继承该查看方式、前后拖动排序、内部标签拖动不会触发外部文件蓝框、拖出标签栏生成独立窗口、将独立窗口中的标签拖入另一个 PDFuck 窗口后自动回归标签页、来源空窗口自动关闭，以及关闭独立窗口时没有主进程异常。不要只以单元测试代替这项跨窗口回归。

涉及页面文字编辑时，`test:page-text-edit-ui` 会生成独立测试 PDF，并在真实 Electron 窗口验证：点击后输入层与原字形区域保持同一坐标和尺寸、光标落在点击字符附近、双重提交只生成一个替换对象、保存并重开后仍只有一个对象，以及删除替换对象后原文编辑区域立即恢复。发布脚本必须执行此项，不能只依赖模型层单元测试。

其中 `npm run build` 会重新生成 `out/main`、`out/preload` 和 `out/renderer`。不要直接用旧的 `out` 目录打包，否则源码修复可能没有进入 `app.asar`。

涉及 PDF 渲染、搜索、批注、打印或密码逻辑时，还应使用 `tmp/` 中的测试 PDF 做实际烟雾测试。至少检查：

- 普通 PDF 和加密 PDF 均能按预期打开。
- 搜索后跳转到正确页，并仅高亮命中文字而不是整页。
- 滚动到后页时搜索浮窗仍固定在应用窗口内。
- 保存、打印、关闭未保存文档等本次修改涉及的主流程可用。

## 6. macOS 打包

### 6.1 标准构建

```bash
npm run dist:mac
```

该命令执行检查、生产构建并调用 electron-builder 生成 `.app` 和 DMG。Apple Silicon 默认应用目录为：

```text
release/mac-arm64/PDFuck.app
```

### 6.2 签名策略

正式分发应配置 Apple Developer ID，并完成公证。electron-builder 可通过签名证书和 Apple 公证相关环境变量工作，证书和密码不得写入仓库。

如果当前机器没有 Developer ID，只能生成未公证的内部测试包。可对 `.app` 做 ad-hoc 签名：

```bash
codesign --force --deep --sign - release/mac-arm64/PDFuck.app
codesign --verify --deep --strict release/mac-arm64/PDFuck.app
```

ad-hoc 签名不等于 Apple 公证。其他机器首次运行时仍可能需要在 Finder 中右键应用并选择“打开”。

### 6.3 签名后重新生成 DMG

签名会修改 `.app`，因此必须用签名后的应用重新生成 DMG：

```bash
npx electron-builder --prepackaged release/mac-arm64/PDFuck.app --mac dmg
```

`--prepackaged` 必须指向具体的 `PDFuck.app`，不能指向 `release/mac-arm64`。错误示例：

```bash
npx electron-builder --prepackaged release/mac-arm64 --mac dmg
```

错误路径会造成 DMG 中出现 `PDFuck.app/PDFuck.app` 嵌套结构。

不要用 `hdiutil` 从临时目录手工重封装最终 DMG。手工封装会绕过 electron-builder 的 `.DS_Store`、卷图标、应用图标位置和 Applications 快捷入口，最终镜像会丢失 Finder 样式。

DMG 配置必须位于 `package.json` 的 `build.dmg`，不能放进 `build.mac`。当前配置包含：

- `resources/icon.png` 应用/卷图标来源。
- Finder 窗口尺寸和背景色。
- `PDFuck.app` 与 `/Applications` 快捷方式的固定位置。

### 6.4 生成 `.app` ZIP

```bash
VERSION=$(node -p "require('./package.json').version")
ditto -c -k --keepParent release/mac-arm64/PDFuck.app "release/PDFuck-${VERSION}-macOS.zip"
```

### 6.5 macOS 验证

```bash
VERSION=$(node -p "require('./package.json').version")
codesign --verify --deep --strict release/mac-arm64/PDFuck.app
hdiutil verify "release/PDFuck-${VERSION}-macOS.dmg"
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' release/mac-arm64/PDFuck.app/Contents/Info.plist
/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' release/mac-arm64/PDFuck.app/Contents/Info.plist
shasum -a 256 "release/PDFuck-${VERSION}-macOS.dmg" "release/PDFuck-${VERSION}-macOS.zip"
```

挂载 DMG 后必须确认顶层直接包含：

```text
.VolumeIcon.icns
Applications -> /Applications
PDFuck.app
```

并确认不存在 `PDFuck.app/PDFuck.app`。还应直接启动 `release/mac-arm64/PDFuck.app`，检查界面显示的新版本号。若 `/Applications` 中已安装旧版，先完全退出旧进程，避免把旧安装误认为新产物。

必要时检查最终包内资源，而不只是源码：

```bash
npx asar list release/mac-arm64/PDFuck.app/Contents/Resources/app.asar
```

可将 `app.asar` 解包到 `mktemp -d` 创建的临时目录，再用 `rg` 检查新版本号和关键修复是否已经进入生产资源。

## 7. Windows 打包

### 7.1 标准构建

在 Windows PowerShell 中执行：

```powershell
npm ci
npm run dist:win
```

只生成某一种产物时：

```powershell
npm run dist:win:installer
npm run dist:win:portable
```

`dist:win` 会同时生成 NSIS 安装版和便携版。构建前仍必须完成第 3、5 节的版本同步、类型检查和测试。

### 7.2 Windows 签名

正式分发应使用可信代码签名证书。可按 electron-builder 的 Windows 签名方式配置 `CSC_LINK`、`CSC_KEY_PASSWORD` 或证书存储；敏感信息不得提交到仓库。

没有证书时可以生成内部测试包，但 Windows SmartScreen 可能显示未知发布者警告。应在交付说明中明确这一点。

### 7.3 Windows 验证

在 PowerShell 中检查产物：

```powershell
$version = (Get-Content package.json | ConvertFrom-Json).version
Get-ChildItem release -Filter "PDFuck-$version-Windows*.exe"
Get-FileHash release\*.exe -Algorithm SHA256
Get-AuthenticodeSignature release\*.exe
```

至少完成以下运行测试：

- 安装版可安装、启动和卸载，桌面及开始菜单快捷方式正确。
- 便携版无需安装即可启动。
- 安装后 `.pdf` 文件关联存在，双击 PDF 可传递真实文件路径并打开。
- 普通 PDF 不触发系统安全存储授权；只有用户选择保存加密 PDF 密码时才使用系统安全存储。
- “打开文件夹”、保存、打印和关闭未保存文档行为正常。
- 应用界面、文件属性和安装包名称显示同一个版本号。

## 8. 最终发布清单

- `package.json`、`package-lock.json`、包内 `app.asar` 和目标平台文件属性版本完全一致。
- `npm run typecheck`、`npm test`、`npm run build`、`npm run test:i18n-catalogue`、`npm run test:i18n-ui`、`npm run test:print-native`、`npm run test:print-ui`、`npm run test:window-tabs`、`npm run test:page-text-edit-ui`、`git diff --check` 全部通过。
- macOS 的 `.app`、DMG、ZIP 或 Windows 的安装版、便携版均为本轮源码重新生成。
- 最终包内的 `app.asar` 包含新版本和本次关键修改。
- DMG 保留卷图标、应用图标、Applications 快捷入口和正确 Finder 布局。
- 签名状态、公证状态和目标 CPU 架构已经记录。
- 实际启动最终产物，而不是开发服务器或旧安装版本。
- 对每个交付文件生成 SHA-256，并在交付信息中给出绝对路径和校验值。

## 9. 常见故障

### 界面仍显示旧版本

检查 `package.json` 与 `package-lock.json` 是否一致，重新执行一键打包脚本。脚本会验证包内版本和启动界面；还要确认手工启动的是 `release` 中的新 `.app/.exe`，不是 `/Applications` 或 Program Files 中的旧安装。

### 源码修了但安装包行为没变化

通常是使用了旧 `out` 或旧 `app.asar`。重新运行生产构建，并直接检查最终应用的 `Contents/Resources/app.asar` 或 Windows `resources/app.asar`。

### DMG 没有图标、Applications 入口或布局很丑

检查是否使用了手工 `hdiutil` 封装、是否把 `build.dmg` 错放到 `build.mac`，以及 `--prepackaged` 是否错误地指向了父目录。应由 electron-builder 使用签名后的具体 `.app` 重建 DMG。

### electron-builder 找不到 npm

先确认 Node.js/npm 安装和 `PATH`。Codex Desktop 会话应使用工作区依赖定位工具返回的 Node/npm 路径；临时 PATH 兼容处理只能用于当前会话，不能写进仓库。

### macOS 构建提示找不到签名身份

表示当前 Keychain 没有有效 Developer ID。内部测试可使用 ad-hoc 签名；正式公开分发必须配置 Developer ID 并完成 Apple 公证。
