# 2.1.9 验证与交付

日期：2026-10-14。平台：Windows x64。依赖未新增。版本与锁文件均为 2.1.9。

本次交付包含用户后续四项修复与书签底栏补充，替换初次交付的同名 2.1.9 文件；以下哈希为当前重新生成的产物。

## 改动与边界

- **选区溢出**：`tmp/selection-fix.pdf` 第一页中，“工智能服务的整体质量，”的文本块从 x=90.024 开始，PDF.js 宽度为 132.026，结束于 222.05；后继“推动…”却从 217.37 开始，原选区会溢出约 4.68pt。负 TJ 间距压缩了标点，旧选区仍包含它的完整字宽。现在在共享布局中按同行、同字号的后继起点校正重叠尾部，仅收紧末字符的 advance，不按整行重新缩放；同类“不诚实行为，”也修复。光标、查询和批注复用此几何。跨行、脚标、旋转及大面积叠字不会被该规则误剪。
- **缩放稳定性**：真实验收发现垂直滚动条出现会改变 clientWidth，旧 ResizeObserver 将其当成窗口缩小，导致高倍率回退。现在比较实际分配给查看区的宽度，真实窗口/侧栏缩小仍会适配。
- **批注原文卡片**：新建和编辑共用顶部独立区域。按照批注矩形提取精确字符，突出对应原文，附带最多各 48 个字符的前后文；完整选中文字不截断，长内容可独立滚动。按页码显示跨页片段；便笺/插入标记显示明确标注的附近文字，脱离正文或无文字位置显示提示。加载期间保留编辑焦点、草稿、颜色和回复；原文不作为 HTML 或 Markdown 执行。
- **简洁文案**：通用选择、欢迎、拖入、原生文件过滤器及最近文件提示使用“文档”，十种语言同步。格式选择、另存/导出和源码/预览区别保留实际格式名。README 的通用介绍同步。
- **界面适配**：源文卡片使用现有辅助/正文/标题字号变量；两种主题颜色、自动文本方向、换行、滚动和键盘可达性均沿用项目结构。阿拉伯语界面中中文原文仍按 LTR 阅读。
- **空格与词尾空格**：原布局只保留非空白词，鼠标端点无法进入空格。现在在保持现有栏目/段落词块的同时，为同行同流域的实际间距建立光标区间；选择、键盘复制、右键复制与原文卡片共用。明确选中的纯空格与首尾空格不会被剪贴板整理删去。缺失空格度量不再按半个 em 推算，连字使用自身字宽，两端对齐的余量分配到空格。短空格拖动超过一个像素且跨越光标边界时可成立，不再一律要求四像素。
- **特殊符号与跨栏图注**：论文第 17 页 wasy8 的 ascent=0.751、descent=-1.667，旧归一化把正常 ascent 压到约 0.31。现在保持有效 ascent，并对同行矩形取完整并集；跨栏结构块按共有流域合并，不将正文双栏连通。精确查询先保留已有 AI 文本块顺序，必要时按跨栏结构块的视觉顺序匹配。
- **指定页码批注**：PDF 自动批注可选择指定页码，支持单页、范围、不连续与去重；空值、越界、倒序和无效片段拒绝启动。开始时冻结范围，只提取所选页，模型上下文和导出原文也限定该范围；进度同时显示真实页码与范围内进度，暂停/继续保持快照。Markdown/TXT 源码模式保留全文/选区，避免把源码块编号冒充 PDF 页码。
- **统一底栏**：自动批注导出报告移入固定底部操作区，和暂停/继续/结束共同排布；检查运行、暂停、完成及导出错误恢复。软件状态栏原来的三栏 `footer` 选择器被限定到 `.app-shell > footer`，防止泄漏进书签及其他组件底栏。书签提示使用全宽、逻辑起始方向与自然换行。

## 仅本轮新增检查

依照用户要求，未调用旧测试全集、一键全量打包、`npm run build` 或 `dist:win`。

| 检查 | 结果 |
| --- | --- |
| `npm run test:release-2.1.9` | 4 个本轮新增测试文件、16 项通过。包括初次 10 项与后续 6 项：论文空格双向选择、75%/100%/216% 缩放、准确字宽、符号图注完整并集、跨栏查询及普通栏隔离、剪贴板边缘空格、页码校验、范围快照与提取/模型/报告隔离、暂停继续和固定导出区。 |
| `node scripts/release-2.1.9-ui.cjs` | 源码生产构建通过。真实鼠标双向拖选两处逗号，在约 102%/178% 两种缩放下共 8 次，复制均仅为“，”；边界与后续文字起点差小于 0.02 CSS px。新建/列表编辑、精确原文、保存重开通过。 |
| 十语言 × 双主题 × 四字号 | 源码及解包成品各 80 组通过。卡片文字不横向溢出，字号正确，关闭入口始终可见，滚动到底后可确认；中文原文方向独立于 RTL 界面。 |
| 成品 UI | `PDFUCK_SMOKE_EXECUTABLE` 指向本轮 `release/win-unpacked/PDFuck.exe`，同一新增 UI 验收通过；确认 isPackaged、app.asar、运行版本 2.1.9，保存重开后原文卡片恢复。 |
| `node scripts/release-2.1.9-portable.cjs` | 实际便携版独立启动、真实原文卡片、取消后 PDF 保持干净、欢迎页“文档”文案及正常关闭通过。 |
| `node scripts/release-2.1.9-survey-ui.cjs` | 原论文的隔离副本保留全部 22 页，仅增加一条测试书签。第 20 页在正常/高缩放下各双向选择纯空格与词尾空格，共 8 次复制；第 17 页双向选择符号与跨栏图注，均为正确的一块选区，没有下一段/相邻说明。指定 `20,17,17` 实际仅处理 17、20 页，写入的两条批注只属于这两页；本地模型夹具验证暂停、继续、选定原文导出及导出失败恢复，没有外部模型请求。 |
| 自动批注/书签新布局 | 源码与最终解包成品各 80 组十语言 × 双主题 × 四字号检查。书签底栏不再是三栏网格；文字位于全宽内；状态栏保持原有网格；导出与运行按钮在窗口内，正文滚动不改变操作区位置。 |
| `npm run typecheck` | 通过。 |
| `npx --no-install electron-vite build` | 通过。构建时 PDF.js 资源 URL 提示沿用原有配置；实际资源由构建插件复制，并由包内逐字节检查确认。 |
| `git diff --check` | 通过。 |
| `node scripts/release-2.1.9-package-check.cjs` | 210 个生产文件与最终包逐字节一致，批注源文样式/文案已进入 bundle；11 个 OCR 模型、PDFium 与 Koffi 保留，版本和 SHA-256 已核对。 |

构建命令：`npx --no-install electron-builder --win --config.electronDist=node_modules/electron/dist`。

截图与机器记录：

- [中文浅色原文卡片](../output/release-2.1.9/packaged/source-zh-light.png)、[中文深色](../output/release-2.1.9/packaged/source-zh-dark.png)、[阿拉伯语深色](../output/release-2.1.9/packaged/source-ar-dark.png)。已目视检查。
- [源码检查结果](../output/release-2.1.9/source/result.json)、[成品检查结果](../output/release-2.1.9/packaged/result.json)、[便携版检查结果](../output/release-2.1.9/portable/result.json)。
- [论文源码检查](../output/release-2.1.9/survey-source/result.json)、[论文成品检查](../output/release-2.1.9/survey-packaged/result.json)、[固定导出区](../output/release-2.1.9/survey-packaged/automatic-paused.png)、[书签全宽提示](../output/release-2.1.9/survey-packaged/bookmark-zh-light.png)。

## Windows 交付

| 产物 | 字节 | SHA-256 |
| --- | ---: | --- |
| [安装版](<C:/Users/Yuwei Le/Documents/GitHub/PDFuck/release/PDFuck-2.1.9-Windows-Setup.exe>) | 221964270 | `1a5c3384e4237f8980b46db3677105c24b7723140b914384daabfa12c939698a` |
| [便携版](<C:/Users/Yuwei Le/Documents/GitHub/PDFuck/release/PDFuck-2.1.9-Windows.exe>) | 221581072 | `95f00f2f4f3f727ac5ef8f1f319c04ff7b042068e820f207c1f01e8b0a5e6225` |
| [解包程序](<C:/Users/Yuwei Le/Documents/GitHub/PDFuck/release/win-unpacked/PDFuck.exe>) | 225589248 | `d03fd0a1a09be6837c5b7103f084288d1df73b68797f9c0e75fef02648d1cfdd` |

解包程序需与同目录资源一起使用。安装包、便携版的产品/文件版本为 2.1.9；解包 EXE 的产品版本使用 Windows 四段形式 2.1.9.0，文件版本为 2.1.9，包内与运行界面均为 2.1.9。

[发布 JSON](../release/PDFuck-2.1.9-Windows-release.json) 与 [SHA-256 清单](../release/PDFuck-2.1.9-Windows-SHA256.txt) 包含全部绝对路径、版本、架构、签名状态和验收范围。

三份 EXE 的 Authenticode 均为 `NotSigned`；当前环境没有可信代码签名证书，首次运行可能出现 SmartScreen 未知发布者提示。本轮未执行真实系统安装、UAC 更新与卸载，也未替换已有安装；便携/解包成品已实际运行。未在 Windows 上构建或宣称验收 macOS 产物。新增样例测试需要保留用户提供的 `tmp/selection-fix.pdf` 与 `tmp/inter_agent_trust_comst_survey.pdf`。
