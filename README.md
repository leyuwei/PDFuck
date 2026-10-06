<img width="1113" height="171" alt="ScreenShot_2026-09-18_114316_102" src="https://github.com/user-attachments/assets/8b1517a2-abdd-4431-a987-ba6768226433" />

# PDFuck

[简体中文](#chinese) · [English](#english)

<img width="2154" height="1352" alt="ScreenShot_2026-09-18_113723_792" src="https://github.com/user-attachments/assets/b2b3b87d-d8b8-4996-8f9d-94c933359fa6" />

<a id="chinese"></a>

## 简体中文

**为论文精读、审稿与修改设计的 PDF 与 Markdown 编辑器。**

支持 Windows、macOS 和十种界面语言，将阅读、写作、编辑与审稿放在同一个工作区。

[下载安装](https://github.com/leyuwei/PDFuck/releases) · [打包指南](PACKAGING_GUIDE.md) · [界面规范](docs/VI-TYPOGRAPHY.md)

### 核心亮点

- **Markdown 写作，直接生成 PDF**：源码与真实 PDF 双栏预览，支持同步滚动、独立撤销和搜索。五种排版模板可自定义字体与间距；生成的 PDF 可继续编辑、批注、打印，源码与 PDF 分别保存。
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

打开或拖入 PDF、Markdown 即可开始。“查看”中可调整语言、主题与界面字号；“文档标签”可保存和恢复一组文件。

Markdown 源码使用 Ctrl/⌘+S 保存，“保存 PDF”单独导出预览。PDF 编辑与批注不会写回源码；预览已有修改时，重新生成需确认，建议先保存 PDF。

### 可选功能与数据处理

**AI**：在“批注 → 实验室 → 模型设置”填写接口地址、API Key 和模型名，并激活配置。支持多个服务商及兼容接口；图片解读需要模型支持图片输入。

普通编辑、Markdown 渲染和 OCR 在本地执行。使用 AI 时，所选文字、文档内容或图片区域会发送给当前激活的服务。

**格式转换**：EPS 导入需要 Ghostscript，矢量 EPS 导出需要 Poppler 的 `pdftocairo`；Office 导入可使用 Windows 上的 Microsoft Office，或跨平台的 LibreOffice。macOS 可通过 `brew install ghostscript poppler` 安装 EPS 工具。

### 开发

需要 **Node.js 22.4+**：

```bash
npm ci
npm run dev
```

`npm run build` 执行类型检查、单元测试、多语言与字号审计，再生成生产构建。平台打包、签名和发布流程见 [打包指南](PACKAGING_GUIDE.md)。

Electron 主进程位于 `src/main`，负责本地文件、窗口、打印、AI 请求与 OCR；`src/preload` 和 `src/shared` 提供安全桥接与共享契约；React 界面位于 `src/renderer/src`。

### 开源与许可

基于 [Electron](https://github.com/electron/electron)、[React](https://github.com/facebook/react)、[PDF.js](https://github.com/mozilla/pdf.js)、[pdf-lib](https://github.com/Hopding/pdf-lib)、[Tesseract.js](https://github.com/naptha/tesseract.js)、[react-markdown](https://github.com/remarkjs/react-markdown) 和 [remark-gfm](https://github.com/remarkjs/remark-gfm) 构建。完整依赖见 [package.json](package.json)，OCR 来源与许可见 [OCR 说明](resources/OCR-NOTICE.txt)。可选转换工具由用户另行安装，遵循各自许可证。

本项目采用 [MIT 许可证](LICENSE)。© 2026 [leyuwei](https://github.com/leyuwei)

---

<a id="english"></a>

## English

**A PDF and Markdown editor for close reading, peer review, and revision.**

Available on Windows and macOS in ten interface languages. Read, write, edit, and review in one workspace.

[Download](https://github.com/leyuwei/PDFuck/releases) · [Packaging guide](PACKAGING_GUIDE.md) · [Interface guidelines](docs/VI-TYPOGRAPHY.md)

### Highlights

- **Write Markdown, work with real PDFs**: edit source alongside a PDF preview, with synchronized scrolling, independent undo, and search. Customize five layout templates, then edit, annotate, or print the generated PDF. Save source and PDF separately.
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

Open or drop a PDF or Markdown file to begin. Change language, theme, and interface size under **View**; use **Document tabs** to save and restore a group of files.

In Markdown, Ctrl/Cmd+S saves the source; **Save PDF** exports the preview separately. PDF edits and annotations do not change the source. Rebuilding an edited preview requires confirmation, so save the PDF first.

### Optional features and data handling

**AI**: enter an endpoint, API key, and model name under **Annotations → Lab → Model settings**, then activate the configuration. Multiple providers and compatible endpoints are supported; figure interpretation requires an image-capable model.

Ordinary editing, Markdown rendering, and OCR run locally. AI features send selected text, document content, or an image region to the active provider.

**Format conversion**: EPS import requires Ghostscript; vector EPS export requires Poppler’s `pdftocairo`. Office import uses Microsoft Office on Windows or LibreOffice across platforms. On macOS, install the EPS tools with `brew install ghostscript poppler`.

### Development

Requires **Node.js 22.4+**:

```bash
npm ci
npm run dev
```

`npm run build` runs type checking, unit tests, translation and typography audits, then creates a production build. See the [packaging guide](PACKAGING_GUIDE.md) for platform builds, signing, and release instructions.

The Electron main process in `src/main` handles files, windows, printing, AI requests, and OCR. `src/preload` and `src/shared` provide the secure bridge and shared contracts; `src/renderer/src` contains the React interface.

### Open source and license

Built with [Electron](https://github.com/electron/electron), [React](https://github.com/facebook/react), [PDF.js](https://github.com/mozilla/pdf.js), [pdf-lib](https://github.com/Hopding/pdf-lib), [Tesseract.js](https://github.com/naptha/tesseract.js), [react-markdown](https://github.com/remarkjs/react-markdown), and [remark-gfm](https://github.com/remarkjs/remark-gfm). See [package.json](package.json) for dependencies and the [OCR notice](resources/OCR-NOTICE.txt) for OCR provenance and licenses. Optional converters are installed separately and retain their own licenses.

Licensed under [MIT](LICENSE). © 2026 [leyuwei](https://github.com/leyuwei)
