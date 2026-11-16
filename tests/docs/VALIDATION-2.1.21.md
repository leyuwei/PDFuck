# 2.1.21 验收

## 修正范围

新输入已使用替代文字、合成字体与几何重新生成：`tests/fixtures/4aeccb4afd905617973cddf3769f8bdb.pdf`。保留一页版式和表格/图形规则，不复制原图、原始字体、PDF 对象、链接、批注、附件或元数据。隐私检查确认 73 行原始长文本均未保留，原件未修改；夹具 SHA-256 见 `tests/fixtures/release-2.1.21-inputs.json`。

漏选与向上拖选受限来自三个相连的误判：正文里的 Table IV 引用被当作标题，页边小字号行号参与了无框表格判断，左栏图注又把右栏较大字号的正文当成跨栏延续。共用的图表引用判断、页边数字轨迹过滤、图注字体与延续范围已修正；显式表格和真实跨栏图注仍保留，公式中的个别大字不截断图注。

检查全部 16 份 renderer CSS，261 处遗留蓝色声明改为现有主题变量，主题引用声明共 580 处。覆盖页面选择小字和底边、页面管理、焦点、文本编辑、加载/下载进度、浮窗与工具控件；根节点同步用户主题色，使 portal 窗口和原生焦点/选区/进度控件继承主题。保留警告、处理状态、批注数据、国旗、色谱与文档模板内容的颜色含义。

README 未改，无新增生产依赖；界面沿用现有十语言文案。

## 本轮新增检查

```sh
tests/tmp/release-2.1.16/venv/bin/python tests/scripts/sanitize-inputs-2121.py
node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/lib/release-2.1.21.test.ts --reporter=json --outputFile=tests/output/release-2.1.21/unit.json
node tests/scripts/release-2.1.21-selection.cjs
node tests/scripts/release-2.1.21-theme-audit.cjs
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.1.21-ui.cjs
```

- 17 项新增单元通过：普通图表引用/真实标题、两侧页边行号、短数字列表与表格值保护、跨栏拆分标题、含大字公式的图注与较大字号正文隔离。
- 原件与脱密副本 × 三档缩放 × 两种字体模式，共 12 组，756 组正反向选区及 288 步向上扩展通过；以正文几何直接定义预期，不先按图表分类过滤预期词。正文不得属于任何图表/单元格，真实图表和 55 个表格单元格保留。
- 隔离配置的源码 Electron 窗口 12 次实际拖选通过，覆盖正向、持续向上反向、跨栏及两档缩放；逐词验证此前遗漏段落的选区覆盖和页边行号隔离。公开截图只使用脱密内容。
- 红/绿两种主题色 × 明暗模式 × 十语言，共 40 组、280 个计算样式检查通过，包含真实 32 页文档的第 15 页选择弹窗，以及页面管理、加载、批注聚焦与下载图标。另检查 portal 继承和原生焦点颜色。
- 16 份 CSS 静态审计、类型检查、直接生产构建和 diff 检查通过。

## 交付

版本同步为 2.1.21。交付 macOS arm64 APP、DMG 与 ZIP，使用 ad-hoc 签名并严格验证。新增包检查 `node tests/scripts/release-2.1.21-package-check.cjs` 比对生产文件与 ASAR、版本、按需资源排除、许可证、签名、DMG Finder 布局、ZIP 和 SHA-256；发布清单为 `release/PDFuck-2.1.21-macOS-release.json`。

按要求未运行旧测试全集，未启动成品复测；Windows、Intel 与真实覆盖安装未实测，未进行公证。
