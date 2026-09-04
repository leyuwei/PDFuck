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
.\scripts\package-windows.ps1 2.0.14
```

macOS：

```bash
bash scripts/package-macos.sh 2.0.14
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
npm run test:workflow-state-ui
npm run test:lab-features-ui
npm run test:creative-tools-ui
npm run test:print-native
npm run test:print-ui
npm run test:window-tabs
npm run test:bookmarks-ui
npm run test:bookmark-recognition-papers
npm run test:page-text-edit-ui
npm run test:page-manager-input-ui
git diff --check
```

多栏文字选择回归还应运行：

```bash
npm run test:selection-scheduling
npm run test:selection-scheduling-ui
npm run test:selection-scheduling-0826
npm run test:selection-scheduling-0826-ui
npm run test:selection-test2
npm run test:selection-test2-ui
npm run test:citations-scheduling-0826
npm run test:reading-navigation-ui
npm run test:selection-chinese
npm run test:selection-chinese-ui
npm run test:selection-bc
npm run test:selection-bc-ui
```

前两项使用 `tmp/Scheduling0821m.pdf`，验证内部对象顺序异常时当前行选区不会带入下一行项目符号。随后两项使用 `tmp/Scheduling0826m.pdf`，在第 5、10、11 页同时验证公式碎片保留、图表文字隔离、单双栏流域裁剪、正反向拖拽一致性，并在真实 Electron 窗口核对选区矩形与剪贴板文本。`test:selection-test2` 与 UI 版本固定复现 `tmp/test2.pdf` 第 6 页右栏跨行公式框选。`test:selection-bc` 与 UI 版本固定覆盖 `tmp/bc.pdf` 第 1 页末位作者到跨栏标题的反向拖选，以及第 7、12、13 页；验证结构块跨栏时不会按栏序吸入正文、持续空白栏沟判定不会把公式/矩阵缩进误当栏目，跨栏图注和大公式仍是独立视觉块，同行和长距离同栏拖拽不会溢出；同时验证默认隐藏的页面校正入口、可拖动/增删的竖向栏界、跨栏公式或图片的上下横界、按 PDF 指纹与页码持久化，以及恢复自动识别。`test:citations-scheduling-0826` 要求跨页参考文献覆盖 `[1]`–`[38]`；`test:reading-navigation-ui` 在 900×700 小窗口和高缩放下验证页内滚动优先、页边界继续滚动才翻页、搜索命中矩形进入可视区，以及真实引文面板显示 40 个正文引用位置。最后两项使用 `tmp/7.申报书原件.pdf` 第 3 页验证异常子集字体的纵向度量归一化。目标平台产物生成后，打包脚本还会用最终 `PDFuck` 可执行文件再次运行关键 UI 回归。缺少任一测试 PDF 时应先补齐样本，不要跳过回归。`test:i18n-catalogue` 必须覆盖 JSX 文案、`ui()` 文案和全部十种语言的可外显错误词条；`test:i18n-ui` 必须逐一切换十种界面语言，在 900×700 窗口审计长文本始终位于自适应按钮/提示边框内，并验证重启后的语言持久化、平台自适应快捷键、搜索 PDF 的单行同款按钮布局、八项编辑图标、批注人浮窗拖动与唯一外显开关、姓名和外显偏好持久化、新批注作者写入、作者标签位于正文上方且列表无新增列，以及主要工作区标签、打印设置、PDF 右键菜单与页面删除弹窗，且不允许在非中文界面残留中文控件，并核对非打印提示在十种语言中均不超过两行。

Windows 上的 `test:print-native` 会通过 CJS 实际枚举打印机、加载 PDFium、绑定系统默认设备，核对驱动接受的 150/300/600 DPI 质量枚举与有效最大份数，并让双面打印机驱动验证单面/短边/长边三个逐任务 DEVMODE 值，但不会发送纸张；非 Windows 平台安全跳过。`test:print-ui` 会自行生成七页横纵混排 PDF，在 900×760 的真实 Electron 窗口中注入测试打印机并拦截 IPC 作业，逐一验证十种语言、1–99 份、三档质量、所选设备首选项、25%–200% 缩放、清晰度，以及手动双面奇偶页、反向输出和每张一页/一次一份约束。两项测试都不会真正派发纸张或打开系统设置，以免自动化误触实体设备。

发布前仍需用实体打印机各抽检一次：四页文档按提示完成手动双面，若进纸方向相反则勾选反向输出；奇数页文档以自动双面打印两份，确认份与份之间没有共纸；同一页分别以 150 和 600 DPI 打印，确认质量设置已生效；点击“打印机首选项”，确认打开的是当前所选设备。驱动专属的介质、色彩和后处理选项以该系统窗口为准。

`test:workflow-state-ui` 使用真实 Electron 窗口验证无文档按钮矩阵、干净/已修改文档的保存状态、跨模块选区传递、双击批注自动激活批注模块但不重放已关闭的批注建议请求、智能润色快捷键同行布局与 5–3600 秒自定义超时持久化；发布脚本还会对最终可执行文件再次运行该项回归。Office 合并导入由单元测试分别模拟 Windows、macOS 与 Linux 的 LibreOffice 查找路径，以及 Windows/macOS 的 Microsoft Office 回退脚本；目标系统仍应至少用一个真实 DOCX 和 PPTX 做人工导入抽检。

`test:ai-smoke` 会启动本地 SSE 服务并确认真实 Electron 主进程代理完整转发流式事件；对应单元测试覆盖 OpenAI 与 Claude 流式解析、旧中转明确拒绝流式时的一次兼容回退、524 后禁止盲目重放、网关/鉴权/额度/输入错误分类及十种界面语言。`test:lab-features-ui` 会生成多份 PDF 并启动本地模拟 AI 服务，在真实 Electron 窗口验证实验室标题无上下分隔线、按钮字号与间距和标准批注工具一致、包含自动批注与自由画板的五功能按钮及快捷键约束、免责声明复选框同行及卡片边距、逐页全文文字载荷、按自定义超时倒计时的全文评价进度、打开新 PDF 与手动往返切换时的按文档任务隔离、倒计时连续和结果恢复、GitHub 风格 Markdown 渲染和原始 Markdown 复制、第一页批注写回、批注建议开关、1–5 级自动上下文滑动条、自由位置批注的谨慎回退、按文档持久化的跨页多段手动上下文、切换标签期间仍定向到原文档的 AI 回复写回、回复行与设置区可见性，以及保存重开后的回复持久化；同时保存视觉 QA 截图。发布脚本会对最终可执行文件再次运行该项回归。

2.0.13 自动批注 / Automatic Annotation：发布验证必须覆盖全文与当前选区两种范围，以及 12 类完整且可持久化的问题清单：错别字/格式、语法、清晰度与地道表达、术语一致性、句间衔接、段落主旨、事实/引证/论据、数学推理、跨段落/章节一致性、章节结构、段落/章节重组、论文贡献。每种勾选问题必须单独完成一轮逐页请求，并在新问题轮次开始时清空上一类的滚动摘要；进度须同时显示问题轮次、名称、页码和总检查量。文档开头、邻近段落、跨页文字及本轮持续更新的篇章提纲只能作为上下文，选区任务不得在范围外落注。结构问题须说明影响并给出移动、合并、拆分、补桥、重排或补证据等具体动作。六类结果（高亮、替换、删除、下划线、插入文字、自由批注）均须可保存、重开和一次撤销；“仅修订文本 / 简短说明 / 详细说明”必须直接写入批注内容。精确原文锚点必须覆盖完整命中范围。宽松、均衡（默认）、严格三档必须持久化且不得按配额凑批注。前三次可重试模型失败不得显示人工决策，第四次失败后才显示重试/跳过/结束；写回失败不可自动重放，重试中结束后迟到响应不可落注。还应验证暂停、继续、结束及首次隐私与版权确认。Release validation must cover all 12 persistent issue choices, one complete page pass per selected issue with a reset per-issue rolling summary, scope-safe context, concrete restructuring advice, exact-quote geometry, all six persisted annotation types, three persistent intensity levels without quotas, automatic retries, single writeback, pause/resume/end controls, and the one-time privacy and copyright confirmation.

`test:creative-tools-ui` 会在真实 Electron 窗口先验证自由画板三个控件分组等高对齐、操作提示可见、按浮窗自身宽度响应式重排且无溢出，再验证绘制、移动、缩放、画笔粗细/颜色、PNG 导出和加入当前页；同时遍历箭头、椭圆、方框及线宽、透明边框/填充、线型、箭头大小/样式，并拦截完全不可见图形。之后保存、重启并确认三个生成对象都恢复为可编辑图片。Windows/macOS 发布脚本会在源码态与最终打包程序上各执行一次，并把 PNG/PDF 视觉检查产物保存在 `output/playwright/`。

2.0.14 界面布局 / UI Layout：最窄支持窗口下，滚动文档标题与 PDFuck Logo 之间至少保留 12px 间距，与居中工具栏之间至少保留 16px 间距；Logo 不得被压缩。自动批注的 12 类问题清单必须位于明暗主题均清晰可辨的完整外框内，左右内边距不得小于 12px，列表不得越出外框。The narrowest supported window must keep at least 12px between the scrolling title and the fixed brand and at least 16px before the centered toolbar. The 12 automatic-annotation issue choices must stay within a clearly framed group with at least 12px horizontal padding in both themes.

打包脚本会以 `test:release-ui` 对最终可执行文件验证 2.0.14 桌面外壳：关闭临时文档后黄色提示必须消失，两处最近文件列表必须保存并滚动显示 50 项，Logo 对比色必须随主题切换，标题栏工具组在窗口缩放前后都保持几何居中；文档标题只有溢出时才往返滚动，宽窗口下必须完整静止显示，最窄支持窗口下不得贴近工具栏或与 Logo 重叠；Windows 最小化、最大化/还原和关闭按钮必须使用可辨识的矢量图标。

涉及文档标签页时，`test:window-tabs` 使用真实 Electron 窗口验证：打开两个标签、从操作系统关闭窗口时出现统一的深红确认/闪烁取消警告并可安全取消；存在未保存修改时必须同时出现“全部保存后关闭”，之后继续验证适合宽度继承、排序、拖出/拖回和独立窗口清理。`test:bookmarks-ui` 会生成含标准 Outlines 的测试 PDF，并验证边栏自动显示、随当前页/页内位置唯一高亮所属书签范围、自动展开父级、拖宽、搜索、字号、分级结构、双击改名、单项删除/撤销、窄窗口下与批注栏协调、五组识别规则、1–6 级深度、预览剔除/恢复、精确页内目标写入/读取、写入/清空/撤销以及“保存后关闭”后的实际落盘；`test:bookmark-recognition-papers` 会直接读取 `tmp/m91474-li paper.pdf` 与 `tmp/Scheduling0826m.pdf`，精确核对双栏阅读顺序、小型大写规范化、跨行标题、6/9 个罗马数字章节、Abstract/References 和图表/公式/正文误报排除。源码和最终包都必须执行。不要只以单元测试代替这些跨窗口回归。

涉及页面文字编辑时，`test:page-text-edit-ui` 会生成独立测试 PDF，并在真实 Electron 窗口验证：点击后输入层与原字形区域保持同一坐标和尺寸、光标落在点击字符附近、双重提交只生成一个替换对象、保存并重开后仍只有一个对象，以及删除替换对象后原文编辑区域立即恢复。发布脚本必须执行此项，不能只依赖模型层单元测试。

涉及页面方向、栅格 DPI 或文字输入时，`test:page-manager-input-ui` 会生成三页非对称 PDF，并在真实 Electron 窗口验证：对同一批注连续派发两次删除只能产生一次幂等删除，不能出现原生或应用错误弹窗，且随后新建批注仍可接收普通键盘输入和中文 IME composition；逐页左转、180° 翻转和右转的预览与写回角度一致；DPI 空值、任意正数和小数在编辑中不被预设值改写；窗口失焦/回焦后仍保持真实输入框。发布脚本必须在源码构建和最终打包程序上各执行一次。

2.0.7 的框选专项矩阵会在 `bc.pdf`、`Scheduling0826m.pdf` 和 `test2.pdf` 上合计穷举 1,253 个自动/手工栏界位置，并以真实 Electron 鼠标验证正反向、行尾越界、普通缩放与适合宽度；每次都同时检查剪贴板文本和选区几何，防止“文本看似正确但高亮仍溢出”的假通过。三个 UI 回归会在五条拖动轨迹上连续采样数百个真实显示帧，逐帧检查选区不会消失、倒退、越过栏沟或逃出跨栏图题带，其中包括反向跨页并穿过页间空隙的拖动；同时验证低于 4 px 阈值的指针抖动不会生成选区。

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
- 最近文件两处入口均可滚动查看 50 条记录；关闭文档后不再显示该文档的临时目录提示。
- 缩放窗口时标题栏工具始终居中，浅/深主题字标对比正确，Windows 最小化、最大化/还原和关闭图标清晰可辨。
- 自由画板可导出 PNG 或加入当前页；箭头、椭圆、方框及其样式可生成、定位、保存并重开编辑。
- 应用界面、文件属性和安装包名称显示同一个版本号。

## 8. 最终发布清单

- `package.json`、`package-lock.json`、包内 `app.asar` 和目标平台文件属性版本完全一致。
- `npm run typecheck`、`npm test`、`npm run build`、`npm run test:i18n-catalogue`、`npm run test:i18n-ui`、`npm run test:workflow-state-ui`、`npm run test:lab-features-ui`、`npm run test:creative-tools-ui`、`npm run test:print-native`、`npm run test:print-ui`、`npm run test:window-tabs`、`npm run test:bookmarks-ui`、`npm run test:bookmark-recognition-papers`、`npm run test:page-text-edit-ui`、`git diff --check` 全部通过。
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
