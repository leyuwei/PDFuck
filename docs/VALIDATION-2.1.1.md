# PDFuck 2.1.1 验收记录

日期：2026-10-05。环境：Windows x64、Node.js 22.22.2、Electron 43.4.0、electron-builder 26.15.3。清单和锁文件同步为 2.1.1，无新增依赖。

## 本次改动

- 快捷插入入口仅显示 `+`，紧接常用语法工具；普通宽度同排，窄栏紧凑换行。新增下划线工具，另存为图标的箭头与右上角对齐。
- 源码停止修改 1.5 秒后更新 PDF。输入法组字期间暂停；每个文档最多一个渲染请求，过期结果不替换预览，失败后不自动循环重试。已有 PDF 编辑仍暂停自动替换，显式刷新沿用原确认机制。
- 源码支持 Ctrl/⌘+B、I、U、E、K 和 Shift+X：加粗、斜体、下划线、行内代码、链接、删除线。保留编辑选区；键盘事件不触发 PDF 的同名快捷键。下划线仅识别无属性的成对 `<u>`，其他原始 HTML 和脚本仍禁用。
- 五模板每页底部显示 `当前页 / 总页数`，使用 Chromium 页边距计数器，无额外 PDF 重写或依赖。
- 拖拽比例按实际栏宽计算、保存；打开另一 Markdown 和重启后恢复。源码输入不再重复写入未改变的排版偏好。
- Markdown 工作区和浮窗按钮共用应用内悬浮/焦点提示，图标按钮带可访问名称，语法提示附快捷键；提示脱离栏内滚动裁切，支持十语言、双主题和四档字号。
- Windows Setup/卸载器使用软件 ICO，安装页采用同一 Logo 的 BMP；安装前显示有无已有版本、版本号和路径，说明继续更新时保留用户设置。生产 NSIS 状态页只读既有安装记录。

## 执行结果与范围

1. `npm run typecheck`、生产构建和 `git diff --check` 通过。
2. 新增 `src/renderer/src/lib/release-2.1.1.test.tsx`：4 项通过，覆盖下划线选区及安全渲染、Windows/macOS 快捷键和 IME/修饰键、跨排版更新的比例偏好、十语言下划线文案。
3. 新增 `scripts/release-2.1.1-ui-smoke.cjs` 分阶段通过：连续输入重置 1.5 秒计时、组字保护、单个在途请求、过期结果和失败保护；真实六类快捷键和选区恢复；80 组十语言 × 双主题 × 四字号布局及真实鼠标提示；窄栏无横向溢出；拖拽到约 63% 后打开其他文档与重启恢复。
4. 五种实际多页 PDF 逐页验证底部页码：简洁 4 页、学术 5 页、商务 5 页、书刊 5 页、技术 4 页，共 23 页。每页均包含正确当前页和总页数，页码位于正文下方。PDF 与界面截图保存在 `output/playwright/release-2.1.1-*`；工具栏、窄栏截图已目视检查。
5. 新增 `scripts/windows-installer-check.ps1`：无安装、HKCU 2.0.99 测试安装、失效记录和本机 HKLM 2.1.0 安装四种状态通过。复用生产 NSIS include、全部十种语言编译，测试页使用 64-bit 注册表视图。仅创建/清理唯一 HKCU 测试键，已有 `C:\Program Files\PDFuck` 只读，未执行真实安装/更新/卸载。最终 Setup EXE 的 32px 图标通过系统提取，与源 ICO 逐像素相同。
6. 新增 `scripts/release-2.1.1-packaged-smoke.cjs`：解包 EXE、实际便携 EXE 及便携重启均通过；Unicode `.md` 参数、界面 2.1.1、完整源码、真实可选文字 PDF、纯 `+` 按钮正常，便携重启恢复 50% 分栏。
7. 最终包内运行时清单、主进程/预加载/界面资源与本轮生产构建一致；11 种 OCR 数据、OCR 工作线程、Tesseract.js-core、原生打印补丁、PDFium、许可证和 Koffi 存在。版本与哈希见 release JSON 和 SHA256SUMS。

仅执行此次新增测试和必要类型/构建/成品检查；没有运行旧单元测试全集、旧 UI 回归或一键完整发布脚本。macOS 成品未在 Windows 上构建或宣称实机验证。Windows 真实 UAC、旧安装更新、文件关联与卸载需在目标环境人工抽检。

## Windows 交付

- `release/PDFuck-2.1.1-Windows-Setup.exe`：安装版，产品版本 2.1.1。
- `release/PDFuck-2.1.1-Windows.exe`：便携版，产品版本 2.1.1。
- `release/win-unpacked/PDFuck.exe`：解包程序，产品版本 2.1.1.0。
- `release/PDFuck-2.1.1-Windows-release.json`、`release/PDFuck-2.1.1-Windows-SHA256SUMS.txt`：资源检查、测试范围、大小、SHA-256 和签名状态。

三项 EXE 的 Authenticode 状态均为 `NotSigned`；当前没有可信代码签名证书，Windows 可能显示未知发布者提示。未发布 GitHub Release，也未替换本机已有安装。README 与 PACKAGING_GUIDE 已同步；安装器资源生成、稳定 GUID、双安装范围检测、注册表视图及后续版本验收方式均已写入指南。
