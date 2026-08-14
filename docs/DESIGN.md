# PDFuck v1.2 设计与架构

版权：Copyright © 2026 github@leyuwei

## 1. 产品结构

界面只保留查看、编辑、批注、保存四个模块：顶部为文件/页码/缩放和窗口控制；左侧为模块与工具；中央为 PDF 画布；批注模式右侧显示可行内编辑的批注列表；底部显示状态和文字选区。

窗口采用无系统外框设计。最小化、最大化/还原和关闭按钮使用独立固定区域置于最右上角，不随中间工具栏宽度移动；标题栏空白区域可拖动窗口。

## 2. 跨平台技术架构

- Electron 43：Windows/macOS 桌面窗口、文件对话框、启动参数与文件落盘。
- React 19 + TypeScript：四模块界面和交互状态。
- Vite/electron-vite：开发、类型检查和生产构建。
- PDF.js：PDF 解析、文字信息和高 DPI 页面渲染。
- pdf-lib：裁切、删页、文字叠加、标准 PDF 批注字典和序列化。
- Canvas：PNG/JPG 编码；RGB PostScript 图像流用于 EPS。

数据流：PDF 字节由主进程读取，经受控 IPC 交给渲染层；pdf-lib 保存编辑模型，每次修改后重新序列化；PDF.js 使用新的字节刷新画布与文字层。业务代码不使用 Windows 专属 API。

## 3. 进程与安全边界

- Renderer 设置 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。
- Preload 每个桌面动作只暴露一个明确方法，不透传 `ipcRenderer`。
- Main process 校验 PDF 扩展名、导出格式、IPC 发送者和目标路径。
- 覆盖保存先写同目录临时文件，再重命名或覆盖替换。
- 禁止渲染层跳转外部页面和创建新窗口；页面使用限制性 CSP。

## 4. 查看器

PDF.js canvas 按 `缩放倍率 × devicePixelRatio` 渲染，CSS 使用逻辑尺寸，因此缩放时不会放大旧截图。连续模式渲染纵向页面栈并随滚动更新当前页；单页模式只挂载当前页。

文字层从 PDF.js TextContent 生成按阅读顺序排列的单词框。批注模式使用 I 形光标，拖动时把首尾命中词之间的单词合并为逐行选区；页面坐标以左上角 PDF 点为统一内部坐标。

## 5. 编辑与批注

- 裁切：将画布框选坐标转换为 PDF CropBox。
- 删除：使用页码多选视窗批量选择，按倒序一次删除；禁止删除全部页面。
- 添加文字：保存为带唯一编号和外观流的 FreeText 对象。拉丁文字使用矢量标准字体外观，中文等字符使用三倍分辨率透明外观；应用覆盖层支持拖动和双击再次编辑完整格式。
- 文本批注：Highlight、Underline、StrikeOut 和替换主题，使用 Rect 与 QuadPoints。
- 位置批注：Text 与 Caret；插入点吸附到最近文字边界并显示小型插入符。
- 批注均写入 Contents、T、NM、M、C、Subj 等标准字段，可保存后重新解析。
- 页面覆盖层负责选择、拖动和双击；列表内容单元格负责双击行内编辑。
- 六类批注在工具栏、右键菜单和批注列表中使用同一套语义化 SVG 图标。

## 6. 保存与导出

- PDF：保留页面编辑与标准批注。
- PNG/JPG：PDF.js 按 72-600 DPI 渲染后由 Canvas 编码。
- EPS：每页写入独立 EPSF 文件，包含 BoundingBox、RGB colorimage 和稳定的多页文件名后缀。

## 7. 验收

- TypeScript 严格检查、Vitest 文档模型/几何/EPS 测试。
- 示例 PDF 实际桌面检查：连续查看、四模块、文字框选、高亮说明、右键菜单、批注列表行内编辑。
- 生产 EXE 启动并打开 PDF；无外框和右上角窗口按钮截图检查。
- Windows 输出为 portable EXE；macOS 预置 DMG 配置，需在 macOS 上执行签名与公证。
