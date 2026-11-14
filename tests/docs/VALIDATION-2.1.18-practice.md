# 2.1.18 示例教学重做验收

> 此前示例教学交付记录；最新同版本安装包包含引导框定位修复，见 `VALIDATION-2.1.18-guide-position.md`。以下旧测试未在定位修复中重跑。

日期：2026-11-14；交付平台：macOS arm64。版本继续为 2.1.18，替换首轮安装包。

## 完成内容

- 导航栏移除独立引导按钮，重看入口放在关于弹窗。
- 欢迎页可直接切换语言。欢迎页、教学步骤和查看模块共用地球图标、SVG 国旗、语言原名选择器；旗帜不依赖系统 emoji 字体。欢迎页展开后十种语言分两列完整显示。
- 本地生成三页练习 PDF，含可选择正文、可编辑文字、三项书签和一条真实批注。练习独立打开，没有原文件路径；已有用户文档保留在自己的标签中。选择开始前可以直接跳过。
- 十一个教学步骤涵盖工作区、阅读导航、高亮、批注编辑、处理状态、页面文字编辑、页面管理、实验室、OCR/语法、Markdown/TXT 写作、保存导出。文字围绕主要功能和具体操作，不介绍版本更新和字数统计。
- 教学提供真实工具入口，说明可收起，编辑弹窗和模型设置打开时引导暂隐。编辑步骤进入第二页；写作步骤另开 Markdown 练习文档，使用正常编辑、预览和保存流程。
- 文案和练习内容覆盖 zh/en/ja/ru/es/fr/de/pt/ko/ar。首轮引导完成记录会再次提示新的练习教学。
- README 未修改，无新增生产依赖。首轮安装包备份位于 `release/previous-2.1.18-before-practice-20261114/`。

## 本轮新增测试

只运行本轮新增测试，不重跑首轮或历史测试全集。

1. `npm run test:release-2.1.18-practice`：新增 21 项单元全部通过，结果位于 `tests/output/release-2.1.18/practice-unit.json`。覆盖十语言完整文案与练习 HTML、国旗和语言持久化、旧引导记录迁移、十一课流程、打开失败重试、关于入口、真实 PDF 书签/批注构造、收起说明后翻页、开始前跳过、焦点恢复。
2. `node tests/scripts/release-2.1.18-practice-ui.cjs`：10 组新专项通过，十语言 × 双主题 × 11 步共 220 个步骤布局通过。实际从欢迎页切到英语，生成三页练习，点击书签、拖选并创建高亮、编辑原生便签、标记已处理、将第二页日期改为 Friday、打开页面管理和真实模型设置、修改 Markdown 并看到更新后的 PDF 预览、保存练习原文。确认查看模块语言切换、小窗口、Esc 和关于重看入口；用户原 PDF 的 SHA-256 不变，renderer 没有异常。报告及截图位于 `tests/output/release-2.1.18/practice/`。
3. `npm run typecheck`、直接 `npx --no-install electron-vite build`、`git diff --check` 通过。旧单元仅同步引导组件的必要接口与预期，不在本轮执行。
4. `node tests/scripts/release-2.1.18-practice-package-check.cjs` 已完成，发布 JSON 已生成：197 个生产文件与 ASAR 逐字节一致，Info.plist/ASAR 版本一致，ad-hoc 严格签名有效，DMG 布局/图标/背景/Applications 快捷方式、ZIP 完整性和 SHA-256 一致；关于入口、国旗和练习文档代码已进入成品，独立引导导航按钮已移除。按需资源未重新打入安装包。

## 当前产物

- `release/mac-arm64/PDFuck.app`
- `release/PDFuck-2.1.18-macOS.dmg`：154046812 bytes
- `release/PDFuck-2.1.18-macOS.zip`：152847819 bytes
- `release/PDFuck-2.1.18-macOS-release.json`
- `release/PDFuck-2.1.18-macOS-SHA256.txt`

DMG SHA-256：`a6bf5eb91a3d522ae0ee049fcb53c6e7c1e77ac5531a3b860c61cbb492a958a5`

ZIP SHA-256：`aeada74c2083466ea4c3612f5572f0abb9b324c20f2f09d02167eb5a73dc477d`

## 验证边界

未运行旧测试全集，未调用外部 AI 服务，也未在本轮重新下载和执行 OCR/语法引擎。实际端到端示例实操使用英语；十语言教学布局和练习内容另行覆盖。未做 Windows/Intel 构建与实机验证。成品只做静态校验，没有启动成品重跑 UI。macOS 使用 ad-hoc 签名，未公证。
