# PDFuck 2.1.5 验收记录

日期：2026-10-06。Windows x64；Electron 43.4.0、electron-builder 26.15.3。清单与锁文件同步为 2.1.5。

## 实现与验收范围

沿用 Markdown 的文档状态、源码历史、搜索、分栏、排版模板、PDF 渲染及实验室窗口；不另建 TXT 编辑引擎。编码转换使用直接运行时依赖 `iconv-lite` 0.6.3，统计检测新增 `chardet` 2.2.0。

| 用户要求 | 实现及新增验收 |
| --- | --- |
| TXT 编辑与生成 PDF | 打开、拖入、命令行、最近文件和标签支持 TXT；转义并保留纯文本，禁用 Markdown 语法插入；真实导出 PDF 并读取页数、检查字面文字。 |
| TXT/Markdown 编码适配与转换 | BOM、严格 UTF-8、常见传统编码检测；十种编码选择、重新读取和转换保存；保留换行；不能无损表示字符时拒绝写入，原文件保持原字节。 |
| 全文及选区字数 | 下方状态栏显示全文、选区和编码；真实键盘框选、源码搜索定位及多语言计数验证。 |
| 强制左侧行号 | 原生 textarea 共用虚拟行号，按逻辑行显示；默认横向滚动，可开启自动换行，续行留白。独立主题底色、较淡且稍小的数字；十语言包括 RTL 时固定在左侧。 |
| 实验室写回文字文档 | 选区润色、修订、翻译替换选区；全文评价追加文末；自动检查按原文范围应用替换/插入/删除及评价；进入现有撤销历史；拒绝过期、重叠及不确定的目标。 |
| 仅编辑器视图功能边界 | 页面、缩放、PDF 编辑/批注、OCR、图片区域和打印入口禁用，PDF 专用面板隐藏；搜索、主题、原文保存和文字 AI 功能保留。 |
| 背景/主题/字号 | 共用每文档纸张背景，自动选择黑/白正文颜色；四种背景的文字对比度至少 4.5:1；十语言 × 双主题 × 四字号共 80 组布局，追加 S/M/L 行号与正文一致检查。 |
| 文档类型文案 | 保存模块区分 TXT/Markdown 原文和 PDF 预览；窗口、最近文件、搜索、编辑器、主题提示适配类型；实验室不再指导添加批注/回复或显示虚构 PDF 页码。 |

图片解读和画板属于 PDF 预览操作，在仅编辑器视图禁用；图片解读结果用于文字文档时可追加原文。PDF 预览的独立编辑保护、保存方式沿用现有机制。

## 本次新增测试

仅执行本次新增测试及必要类型、构建、资源检查；未执行旧版本测试全集或 `npm run build`、一键发布脚本。修复后只重测本次受影响阶段。

- `src/main/release-2.1.5.test.ts`：3 项通过。Unicode BOM/UTF-16 无 BOM/代表性传统编码检测；十种编码无损往返、不可表示字符保护及无效输入；TXT/Markdown 打开、CRLF 标准化与元数据、TXT PDF 渲染路径。
- `src/renderer/src/lib/release-2.1.5.test.tsx`：5 项通过。TXT 字面渲染与 HTML 转义；多语言字数；精确选区写回、评价追加、撤销和过期保护；自动检查原文块解析、范围、重叠、移动目标和分块；新增文案十语言及占位符一致性。文案增加后仅重测文案项。
- `scripts/release-2.1.5-ui.cjs --checks=editor`：TXT/Markdown 真实打开、搜索、选区计数、虚拟行号滚动、TXT 禁用语法、仅编辑器工具边界、保存标题、真实 PDF 导出和字面预览，通过。
- `--checks=encoding`：GB18030 检测、CRLF 编辑偏移、UTF-16 LE 转换/BOM、实际保存、显式重新读取、TXT 另存筛选和 Unicode 路径、失真保存拒绝且原文件不变，通过。
- `--checks=lab`：TXT/Markdown 润色、修订建议、全文评价、翻译和选区自动修改，分别写回、撤销；全文评价请求期间修改原文后拒绝旧结果；没有创建 PDF 批注，通过。AI 接口使用确定性本地模拟，未上传用户数据或消耗模型额度；本次没有验证真实服务商输出质量。
- `--checks=layout`：80 组语言/主题/界面字号布局，含阿拉伯语；状态栏边界、左侧行号和行高；黑、白、灰、淡黄色纸张对比度，通过。
- `--checks=labels`：TXT/Markdown 实验室自动检查配置不含批注操作提示，翻译说明符合选区替换、修订建议隐藏 PDF 页码，通过。
- `--checks=policy`：TXT/Markdown 修订建议即使使用自定义提示，也在请求末尾保留仅输出可替换选区文字的约束，通过。自动检查活动与暂停/结束状态使用文字文档提示。
- `--checks=font`：首次验收时编辑器 S/M/L 在深浅主题中与行号字号、行高一致，通过。后续修正改为行号字号 90%、行高一致，由新增换行 UI 检查覆盖；此阶段断言已同步调整，未重复运行。
- `--checks=boundary`：TXT/Markdown 仅编辑器视图的 Ctrl+P 在编辑器及工具栏焦点下均被拦截；切回 PDF 后可打开打印设置；工具栏焦点下 Ctrl+S 保存原文，顶部保存按钮只使用原文脏状态，通过。最终目视后补齐 PDF 导航、批注及复制快捷键的视图守卫和监听器依赖；没有重复其他已通过阶段。
- `npm run typecheck`、`npx --no-install electron-vite build` 通过。PDF.js 资源 URL 提示沿用既有构建逻辑，对应资源纳入最终包核验。

界面报告及截图位于 `output/playwright/release-2.1.5-*`，编辑器阶段早期报告为 `release-2.1.5-ui.json`，其余阶段使用独立文件名。

## 使用边界

无 BOM 的短文件可能存在多个有效编码解释，自动检测属于推断；编码按钮提供显式重新读取。每个文字文件大小限制沿用 5 MB。编辑器内部统一 LF 以保持原文选区偏移，保存恢复原有换行格式。

字数按汉字和日文假名逐字、其他语言按词统计，数字词计入；不计空白、标点和 emoji。Markdown 按原始文字计数。行号以逻辑行显示，底栏可切换长行横向滚动/自动换行；软换行不插入换行符，偏好跨文件和重启保留。

Windows 本机交付安装版、便携版和解包 EXE；macOS 的 TXT 关联配置已更新，尚未进行 macOS 构建或实机验收。本次未修改本机默认文件关联，也未运行旧安装/卸载测试。

## Windows 成品验收

### 2.1.5 后续界面修正

编码弹窗的两组下拉框和动作按钮共用高度、字号、行高与内边距。行号栏使用独立主题底色、边界及较淡的数字，数字字号为正文的 90%，行高一致。底栏新增同风格 28px 自动换行图标；默认关闭，开启后按源码视区软换行，每个逻辑行只在首行编号，续行留白。文档内容不因切换而改变。

新增 `src/renderer/src/lib/source-editor-layout.test.ts` 一项通过：UTF-16 原文偏移、连续/末尾空行以及严格布尔换行偏好。仅定向重验 `release-2.1.5.test.tsx` 的新文字消息翻译检查，十语言新增换行标签/提示及占位符一致性通过，其余四项跳过。先前通过的 2.1.5 验收结果保留。

新增 `scripts/release-2.1.5-wrap-ui.cjs` 通过 TXT/Markdown 的真实软换行、长行续行留白、首尾滚动、20/70% 分栏、S/M/L、选区保留、空行输入/撤销、搜索定位及跨文档偏好检查。使用独立原生 textarea 前缀排版核对每个可见行号的位置，误差不超过 1.2px；实现读取 DOM Range 的实际位置，避免长文档小数行高累积漂移。十语言 × 双主题 × 四界面字号共 80 组中，编码控件高度与上下边缘一致，换行无横向溢出，行号栏固定左侧且与正文颜色/底色区分，对比度至少 4.5:1。报告为 `output/playwright/release-2.1.5-wrap-ui.json`，目视截图为 `output/playwright/release-2.1.5-wrap-editor.png`。

后续修正重新打包后，`node scripts/release-2.1.5-packaged.cjs --checks=wrap` 实际启动解包程序、便携版和便携重启，三次均通过：原生换行和长文档稀疏行号对齐，编码弹窗控件等高且上下对齐，28px 图标尺寸与周围一致，行号背景/文字区分；自动换行、仅源码视图、深色主题与 L 档偏好跨启动保留，原文及保存脏状态不被切换改动。报告为 `output/playwright/release-2.1.5-wrap-packaged.json`。生产资源重新核验 210 个文件一致。

后续修正仅补测上述新增项目、类型检查、生产构建及最终成品/资源验证，没有重跑旧功能全集。

使用 `npx --no-install electron-builder --win --config.electronDist=node_modules/electron/dist` 打包，交付 `release/PDFuck-2.1.5-Windows-Setup.exe`、`release/PDFuck-2.1.5-Windows.exe` 和 `release/win-unpacked/PDFuck.exe`。

新增 `scripts/release-2.1.5-packaged.cjs` 实际启动解包程序、便携程序和便携重启：Unicode TXT 命令行路径、GB18030 检测、原文 LF 偏移、字面 PDF、十编码选项、字数/选区统计、左侧行号、仅编辑器功能限制、TXT 保存标题以及深色主题、源码视图与 L 字号偏好均通过。重启断言使用 L 档。报告为 `output/playwright/release-2.1.5-packaged.json`。最终快捷键边界修正后仅追加 `--checks=boundary` 成品阶段：三个实际启动场景均通过，报告为 `output/playwright/release-2.1.5-boundary-packaged.json`，其余结果保留。

`scripts/release-2.1.5-resources.cjs` 核对 210 个生产文件逐字节一致，app.asar 版本、编码依赖与许可、11 个 OCR 模型和声明、原生打印 ESM 补丁/PDFium/Koffi/许可证，以及 Windows/macOS TXT 关联配置。报告为 `output/playwright/release-2.1.5-resources.json`。

三个 EXE 的 Authenticode 状态均为 `NotSigned`。未发布 GitHub Release。版本、签名、大小和 SHA-256 记录于 `release/PDFuck-2.1.5-Windows-release.json` 与 `release/PDFuck-2.1.5-Windows-SHA256SUMS.txt`。

## 最终 SHA-256

| 成品 | 字节数 | 产品版本 | SHA-256 |
| --- | ---: | --- | --- |
| Windows-Setup.exe | 221930251 | 2.1.5 | `1D3123CC2F66000F26F72F40A42602EDD9A10EBB3967767418C1687FE2947B02` |
| Windows.exe | 221547042 | 2.1.5 | `0D7B4C498EC5EB6D7F3E3C62AA6CA4CC54EDB45F4398C569526B8ABA97C7D1D7` |
| win-unpacked/PDFuck.exe | 225589248 | 2.1.5.0 | `D604434A667ECC405E6BE7FE54C4CBD5E150FC35BB1D537FF06E144500E73F22` |
