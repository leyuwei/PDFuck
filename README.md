# PDFuck

[简体中文](#chinese) · [English](#english) · [下载 / Download](https://github.com/leyuwei/PDFuck/releases)

<a id="chinese"></a>

**为论文精读、审稿与修改设计的 PDF 编辑器。** 支持 Windows、macOS 和十种界面语言。

## 核心亮点

- **专门处理复杂论文版式的框选**：兼顾双栏、行内公式、上下标与跨页选区；支持手动校正栏界，复制时自动整理断行与断词。
- **AI 审稿直接生成文内批注**：对全文或选区逐项检查语言、逻辑、数学推导和篇章结构；可选择批注力度、添加自定义标准，并随时暂停、继续。
- **结合原文生成修改建议**：从批注位置自动提取附近正文，也可加入多段选区作为上下文。建议在同一编辑窗口中填入回复草稿，确认后保存到 PDF。
- **把批注变成可跟进的修改清单**：区分批注人，用“已处理／想一想／不做了”标记处理状态；按进度统计快速定位批注，再回到原文核查，回复随 PDF 保存。
- **扫描件也能原位框选与复制**：OCR 在本地识别所选页码，支持中英等 11 种主要语言，自动纠斜、低置信度复识别并整理中文/日文伪空格。隐形文字随 PDF 保存，页面外观保持不变，识别结果可撤销。
- **按论文结构找内容**：一键定位图表，将文中引用关联到参考文献，自动识别章节书签，减少来回翻页。
- **衔接论文插图的 EPS 工作流**：支持 EPS 导入，将编辑后的 PDF 导出为保留文字与矢量路径的 EPS，方便后续排版。

## 安装与配置

- **Windows**：从 [Releases](https://github.com/leyuwei/PDFuck/releases) 下载 `Windows-Setup.exe` 安装；`Windows.exe` 为便携版。
- **macOS**：下载对应 DMG，将 PDFuck 拖入 Applications。各平台产物以 Releases 实际提供的文件为准。
- **日常使用**：打开 PDF 即可阅读、编辑与批注。“查看”中可切换语言、主题和界面字号；字号支持预览后确认，不影响 PDF 缩放。
- **OCR**：“编辑 → OCR 识别”设置页码范围和主要语言。引擎与语言数据随包内置，无需联网、配置 AI 或另装 OCR 软件。
- **AI（可选）**：在“批注 → 实验室 → 模型设置”中保存多个命名配置，填写接口地址、API Key、模型名后点击“激活此模型”。顶部摘要显示实际使用的配置与模型；实时过程按请求、思考和回复分区显示。支持 OpenAI、Claude、Grok、BigModel、Doubao、DeepSeek、KIMI 和自定义兼容接口；保存其他配置不会切换当前模型。启用 AI 时，所选原文或全文会发送给激活的服务；普通编辑与 OCR 在本地执行。
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

## Highlights

- **Selection built for complex papers**: Handles two-column layouts, inline equations, superscripts, subscripts, and cross-page selections. Correct column boundaries manually; copying cleans up line breaks and split words.
- **AI review that becomes in-document annotations**: Check a whole paper or a selection for language, logic, mathematical reasoning, and structure. Choose review intensity, add custom criteria, and pause or resume the review.
- **Revision advice grounded in the source**: Automatically collect nearby text from an annotation’s position, or add multiple selections as context. Use suggestions in a reply draft within the same editor, then confirm to save them into the PDF.
- **Annotations you can follow through**: Identify reviewers and mark each item as Done, Think about it, or Won’t do. Use progress counts to find annotations, return to the source to verify changes, and keep replies in the PDF.
- **Select and copy scanned pages in place**: Local OCR supports selected page ranges and 11 primary languages, deskewing, a low-confidence retry, and removal of spurious Chinese/Japanese spaces. Invisible text is saved inside the PDF while preserving its appearance, with undo support.
- **Navigate by the paper’s structure**: Find figures and tables in one click, link citations to references, and recognize section bookmarks.
- **An EPS workflow for research figures**: Import EPS files and export edited PDFs to EPS while retaining text and vector paths for subsequent typesetting.

## Installation and configuration

Download the Windows installer/portable executable or the macOS DMG from [Releases](https://github.com/leyuwei/PDFuck/releases). Available builds are listed there. Open a PDF to start; language, theme, and previewable interface font sizes are under **View**.

**OCR** is under **Edit**: choose pages and a primary language. The engine and language data are bundled for offline use. Recognition can still need proofreading, particularly for noisy scans, formulas and mixed scripts.

**AI is optional**: under **Annotations → Lab → Model settings**, save named configurations and explicitly activate one. The summary identifies the active configuration and model; live activity separates the request, reasoning and response. Providers include OpenAI, Claude, Grok, BigModel, Doubao, DeepSeek, KIMI and custom compatible endpoints. Saving an inactive configuration does not switch models. Configure Thinking mode/effort, Claude's thinking budget, sampling, penalties, Seed and advanced JSON. Defaults are 600 seconds and 65,536 output tokens; configurable maxima are 3,600 seconds and 262,144 tokens, subject to provider limits. Recovery handles rejected parameters and truncation; Thinking fallback can be disabled. Only reasoning actually returned by the provider is displayed. AI sends the selected text or document to the active provider; ordinary editing and OCR run locally.

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
| [react-markdown](https://github.com/remarkjs/react-markdown)、[remark-gfm](https://github.com/remarkjs/remark-gfm) | AI 建议排版 / Formatting AI suggestions | MIT |
| [windows-pdf-printer-native](https://github.com/ClemersonAssuncao/windows-pdf-printer-native)、[Koffi](https://github.com/Koromix/koffi)、[PDFium](https://pdfium.googlesource.com/pdfium/) | Windows 原生打印 / Native Windows printing | MIT；PDFium 为 BSD 风格 / BSD-style |
| [Vite](https://github.com/vitejs/vite)、[electron-vite](https://github.com/alex8088/electron-vite)、[electron-builder](https://github.com/electron-userland/electron-builder)、[Vitest](https://github.com/vitest-dev/vitest)、[Playwright](https://github.com/microsoft/playwright) | 构建、打包与测试 / Build, packaging, and tests | MIT / Apache-2.0 |

感谢 [Ghostscript](https://www.ghostscript.com/)、[Poppler](https://poppler.freedesktop.org/) 和 [LibreOffice](https://www.libreoffice.org/) 提供可选格式转换能力。它们由用户另行安装，分别遵循其自身许可证。完整依赖版本见 [package.json](package.json) 与锁文件；OCR 来源说明随安装包提供，也可查看 [OCR NOTICE](resources/OCR-NOTICE.txt)。

Optional converters Ghostscript, Poppler, and LibreOffice are installed separately and retain their own licenses. Dependency versions are pinned in the package manifests; OCR provenance is included with the app and in [OCR NOTICE](resources/OCR-NOTICE.txt).

---

[MIT License](LICENSE) · © 2026 [leyuwei](https://github.com/leyuwei)
