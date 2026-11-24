# PDFuck 2.2.2 大 PDF 编辑、导出与打印

## 实现方案

PDF.js 继续按需读取文档索引和普通页面。请求超过单次读取上限时，Windows 页面预览和故事板可以切换到独立进程里的 PDFium。每页平均文件体积达到 96 MiB 时优先使用 PDFium。PDFium 直接打开磁盘路径，仅将有尺寸上限的预览图传回主窗口。进程异常退出或超时后，界面提供重试。

对工业图纸，决定内存峰值的还包括解压后的内容流、图像以及绘制对象数。按页或按字节分段只能控制读入范围。区域渲染可以缩小输出位图，但 PDFium 的页面解析仍可能解码整条内容流。了解实现边界可参见 [PDFium 文件与渲染 API](https://pdfium.googlesource.com/pdfium/+/refs/heads/main/public/fpdfview.h) 和 [PDFium 页面内容解析](https://pdfium.googlesource.com/pdfium.git/+/refs/heads/chromium/7827_22/core/fpdfapi/page/cpdf_contentparser.cpp)。

也调研了 Windows 原生 PDF API 的局部渲染与 MuPDF 的显示列表。两种方案仍需要区分页面解析和输出图像，对原始绘图对象的内存峰值没有通用保证。Windows 交付复用已经随打印模块提供的 PDFium。 [Windows 局部渲染 API](https://learn.microsoft.com/en-us/uwp/api/windows.data.pdf.pdfpagerenderoptions.sourcerect) · [MuPDF 显示列表说明](https://mupdf.readthedocs.io/_/downloads/en/1.26.1/pdf/)

编辑时把连续页送入现有编辑器，单次载入上限为 96 MiB。Windows 单页超限时，编辑器提供基于原页预览的叠加编辑，可以添加文字、图形或位置批注。原始图纸路径仍保存在完整 PDF 中，原图内容不可在此模式下逐对象改写。页面管理对完整文档执行重排、旋转和删除。保存通过同目录临时文件写入完整副本，保留已打开的源文件。

QPDF 12.4.2 在独立进程里读取和写出 PDF 对象，使用原始流保留选项。局部编辑会替换对应页，单页叠加则作用于原页。被替换或移除页涉及的书签与文档级表单等元数据受 QPDF 页操作限制。PDF 可合并选页或逐页导出，PNG 与 JPG 按页编码，EPS 使用已有的 Poppler 磁盘转换路径。 [QPDF 页操作与元数据限制](https://qpdf.readthedocs.io/en/latest/cli.html) · [QPDF 12.4.2 官方发行](https://github.com/qpdf/qpdf/releases/tag/v12.4.2)

打印沿用既有的选页、拼版及驱动接口，分批生成数据。超出 PDF 编辑载入上限的打印批次，按页生成受像素预算约束的打印图像。向物理打印机输出的效果仍取决于驱动和设备。

## 专项输入与验收口径

- 多页样本包含 145 页和分散的 JPEG 2000 图像及资源，约 1,096 MiB。检查跨页跳转、编辑第 5 页后保存 145 页完整副本、源文件时间戳、导出 PDF / PNG / EPS、两页打印任务及全文件删除一页。
- 单页样本包含 50,000 条三段折线和位于约 1 GiB CAD 式注释记录两侧的绘图指令。大字节区位于单页实际引用的内容流中，后半段的红色图形用于验证解析完整性。它模拟超大内容流，而真实工业图纸的对象密度、压缩率、透明层与图像编码组合仍有差异。
- 单页路径检查页面像素、故事板缩略图、矢量 PDF 导出、栅格打印中间文件，以及写入叠加后图形对象和超大原始流的存在。
- 界面检查在阿拉伯语、深色主题、最大预置字号下打开页码范围，确认 RTL 布局与阿拉伯数字、全角数字输入。新增文案接入现有十语言目录。
- 打印验证止于驱动提交接口，使用测试替身接收并检查生成的 PDF。成品交付后仅记录静态文件元数据与 SHA-256。

2026-11-24 的 Windows x64 源码验收通过。1,040 MiB 单页样本从发出打开请求到首帧完成耗时 1,385 ms。该数字来自本机的一次合成样本开页，受磁盘、缓存、可用内存和绘图对象复杂度影响。两个打印任务分别收到 2 页和 1 页。源码窗口重新打开叠加后的完整 PDF，并确认包含新增文字、外观对象和超过 1 GiB 的原始内容流。类型检查及生产构建通过。

## 命令

以下命令在 Windows x64 上执行。合成 JPEG 2000 依赖 Python Pillow，EPS 专项依赖系统提供的 pdftocairo。

```powershell
node scripts/prepare-qpdf.cjs
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.2-large-operations-ui.cjs
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
node tests/scripts/release-2.2.2-package-check.cjs --large-operations --source-only
```

源码结果写入 `tests/output/release-2.2.2-large-operations/results.json`。试验输入和中间 PDF 放在隔离临时目录，测试结束后清理。
