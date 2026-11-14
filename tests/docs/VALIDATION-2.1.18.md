# 2.1.18 验收与交付

> 首轮历史记录；当前同版本已重做为示例文档教学，见 `PLAN-2.1.18-practice.md` 与 `VALIDATION-2.1.18-practice.md`。以下测试未在本次重做中重跑。

日期：2026-11-14；主机：macOS arm64。

已完成：五步视觉引导（首次启动、版本升级、跳过、前后翻页、Esc、重看），四模块标题栏主题色无边框隐藏图标，独立 PDF 选区字数，固定用户目录保存外部依赖并迁移旧下载。全部新增界面文案覆盖 zh/en/ja/ru/es/fr/de/pt/ko/ar。README 未修改，无新增生产依赖。

## 本轮执行结果

- `npm run test:release-2.1.18` 对应两个新增文件，共 21 项通过。最终 JSON：`tests/output/release-2.1.18/unit.json`。覆盖版本记忆、完整翻译、焦点恢复、翻页/结束/跳过/Esc、混合语言计数、资源目录隔离、非覆盖迁移、恢复部分下载、文件系统错误，以及 mac-arm64/win-x64 资源清单的校验复用与损坏重取。
- `node tests/scripts/release-2.1.18-ui.cjs` 通过 8 组专项。十语言 × 双主题 × 五步骤，共 100 个步骤布局；检查高亮目标准确、实验室标题可见、导航不被横向滚走。四模块收起重开、快捷标记已处理、双击打开编辑、真实 PDF 拖选显示 4 字/词、重启不重复、从 2.1.17 升级再次显示、重看/Esc/小窗口均通过。JSON 与截图位于 `tests/output/release-2.1.18/`。
- `npm run typecheck`、直接 `npx --no-install electron-vite build`、`git diff --check` 通过。Vite 仍提示 PDF.js 动态资源 URL 在运行时解析，构建正常，真实 PDF 窗口已渲染并完成拖选。
- `node tests/scripts/release-2.1.18-package-check.cjs` 通过：197 个生产文件与 ASAR 逐字节一致、包内/Info.plist 版本 2.1.18、ad-hoc 严格签名、DMG 内容/背景/图标/Applications 快捷方式、ZIP 完整性、资源许可证与 SHA-256。未打入 OCR/LanguageTool/Java 按需下载负载。未运行旧测试全集或全量发布脚本。

## 资源保留方式

正常启动的资源位于 `app.getPath('appData')/PDFuck-resources`，不随安装目录、版本号或 Electron 配置目录变化。旧 `userData/feature-resources` 中的资源和未完成下载非覆盖复制到新位置，旧副本保留；这次迁移可能临时增加磁盘占用。代理凭据仍由原有用户配置及系统加密存储管理。依赖摘要不变时复用；文件损坏或依赖本身更新时仍校验并下载所需版本。显式 `--user-data-dir` 和测试配置保持资源隔离。

## 交付

- `release/mac-arm64/PDFuck.app`
- `release/PDFuck-2.1.18-macOS.dmg`（154035816 bytes）
- `release/PDFuck-2.1.18-macOS.zip`（152822545 bytes）
- 发布元数据及校验：`release/PDFuck-2.1.18-macOS-release.json`、`release/PDFuck-2.1.18-macOS-SHA256.txt`

当前交付为 macOS Apple Silicon。未做 Windows 实机覆盖安装或构建 Windows 安装包，未做 Intel 构建；跨平台资源策略及两种平台资源清单复用已在新增单元覆盖。成品仅静态验证，没有启动成品重跑 UI。无 Developer ID，使用 ad-hoc 签名，未公证。
