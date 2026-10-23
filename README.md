<img width="1113" height="171" alt="ScreenShot_2026-09-18_114316_102" src="https://github.com/user-attachments/assets/8b1517a2-abdd-4431-a987-ba6768226433" />

# PDFuck - A Tiny AI-Empowered Document Editor

[简体中文](#chinese) · [English](#english)

<img width="2154" height="1352" alt="ScreenShot_2026-09-18_113723_792" src="https://github.com/user-attachments/assets/b2b3b87d-d8b8-4996-8f9d-94c933359fa6" />

<a id="chinese"></a>

## 简体中文

**为论文精读、审稿与修改设计的文档编辑器。**

支持 Windows、macOS 和十种界面语言，将阅读、写作、编辑与审稿放在同一个工作区。

[下载安装](https://github.com/leyuwei/PDFuck/releases) · [打包指南](PACKAGING_GUIDE.md) · [界面规范](docs/VI-TYPOGRAPHY.md)

### 核心亮点

- **Markdown / TXT 写作，直接生成 PDF**：共用带左侧行号的编辑器、真实 PDF 双栏预览、同步滚动、独立撤销和搜索。TXT 保留字面文字，不解释 Markdown 语法。五种排版模板可自定义字体与间距；生成的 PDF 可继续编辑、批注、打印，原文与 PDF 分别保存。
- **文字与编码清楚可控**：状态栏显示全文、选区字数和编码；自动识别常见编码，可手动重新解码或转换保存编码。编辑器跟随纸张背景与主题，自动选择清晰的文字颜色。
- **读懂复杂论文版式**：框选兼顾双栏、行内公式、上下标与跨页文本，复制时整理断行与断词。通过图表定位、章节书签与参考文献关联快速回到原文。
- **AI 审稿落到原文**：检查语言、逻辑、数学推导与篇章结构，直接生成文内批注；结合上下文给出修改建议，也可翻译选区、解读图片，将结果导出为带原文的 PDF 报告。
- **让批注成为修改清单**：区分批注人，用“已处理／想一想／不做了”跟进进度；支持 Markdown 内容、文内浮窗和回复，随 PDF 保存。
- **扫描件也能选中、复制**：内置本地 OCR，支持中英等 11 种语言。识别文字随 PDF 保存，保留原页面外观，无需联网或另装 OCR 软件。
- **编辑与导出一站完成**：添加文字、图片、图形和批量水印，智能裁切图片，管理页面并打印。支持 EPS 导入与矢量导出，识别加密权限与数字签名。

### 安装与开始使用

从 [下载页面](https://github.com/leyuwei/PDFuck/releases) 获取对应平台的文件：

| 平台 | 安装方式 |
| --- | --- |
| Windows | 下载文件名以 `Windows-Setup.exe` 结尾的安装包；以 `Windows.exe` 结尾的文件为便携版。 |
| macOS | 下载适合本机架构的 DMG，将 PDFuck 拖入 Applications。 |

打开或拖入文档即可开始。“查看”中可调整语言、主题、纸张背景与界面字号；“文档标签”可保存和恢复一组文件。

2.1.11 后续修复按 Form 和路径裁剪还原图表真实可见范围，避免超大隐藏路径把正文并入图框；带明确分图标记的多部件图共用完整图注和一个索引条目。CropBox 外对象不列出，部分可见区域裁到页内。实验室批注在共用写入层检查重叠：独立说明去重合并，改写只保留最新完整版本；保留人工批注、人工改动和回复，支持跨轮次、保存重开及撤销。现行交付见 [2.1.11 验收记录](tests/docs/VALIDATION-2.1.11.md)。

2.1.11 优化实验室实时思考区与取消按钮间距，状态信息距窗口左侧仅 12px；补齐中文选区的上下沿。图像、矢量图和有线/无边框表格复用同一识别区域，正文选择跳过图表、标题及表下注释，图表内部仍可独立选择。“一键图表”以半透明淡色框显示区域，并按单个图表提供定位索引。

2.1.10 改进公式密集、左右栏错行文档的自动分栏，修复 `785904351dabdab98176b914912cc8dd.pdf` 两页漏检，并排除公式编号空隙误报。栏界工具条支持长翻译文本、大字号换行及双主题。所有测试、样本、验收记录和运行输出统一到根目录 [tests](tests/README.md)，未添加或修改 gitignore。见 [2.1.10 验收记录](tests/docs/VALIDATION-2.1.10.md)。

2.1.9 修复压缩标点与后续文字块重叠导致的选区溢出，保留前面字符的光标位置，支持双向选择与缩放。批注编辑顶部显示被批注原文、前后文和页码；跨页批注分页面展示，便笺展示附近文字，无文字位置明确提示。通用打开和拖入提示统一为“文档”，支持十种语言、双主题及四档界面字号。验收与 Windows 交付见 [2.1.9 验证记录](tests/docs/VALIDATION-2.1.9.md)。

2.1.9 后续修复补齐英文空格与词尾空格的选择/复制，校正特殊符号及跨栏图注的选区。自动批注可选择“指定页码”，填写如 `1-3, 5` 的范围；只处理并发送所选页面，进度显示实际页码，报告保留相同范围。导出与运行控制统一放在浮窗固定底栏。书签底部提示按完整宽度自然换行。

顶部“保存”左侧的新建图标可创建空白 Markdown 或 TXT。选择类型后进入编辑器，并提醒尽快保存；首次保存选择本地位置。Tab 插入制表符或缩进多行，Shift+Tab 反缩进，Esc 将焦点移出编辑区；缩进支持撤销和重做。

2.1.7 的“编辑页面文字”支持直接修改、增字、换行及格式调整。小改动复用原文字指令；需要重排时自动按原字体程序、字号、基线、字距和栏内宽度生成可复制的矢量文字，缺字自动补齐并在字体栏标明。预览与写回共用流程，支持连续编辑、撤销重做及保存重开。多栏选择与可视栏线复用 PDF 字体度量及多行共同栏沟。同时兼容 Chromium 输出的 Type3 字体子集：按字形编码定位同名字体、合并分散字宽，连续编辑与保存重开沿用相同解析。页面文字编辑的失败反馈留在编辑器内，保留草稿供继续修改或重试，不弹通用错误窗口。修复根因、关键复测与交付包见 [2.1.7 验证记录](tests/docs/VALIDATION-2.1.7.md)。

Markdown / TXT 原文使用 Ctrl/⌘+S 保存，“保存 PDF”单独导出预览。在仅编辑器视图中，页面编辑、批注、OCR 和打印等 PDF 操作禁用；切回双栏或 PDF 视图可使用。

源码底栏的自动换行图标可切换横向滚动和按编辑区宽度回行，并记住选择。左侧行号使用独立底色和较淡、稍小的数字；每个原始行只在第一条显示行编号，自动换行的续行留白，不改动文档内容。

“批注 → 实验室”可对文字选区润色、修订、翻译或自动检查；结果直接替换原文，全文评价追加至文末，均可撤销。普通 PDF 编辑与批注不会写回源码；预览已有修改时，重新生成需确认，建议先保存 PDF。

底栏编码按钮支持 UTF-8（含 BOM）、UTF-16 LE/BE、GB18030、Big5、Shift JIS、EUC-KR、Windows-1251/1252。无编码标记的文件可能有多种解释，可选择读取编码重新打开；转换后保存才写入文件，不能表示原文字符时拒绝保存，避免静默丢字。保留原有换行格式。字数按汉字及日文假名逐字、其他语言按词统计，忽略空白、标点和 emoji；Markdown 按原文统计。

### 可选功能与数据处理

**AI**：在“批注 → 实验室 → 模型设置”填写接口地址、API Key 和模型名，并激活配置。支持多个服务商及兼容接口；图片解读需要模型支持图片输入。

普通编辑、Markdown / TXT 渲染、编码转换和 OCR 在本地执行。使用 AI 时，所选文字、文档内容或图片区域会发送给当前激活的服务。

**格式转换**：EPS 导入需要 Ghostscript，矢量 EPS 导出需要 Poppler 的 `pdftocairo`；Office 导入可使用 Windows 上的 Microsoft Office，或跨平台的 LibreOffice。macOS 可通过 `brew install ghostscript poppler` 安装 EPS 工具。

### 开发

需要 **Node.js 22.4+**：

```bash
npm ci
npm run dev
```

`npm run build` 执行类型检查、单元测试、多语言与字号审计，再生成生产构建。平台打包、签名和发布流程见 [打包指南](PACKAGING_GUIDE.md)。

测试入口、原始 PDF 样本和版本验收记录见 [tests/README.md](tests/README.md)。当前 `npm run test:release-2.1.11-visual-bounds` 只运行本轮新增 12 项单元用例；新窗口验收另检查十页样本、两页表格及实际索引/双向复制，不执行历史全量回归。

Electron 主进程位于 `src/main`，负责本地文件、窗口、打印、AI 请求与 OCR；`src/preload` 和 `src/shared` 提供安全桥接与共享契约；React 界面位于 `src/renderer/src`。

### 开源与许可

基于 [Electron](https://github.com/electron/electron)、[React](https://github.com/facebook/react)、[PDF.js](https://github.com/mozilla/pdf.js)、[pdf-lib](https://github.com/Hopding/pdf-lib)、[Tesseract.js](https://github.com/naptha/tesseract.js)、[react-markdown](https://github.com/remarkjs/react-markdown) 和 [remark-gfm](https://github.com/remarkjs/remark-gfm) 构建。完整依赖见 [package.json](package.json)，OCR 来源与许可见 [OCR 说明](resources/OCR-NOTICE.txt)。可选转换工具由用户另行安装，遵循各自许可证。

本项目采用 [MIT 许可证](LICENSE)。© 2026 [leyuwei](https://github.com/leyuwei)

---

<a id="english"></a>

## English

**A document editor for close reading, peer review, and revision.**

Available on Windows and macOS in ten interface languages. Read, write, edit, and review in one workspace.

[Download](https://github.com/leyuwei/PDFuck/releases) · [Packaging guide](PACKAGING_GUIDE.md) · [Interface guidelines](docs/VI-TYPOGRAPHY.md)

### Highlights

- **Write Markdown or TXT, work with real PDFs**: share an editor with left line numbers, synchronized scrolling, independent undo, and search. TXT stays literal, without Markdown parsing. Customize five layout templates, then edit, annotate, or print the generated PDF. Save source and PDF separately.
- **Keep text and encoding readable**: see document and selection counts plus encoding in the status bar. Detect common encodings, reread with a chosen encoding, or convert on save. Editor colors adapt to the paper background and theme.
- **Read complex papers comfortably**: select text across columns and pages, including inline equations, superscripts, and subscripts. Copying cleans up line breaks and split words; figure lookup, section bookmarks, and citation links help you find the source.
- **AI review anchored to the text**: check language, logic, mathematical reasoning, and structure with in-document annotations. Get contextual revision suggestions, translate selections, interpret figures, and export reports with their source material.
- **Turn annotations into a revision checklist**: identify reviewers and track items as Done, Think about it, or Won’t do. Markdown content, in-document cards, and replies are saved with the PDF.
- **Select and copy scanned text**: bundled local OCR supports 11 languages, including Chinese and English. Save recognized text inside the PDF while preserving page appearance, without a network connection or a separate OCR installation.
- **Edit and export in one place**: add text, images, shapes, and batch watermarks; crop figures, manage pages, and print. Import EPS, export vector EPS, and inspect encryption permissions and digital signatures.

### Install and get started

Choose a build for your platform from the [download page](https://github.com/leyuwei/PDFuck/releases):

| Platform | Installation |
| --- | --- |
| Windows | Use the file ending in `Windows-Setup.exe` to install, or `Windows.exe` for the portable app. |
| macOS | Download the DMG for your architecture and drag PDFuck into Applications. |

Open or drop a document to begin. Change language, theme, paper background, and interface size under **View**; use **Document tabs** to save and restore a group of files.

The 2.1.11 follow-up respects Form and path clips so oversized hidden paths cannot pull body text into figure regions. Explicitly lettered panels share their full caption and one index entry. Off-crop visuals are rejected and partially visible regions are clipped to the page. Shared Lab writes coalesce overlapping diagnostics and retain one latest complete rewrite, with persistence and undo support. Manual annotations, edits and replies remain protected. See the [2.1.11 validation record](tests/docs/VALIDATION-2.1.11.md).

2.1.11 adds breathing room above Lab cancellation controls, places status text 12px from the window edge, and covers the full vertical bounds of CJK selections. Shared detection isolates raster/vector figures, ruled/borderless tables, captions and table notes from body selection while preserving independent selection inside each region. **Figures & tables** shows translucent regions and a separate index entry for each detected visual.

2.1.10 improves automatic column detection for formula-heavy pages and staggered text, fixing both pages of `785904351dabdab98176b914912cc8dd.pdf` while rejecting equation-number gaps. The column toolbar wraps long translations at larger interface sizes in both themes. Tests, fixtures, validation records and generated output now share the root [tests directory](tests/README.md), with no gitignore additions or changes. See the [2.1.10 validation record](tests/docs/VALIDATION-2.1.10.md).

2.1.9 corrects selection overflow where compressed punctuation overlaps the next text run, preserving earlier caret positions across drag directions and zoom levels. The annotation editor shows highlighted source text, surrounding context and page numbers, including separate passages for cross-page annotations and nearby text for notes. Generic open/drop labels use “document” in all ten languages, with both themes and four interface sizes. See the [2.1.9 validation record](tests/docs/VALIDATION-2.1.9.md).

The 2.1.9 follow-up fixes selection and copying of spaces, trailing whitespace, special symbols and spanning legends. Automatic annotation supports **Specific pages**, such as `1-3, 5`; only chosen pages are processed and sent, and progress and reports retain that scope. Export and run controls share a fixed footer. Bookmark hints wrap across the full sidebar width.

Use the new-document icon immediately before **Save** to create a blank Markdown or TXT document. The editor then reminds you to save; the first save asks for a local path. Tab inserts a tab or indents selected lines, Shift+Tab outdents, and Esc moves focus out of the editor. Indentation supports undo and redo.

In 2.1.7, page text supports ordinary additions, newlines, and formatting. Small edits reuse native instructions; paragraph reflow uses the embedded font program, size, baseline, spacing, and column width to produce selectable vector text. Missing glyphs use an indicated fallback font. Preview and saving share the same pipeline, including repeated edits, undo/redo, and reopening. Column selection and visible guides share PDF font metrics and repeated empty gutter corridors. Chromium Type3 subsets are identified by their glyph mappings, with complete font collection and shared width metrics for repeated edits. Save failures keep the draft and show feedback inside the editor without a blocking error dialog. See the [2.1.7 validation record](tests/docs/VALIDATION-2.1.7.md) for causes, focused checks, and packages.

In Markdown and TXT, Ctrl/Cmd+S saves the source; **Save PDF** exports the preview separately. PDF page tools, annotations, OCR, and printing are disabled in editor-only view and available with the PDF preview.

The wrap icon in the source footer switches between horizontal scrolling and wrapping to the editor width, and remembers your choice. The left gutter uses a separate background and smaller, muted digits. Each source line is numbered once; wrapped continuation rows stay blank without changing the document.

Under **Annotations → Lab**, polish, revise, translate, or automatically review source selections. Apply results directly to the source, append full reviews at the end, and undo changes. Ordinary PDF edits and annotations do not change the source. Rebuilding an edited preview requires confirmation, so save the PDF first.

The encoding button supports UTF-8 with or without BOM, UTF-16 LE/BE, GB18030, Big5, Shift JIS, EUC-KR, and Windows-1251/1252. Ambiguous files can be reread using a chosen encoding. Conversion writes on save and rejects unrepresentable characters instead of silently losing text. Original line endings are retained. Counts treat Han characters and Japanese kana individually and other languages as words, excluding whitespace, punctuation, and emoji; Markdown is counted as raw source.

### Optional features and data handling

**AI**: enter an endpoint, API key, and model name under **Annotations → Lab → Model settings**, then activate the configuration. Multiple providers and compatible endpoints are supported; figure interpretation requires an image-capable model.

Ordinary editing, Markdown/TXT rendering, encoding conversion, and OCR run locally. AI features send selected text, document content, or an image region to the active provider.

**Format conversion**: EPS import requires Ghostscript; vector EPS export requires Poppler’s `pdftocairo`. Office import uses Microsoft Office on Windows or LibreOffice across platforms. On macOS, install the EPS tools with `brew install ghostscript poppler`.

### Development

Requires **Node.js 22.4+**:

```bash
npm ci
npm run dev
```

`npm run build` runs type checking, unit tests, translation and typography audits, then creates a production build. See the [packaging guide](PACKAGING_GUIDE.md) for platform builds, signing, and release instructions.

See [tests/README.md](tests/README.md) for test commands, PDF fixtures and validation records. `npm run test:release-2.1.11-visual-bounds` runs the 12 newly added unit cases. New window checks cover the ten-page fixture, two table pages, index navigation and bidirectional copying; this delivery does not run the historical full suite.

The Electron main process in `src/main` handles files, windows, printing, AI requests, and OCR. `src/preload` and `src/shared` provide the secure bridge and shared contracts; `src/renderer/src` contains the React interface.

### Open source and license

Built with [Electron](https://github.com/electron/electron), [React](https://github.com/facebook/react), [PDF.js](https://github.com/mozilla/pdf.js), [pdf-lib](https://github.com/Hopding/pdf-lib), [Tesseract.js](https://github.com/naptha/tesseract.js), [react-markdown](https://github.com/remarkjs/react-markdown), and [remark-gfm](https://github.com/remarkjs/remark-gfm). See [package.json](package.json) for dependencies and the [OCR notice](resources/OCR-NOTICE.txt) for OCR provenance and licenses. Optional converters are installed separately and retain their own licenses.

Licensed under [MIT](LICENSE). © 2026 [leyuwei](https://github.com/leyuwei)
