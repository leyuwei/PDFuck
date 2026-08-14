# PDFuck

使用 TypeScript + React + Electron 构建的跨平台 PDF 查看、编辑、批注、打印和导出工具。当前 Windows 版本为 v1.2.0；业务层和构建配置同时支持后续 macOS 打包。

版权声明：Copyright © 2026 github@leyuwei

## 功能

- 查看：连续滚动、单页查看、页码跳转、缩放、适合宽度和高 DPI 重新渲染。
- 打开：按钮、启动参数或从资源管理器/Finder 直接拖入 PDF。
- 编辑：框选裁切、任意多页批量删除；添加文字后可拖动改位，双击可继续修改内容和完整格式。
- 批注：高亮、便笺、替换、插入文字、删除线和下划线，每项均配有独立图标。
- 批注交互：直接框选 PDF 文字；页面右键快捷批注；已有批注可选择、移动和双击编辑。
- 批注列表：单击定位，双击内容单元格直接编辑，Enter 或失去焦点时写回。
- 保存：PDF 保存/另存为；逐页导出 PNG、JPG 或 EPS，支持 72-600 DPI。
- 打印：使用系统打印对话框打印当前尚未保存的编辑结果，支持 Ctrl+P。
- 桌面体验：无系统外框，右上角内置固定的最小化、最大化/还原、关闭按钮，支持未保存保护和 Ctrl+S。

## 直接运行

Windows 便携版无需安装 Node.js：

```text
release/PDFuck-1.2.0-Windows.exe
```

也可以把 PDF 路径作为参数：

```powershell
& .\release\PDFuck-1.2.0-Windows.exe "C:\Documents\example.pdf"
```

## 开发

需要 Node.js 22 或更高版本。

```powershell
npm install
npm run dev
```

常用检查和构建：

```powershell
npm run typecheck
npm test
npm run build
npm run dist:win
npm run dist:mac
```

`dist:mac` 需要在 macOS 上执行，以生成 DMG 并完成签名/公证配置。

## 技术结构

- `src/main/`：Electron 窗口、原生对话框和安全文件写入。
- `src/preload/`：启用 context isolation 的类型化桌面接口。
- `src/renderer/src/`：React 界面、PDF.js 查看器、编辑/批注交互。
- `src/renderer/src/lib/pdf-document.ts`：pdf-lib 文档编辑和标准批注字典。
- `src/renderer/src/lib/export.ts`：PNG、JPG、EPS 导出。
- `PLAN.md`：重构计划和完成定义。
- `PROGRESS.md`：完整迁移留痕和中断恢复记录。

## 导出规则

- 单页文档使用用户选择的文件名。
- 多页文档生成 `文件名_001.png`、`文件名_002.png` 等文件。
- EPS 为每页一个带 RGB 图像流的有效单页 EPS 文件。

添加文字保存为带外观流的 PDF FreeText 对象。拉丁文字保留矢量文字外观；中文等无法由标准 PDF 字体直接编码的文字使用高分辨率透明外观。PDFuck 写入的文字对象保存后重新打开仍可继续移动和编辑；原 PDF 页面始终由 PDF.js 按当前缩放和屏幕像素比重新渲染。
