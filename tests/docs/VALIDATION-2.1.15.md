# 2.1.15 验收记录

- 实验室共享纵向布局中的子项不再收缩；回复保留内容高度，统一由窗口外层滚动，覆盖图片解释、润色、全文评价、批注建议及自动批注共用样式。提示词继续支持伸展。
- 关于介绍更新至 PDF、Markdown、TXT 与 AI 文档工具；十语言同步。
- GitHub release body 经主进程类型检查和长度限制后传到关于及更新提醒，复用 Markdown 组件显示标题、列表、表格与代码。长内容独立滚动；不加载远程图片或 HTML。

## 本次新增检查

- `npm run test:release-2.1.15`：11 项通过，覆盖安全 Markdown、十语言介绍与空说明。
- `node tests/scripts/release-2.1.15-ui.cjs`：已生成成功结果 `tests/output/release-2.1.15/results.json`；十语言关于长说明、十语言 × 两种窗口高度的回复完整高度和操作可达性、真实图片选区解释、拖拽缩放与恢复通过；模拟更新接口覆盖新版本/当前版本/非法版本、缺失及错误类型正文、网络错误和 HTTP 错误。
- `npm run typecheck`、直接 `electron-vite build`、`git diff --check` 通过。

## 交付范围

macOS Apple Silicon APP、DMG、ZIP，版本 2.1.15。使用 ad-hoc 签名，未 Apple 公证。首轮仅新增测试；本轮按用户追加要求复跑相关选择回归，不启动、复测成品或执行包验收脚本；未进行 Windows 实机验证。更新接口采用模拟响应，未依赖真实 GitHub 网络完成验收。

## 追加框选修复（2026-11-04）

原因：图注续行被分栏文本对象及上标公式拆散，图片区域只收进首行；全页统计将远处通栏表格作为局部正文栏缝的冲突，抑制正确双栏。

修复：图注续行按邻近基线归并后再检查间距与缩进；分栏冲突在连续的栏缝支持区间内计算，保留原有最少重复证据和冲突比例限制。单元格选择逻辑不变。

- 新增 `node tests/scripts/selection-figure-table-2115.cjs`：8,214 组选择范围，每组正反向对比，三个缩放比例；检查图注完整隔离、正文逐字矩形覆盖、左右栏隔离及表格单元格保护，全部通过。
- 新增 `node tests/scripts/selection-figure-table-2115-ui.cjs`：源码生产构建下真实 Electron 界面 6 次拖选，覆盖图注、左右正文栏及双向拖动；剪贴板内容和多行高亮通过。
- 类型检查和直接生产构建通过。仅执行本轮新增测试；不运行历史测试、不启动成品复测。保持 2.1.15，重建 APP、DMG 和 ZIP，更新校验值。

## 分栏误增修复与专项回归

原因：重复出现的页边行号、符号表的短符号、图表刻度被当成正文列；仅按间隙重复次数不足以区分这些布局。修复在共享推断中按相邻候选栏缝间的实际文字宽度验证两侧证据，并排除正文左侧独立数字的栏缝证据。数字仍保留为可选文字；正文行范围合并与图注归并同步隔离页边行号，避免取消错误栏线后引入选择污染。

- `selection-columns-2115.cjs`：两份 PDF 四页 × 五档缩放，共 20 个布局均仅识别真正中缝；270 组跨行正文范围检查逐字高亮、正反向一致及左右栏隔离，手动无分栏/多分栏覆盖通过。
- 同脚本 96 种合成布局通过：中文/英文、单至四栏、窄/宽栏缝、有/无行号、三档缩放，防止只匹配某一文档。
- `selection-figure-table-2115.cjs`：8,214 组范围通过，覆盖图注续行、公式片段、左右正文及单元格保护，逐组正反向对比。
- 源码构建真实 Electron 拖选共 10 次通过（旧样本 6 次、新样本 4 次），检查剪贴板和多行高亮。
- 相关既有选择/分栏单元测试 36 项通过；text-layout 中其他 16 项未选中。首次整文件执行遇到一项既有断言未包含 `sources` 字段，本轮未修改无关断言，不将其记为通过。
- 类型检查、源码生产构建、diff 检查通过。没有运行无关测试全集；不启动成品复测。

## 最新重复栏缝修复与历史专项重跑（当前交付）

新样本已匿名保存为 `tests/fixtures/ee07961f15714eb093b704ab8756a102.pdf`，原始内容及校验值见样本说明。截图中的两条相邻栏线源于候选归属：公式/缩进的宽空隙同时重叠真实栏缝和偶然词间空隙，旧逻辑选择第一个候选，偶然空隙因而获得错误支持。边缘中位数也可能被缩进偏移。

共享推断现按最近的重复边缘选择候选，取较窄间隙中最稳定的边缘带定位，约束在共同空白区内；冲突检测宽度限制在该空白区内。没有按文件名、页码或固定横坐标特判，也没有把相邻栏线直接合并。原有行号/短符号排除、局部正文支持区、手动边界及图注/单元格保护保留。

### 新增检查

- `node tests/scripts/selection-gutter-clusters-2115.cjs`：40 个真实 PDF 变体通过（五档缩放、原生/默认字体度量、平移、文本对象逆序），均只得到一条位于真实中缝的边界；24 个合成组合通过，覆盖缩进、偶然空隙、两/三栏及真正相邻栏缝不能合并。
- `node tests/scripts/selection-gutter-clusters-2115-ui.cjs`：源码生产构建的真实 Electron 界面两档缩放通过，均显示一条边界，文档坐标 `306.002448`。截图位于 `tests/output/gutter-clusters-2115/new-boundary-{0,1}.png`。

### 按最新用户要求重跑历史分栏/选择自动化

- 六个相关单元文件按 `column|gutter|caret|selection|spacing|formula|detection|boundar` 筛选：82 项通过，2 项因缺失原始 PDF 报 ENOENT，12 项无关测试未选中。文件：`text-layout`、`release-2.1.7`、`release-2.1.7-repair`、`release-2.1.10`、`page-layout-overrides`、`release-2.1.14-followup`。
- 纯布局/选择脚本通过：`selection-bc-smoke`、`selection-test2-smoke`、`selection-test3-smoke`、`selection-scheduling-smoke`、`selection-scheduling-0826-smoke`、`selection-scheduling-inline-formula-smoke`、`selection-m91474-smoke`、`selection-chinese-alignment-smoke`、`selection-figure-table-2115`、`selection-columns-2115`、`selection-gutter-clusters-2115`。
- 上述包含 BC 14 页、旧有公式/图注/中英正文选择、20 个新旧 PDF 缩放布局、270 组正文范围、96 个中英单至四栏组合，以及 8,214 组图表选择范围；未放宽已有断言。
- 源码界面专项通过：`release-2.1.10-ui --checks=behavior`、`selection-bc-ui-smoke`、`selection-test2-ui-smoke`、`selection-test3-ui-smoke`、三个 `selection-scheduling*-ui-smoke`、`selection-m91474-ui-smoke`、`selection-chinese-alignment-ui-smoke`、`selection-figure-table-2115-ui`（两份输入，6+4 次拖选）及新增栏线界面测试。test3 另核对 8 次双向/高缩放拖选的 1,500 帧实时选择，逐字高亮与复制通过。
- 自动化运行时使用忽略目录中的临时启动辅助隔离桌面鼠标事件、限制窗口关闭等待，并等待进程退出后清理配置。test3 初次受桌面鼠标事件干扰、m91474 初次配置清理竞争，隔离后重跑通过；未修改产品行为或测试断言来消除这些失败。2.1.10 界面脚本仅将硬编码的旧版本号断言改为当前 package 版本。
- 结果和日志：`tests/output/gutter-clusters-2115/` 的 `script-results.json`、`ui-results.json`、`ui-reruns.json`、`units.log`、`results.json` 和各专项日志。

### 未能完成的历史用例

- `15b0dac9d0578d2802c4235a5ab881ed.pdf` 缺失：两项单元测试实际报 ENOENT；`release-2.1.7-repair-ui` 的该文档分栏检查无法执行，本轮未启动其无关编辑流程。
- `6fa8dadce18511ed3878289ff187a9c0.pdf` 缺失：`selection-cpaper-smoke` 与 `selection-cpaper-ui-smoke` 均实际运行后报告缺失。
- `9a85799401ef8ca4091cd38f64949fb9.pdf`、`0a02ff02029c95044bf3f72ffdf6c3af.pdf` 缺失：`selection-smoke` 运行后四个子项均自行跳过，不能记为通过。
- 已检查工作区、下载目录、Codex 文件及这两份核心缺失样本的本地 Git 历史，未找回原始文件。以上缺失项不以别的 PDF 替换，不宣称历史用例全部通过。

最终类型检查、直接生产构建及 diff 检查通过。版本保持 2.1.15，重新生成 macOS arm64 APP、ad-hoc 签名、DMG、ZIP 与 SHA-256；按用户要求不启动成品、不执行成品复测。未做 Windows 实机验收，未公证。
