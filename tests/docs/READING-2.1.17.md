# 2.1.17 阅读与批注交互追加修复（2026-11-13）

## 八项需求与结果

| 需求 | 本轮修改 | 新增验证 |
| --- | --- | --- |
| 删除批注闪烁 | 删除只同步模型与叠加标记；已加载页面保留被覆盖原生批注 ID 的过滤集合，避免旧外观在缩放后回来 | 单条、批量删除前后画布是同一 DOM 节点，画布像素哈希不变；缩放后无原生旧痕迹；撤销、重做正常；打印、页面管理、水印预览使用最新模型快照 |
| 多种弹窗不能拖动 | 普通模态窗口统一复用浮窗标题拖动；批注、自带浮窗维持原处理；结果窗也支持拖动；遮罩顶端恢复主窗口原生拖动区域 | 实际鼠标拖动批注、页码、搜索及结果窗；弹窗拖动不移动主窗口；原生标题区域样式检查；1100×850 和 900×540 下三个弹窗边界检查 |
| 阅读工具六个图标 | 使用与编辑模块一致的 24px 线条与强调色 SVG；六个按钮统一图标/文字横排，阿拉伯语镜像排列 | 六个图标均存在；十语言 × 双主题 20 组图文对齐及横向可见范围检查 |
| 三项功能延迟提示 | 引文、图表、缩写分析前先绘制本地等待提示；切换、关闭及替换文档后丢弃过期结果 | 通知先出现、完成后消失；快速开关无残留；通知不移动 PDF，不遮挡临时目录提醒，返回按钮仍可使用 |
| 按文档保存开关 | 三个开关按文件路径保存在本机，开启时整个按钮使用激活色；无结果也能关闭；重开自动恢复标记 | 两份独立文档往返与进程重启；开启/关闭均恢复；空结果、损坏偏好及不可用存储；恢复不自动弹出结果窗，关闭结果窗保留开启状态 |
| 搜索弹窗标题 | 仅保留“搜索文档”，删除来源副标题，标题字号改为界面正文字号 | PDF 与源码共用标题；标题为单行层级，无 small 副标题；仍保留输入、搜索与拖动 |
| 缩写浮窗文案 | 用命中类型区分缩写与引文；缩写显示“缩写定义”、原缩写及“复制定义/定义已复制” | 缩写标题、无方括号展示、复制完整定义；六条新增消息覆盖十语言 |
| 书签起点闪烁 | 复用正文高亮动画；优先匹配目标标题，否则定位目的行；每次点击使用新的动画标识 | 指定目的位置、无位置标题、相邻正文与另一栏排除；实际点击及重复点击均闪烁 |

## 执行范围

计划见 `PLAN-2.1.17-READING.md`。只执行本轮新增测试，没有运行历史测试全集，也没有启动成品复测。

- 新增单元 `release-2.1.17-reading.test.tsx`：22 项通过。
- 新增源码窗口 `release-2.1.17-reading-ui.cjs`：15 组交互检查通过，包括删除画布稳定性、撤销/重做、四种窗口拖动、书签、开关、实际复制及跨进程恢复。另检查十语言与双主题下激活状态。
- 新增源码窗口 `release-2.1.17-reading-archive-ui.cjs`：只读上一轮已脱敏的 30 页档案，图表索引仍准确列出第 5、8、9、16、21 页五张表，并逐页实际定位。新增 20 组语言/主题图标排版检查及等待提示不造成页面位移检查。
- 新增源码窗口 `release-2.1.17-reading-windows-ui.cjs`：3 组小窗口弹窗边界检查；5 次等待/返回通知位置采样，均避开临时目录黄色提醒。
- 新增源码窗口 `release-2.1.17-reading-previews-ui.cjs`：原生可打印批注在删除前的打印预览包含 7,650 个黄色像素；删除后打印预览、页面管理缩略图、水印底图均为 0，未发送打印作业。预览快照只在弹窗/模型改变时取用，阅读画布继续保留。
- 类型检查、直接生产构建、diff 检查通过。生产依赖未新增，界面仍支持中、英、日、俄、西、法、德、葡、韩、阿十语言。

源码交互输入为合成 PDF，存于已有忽略的 `tests/tmp/release-2.1.17/reading-followup/`。论文测试只读取 `tests/fixtures/5d5c6d5b198ff6a22c879dd5c26ae5bf.pdf` 脱敏副本，未访问或修改用户原件。生成报告和截图不含私密原文。

证据位于 `tests/output/release-2.1.17/`：

- `reading-unit-results.json`
- `reading-ui.json`
- `reading-archive-ui.json`
- `reading-windows-ui.json`
- `reading-previews-ui.json`
- `reading-source/` 中的窗口截图及分阶段记录

## 复现与交付

```bash
node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/lib/release-2.1.17-reading.test.tsx --reporter=json --outputFile=tests/output/release-2.1.17/reading-unit-results.json
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.1.17-reading-ui.cjs
node tests/scripts/release-2.1.17-reading-archive-ui.cjs
node tests/scripts/release-2.1.17-reading-windows-ui.cjs
node tests/scripts/release-2.1.17-reading-previews-ui.cjs
# 构建并签名 APP/DMG/ZIP 后，仅静态核验：
node tests/scripts/release-2.1.17-reading-package-check.cjs
```

版本仍为 2.1.17，重新生成 macOS arm64 APP、DMG、ZIP。只做生产资源逐字节、版本、11 个 OCR 模型、图标、签名与压缩包完整性/哈希核验，不把早期成品运行结果算成本轮测试。

采用 ad-hoc 本地签名，未公证。Windows/Intel 未构建或实机验证；主窗口原生拖动区域做了样式核查，没有通过系统鼠标自动化实际移动操作系统窗口。

最终静态核验通过：210 个生产文件与本轮构建逐字节一致，11 个 OCR 模型及图标完整，APP/DMG 内 ad-hoc 签名有效，DMG 校验和、ZIP 完整性与包内字节一致性通过。

| 产物 | SHA-256 |
| --- | --- |
| PDFuck-2.1.17-macOS.dmg | `a8bc26335a6da280c13f09c06fb3784ebe87ae0d738f0f8e709a89c930357c15` |
| PDFuck-2.1.17-macOS.zip | `0418ef54319ecea8124b52f8c833791ba30cb5748ab3c5e08e321b72e4b5bd09` |
