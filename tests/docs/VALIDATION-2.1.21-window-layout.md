# Markdown 批注与浮窗位置验收

版本保持 2.1.21，README、package.json、package-lock.json 与本轮开始 SHA-256 一致。保留前一轮已完成的修复。

仅执行本轮新增专项：

- `node tests/scripts/run-vitest.cjs run tests/unit/renderer/floating-position-2121.test.tsx`：10 项通过，覆盖隐藏/显示、卸载重建、功能间位置隔离、同种浮窗在不同文档中的独立位置、旧尺寸记录兼容、非法位置、存储不可用与屏幕边界校正。
- `node tests/scripts/release-2.1.21-window-layout-ui.cjs`：十语言 × 明暗主题 × 1440/1080 两种窗口宽度共 40 组布局，检查六种实际 Markdown 批注（编号、嵌套列表、标题、代码、长链接、表格/引用），验证作者与内容区分离、内容不外溢、列表边界受限。另有 8 项实际窗口专项：实验室标签切换恢复、不同文档独立位置、OCR 最小化后切换标签与恢复、OCR 最小化恢复、搜索重新挂载、纯文本/单行模式、批注人设置重新打开、批注编辑器重新打开。

类型检查、直接生产构建和 diff 检查通过。没有新增生产依赖与界面文案，沿用十语言。

先备份旧 DMG/ZIP 与校验清单，再重建 macOS arm64 APP，补齐并严格验证 ad-hoc 签名，生成 DMG 和 ZIP。本轮新增 `release-2.1.21-window-layout-package-check.cjs` 静态核验版本、生产字节、签名、DMG/ZIP、资源与许可证、README 不变及 SHA-256，报告为 release/PDFuck-2.1.21-macOS-release.json。

未运行旧测试全集，未启动成品复测；Windows、Intel 与真实覆盖安装未实测，macOS 包未公证。
