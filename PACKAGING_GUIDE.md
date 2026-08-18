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

假设新版本为 `X.Y.Z`：

```bash
npm version X.Y.Z --no-git-tag-version
```

该命令会同步 `package.json` 和 `package-lock.json`。本项目界面版本目前还在 `src/renderer/src/App.tsx` 中使用 `APP_VERSION`，必须同步修改：

```ts
const APP_VERSION = 'X.Y.Z'
```

修改后检查所有版本来源：

```bash
rg -n '"version"|APP_VERSION' package.json package-lock.json src/renderer/src/App.tsx
```

三个位置必须一致。否则 `Info.plist` 可能是新版本，但应用界面仍显示旧版本。

## 4. 构建前检查

按顺序执行：

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

其中 `npm run build` 会重新生成 `out/main`、`out/preload` 和 `out/renderer`。不要直接用旧的 `out` 目录打包，否则源码修复可能没有进入 `app.asar`。

涉及 PDF 渲染、搜索、批注、打印或密码逻辑时，还应使用 `tmp/` 中的测试 PDF 做实际烟雾测试。至少检查：

- 普通 PDF 和加密 PDF 均能按预期打开。
- 搜索后跳转到正确页，并仅高亮命中文字而不是整页。
- 滚动到后页时搜索浮窗仍固定在应用窗口内。
- 保存、打印、关闭未保存文档等本次修改涉及的主流程可用。

## 5. macOS 打包

### 5.1 标准构建

```bash
npm run dist:mac
```

该命令执行检查、生产构建并调用 electron-builder 生成 `.app` 和 DMG。Apple Silicon 默认应用目录为：

```text
release/mac-arm64/PDFuck.app
```

### 5.2 签名策略

正式分发应配置 Apple Developer ID，并完成公证。electron-builder 可通过签名证书和 Apple 公证相关环境变量工作，证书和密码不得写入仓库。

如果当前机器没有 Developer ID，只能生成未公证的内部测试包。可对 `.app` 做 ad-hoc 签名：

```bash
codesign --force --deep --sign - release/mac-arm64/PDFuck.app
codesign --verify --deep --strict release/mac-arm64/PDFuck.app
```

ad-hoc 签名不等于 Apple 公证。其他机器首次运行时仍可能需要在 Finder 中右键应用并选择“打开”。

### 5.3 签名后重新生成 DMG

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

### 5.4 生成 `.app` ZIP

```bash
VERSION=$(node -p "require('./package.json').version")
ditto -c -k --keepParent release/mac-arm64/PDFuck.app "release/PDFuck-${VERSION}-macOS.zip"
```

### 5.5 macOS 验证

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

## 6. Windows 打包

### 6.1 标准构建

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

`dist:win` 会同时生成 NSIS 安装版和便携版。构建前仍必须完成第 3、4 节的版本同步、类型检查和测试。

### 6.2 Windows 签名

正式分发应使用可信代码签名证书。可按 electron-builder 的 Windows 签名方式配置 `CSC_LINK`、`CSC_KEY_PASSWORD` 或证书存储；敏感信息不得提交到仓库。

没有证书时可以生成内部测试包，但 Windows SmartScreen 可能显示未知发布者警告。应在交付说明中明确这一点。

### 6.3 Windows 验证

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

## 7. 最终发布清单

- `package.json`、`package-lock.json`、`APP_VERSION` 完全一致。
- `npm run typecheck`、`npm test`、`npm run build`、`git diff --check` 全部通过。
- macOS 的 `.app`、DMG、ZIP 或 Windows 的安装版、便携版均为本轮源码重新生成。
- 最终包内的 `app.asar` 包含新版本和本次关键修改。
- DMG 保留卷图标、应用图标、Applications 快捷入口和正确 Finder 布局。
- 签名状态、公证状态和目标 CPU 架构已经记录。
- 实际启动最终产物，而不是开发服务器或旧安装版本。
- 对每个交付文件生成 SHA-256，并在交付信息中给出绝对路径和校验值。

## 8. 常见故障

### 界面仍显示旧版本

检查 `src/renderer/src/App.tsx` 的 `APP_VERSION`，重新执行 `npm run build`，再重新打包。还要确认启动的是 `release` 中的新 `.app/.exe`，不是 `/Applications` 或 Program Files 中的旧安装。

### 源码修了但安装包行为没变化

通常是使用了旧 `out` 或旧 `app.asar`。重新运行生产构建，并直接检查最终应用的 `Contents/Resources/app.asar` 或 Windows `resources/app.asar`。

### DMG 没有图标、Applications 入口或布局很丑

检查是否使用了手工 `hdiutil` 封装、是否把 `build.dmg` 错放到 `build.mac`，以及 `--prepackaged` 是否错误地指向了父目录。应由 electron-builder 使用签名后的具体 `.app` 重建 DMG。

### electron-builder 找不到 npm

先确认 Node.js/npm 安装和 `PATH`。Codex Desktop 会话应使用工作区依赖定位工具返回的 Node/npm 路径；临时 PATH 兼容处理只能用于当前会话，不能写进仓库。

### macOS 构建提示找不到签名身份

表示当前 Keychain 没有有效 Developer ID。内部测试可使用 ad-hoc 签名；正式公开分发必须配置 Developer ID 并完成 Apple 公证。
