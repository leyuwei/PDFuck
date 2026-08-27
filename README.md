<img width="128" height="128" alt="icon" src="https://github.com/user-attachments/assets/b9a1211c-7264-4112-a3e9-09afe480b242" />

**Language / 语言:** [English](#english) | [简体中文](#chinese)

<a id="english"></a>

# PDFuck - PDF Editor with ~U~seful & ~C~lever ~K~it

> A local-first PDF reading, reviewing, editing, and annotation workspace for researchers.

<img width="1438" height="862" alt="Screenshot 2026-08-22 at 18 51 02" src="https://github.com/user-attachments/assets/0e3baff3-529b-4cb4-9ab8-e2a7b4b4bcc6" />

Reading papers should not mean fighting blurry rendering, scattered comments, or nested menus. PDFuck turns the review-and-revision loop into one focused workspace: select text at character boundaries, leave an annotation, mark it as **Done**, **Think about it**, or **Won't do**, then jump between your task list and the source text. PDFuck is more than a PDF highlighter; it keeps “find an issue -> write a note -> make a decision -> verify it in context” in one flow.

[Download the latest release from GitHub](https://github.com/leyuwei/PDFuck/releases)

Copyright © 2026 github@leyuwei

## Why PDFuck

- **Find figures and tables in one click**: Detects captions such as `Figure`, `Fig.`, `Table`, `图`, and `表`, plus page images and likely tables without standard captions. Results are grouped by page and focus the target when selected.
- **Five interface languages**: Switch between Simplified Chinese, English, Japanese, Russian, and Spanish from the View panel. Window titles, native file dialogs, notices, dialogs, printing, and export flows follow the selected language, and the choice persists after restart.
- **Link citations to references**: Recognizes common numeric (`[1]`, `[2-4]`) and author-year citations and creates clickable links between in-text citations and bibliography entries.
- **Lightweight paper-oriented grammar checks**: Flags common English spelling, repeated-word, and subject-verb agreement issues and links each result back to its context. It is a review aid, not an uncontrolled rewrite engine.
- **Edit PDF text as editable objects**: PDF.js text blocks are regrouped into natural chunks. New text inherits the source font, size, weight, style, alignment, color, and sampled page background, and remains movable and editable after saving.
- **Annotations built for review**: Highlight, replace, delete, underline, note, and insert annotations can carry explanations, colors, replies, and positions that persist in the saved PDF.
- **Character-level selection**: Select partial words, half-lines, mixed Chinese and English text, and cross-line ranges precisely. Replacement lines and insertion arrows snap to actual character boundaries.
- **Fast review decisions**: Each annotation has one-click **Done**, **Think about it**, and **Won't do** replies, plus custom replies. Status is visible through subtle list-row colors.
- **A progress view for revisions**: Annotation counts are grouped by unanswered, done, thinking, and won't-do items. Selecting a count jumps to the first matching annotation.
- **Search that leads somewhere**: Supports case sensitivity, fuzzy matching, and regular expressions. Results include page context and highlight only the matched text.
- **Selection and copy in every module**: View, Edit, Annotate, and Save modes support character-level selection. `Shift` + arrow keys adjust the range, while copying removes hard PDF line breaks and common English word splits.
- **Reorderable, detachable, and returnable document tabs**: Drag tabs forward or backward to arrange your workspace. Drag a tab outside the tab bar to move its current in-memory PDF, reading position, view state, and unsaved indicator into a separate window; drag that tab into another PDFuck window to return it automatically, including unsaved changes.
- **Local-first and explicit password handling**: Parsing, rendering, editing, and export happen locally. Encrypted PDFs open read-only by default; a password is stored by the system secure store only when you explicitly choose to save it.
- **Export for delivery**: Select pages with ranges such as `1-3, 5, 8-10`, odd/even filters, inversion, or individual toggles, then export combined or separate PDF files, PNG, JPG, or EPS. Raster exports support 72-600 DPI.
- **Automatic update check**: Packaged builds can compare the installed version with the latest GitHub Release and let you download, postpone, or skip a release.

## Download and Install

### Windows

The [Releases page](https://github.com/leyuwei/PDFuck/releases) provides two builds:

- **Installer (recommended)**: `PDFuck-<version>-Windows-Setup.exe` supports a custom install directory, desktop and Start Menu shortcuts, PDF file association, normal uninstall, and launch after installation.
- **Portable**: `PDFuck-<version>-Windows.exe` runs directly without writing to a fixed install directory. Neither build requires Node.js.

If Windows SmartScreen warns about an unsigned community build, verify that the file came from this repository's Releases page and check the published checksum before continuing.

### macOS

- **DMG (recommended)**: Open `PDFuck-<version>-macOS.dmg` and drag `PDFuck.app` to `Applications`.
- **ZIP**: Extract `PDFuck-<version>-macOS.zip` and run `PDFuck.app` directly or move it to `Applications`. Choose the Apple Silicon or Intel build shown on the Releases page; do not mix architectures.

Community builds may not have Apple Developer ID signing or notarization. If macOS blocks the first launch, right-click `PDFuck.app` in Finder and choose **Open**. Quit the old version before replacing it during an update. PDFs stay on your computer and are not uploaded.

On macOS, dragging, double-clicking, or opening a PDF through file association reuses the same window and adds a tab. `Command` maps to Windows `Ctrl`; `Option + Left/Right` changes pages, and `Command` + mouse wheel zooms. Printer selection stays in PDFuck's unified print panel; Save As and export use native file dialogs.

## Feature Overview

### View

- Continuous or single-page reading, page navigation, zoom, fit-to-width, fit-page, and high-DPI rendering. In single-page mode, each mouse-wheel gesture turns exactly one page and only one page is shown. Fit Width and Fit Page use compact toolbar icons; the last fitting choice becomes the default for subsequently opened PDFs.
- Light and dark themes, a customizable app accent, and a per-document PDF paper background. Both colors have a full picker with HEX input, presets, and reset controls.
- Drag-and-drop opening, recent files, single-window document tabs, and independent state per tab.
- Reading tools for PDF search, figure/table discovery, citation links, and grammar checks.

### Edit

- Crop pages with a movable selection and eight resize handles, then confirm before applying.
- Delete the current, odd, even, or any selected pages.
- Manage pages in a single thumbnail storyboard with fixed preview frames, a large focused-page inspector, stable pointer dragging with insertion feedback, keyboard reordering, batch removal, cross-group position moves, and 20-page on-demand preview groups for large documents.
- Merge pages from existing PDF, PNG, JPG/JPEG, or EPS files, even before a PDF is opened. After import, batch-select page ranges and move them to the beginning, end, or a specified position before confirming the order. EPS is rasterized locally through Ghostscript when it is installed.
- Add formatted text with custom font, size, color, bold, italic, alignment, line spacing, paragraph spacing, character spacing, and 50%-200% text width.
- Add PNG (including transparent PNG) or JPG images to the current page. Position, resize, rotate, and lock the aspect ratio in a live preview before confirming it into the PDF; reopen the PDF later to edit or remove the image again.
- Add polished page numbers across the document with `{page}` / `{total}` templates, custom separators, font styling, horizontal and vertical alignment, and edge-relative percentage margins that adapt independently to mixed page sizes and orientations. PDFuck-created page numbers can be detected, replaced as a set, or removed after reopening the file.
- Edit PDF.js-recognized text blocks directly at their original coordinates. The zero-padding inline editor keeps the source font face, size, color, baseline, and click-relative caret; repeated saves update one source-bound object instead of stacking duplicates. Multi-column pages remain split into editable blocks, and deleting a saved replacement restores the untouched original text.
- Undo and redo page crops, page deletion, text changes, and annotation changes independently per document tab.

### Annotate

- Highlight, replace, delete, underline, note, and insert text annotations.
- Use the page context menu or the floating selection toolbar to create annotations.
- Cross-line and cross-page selection is written as accurate per-page annotation rectangles, including multi-column layouts, figures, tables, captions, and long formulas.
- Edit or delete existing annotations from the page or list. Change annotation colors, collapse the list to a narrow rail, and focus a selected annotation in the document without leaving a permanent overlay.
- The Annotation Lab provides AI Polish presets for plain-language explanation, logic review, grammar-only checking, human-like phrasing, inconsistency detection, highlighting contributions, and custom prompts. Supported providers include OpenAI-compatible endpoints, Claude-compatible endpoints, BigModel Plan, Doubao, DeepSeek, KIMI, and custom OpenAI-compatible services. API keys and model settings are kept in local browser storage.

### Save, Print, and Export

- Save or Save As PDF, including unsaved in-memory changes.
- PDFuck discovers the printers installed in the operating system and selects one directly inside the unified page-selection, settings, and preview window. On Windows, jobs use the native GDI/DEVMODE path and query each driver's duplex capability; simplex, long-edge duplex, and short-edge duplex are written into that individual job instead of inheriting the printer default.
- Select all, current, odd, even, or arbitrary non-contiguous pages. Printing supports paper size, multi-page layouts, optional page frames, and an independent 25%-200% scale for both one-page and multi-page printing. Values above 100% deliberately allow edge cropping.
- The preview is rendered at high pixel density from the same imposed PDF that is dispatched to the printer, including scale, orientation, margins, multi-page placement, and frames. Windows output uses a 600-DPI PDFium raster passed to the selected driver for clearer physical output.
- Print orientation can be forced to portrait or landscape, or left on the default per-sheet Auto mode. Auto evaluates the actual pages placed on each sheet, so mixed portrait/landscape documents keep the matching orientation in both the application preview and the imposed PDF dispatched to the printer.
- Export selected pages as one combined PDF, one PDF per page, PNG, JPG, or EPS. PNG/JPG/EPS support 72-600 DPI and preserve original page-number suffixes such as `_001` and `_003`.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+S` | Save the current PDF |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+P` | Open the unified page-selection, print-settings, and preview window |
| `Ctrl+C` / `Cmd+C` | Copy the selected PDF text and remove hard line breaks |
| `Ctrl` + mouse wheel | Zoom |
| `Alt+Left/Right` (`Option` on macOS) | Previous/next page |
| `Shift+Left/Right` | Expand or shrink the text selection by character |
| `Ctrl+I` / `Cmd+I` | Open the Annotation Lab AI Polish dialog |

## Run from Source

Requires Node.js 22 or newer. Windows PowerShell, macOS Terminal, and Linux shells are supported.

```sh
npm ci
npm run dev
```

## Check and Build

```sh
npm run typecheck
npm test
npm run build
```

The build also audits the i18n catalogue. Selection regression checks are available through `npm run test:selection-scheduling` and `npm run test:selection-scheduling-ui`; both use `tmp/Scheduling0821m.pdf`. Run `npm run test:window-tabs` to verify tab reordering, standalone windows, automatic return to another PDFuck window, and safe standalone-window cleanup with the same fixture. Run `npm run test:page-text-edit-ui` for the real Electron regression covering in-place geometry, click-relative caret placement, duplicate-free double submission, save/reopen persistence, and source restoration after deletion.

### Package a Release with One Command

Run the script for the target system from the repository root. Both scripts require Node.js 22 or newer, install the locked dependencies with `npm ci`, run all release regressions, package the app, launch the packaged executable for a smoke test, verify the embedded version, and write a SHA-256 release manifest.

Omit the argument to use the version already stored in `package.json`:

```powershell
# Windows PowerShell; run on Windows
npm run package:windows
```

```sh
# macOS Terminal; run on macOS
npm run package:macos
```

Pass a semantic version when preparing a new release. For example, these commands update both `package.json` and `package-lock.json` to `1.20.4` before packaging:

```powershell
npm run package:windows -- 1.20.4
```

```sh
npm run package:macos -- 1.20.4
```

The direct-script equivalents are `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-windows.ps1 1.20.4` and `bash scripts/package-macos.sh 1.20.4`. Review and commit the two version-file changes after a successful versioned run.

Successful Windows builds produce `release/PDFuck-<version>-Windows-Setup.exe`, `release/PDFuck-<version>-Windows.exe`, and `release/PDFuck-<version>-Windows-release.json`. Successful macOS builds produce `release/PDFuck-<version>-macOS.dmg`, `release/PDFuck-<version>-macOS.zip`, and `release/PDFuck-<version>-macOS-release.json`; the checked `.app` remains under `release/mac-arm64/`, `release/mac/`, or `release/mac-universal/`, depending on the architecture.

Windows artifacts must be built on Windows and macOS artifacts on macOS. A Windows package without a configured signing certificate and a macOS package with only an ad-hoc signature are suitable for internal testing, not a public release. On a release-signing Mac, use `REQUIRE_NOTARIZATION=1 npm run package:macos` to fail the run unless Gatekeeper accepts the app. See [PACKAGING_GUIDE.md](PACKAGING_GUIDE.md) for certificate configuration, notarization, artifact inspection, and the delivery checklist.

The lower-level build commands remain available when you deliberately need only part of the packaging flow:

Windows release builds:

```powershell
# Installer and portable builds
npm run dist:win

# NSIS installer only
npm run dist:win:installer

# Portable build only
npm run dist:win:portable
```

macOS release build (run on macOS):

```sh
npm run dist:mac
```

This creates the platform artifact but does not replace the full validation performed by the one-command release script.

## Technical Structure

- `src/main/`: Electron windows, native dialogs, printing, and secure file writes.
- `src/preload/`: Typed desktop APIs with context isolation enabled.
- `src/renderer/src/`: React UI, PDF.js viewer, editing, and annotation interactions.
- `src/renderer/src/lib/pdf-document.ts`: pdf-lib document editing and standard PDF annotations.
- `src/renderer/src/lib/page-selection.ts`: Non-contiguous page parsing and validation.
- `src/renderer/src/lib/export.ts`: PNG, JPG, and EPS page export.
- `src/shared/version.ts`: Version comparison and startup update-check foundations.

### Add a New Interface Language

All application copy is centralized in [`src/shared/i18n-catalogue.ts`](src/shared/i18n-catalogue.ts). Chinese source phrases are stable catalogue keys; components must request them through `ui('源文案')`. Parameterized messages use `t('message.key', { value })`, and stored or dynamically assembled status text uses `translateUiText(...)`. Never translate PDF contents, file names, paths, user input, or model responses.

The following example uses French (`fr`). A language is complete only after every step passes; do not ship a selector option that relies on Chinese or English fallback text.

1. In `src/shared/i18n-catalogue.ts`, add `fr` to `InterfaceLanguage`, `INTERFACE_LANGUAGES`, and `AdditionalInterfaceLanguage`. Add a complete `localePhrases.fr` map for every key in `englishPhrases`, add an `fr` value to every entry in `phraseTranslations`, and include French in the code that merges `phraseTranslations` into `localePhrases`. Also add all French entries to `statusTemplates.fr` and `parameterMessages.fr`. Preserve placeholders exactly: a source containing `{count}`, `{name}`, or `$1` must use the same placeholders in its translation.
2. Wire the language through the application: extend the desktop API union in [`src/shared/contracts.ts`](src/shared/contracts.ts), accept `fr` in the main-process language validation in [`src/main/index.ts`](src/main/index.ts), add `<option value="fr">Français</option>` to [`src/renderer/src/components/ToolPanel.tsx`](src/renderer/src/components/ToolPanel.tsx), and add the correct BCP 47 date locale (for example, `fr-FR`) to the recent-file date map in [`src/renderer/src/components/Dialogs.tsx`](src/renderer/src/components/Dialogs.tsx).
3. Extend the safeguards: add the locale to the language and catalogue maps in [`scripts/i18n-catalogue-audit.cjs`](scripts/i18n-catalogue-audit.cjs), add a representative French UI case and persistence expectation to [`scripts/i18n-ui-smoke.cjs`](scripts/i18n-ui-smoke.cjs), and update complete-language fixtures in [`src/renderer/src/lib/i18n.test.ts`](src/renderer/src/lib/i18n.test.ts) and any component test that enumerates every language. This search helps find fixed five-language lists that need review:

   ```sh
   rg -n "zh.*en.*ja.*ru.*es|en.*ja.*ru.*es" src scripts
   ```

4. Run the complete checks, then launch the app and manually inspect the language selector, window title, native open/save dialogs, unsaved-change dialog, recent-file dates, print/export flows, and language persistence after restart:

   ```sh
   npm run typecheck
   npm test
   npm run test:i18n-catalogue
   npm run test:i18n-ui
   npm run build
   ```

When adding new visible copy later, put it in this same catalogue in all supported languages and render it with `ui`, `t`, or `translateUiText`; do not add a component-local translation object or raw visible string. Installer localization is separate from application localization: add an installer language in the `build.nsis.installerLanguages` section of `package.json` only when electron-builder/NSIS supports the target locale, and verify that installer independently.

## Text Objects

Text added by PDFuck is stored as PDF FreeText objects with appearance streams. Latin text uses vector text appearances; characters that standard PDF fonts cannot encode, such as Chinese, use a high-resolution transparent appearance. PDFuck-created text remains movable and editable after reopening the file.

“Edit Page Text” uses a reversible visual replacement. PDF.js identifies the source glyph boxes and live embedded font face; the inline editor remains at the same coordinates with no box padding and places the caret near the clicked character. The sampled background masks and exact high-resolution text appearance are stored together in one source-bound FreeText object, while the original page content stream stays untouched. Repeated or concurrent saves update that same object, so replacements do not stack; deleting it reveals the original text again.

## License

PDFuck is released under the [MIT License](LICENSE). Issues, suggestions, and pull requests are welcome.

---

<a id="chinese"></a>

# PDFuck - PDF 编辑器（简体中文）

> 为科研人员打造的 PDF 精读、审稿与协作批注工作台。

读论文，不应该在模糊渲染、零散批注和层层菜单之间消耗注意力。PDFuck 的核心是一个面向审稿返修的批注工作台：你可以在字符边界上留下意见，马上把它标记为“已处理 / 想一想 / 不做了”，再从列表统计和原文定位继续推进。它不只是给 PDF 画颜色，而是把“发现问题 → 写下意见 → 做出决定 → 回到原文核对”放进同一条工作流。

[前往 GitHub Releases 下载](https://github.com/leyuwei/PDFuck/releases)

版权声明：Copyright © 2026 github@leyuwei

## 为什么值得一试

- **一键找到论文里的图和表**：自动识别 `Figure`、`Fig.`、`Table`、`图`、`表` 等标题，也能发现没有规范标题的页面图像和疑似表格；结果按页列出，点击即可跳转并短暂聚焦目标。
- **五种界面语言**：可在查看面板通过紧凑下拉框即时切换简体中文、English、日本語、Русский 与 Español；窗口标题、系统文件对话框、提示、弹窗、打印与导出流程会同步使用所选语言，重启后仍会保留选择。
- **引文和参考文献自动连线**：识别 `[1]`、`[2-4]`、作者-年份等常见引文格式，在正文引用与参考文献条目之间建立可点击关联，返修时不用手动翻页对照。
- **针对论文的轻量语法检查**：标出常见英文拼写错误、重复单词和主谓一致问题，并把每一处结果定位回原文上下文；它是审稿辅助，不会把整篇文档改写成不可控的“AI 文风”。
- **直接改 PDF 原文，而不是盖一层白框**：PDF.js 会把被拆散的同行文字合并成自然文本块；编辑时继承原字体、字号、粗斜体和对齐方式，再从页面取样文字色与背景色，改完的文字仍是可移动、可再次编辑的 PDF 对象。
- **批注是审稿工作流，不是装饰层**：高亮、替换、删除、下划线、便笺和插入六类批注都能携带文字说明；批注内容、颜色、位置和回复会随 PDF 保存，重开文档仍可继续编辑。
- **字符级批注，半行文字也不丢精度**：单击得到字符间光标，拖动只选择真正命中的字符；跨行、半词和中英文混排都能精确标记，替换线与插入箭头会吸附到真实字符边界。选中文字后，页面浮动工具栏和右键菜单都能直接创建批注。
- **三种快捷回复，把意见变成决定**：每条批注旁边都有“✓ 已处理 / ? 想一想 / × 不做了”快捷按钮，一次点击即可更新状态；状态会以淡绿、淡黄、淡红的行背景呈现，不必打开批注逐条确认。需要补充上下文时，还能输入自定义回复。
- **回复统计就是返修进度板**：批注列表按“未回复、已处理、想一想、不做了”统计数量，点击统计项即可跳到第一条对应批注；审稿结束前，未回复和“想一想”数量就是明确的待办清单。
- **从列表回到原文只需一次点击**：批注列表支持 `Ctrl/⌘` 多选、`Shift` 连续选择、批量删除、行内双击编辑、右键设置颜色与回复，以及单行/多行显示和 280–560 px 宽度调整。定位时自动滚动到页面中央，用紧贴每行文字的短暂轮廓提示目标。
- **批注不会挡住阅读，也不会失去上下文**：侧栏可以收起为窄栏，保留数量提示；选中批注后页面只显示约 1 秒的“当前批注”聚焦框，既能确认位置，又不会留下永久遮罩。
- **搜索结果是真正可用的定位结果**：支持大小写、模糊匹配和正则表达式，命中结果按页显示上下文，跳转后只高亮匹配文字而不是整页。
- **选字和复制不受模式限制**：查看、编辑、批注、保存四个模块都能字符级拖选；`Shift` 加左右方向键可逐字符扩展选区，复制时自动清掉 PDF 硬回行并修复常见英文断词。
- **标签可排序、可拖出和移回**：可前后拖动标签调整工作顺序；将标签拖出标签栏，即可把当前内存 PDF、阅读位置、查看状态和未保存标记无损移入一个单独窗口；再将该标签拖入另一个 PDFuck 窗口，PDF 会自动回归标签页，未保存修改也会保留。
- **本地优先，密码边界清楚**：PDF 解析、渲染、编辑和导出都在本机完成；加密 PDF 默认以只读方式打开，只有用户明确选择保存密码时才交给系统安全存储。
- **为交付而不是炫技设计**：页码选择器支持 `1-3, 5, 8-10`、奇偶页、反选和逐页点选，可将当前修改后的指定页面合并或拆分导出为 PDF、PNG、JPG、EPS。
- **启动时检查更新**：打包版本会对比 GitHub Releases 的最新版本，发现更新后可选择立即下载、稍后提醒或跳过该版本。

## Windows 下载与安装

发布页同时提供两种版本：

### 安装版（推荐）

下载 `PDFuck-<version>-Windows-Setup.exe`（`<version>` 为 Releases 页面上的当前版本），按安装向导操作即可。安装版支持：

- 自定义安装目录；
- 创建桌面快捷方式；
- 创建开始菜单入口；
- 注册为可打开 PDF 文件的应用；
- 通过 Windows“已安装的应用”正常卸载；
- 安装结束后直接启动 PDFuck。

### 便携版

下载 `PDFuck-<version>-Windows.exe` 后直接运行，不写入固定安装目录，适合放在移动硬盘或临时电脑上使用。

两种版本都不需要另行安装 Node.js。

> 如果未签名的社区版本触发 Windows SmartScreen，请先确认文件来自本仓库的 Releases 页面并核对发布页校验值，再选择是否继续运行。

## macOS 下载与使用

发布页提供两种 macOS 版本：

### DMG 安装镜像（推荐）

下载 `PDFuck-<version>-macOS.dmg`，双击打开后将 `PDFuck.app` 拖入 `Applications` 文件夹。之后可以从 Launchpad、Finder 或 Spotlight 启动 PDFuck。DMG 保留了应用图标和 `Applications` 快捷入口，不需要安装 Node.js。

### ZIP 便携包

下载 `PDFuck-<version>-macOS.zip`，解压得到 `PDFuck.app`，可直接运行，也可以手动拖到 `Applications`。Apple Silicon 与 Intel 架构请按 Releases 页面标注选择对应构建；不要把 Intel 版本和 Apple Silicon 版本混用。

### 首次打开与更新

社区构建可能没有 Apple Developer ID 签名或公证。若 macOS 阻止首次打开，请在 Finder 中右键 `PDFuck.app` 选择“打开”，再在系统提示中确认。更新时先完全退出旧版，再用新版本替换 `Applications` 中的 `PDFuck.app`；PDF 文件不会被上传，文档仍保存在本机。

### macOS 工作方式

- 将 PDF 拖入窗口，或使用“打开 PDF”；双击、拖入和文件关联打开的文档会复用同一个窗口并新增标签。
- 在 Finder 中右键 PDF，选择“打开方式” → `PDFuck`，即可把它设为默认阅读器。
- `Command` 对应 Windows 的 `Ctrl`；`Option + ←/→` 可快速翻页，`Command + 滚轮` 可缩放。
- 打印机选择与全部打印设置都在 PDFuck 的统一打印浮窗内完成；保存、另存为和导出会弹出原生文件选择器。

## 功能一览

### 查看

- 连续滚动与单页查看；单页模式下每次滚轮手势只翻动一整页，且始终只呈现一页；
- 页码跳转、缩放，以及图标化的“适合宽度”和“适合屏幕”；后者会同时按可显示宽高完整呈现当前页，最近一次适配选择会成为之后打开 PDF 的默认查看方式；
- 高 DPI 清晰渲染；
- 支持完整的浅色与夜间暗色主题，也可自定义软件主题色，主题色会贯穿导航、标签、激活工具、选区、编辑框、焦点和主操作；亮色主题色会自动采用深色选中文字与图标，避免高亮区域失去可读性。软件主题色与每份 PDF 的纸张底色（包括原始白纸区域）均可在颜色选择器旁一键恢复默认；
- 从资源管理器直接拖入 PDF 打开；
- 文件未真正拖入窗口时，拖放提示会立即消失，不再遮挡界面；
- 未打开 PDF 时显示最近使用列表，可点击快速打开；
- 已有文档时继续打开、双击或拖入 PDF，会在同一个主窗口新增文档标签；
- 文档标签栏支持切换、打开、单独关闭、前后拖动排序；将标签拖出标签栏即可创建独立窗口，再拖入另一个 PDFuck 窗口会自动回归标签页，当前内存修改不丢失；
- 每个标签保留独立页码、缩放、工具和未保存状态，原生窗口标题跟随当前 PDF 文件名。
- 打包版本启动后会在后台检查 GitHub Releases；更新提示支持下载、稍后提醒和跳过当前版本。

### 编辑

- 框选裁切页面，初选后可移动并通过八个控制点精调大小；点击页面内“确认范围”后才询问是否执行裁切；
- 页面管理器采用统一缩略图故事板和右侧大图详情；拖动时显示悬浮影子与插入位置，松手后再重排，也可用方向键或目标位置跨组移动；支持多页批量删除，大文档每组按需生成 20 页预览，排序和删除作为一次可撤销修改提交；
- 无需先打开 PDF，即可将已有 PDF、PNG、JPG/JPEG 或 EPS 合并成新文档；已有文档可明确选择插入到开头、末尾、指定页之前或之后。多个导入文件在独立列表中拖动或用上下按钮排序，且每个文件内部页面保持原有顺序。EPS 会在本机 Ghostscript 可用时离线栅格化导入；
- 添加自定义字体类别、字号、颜色、粗体、斜体和对齐方式的文字；
- 可在当前页面添加 PNG（包括透明 PNG）或 JPG 图片；导入后先在页面上拖动调整位置、大小、旋转角度和原始比例锁，确认后才正式写入 PDF；已添加图片会保留可编辑源数据，重开 PDF 后仍可在编辑模块选中、调整或删除；
- 可为全部页面批量增加美观页码：支持 `{page}` / `{total}` 模板、任意分隔符、字体/字号/颜色/粗斜体、左中右与页顶/页底对齐，并按每页宽高使用百分比边距独立定位，可正确适配横向、纵向及混合尺寸页面；重开 PDF 后仍可整组更新或删除由 PDFuck 添加的页码；
- 新增文字可直接选择、拖动，双击后继续编辑；
- 激活“编辑页面文字”后，当前页所有 PDF.js 可识别文本块会自动显示边框；点击后编辑器保持原坐标、零内边距和源字体样式，并把光标放到点击字符附近，不再跳成独立文本框；同一区域反复保存只更新一个对象，删除替换对象即可恢复未被破坏的原文；
- 多栏页面按栏和段落拆分为可编辑文本块；清空编辑内容并应用即可删除原页面文字，保存后可正常重开；
- 默认继承文本块的具体字体名称、字号、粗体、斜体，并通过像素取样匹配原文字色和页面背景色；
- 页内浮动工具栏提供 Arial、Helvetica、Calibri、Segoe UI、Times New Roman、微软雅黑、宋体、黑体等常用字体，并支持字号、颜色、粗斜体、对齐、行距、段前距、段后距、字符间距和 50%–200% 文字宽度；
- 替换后的页面文字作为可编辑对象保存，支持拖动和双击再次修改；
- 撤销/重做覆盖裁切、页面排序/删除、添加/移动/编辑文字、添加/移动/编辑/删除图片以及添加/移动/编辑/删除批注，并按文档标签独立保存操作历史。

### 界面与工作区

- 左侧四个主菜单使用统一的简洁线性图标，始终保持可见；
- 点击当前已激活的“查看 / 编辑 / 批注 / 保存”按钮，可反复收起或展开它旁边的白色工具区；
- 工具区收起后切换其他主菜单，会自动展开对应工具；
- 顶部“保存”在文档无改动时为灰色禁用，有未保存改动时才变为蓝色可点击。

### 全局文字选择与复制

- 查看、编辑、批注、保存四个模式均默认支持字符级拖选；
- 单击文字可定位到字符间闪烁光标，`Shift+←/→` 可精确调整选区；
- `Ctrl+C`、`Cmd+C` 或页面右键菜单中的“复制”均可复制；
- 写入剪贴板前自动去除 PDF 硬回行，并避免在连续中文之间插入多余空格。

### 批注

- 文本高亮；
- 文本替换；
- 文本删除；
- 加下划线；
- 自由批注；
- 插入文字；
- 页面右键快捷批注；
- 单击文字显示类似 Word 的字符间闪烁光标，拖动才形成选区；
- 连续阅读模式下可跨页框选，跨页高亮、替换、删除和下划线会按页写入准确的批注矩形；
- 光标定位后可按住 `Shift`，使用左右方向键逐字符精准扩展或收缩选区；
- 已有批注可在页面上直接右键编辑或删除；
- 所有批注痕迹都可通过页面右键、双击编辑窗或列表设置区调整颜色；
- 文本替换线与插入箭头默认使用深蓝色，插入箭头按字符边界精确指向文字中间；
- 多段或半行批注仅在真正标记的片段上响应鼠标，未标记文字仍可继续精准框选和批注；
- 每条批注支持自定义回复，以及“已处理 / 想一想 / 不做了”三种快捷回复；快捷状态默认不外显文字，而以淡绿、淡黄、淡红列表底色表达；
- 批注列表默认完整多行显示内容，也可通过顶部按钮切换为紧凑单行模式；列表仍支持定位、编辑、删除和收起为 46 px 窄栏；
- 列表选中的批注会自动滚动到页面中央，按实际文字行分段显示紧致聚焦框，并在约 1 秒后消失；
- 删除批注会立即执行，不再二次确认；误删可用 `Ctrl/⌘Z` 撤销。
- 左侧“批注”工具栏将“实验室”作为与“文本批注”“位置批注”一致的标准工具分组：框选后按 `Ctrl/⌘I` 或点击页面浮窗的星形图标，可选通俗化解释、逻辑需优化、仅语法检查、类人化表达、前后不一致、要突出亮点或自定义提示词；回复可复制或写回为智能润色批注。
- 智能润色会根据框选文字的主要语言自动使用中文或英文提示词；切换中文、英文选区时会同步切换预置提示词，混合文本按字符占比判断。
- 夜间模式默认使用浅蓝灰文档纸张底色，保证多栏正文和公式在深色界面中仍清晰可读；多栏跨栏选区按真实文字列分段绘制并支持高亮、替换、删除和下划线批注。
- 多栏跨栏框选会根据页面文字覆盖和字号自适应识别栏沟，支持双栏、三栏及更多栏，也能处理小于 15pt 的紧凑栏间距；选区矩形不会穿过栏沟误选邻栏公式或文字。
- 图、表、长公式与正文混排时，跨栏视觉块会按页面几何顺序整体识别；多行图题、表注和跨栏公式不会因为 PDF 内部对象顺序而漏字、跳回正文或把相邻栏内容带入选区。
- 模型设置支持 OpenAI（含中转）、Claude（含中转）、BigModel Plan、Doubao、DeepSeek、KIMI 与自定义 OpenAI 兼容接口；密钥仅保存在本机浏览器存储中。

### 保存、打印与导出

- 保存或另存为 PDF；
- 软件会直接识别操作系统中已安装的打印机，并在统一打印浮窗内完成设备选择、页码选择、设置和预览；Windows 会走原生 GDI/DEVMODE 通道，读取每台驱动的双面能力，并把单面、长边双面或短边双面写入当前作业，不再继承打印机默认值；
- 可选择全部、当前、奇数、偶数或任意不连续页面，并设置纸张、每张纸多页拼版、25%–200% 独立缩放和页面边框；单页与多页拼版都支持缩放，超过 100% 时允许按预览裁切边缘；默认不添加页面边框，只有主动勾选时才会写入分隔线；
- 预览不再使用近似缩略图，而是以高像素密度直接渲染即将派发的最终拼版 PDF，缩放、方向、页边距、多页位置和边框与作业保持同源；Windows 物理输出使用 600 DPI PDFium 栅格交给所选驱动；
- 打印方向支持自动、纵向和横向；默认自动模式会针对每一张输出纸上的实际页面独立选择方向，横纵页面混排文档的应用预览和最终提交给系统的打印 PDF 保持一致；
- 输入 `1-3, 5, 8-10` 即可快速指定页码，错误范围会即时提示；
- 把指定页面导出为新 PDF，或导出 PNG、JPG、EPS；
- 图片与 EPS 支持 72–600 DPI，并保留原文档页码后缀，例如 `_001`、`_003`。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+S` | 保存当前 PDF |
| `Ctrl+Z` | 撤销当前 PDF 的上一步修改 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | 重做当前 PDF 的下一步修改 |
| `Ctrl+P` | 打开合并后的页码选择、打印设置与预览窗口 |
| `Ctrl+C` / `Cmd+C` | 复制当前 PDF 文字选区，并自动去除回行 |
| `Ctrl+鼠标滚轮` | 快速缩放页面 |
| `Alt+←/→`（macOS 为 `Option+←/→`） | 快速翻到上一页或下一页 |
| `Shift+←/→` | 所有模式下逐字符扩展或收缩文字选区 |
| `Ctrl+I` / `Cmd+I` | 打开批注实验室的智能润色窗口 |

## 从源码运行

需要 Node.js 22 或更高版本。Windows PowerShell、macOS Terminal 和 Linux shell 都可以使用下面的命令。

```sh
npm ci
npm run dev
```

## 检查与构建

```powershell
npm run typecheck
npm test
npm run build
```

针对框选溢出的回归，可在构建后运行 `npm run test:selection-scheduling` 和 `npm run test:selection-scheduling-ui`。两项检查都使用 `tmp/Scheduling0821m.pdf`：前者验证 PDF 内部文字流把下一行项目符号插入当前行中间时，选区仍只包含当前行；后者在真实 Electron 界面中拖选该位置，并确认原生界面控件不会出现浏览器式文字选中。

页面文字编辑回归使用 `npm run test:page-text-edit-ui`。它会在真实 Electron 窗口验证原位坐标、点击字符光标、双重提交去重、保存重开后对象唯一性，以及删除替换对象后恢复原文。

### 一键打包发布

请在仓库根目录、对应的目标系统上执行脚本。两个脚本都要求 Node.js 22 或更高版本，并会通过 `npm ci` 安装锁定依赖，执行全部发布回归，打包应用，启动最终可执行程序完成冒烟测试，核对包内版本，最后生成 SHA-256 发布清单。

不传参数时，脚本会自动使用 `package.json` 中已有的版本号：

```powershell
# Windows PowerShell；必须在 Windows 上运行
npm run package:windows
```

```sh
# macOS Terminal；必须在 macOS 上运行
npm run package:macos
```

准备新版本时可传入语义化版本号。例如下面的命令会先把 `package.json` 和 `package-lock.json` 一起更新为 `1.20.4`，再开始打包：

```powershell
npm run package:windows -- 1.20.4
```

```sh
npm run package:macos -- 1.20.4
```

直接执行脚本的等价命令分别是 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-windows.ps1 1.20.4` 和 `bash scripts/package-macos.sh 1.20.4`。带版本号执行成功后，请检查并提交上述两个版本文件的变更。

Windows 成功后会得到 `release/PDFuck-<version>-Windows-Setup.exe`、`release/PDFuck-<version>-Windows.exe` 和 `release/PDFuck-<version>-Windows-release.json`。macOS 成功后会得到 `release/PDFuck-<version>-macOS.dmg`、`release/PDFuck-<version>-macOS.zip` 和 `release/PDFuck-<version>-macOS-release.json`；已检查的 `.app` 会根据架构位于 `release/mac-arm64/`、`release/mac/` 或 `release/mac-universal/`。

Windows 产物必须在 Windows 上构建，macOS 产物必须在 macOS 上构建。未配置签名证书的 Windows 包以及仅使用 ad-hoc 签名的 macOS 包只适合内部测试，不应公开发布。在已配置正式签名的 Mac 上，可使用 `REQUIRE_NOTARIZATION=1 npm run package:macos`，让脚本在 Gatekeeper 未接受应用时直接失败。证书配置、公证、产物检查和交付清单详见 [PACKAGING_GUIDE.md](PACKAGING_GUIDE.md)。

只有在明确需要跳过完整发布验证、单独生成某类产物时，才建议使用以下底层命令：

Windows 发布命令：

```powershell
# 同时生成安装版和便携版
npm run dist:win

# 只生成 NSIS 安装版
npm run dist:win:installer

# 只生成便携版
npm run dist:win:portable
```

macOS 发布（必须在 macOS 上执行）：

```sh
npm run dist:mac
```

该命令只生成平台产物，不能替代一键发布脚本执行的完整验证。

## 技术结构

- `src/main/`：Electron 窗口、原生对话框、打印和安全文件写入；
- `src/preload/`：启用 context isolation 的类型化桌面接口；
- `src/renderer/src/`：React 界面、PDF.js 查看器和编辑/批注交互；
- `src/renderer/src/lib/pdf-document.ts`：pdf-lib 文档编辑和标准 PDF 批注；
- `src/renderer/src/lib/page-selection.ts`：不连续页码解析、校验与紧凑显示；
- `src/renderer/src/lib/export.ts`：指定页 PNG、JPG 与 EPS 导出；
- `src/shared/version.ts`：版本比较与启动更新检测基础逻辑。

### 加入新的界面语言

所有应用外显文案统一集中在 [`src/shared/i18n-catalogue.ts`](src/shared/i18n-catalogue.ts)。中文源文案是稳定的词典键，组件必须通过 `ui('源文案')` 取值；带参数的消息使用 `t('message.key', { value })`，已存储或动态拼接的状态文字使用 `translateUiText(...)`。PDF 正文、文件名、路径、用户输入和模型回复都不属于界面文案，切勿翻译。

下面以法语（`fr`）为例。只有全部步骤和测试都通过，才算真正支持一种语言；不要只增加下拉选项后依赖中文或英文回退。

1. 在 `src/shared/i18n-catalogue.ts` 中，把 `fr` 加入 `InterfaceLanguage`、`INTERFACE_LANGUAGES` 和 `AdditionalInterfaceLanguage`；新增完整的 `localePhrases.fr`，覆盖 `englishPhrases` 的每个键；为 `phraseTranslations` 的每一项加入 `fr`，并在把 `phraseTranslations` 合并到 `localePhrases` 的代码中纳入法语；同时补齐 `statusTemplates.fr` 与 `parameterMessages.fr`。占位符必须原样保留：源文案中的 `{count}`、`{name}` 或 `$1` 等占位符，在译文中必须保持一致。
2. 打通应用链路：在 [`src/shared/contracts.ts`](src/shared/contracts.ts) 中扩展桌面 API 的语言联合类型；在 [`src/main/index.ts`](src/main/index.ts) 的主进程语言校验中允许 `fr`；在 [`src/renderer/src/components/ToolPanel.tsx`](src/renderer/src/components/ToolPanel.tsx) 中加入 `<option value="fr">Français</option>`；在 [`src/renderer/src/components/Dialogs.tsx`](src/renderer/src/components/Dialogs.tsx) 的最近文件日期映射中加入正确的 BCP 47 区域代码，例如 `fr-FR`。
3. 扩展防遗漏检查：在 [`scripts/i18n-catalogue-audit.cjs`](scripts/i18n-catalogue-audit.cjs) 中更新语言列表和词典映射；在 [`scripts/i18n-ui-smoke.cjs`](scripts/i18n-ui-smoke.cjs) 中加入有代表性的法语界面断言和持久化预期；在 [`src/renderer/src/lib/i18n.test.ts`](src/renderer/src/lib/i18n.test.ts) 以及所有枚举完整语言集合的组件测试中加入新语言。可用下面的搜索命令查找仍固定为五种语言的列表：

   ```sh
   rg -n "zh.*en.*ja.*ru.*es|en.*ja.*ru.*es" src scripts
   ```

4. 运行完整检查，然后启动应用，人工检查语言选择器、窗口标题、系统打开/保存对话框、未保存更改弹窗、最近文件日期、打印/导出流程，以及重启后的语言记忆：

   ```sh
   npm run typecheck
   npm test
   npm run test:i18n-catalogue
   npm run test:i18n-ui
   npm run build
   ```

以后增加新的外显文案时，也必须在同一个词典中一次性补齐所有语言，并通过 `ui`、`t` 或 `translateUiText` 渲染；不要再新增组件内翻译对象或直接显示的裸字符串。安装器语言与应用界面语言是两套独立机制：只有在 electron-builder/NSIS 支持目标地区时，才在 `package.json` 的 `build.nsis.installerLanguages` 中加入对应安装器语言，并单独验证安装界面。

开发计划与过程记录只保存在开发任务中，`PLAN.md`、`PROGRESS.md` 已加入 `.gitignore`，不会再进入仓库。

## 关于文字对象

PDFuck 添加的文字会保存为带外观流的 PDF FreeText 对象。拉丁文字使用矢量文字外观；中文等无法由标准 PDF 字体直接编码的文字使用高分辨率透明外观。保存后重新打开，PDFuck 创建的文字对象仍可继续移动和编辑。

“编辑页面文字”采用可逆的视觉替换方式：PDF.js 识别源字形区域和当前已加载的内嵌字体，零内边距编辑器保持原坐标，并把光标定位到点击字符附近。取样背景遮罩和高分辨率精确文字外观会一起写入一个与来源区域绑定的 FreeText 对象，原始页面内容流不再被永久覆盖。同一区域的重复或并发保存只更新该对象，不会叠出重复文字；删除对象即可重新显示原文。

## 开源许可

本项目基于 [MIT License](LICENSE) 开源。欢迎提交 Issue、改进建议和 Pull Request。
