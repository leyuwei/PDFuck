# PDFuck 2.1.3 验收记录

日期：2026-10-06。环境：Windows x64、Electron 43.4.0、electron-builder 26.15.3。清单与锁文件同步为 2.1.3，无新增依赖。本次后续修复继续使用 2.1.3，重新生成交付包。

## 最终设计与问题定位

- 删除 Markdown 总工具栏及源码/PDF 面板标题、外侧留白和卡片边框。双栏从文档标签栏下沿铺满工作区，底部仅保留一条 47px 控制栏。
- 删除底栏文本样式入口。鼠标框选后，在选区结束处显示工具栏；右键在点击位置显示。键盘选择通过临时镜像测量 textarea 的实际换行位置，工具栏随选区显示。Shift+F10/菜单键直接聚焦工具栏，Escape 返回编辑器并保留选区；普通框选不抢焦点。点击格式按钮不破坏原选区，复用原格式插入和撤销历史。插入、滚动、输入、外部点击、改变窗口或视图后收起；输入法组字期间不展开。
- 原底栏的共享 flex 区域把源码和 PDF 操作一起推到右侧，导致归属错位。现以与正文相同的分栏比例及 10px 分隔列划分底栏，明确覆盖全局 footer 的 12px gap。保存/另存/关闭源码在源码区域末端，PDF 操作在 PDF 区域末端，统一为 28×28px 图标。源码字号恢复原 A− / 当前 S·M·L / A＋ 选择器，字符统计放入其提示；长状态省略并保留完整提示。极窄分栏各自横向滚动，保持一行。
- 原 hint 按固定 288px 宽度和 100px 偏移猜测位置；此外浮动元素的默认 shrink-to-fit 会让宽度随 left 改变，造成位置漂移。现按实际按钮和提示尺寸居中，在底栏按钮正上方留 6px 间距，靠边时避让；使用 max-content 与最大宽度稳定测量。提示随窗口、滚动、分栏、字号和语言变化重新定位。所有 Markdown 按钮共用此逻辑。
- 工具栏同样按实际尺寸在鼠标/选区附近放置，越过下沿时翻到上方，并约束在正文区域内。复用主题颜色、十语言名称、四档界面字号和既有浮窗边界工具。源码/PDF 控制组及浮动格式按钮继续指定正确的独立历史和同步滚动目标。

## 新增检查与结果

1. `npm run typecheck`、`npx --no-install electron-vite build`、`git diff --check` 通过。
2. 新增 `scripts/release-2.1.3-interaction-fixes-ui.cjs --checks=selection` 通过：真实鼠标框选及加粗、保留选区/撤销、键盘选区且不抢焦点、Shift+F10/Escape、右键选区格式和空选区插入、右下边缘翻转、滚动/外部点击收起、快捷插入对话框。边缘右键在正文内容内执行，避开原生滚动条，并等待前一次键盘滚动完成。
3. 同一脚本 `--checks=layout,hints` 通过：十语言 × 两种主题 × 四档界面字号，共 80 组，检查唯一底栏、47px 高度、源码/PDF 操作区域与对应正文边界一致、28px 按钮等高对齐、选区工具栏不越界。最小 1080×700 窗口下 20%、80%、42% 分栏内每个按钮可滚动至自身区域；源码/PDF 单栏与恢复、S/M/L 选择正常。
4. 80 组设置中的 7 个源码/PDF 按钮，共 560 项 hint 检查通过：文案对应、按实际宽度居中及边缘避让、贴近按钮上方、无视区外溢。
5. 目视检查 `output/playwright/release-2.1.3-selection-toolbar.png` 和 `release-2.1.3-aligned-footer-hint.png`，确认选区旁工具栏、分栏归属和“保存 PDF”提示位置。

本次此前新增的基础控件检查已通过：真实 UTF-8 源码保存/另存、独立 PDF 导出、源码/PDF 关闭恢复、同步开关、技术模板切换/刷新及无留白分栏拖动。历史结果保留在 `output/playwright`；依赖旧底栏语法入口的中间脚本已由上述最终交互脚本替换。仅重测后续修复影响的新增阶段，没有运行旧版本测试全集或一键发布脚本。

## 后续插入滚动及字号选择器修复

用户继续反馈快捷插入标题后源码被滚到文档底部，及字号控件不应改成下拉框。新增真实 UI 检查在修改前复现：开头插入标题，scrollTop 从 0 变为 2948，等于该文档最大滚动位置；插入选区本身仍在开头。原因是受控 textarea 更新值后临时光标位于末尾，旧代码先 focus() 触发浏览器滚向末尾，才恢复插入选区。共享 insert 流程现先 setSelectionRange，再 focus({ preventScroll: true })，快捷插入和直接格式插入均使用该路径，无额外延时或滚动补丁。

恢复原来的 A− / 当前 S·M·L / A＋ 字号选择器及组边框，不使用下拉框；沿用原来的字号比例、档位边界、完整提示和持久化，继续放在唯一底栏。无需新增依赖。

本轮只运行新增 `node scripts/release-2.1.3-interaction-fixes-ui.cjs --checks=insertion,font`，以及必要 typecheck、生产构建、diff 检查。6 个真实交互场景通过：同步关闭/开启 × 开头选区标题、中段选区标题、中段空选区链接；插入文本及选区正确、编辑焦点恢复、插入前后 scrollTop/scrollLeft 一致，等待实际新 PDF 文字层出现后仍稳定，撤销恢复原文。新字号检查覆盖 80 组十语言 × 双主题 × 四字号，验证 S/M/L 对应 90%/100%/120%、两端禁用、名称、单行布局、控件在源码底栏内及不存在下拉框。报告：`output/playwright/release-2.1.3-fixes-insertion-font.json`。此前已通过的选区工具栏及 560 项 hint 检查不重复执行。

本轮最终成品新增检查通过：`node scripts/release-2.1.3-interaction-fixes-packaged.cjs --checks=insertion,font`，仅检查新增插入保持视区、恢复的字号选择器及便携重启档位；结果写入 `output/playwright/release-2.1.3-insertion-font-packaged.json`。原先成品记录作为前轮已通过结果保留。

## Windows 成品验收

安装版：`release/PDFuck-2.1.3-Windows-Setup.exe`；便携版：`release/PDFuck-2.1.3-Windows.exe`；解包程序：`release/win-unpacked/PDFuck.exe`。

前一轮 `scripts/release-2.1.3-interaction-fixes-packaged.cjs` 检查通过，报告保存在 `output/playwright/release-2.1.3-fixes-packaged.json`。该检查实际启动解包 EXE、便携 EXE 和便携重启，验证 Unicode Markdown 参数、界面版本、真实可选文字 PDF、选区及右键工具栏、无底栏触发按钮、分栏操作对齐、对应按钮提示、PDF 关闭恢复，以及源码 L 字号与同步设置重启恢复。

包内运行时清单一致，210 个生产文件与当前构建逐字节一致，其中包含 11 种 OCR 模型及其许可证。已核对 OCR 数据和运行时、Koffi、原生打印 PDFium DLL、ESM 补丁及许可证。最终资源报告保存在 `output/playwright/release-2.1.3-insertion-font-resources.json`。

最终版本、大小、Authenticode 状态及完整 SHA-256 记录于 `release/PDFuck-2.1.3-Windows-release.json`；哈希另存于 `release/PDFuck-2.1.3-Windows-SHA256SUMS.txt`。安装版/便携版产品版本为 2.1.3，解包 EXE 为 2.1.3.0，三项 Authenticode 均为 `NotSigned`。成品检查结论以本次新报告为准。

安装器资源、旧版本提示、文件关联和 appId 沿用原配置，本轮不重复旧安装测试，没有执行真实安装、UAC、更新、关联或卸载。Windows 本机未构建或验收 macOS，未发布 GitHub Release。
