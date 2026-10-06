# PDFuck 2.1.4 验收记录

日期：2026-10-06。Windows x64；Electron 43.4.0、electron-builder 26.15.3。清单与锁文件同步为 2.1.4，无新增依赖。编码前方案见 `docs/PLAN-2.1.4.md`。

## 改动与原因

- 原搜索窗处在 Markdown 工作区中，被 `.md-workspace input` 的 100% 宽度、padding 等通用样式影响，checkbox 占用异常空间，裸选项文字逐字换行。现提取共享 SearchPanel，通过 portal 放到 app-shell 内、与 Markdown 工作区平级，既隔离表单样式，也继承应用主题、自定义强调色、全局字号及 RTL。
- 窗宽按正文字号增长并受视区限制。输入/按钮允许整组换行，选项是可点击的完整块，16px 原生 checkbox 不压缩，长文字自然换行。标题及关闭入口固定、正文可滚动；复用浮窗拖动、标题栏避让和实际尺寸约束。只使用既有三档 UI 字号。
- Markdown 工作区与全局搜索入口按最近操作区域/当前单栏路由。Ctrl/⌘+F 在源码中可用，源码单栏不依赖 PDF。复用 PDF 的大小写、忽略空白的模糊匹配、正则和十项预设；源码显示行号，结果按 UTF-16 原始偏移选中，滚到匹配处，不修改正文及历史。PDF 保留页码、跨页定位及文字高亮。
- 搜索输入框中 Enter/Shift+Enter 遍历结果，按钮可前后跳转，重复 Ctrl/⌘+F 聚焦当前输入；Escape/关闭恢复原焦点。窗口互斥，IME Enter 不搜索，源码修改取消旧任务并清空结果，文档切换使用独立实例。最多显示 200 条，多余结果显示 200+。
- 目视成品后补做结果行号/页码对比度修正：明暗主题分别混入深色/白色，让极亮、极暗自定义强调色也保留清晰正文。该修正只改变结果标题颜色；已通过功能与布局检查保留，新增颜色阶段定向验证并重新打包。

## 本次新增检查

1. `src/renderer/src/lib/release-2.1.4.test.ts` 的 6 项通过：字面标点/大小写/重复次数、空白折叠与 emoji/Unicode 的原始范围、多行及阿拉伯语、正则错误/零宽匹配、结果上限/空输入、十语言新增文案。初次一项断言中的手工偏移数值错了一位，修正后仅重跑该项，未重复其余五项。
2. `node scripts/release-2.1.4-search-ui.cjs --checks=behavior,layout,pdf` 通过：实际 Ctrl+F、深处精确选择/滚动、重复聚焦、Enter/Shift+Enter、Escape/关闭恢复焦点、大小写、跨换行中文模糊/严格匹配、无结果、错误/有效正则和预设、编辑后失效/撤销、源码单栏、源码/PDF 窗口互斥、生成 PDF 与普通两页 PDF 的跨页高亮。
3. 同次布局检查共 160 组：十语言 × 双主题 × 四字号（12/13/16/18 正文）× 1280×900 与 1080×700 窗口。以真实文字 Range 核对每个选项文字、checkbox 和外框边界，checkbox 保持 16×16，未出现逐字挤压。补充 serif、monospace、Segoe UI 字体族及 480×500 压力视区，正文可滚动、关闭入口可达。截图 `output/playwright/release-2.1.4-zh-light.png`、`release-2.1.4-fr-dark.png` 已目视核对。
4. `--checks=accessibility` 通过：IME Ctrl+F 不拦截、Meta+F 对应逻辑、IME Enter 不搜索、Tab 顺序、拖动到视区边缘仍避开标题栏、自定义强调色继承、工具面板搜索路由。Meta 测试验证 Windows Chromium 中的键盘逻辑，不等同 macOS 实机验收。
5. `--checks=contrast` 通过 6 组：双主题 × 默认/黑/白强调色，结果标题文字对比度至少 4.5:1。检查等待既有主题颜色过渡结束后再读取像素色值。颜色修正后不重跑已通过的其他阶段。
6. `--checks=navigation` 通过：首次 Shift+Enter 从最后一个匹配开始，随后 Enter 正确绕回第一个；修正仅涉及未激活结果时的初始反向索引。
7. 必要 `npm run typecheck`、生产 `npx --no-install electron-vite build`、`git diff --check` 通过。构建中的 PDF.js 资源 URL 提示沿用现有构建逻辑，对应 WASM/CMap/字体已复制并纳入成品资源核验。

结果文件：`output/playwright/release-2.1.4-search-behavior-layout-pdf.json`、`release-2.1.4-search-accessibility.json`、`release-2.1.4-search-contrast.json`、`release-2.1.4-search-navigation.json`。失败后仅修正有关实现或检查时序/选择器并复测受影响的本次阶段，未执行旧版本测试全集或一键发布脚本。

## Windows 交付

- 安装版：`release/PDFuck-2.1.4-Windows-Setup.exe`
- 便携版：`release/PDFuck-2.1.4-Windows.exe`
- 解包程序：`release/win-unpacked/PDFuck.exe`

直接以 `npx --no-install electron-builder --win --config.electronDist=node_modules/electron/dist` 生成。新增 `scripts/release-2.1.4-search-packaged.cjs` 已实际启动解包 EXE、便携 EXE 和便携重启：Unicode Markdown 参数、界面版本、源码单栏 Ctrl+F、精确深处选择/滚动、重复聚焦、Escape、中文模糊匹配、原生深色主题继承和持久化均通过。报告为 `output/playwright/release-2.1.4-search-packaged.json`。

最后仅执行新增 `node scripts/release-2.1.4-search-packaged.cjs --checks=contrast,navigation`，解包版、实际便携版及便携重启均通过：真实深色结果标题对比度至少 4.5:1，首次 Shift+Enter 到最后一个匹配，Enter 绕回第一个。报告为 `output/playwright/release-2.1.4-contrast-packaged.json`，最终截图已目视检查。未重复旧测试全集或前轮已通过的无关阶段。

最终 app.asar 版本为 2.1.4，210 个生产文件与最终构建逐字节一致，包含 11 个 OCR 模型及许可；原生打印 PDFium DLL、Koffi、ESM 补丁及许可证存在。安装/便携产品版本为 2.1.4，解包 EXE 为 2.1.4.0，三项签名均为 NotSigned。

发布清单为 `release/PDFuck-2.1.4-Windows-release.json`，三项 SHA-256 为 `release/PDFuck-2.1.4-Windows-SHA256SUMS.txt`。最终资源核验报告为 `output/playwright/release-2.1.4-resources.json`。

安装器资源、已有安装提示、文件关联沿用原配置；按此次用户范围未重复旧安装/卸载/关联测试，未修改本机已安装应用或默认文件关联。没有发布 GitHub Release。Windows 本机不构建或宣称 macOS 实机验收。三个 EXE 没有可信 Authenticode 签名，Windows SmartScreen 可能显示未知发布者提示。

## 最终 SHA-256

| 成品 | 字节数 | SHA-256 |
| --- | ---: | --- |
| Windows-Setup.exe | 221799827 | `669BFA696DB4D2338C592B8DDFF2F47872C630D6CBDBB39EB880FA5DB4CEE9AF` |
| Windows.exe | 221416726 | `9A02A56AD4D17F345D0AAEE68B5B2B155946275EDDCEB64D83253863A2F60655` |
| win-unpacked/PDFuck.exe | 225589248 | `79E4063631C62CA392D748DB546FDC89BBA3FE2BA65B52E700ADD169DD0012FF` |
