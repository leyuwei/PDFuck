<img width="1113" height="171" alt="ScreenShot_2026-09-18_114316_102" src="https://github.com/user-attachments/assets/8b1517a2-abdd-4431-a987-ba6768226433" />

# PDFuck - A PDF Editor

[简体中文](#chinese) · [English](#english) · [下载 / Download](https://github.com/leyuwei/PDFuck/releases)

<img width="2154" height="1352" alt="ScreenShot_2026-09-18_113723_792" src="https://github.com/user-attachments/assets/b2b3b87d-d8b8-4996-8f9d-94c933359fa6" />

<a id="chinese"></a>

**为论文精读、审稿与修改设计的 PDF 编辑器。** 支持 Windows、macOS 和十种界面语言。

**2.1.4 统一 PDF 与 Markdown 搜索**：重新设计可拖动搜索窗，按字号和视区自适应，复选框与完整选项文字独立排版，避免 Markdown 样式污染导致逐字换行。支持十语言、明暗主题、主题强调色和四档界面字号。Markdown 源码支持 Ctrl/⌘+F，复用 PDF 的大小写、模糊匹配（忽略空白）、正则及预设；结果显示行号，点击直接选中并滚动到原文。输入框中 Enter/Shift+Enter 跳到下一个/上一个结果，Escape 关闭并恢复焦点。PDF 区域继续按页查找；搜索入口跟随当前区域，源码单栏也可使用，修改源码后自动清除旧结果。

## 核心亮点

- **从 Markdown 写作到 PDF 编辑**：双栏和单栏均无上方标题，两栏铺满可用区域；底部操作图标居中等高，完整操作名显示于悬浮提示。按需展开的悬浮语法工具及可拖动的快捷插入浮窗提供 15 类语法、六级标题、代码语言、表格行列设置与插入预览。PDF 排版浮窗展示五种 A4 模板：简洁的细线与浅蓝引用、学术的居中标题与三线表、商务的绿色分区与深色表头、书刊的暖色引言与斜体引用、技术的紫色提示与深色代码块。支持快速字号选择、可选择文字及自动分页。生成的 PDF 直接复用阅读、编辑、批注、搜索、打印与导出工具。十语言、双主题和四档界面字号均适配；分栏比例、所选模板及各模板的自定义排版设置会分别保存，切换模板或重启后恢复。
- **专门处理复杂论文版式的框选**：兼顾双栏、行内公式、上下标与跨页选区；支持手动校正栏界，复制时自动整理断行与断词。
- **AI 审稿直接生成文内批注**：对全文或选区逐项检查语言、逻辑、数学推导和篇章结构；可选择批注力度、添加自定义标准，并随时暂停、继续。
- **结合原文生成修改建议**：从批注位置自动提取附近正文，也可加入多段选区作为上下文。建议在同一编辑窗口中填入回复草稿，确认后保存到 PDF。
- **随手翻译选中的文本**：在“实验室”选择目标语言并启用后，可在任何模块圈选文字并右键翻译。单词会自动参考同页少量上下文，但结果只翻译选区；结果可一键写成 Highlight 高亮批注。翻译独立运行，不打断其他 AI 任务；临时故障会先自动恢复，仍失败时可直接重试。
- **把批注变成可跟进的修改清单**：区分批注人，用“已处理／想一想／不做了”标记处理状态；按进度统计快速定位批注，再回到原文核查，回复随 PDF 保存。
- **Markdown 批注与文内浮窗**：编辑窗、批注列表和文内浮窗共用持久化的 Markdown 开关；可选择列表或文内查看，单击批注显示作者与处理状态，双击浮窗编辑。每页纸张左上方外侧显示四类状态统计，AI 批注附带来源徽标。实验室的润色、全文评价、自动批注、修改建议、图片解释和翻译均可将结果与对应原文导出为独立 PDF，附带完整 Markdown 和原文附件。
- **扫描件也能原位框选与复制**：OCR 在本地识别所选页码，支持中英等 11 种主要语言，自动纠斜、低置信度复识别并整理中文/日文伪空格。隐形文字随 PDF 保存，页面外观保持不变，识别结果可撤销。
- **按论文结构找内容**：一键定位图表，将文中引用关联到参考文献，自动识别章节书签；PDF 自带书签与页内链接可准确跳转，网页和邮件链接由系统安全打开。
- **衔接论文插图的 EPS 工作流**：支持 EPS 导入，将编辑后的 PDF 导出为保留文字与矢量路径的 EPS，方便后续排版。
- **智能裁切与图片解读**：框选图片后，智能裁切自动贴合可见内容边缘；框边“保护边界”可设置 0–50 mm 四周留白，识别后实时调整，0 为贴边，留白止于页面边缘。保护边界自动保存，跨页、跨文档和重启后继续使用；裁切框、图片和图形草稿在缩放时保持定位。实验室“解释图片”支持趋势、坐标估读、图线比较与特征解读，结果可复制或添加为便笺。已添加的图片和图形支持跨页拖放，也可选择目标页，确认后保存，可撤销。
- **批量添加可撤销文字水印**：在编辑模块按页码范围添加水印，可实时预览并设置文字、字体、字号、角度、颜色、透明度和密度；已添加水印可整体更新或一键删除。
- **识别加密权限与数字签名**：密码加密和空密码权限加密 PDF 均可阅读；明显显示打印、复制、修改和批注权限，并验证签名覆盖范围、密码学完整性及证书信息。无法直接写回时可生成不覆盖原件的高分辨率可编辑副本。

## 安装与配置

- **Windows**：从 [Releases](https://github.com/leyuwei/PDFuck/releases) 下载 `Windows-Setup.exe` 安装；安装器采用软件 Logo，并显示是否已有安装及其版本、路径。`Windows.exe` 为便携版。
- **macOS**：下载对应 DMG，将 PDFuck 拖入 Applications。各平台产物以 Releases 实际提供的文件为准。
- **日常使用**：打开 PDF 或 Markdown 即可开始。“查看”中可切换语言、主题和界面字号；字号支持预览后确认，不影响 PDF 缩放。欢迎页和打开文件窗口中的最近打开列表可随时清空，且不会删除本机文档。
- **Markdown**：支持“打开文档”、拖入、最近文档和系统“打开方式”；Windows 安装版与 macOS 应用均注册 `.md` 编辑器，可在系统中选为默认程序。默认双栏，拖动中间分割线调整比例，也可用方向键调整、Home 复位；底部选择源码、PDF 或双栏，源码与 PDF 操作组的关闭图标可隐藏对应栏；底部视图按钮可随时恢复。源码保存/另存为位于底部源码操作组。源码“保存／另存为”和源码编辑器中的 Ctrl/⌘+S 保存 UTF-8 `.md`；支持 Ctrl/⌘+B 加粗、I 斜体、U 下划线、E 行内代码、K 链接和 Shift+X 删除线，悬浮提示同时显示快捷键；“保存 PDF”输出独立 PDF，五种模板每页底部均显示当前页码与总页数。“PDF 排版”提供三种字体族、8–24 pt 字号、1.2–2.4 行距及 0–24 pt 段距；每种模板独立记住自定义设置，重新选择当前模板也不会重置。
- **Markdown 更新与图片**：源码停止编辑 1.5 秒后自动刷新，输入法组字期间暂停；右侧 PDF 已有编辑或批注时暂停自动替换，需显式刷新并确认，建议先保存 PDF。PDF 修改不会写进 Markdown 源码，关闭标签时会检查双方未保存状态。本地渲染不执行原始 HTML 或脚本；支持文档目录及子目录内 PNG/JPEG/GIF/WebP 和嵌入图片，远端或目录外图片显示替代文字。
- **文档标签档案**：点击左上角“文档标签”，为当前窗口的文件列表命名保存，支持多个档案、改名和删除。之后点击档案即可补开文档，已打开的标签保留；缺失或无法打开的文件集中提示。档案只记录文件位置，不包含未保存的编辑，未落盘文档需先保存。
- **OCR**：“编辑 → OCR 识别”设置页码范围和主要语言。引擎与语言数据随包内置，无需联网、配置 AI 或另装 OCR 软件。
- **打印**：点击左侧“打印”直接打开原有打印设置与预览，在弹窗中选择页码；书签、批注列表等侧栏展开或拖宽后，当前 PDF 页面若放不下，会自动适合宽度并保留阅读位置。
- **关于**：左侧模块下方以两行固定显示“关于”和当前版本号；弹窗可检查更新并打开项目官方 Releases 页面。
- **AI（可选）**：在“批注 → 实验室 → 模型设置”中保存多个命名配置，填写接口地址、API Key、模型名后点击“激活此模型”。顶部摘要显示实际使用的配置与模型；实时过程按请求、思考和回复分区显示。支持 OpenAI、Claude、Grok、BigModel、Doubao、DeepSeek、KIMI 和自定义兼容接口；保存其他配置不会切换当前模型。启用 AI 时，所选原文或全文会发送给激活的服务；普通编辑与 OCR 在本地执行。
- **文本翻译（可选）**：在“批注 → 实验室 → 文本翻译”中选择目标语言并启用。之后在任意模块圈选 PDF 文字，右键选择“翻译所选文字”；确认结果后可直接添加为高亮批注。关闭开关即可移除全局右键入口。
- **解释图片（可选）**：在实验室点击“解释图片”，框选页面区域，选择预设或修改提示词后发送。只发送所选区域的 PNG 给当前激活的模型，需要模型支持图片输入；坐标是依据图像的估算值。窗口可最小化，结果可复制或添加到原图所在页的便笺。
- **Thinking 与生成参数**：可配置思考模式/强度、Claude 思考预算、温度、Top P、惩罚、Seed 和高级 JSON。默认等待 600 秒、输出预算 65,536 Token，最多可设置 3,600 秒和 262,144 Token，实际受服务商限制。遇到明确不兼容参数会尝试恢复；输出截断先扩容，再按允许的 Thinking 降级或分批处理。可关闭 Thinking 降级；界面仅显示服务商实际返回的思考内容。
- **格式转换（可选）**：EPS 导入需要 Ghostscript；矢量 EPS 导出需要 Poppler 的 `pdftocairo`。Office 导入在 Windows 可使用本机 Microsoft Office，跨平台可使用 LibreOffice。macOS 可用 `brew install ghostscript poppler` 安装 EPS 工具。

## 软件架构

| 部分 | 职责 |
| --- | --- |
| Electron 主进程 · `src/main` | 本地文件、原生窗口、打印、格式转换、AI 请求及 OCR 工作线程 |
| 安全桥接 · `src/preload`、`src/shared` | 通过类型化 IPC 暴露桌面能力，共享数据契约与十种语言文案 |
| React 界面 · `src/renderer/src` | 多文档工作区、阅读与编辑工具、统一字号和弹窗交互 |
| PDF.js + pdf-lib | PDF.js 渲染、提取文字与建立框选坐标；pdf-lib 写入编辑、批注和隐形 OCR 文字层，管理撤销与保存 |
| Tesseract.js | 本地逐页 OCR；后台识别、进度与取消，不替换原页面图像 |

开发环境需要 **Node.js 22.4+**：

```bash
npm ci
npm run dev
npm run build
```

`build` 包含类型检查、单元测试、多语言与字号审计。安装包构建、平台依赖和发布验证见 [打包指南](PACKAGING_GUIDE.md)；界面规范见 [字号 VI 规范](docs/VI-TYPOGRAPHY.md)。

<a id="english"></a>

**A PDF editor for close reading, peer review, and revision.** Available on Windows and macOS, with ten interface languages.

**2.1.4 unifies PDF and Markdown search**: a redesigned draggable search window adapts to viewport and interface size. Checkboxes and complete option labels stay together without inheriting Markdown form styles. Ten languages, both themes, custom accents and all four interface sizes are supported. Ctrl/Cmd+F searches the active Markdown source or PDF pane. Source search shares case matching, fuzzy matching (ignoring whitespace), regex and presets; line-numbered results select and reveal the original text. Enter/Shift+Enter in the search input move through results, and Escape closes the window and restores focus. Search works in source-only view and clears stale results after source edits.

## Highlights

- **Markdown writing with PDF tools**: both split and single views have no pane headings; bottom save, Save As and close icons share aligned centers and localized tooltips. A floating syntax panel and a draggable insertion window cover 15 types, six heading levels, code languages, table dimensions and an insertion preview. Five A4 styles offer distinct content treatments: Clean uses fine rules and blue quotes; Academic uses centered titles and formal tables; Business uses green sections and dark table headers; Editorial uses warm lead text and italic quotes; Technical uses purple notes and dark code blocks. The draggable layout window offers quick point-size presets, selectable text and automatic pagination. Generated PDFs use the existing reading, editing, annotation, search, printing and export modules. Ten languages, both themes and four interface size presets are supported; pane proportions, template selection and each template's customized typography survive switching and restart.
- **Selection built for complex papers**: Handles two-column layouts, inline equations, superscripts, subscripts, and cross-page selections. Correct column boundaries manually; copying cleans up line breaks and split words.
- **AI review that becomes in-document annotations**: Check a whole paper or a selection for language, logic, mathematical reasoning, and structure. Choose review intensity, add custom criteria, and pause or resume the review.
- **Revision advice grounded in the source**: Automatically collect nearby text from an annotation’s position, or add multiple selections as context. Use suggestions in a reply draft within the same editor, then confirm to save them into the PDF.
- **Translate selected text in place**: Choose a target language in Lab, then translate any PDF selection from its context menu in every module. A single word receives a small same-page context for disambiguation while only the selection is translated. Translation runs independently of other AI tasks; add the result as a Highlight annotation in one click, with automatic recovery before a manual retry.
- **Annotations you can follow through**: Identify reviewers and mark each item as Done, Think about it, or Won’t do. Use progress counts to find annotations, return to the source to verify changes, and keep replies in the PDF.
- **Markdown annotations and in-document cards**: a remembered Markdown switch applies to the editor, list and paper cards. Choose the list or in-document view; click an annotation to see its author and status choices, and double-click the card to edit. Each sheet shows four status counts outside its upper-left corner, and AI annotations retain a source badge. Export every Lab AI result with its source to a separate PDF, including full Markdown and source attachments.
- **Select and copy scanned pages in place**: Local OCR supports selected page ranges and 11 primary languages, deskewing, a low-confidence retry, and removal of spurious Chinese/Japanese spaces. Invisible text is saved inside the PDF while preserving its appearance, with undo support.
- **Navigate by the paper’s structure**: Find figures and tables in one click, link citations to references, and recognize section bookmarks. Built-in outlines and page links navigate precisely; web and email links open safely through the operating system.
- **An EPS workflow for research figures**: Import EPS files and export edited PDFs to EPS while retaining text and vector paths for subsequent typesetting.
- **Smart crop and figure interpretation**: Trim a selected figure to its visible content edges. The adjacent **Protective margin** control adds 0–50 mm of space on all sides with live adjustment after detection; 0 fits tightly and margins stop at page edges. The margin is remembered across pages, documents and restarts; crop, image and shape drafts keep their focus when zoom changes. Lab’s **Explain image** provides trends, estimated coordinates, curve comparisons and feature interpretation; copy the result or add a note on the source page. Added images and shapes can be dragged across pages or moved with a target-page selector, with confirmation and undo.
- **Removable text watermarks in batches**: Add watermarks to selected page ranges with live controls for text, font, size, angle, color, opacity, and density; update or remove the full set in one click.
- **Encryption permissions and digital signatures**: Read password-protected and permission-encrypted PDFs, inspect print/copy/edit/annotation permissions, and verify signature coverage, cryptographic integrity, and certificate details. When direct writeback is unavailable, create a high-resolution editable copy without overwriting the original.

## Installation and configuration

Download the Windows installer/portable executable or the macOS DMG from [Releases](https://github.com/leyuwei/PDFuck/releases). Available builds are listed there. Open PDF or Markdown to start; language, theme, and previewable interface font sizes are under **View**. The recent-files list can be cleared from either the welcome screen or the Open document dialog without deleting files from your computer.

**Markdown**: open through the file chooser, drag and drop, recent documents or your system’s Open With menu. The Windows installer and macOS app register `.md` editor support so you can select PDFuck as the default application. Drag the splitter or use its arrow keys (Home resets); use the bottom controls to switch between source, PDF and both, or close and restore either pane. Source Save/Save As and Ctrl/Cmd+S in the source editor write UTF-8 `.md`; Save PDF exports independently. Formatting shortcuts are Ctrl/Cmd+B (bold), I (italic), U (underline), E (inline code), K (link), and Shift+X (strikethrough). Every template prints current / total page numbers at the bottom. PDF layout offers three font families, 8–24 pt text, 1.2–2.4 line spacing and 0–24 pt paragraph gaps. Typing refreshes a clean PDF after 1.5 seconds of inactivity; IME composition pauses rendering. once PDF edits or annotations exist, rebuilding pauses until explicitly confirmed. Save the edited PDF before rebuilding. PDF edits are separate from source, and closing checks both for unsaved changes. Rendering is local and script-free, with GFM rather than raw HTML; raster images inside the document directory or its subdirectories and embedded PNG/JPEG/GIF/WebP are supported. Remote and out-of-directory images show alternative text.

**About**, below the module buttons, keeps the current version visible on a second line, checks for updates and links to the official Releases page.

**OCR** is under **Edit**: choose pages and a primary language. The engine and language data are bundled for offline use.

**Print** in the left rail directly opens the existing dialog with page selection, settings, and preview. Opening or widening sidebars automatically fits an overflowing current page to the available width while keeping the reading position.

**Saved tab groups**: click **Document tabs** to save the current window’s file list under a name. Create multiple groups, rename or delete them, and reopen a group later. Existing tabs are kept and unavailable files are listed. Groups store file locations, not unsaved edits; save new documents to disk first.

**AI is optional**: under **Annotations → Lab → Model settings**, save named configurations and explicitly activate one. The summary identifies the active configuration and model; live activity separates the request, reasoning and response. Providers include OpenAI, Claude, Grok, BigModel, Doubao, DeepSeek, KIMI and custom compatible endpoints. Saving an inactive configuration does not switch models. Configure Thinking mode/effort, Claude's thinking budget, sampling, penalties, Seed and advanced JSON. Defaults are 600 seconds and 65,536 output tokens; configurable maxima are 3,600 seconds and 262,144 tokens, subject to provider limits. Recovery handles rejected parameters and truncation; Thinking fallback can be disabled. Only reasoning actually returned by the provider is displayed. AI sends the selected text or document to the active provider; ordinary editing and OCR run locally.

**Text translation is optional**: under **Annotations → Lab → Text translation**, choose a target language and enable the switch. In any module, select PDF text and choose **Translate selected text** from the context menu. Source and translation are shown in clearly separated panels, and the result can be added directly as a Highlight annotation; disabling the switch removes the global menu item.

**Explain image is optional**: select an area, choose or edit a prompt, then send only that region’s PNG to the active model, which must support image input. Coordinates read from a figure are estimates. The window supports minimizing, copying results and adding a note on the source page.

Optional format tools: Ghostscript for EPS import, Poppler (`pdftocairo`) for vector EPS export, and Microsoft Office on Windows or LibreOffice across platforms for Office import. On macOS, `brew install ghostscript poppler` installs the EPS tools.

## Architecture and development

Electron handles files, native windows, printing, conversions, AI requests, and background OCR. A typed preload/IPC bridge connects it to the React workspace. PDF.js renders pages and extracts positioned text; pdf-lib persists edits, annotations, and invisible text, with undo history. Tesseract.js recognizes scans locally, page by page.

Use **Node.js 22.4+** and run `npm ci`, then `npm run dev`. `npm run build` runs type checking, unit tests, translation and typography audits before building. See the [packaging guide](PACKAGING_GUIDE.md) and [interface typography specification](docs/VI-TYPOGRAPHY.md).

## 开源致谢 / Open-source acknowledgments

| 项目 / Project | 用途 / Used for | 许可证 / License |
| --- | --- | --- |
| [Electron](https://github.com/electron/electron)、[React](https://github.com/facebook/react) | 桌面运行时与界面 / Desktop runtime and UI | MIT |
| [PDF.js](https://github.com/mozilla/pdf.js) | 页面渲染、文字提取 / Rendering and text extraction | Apache-2.0 |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | PDF 编辑与保存 / PDF editing and persistence | MIT |
| [Tesseract.js](https://github.com/naptha/tesseract.js)、[Tesseract.js-core](https://github.com/naptha/tesseract.js-core)、[tessdata](https://github.com/naptha/tessdata) | 本地 OCR 与语言模型 / Local OCR and language models | Apache-2.0；语言包分发封装为 MIT / Model package wrappers: MIT |
| [react-markdown](https://github.com/remarkjs/react-markdown)、[remark-gfm](https://github.com/remarkjs/remark-gfm) | Markdown 文档与 AI 建议排版 / Markdown documents and AI suggestions | MIT |
| [windows-pdf-printer-native](https://github.com/ClemersonAssuncao/windows-pdf-printer-native)、[Koffi](https://github.com/Koromix/koffi)、[PDFium](https://pdfium.googlesource.com/pdfium/) | Windows 原生打印 / Native Windows printing | MIT；PDFium 为 BSD 风格 / BSD-style |
| [Vite](https://github.com/vitejs/vite)、[electron-vite](https://github.com/alex8088/electron-vite)、[electron-builder](https://github.com/electron-userland/electron-builder)、[Vitest](https://github.com/vitest-dev/vitest)、[Playwright](https://github.com/microsoft/playwright) | 构建、打包与测试 / Build, packaging, and tests | MIT / Apache-2.0 |

感谢 [Ghostscript](https://www.ghostscript.com/)、[Poppler](https://poppler.freedesktop.org/) 和 [LibreOffice](https://www.libreoffice.org/) 提供可选格式转换能力。它们由用户另行安装，分别遵循其自身许可证。完整依赖版本见 [package.json](package.json) 与锁文件；OCR 来源说明随安装包提供，也可查看 [OCR NOTICE](resources/OCR-NOTICE.txt)。

Optional converters Ghostscript, Poppler, and LibreOffice are installed separately and retain their own licenses. Dependency versions are pinned in the package manifests; OCR provenance is included with the app and in [OCR NOTICE](resources/OCR-NOTICE.txt).

---

[MIT License](LICENSE) · © 2026 [leyuwei](https://github.com/leyuwei)
