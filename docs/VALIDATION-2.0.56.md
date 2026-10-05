# 2.0.56 验收记录

日期：2026-10-05（Asia/Shanghai）。本次按用户要求，只执行新增测试；没有执行旧测试、`npm run build` 或完整一键发布脚本。用户随后要求“成品请勿复测”：该消息到达前，新增成品 UI 回归已结束；此后没有再启动成品或进行成品复测，也没有挂载 DMG 做运行验证。

## 定位与修复计划

1. 读取 README、PACKAGING_GUIDE，追踪应用/文档图标生成与打包、首页 Logo、AI 隐私弹窗和所有缩放入口。改动前只有用户已有的 `.DS_Store` 修改；保留该文件。
2. 旧包 `icon.icns` 的 16/32px 是 `icp4/icp5` PNG，属于 electron-builder 26.15.3 的已知原生小图标兼容问题。现有 `pdf.icns` 解码正常，含 `ic04/ic05` ARGB。复用 SVG 和既有生成脚本，通过系统 iconutil 生成应用 ICNS，让应用与 DMG 直接使用原生 ICNS，避开有问题的转换器；没有增加或升级依赖。上游说明：https://github.com/electron-userland/electron-builder/issues/9940 。
3. 首页复用标题栏的 SVG Logo，正方形最大 106px；移除原 PDF 占位图的折角样式，继续复用全部多语言文本。
4. AI 警告框 footer 原上内边距为 0，继承通用分隔线后按钮贴线；改为 16px，保留换行、双主题和隐私确认逻辑。
5. 工具栏缩放原来使用视区/选区中心，真实窗口复现约 31px 横移、16px 纵移。增加文档内最近鼠标位置，统一捕获页面坐标；滚轮在页间空隙取最近纸张而非整容器的缩放比例。达到缩放上限或同帧反向抵消时清除无效锚点。
6. 新 UI 回归进一步复现长文档约 320px 纵向漂移：虚拟页占位使用 `812 * zoom`，既忽略真实纸张高度，也错误地缩放了固定 20px 页间距。改为累计已知纸张高度和未缩放的间距；重新挂载页面复用尺寸缓存；页面窗口和异步尺寸更新也在 React 更新前捕获/更新后恢复阅读锚点，移除尺寸更新引起的重复横向居中。

## 新增测试结果

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `node scripts/run-vitest.cjs run src/main/release-2.0.56.test.ts src/renderer/src/lib/release-2.0.56.test.ts` | 新增 7 项全部通过；未运行旧测试 |
| `npx --no-install electron-vite build` | 通过；使用新 out 生成应用 |
| `node scripts/release-2.0.56-ui-smoke.cjs` | 通过：首页 Logo 和 AI 警告框分别覆盖十语言 × 两主题 × 四字号；按钮上留白 ≥16px；取消不保存授权、接受后正确打开自动批注 |
| 新增缩放 UI | 通过：真实 Ctrl+滚轮、工具栏加减、同帧快速滚轮、页间空隙、400% 上限、短文档连续/单页、96 页混合尺寸虚拟化、LTR/RTL；最大测量偏移 0.2663px，要求 <2px |
| 图标 | 应用/文档图标共 20 个标准/Retina 表示经系统 iconutil 解码；16/32px 使用原生 ARGB。包内两份 ICNS 与源文件逐字节一致 |
| 成品新增 UI | 在用户停止成品复测的消息到达前已通过；同样最大偏移 0.2663px，无 renderer/passive-wheel 错误。之后未再复测成品 |
| 包内资源 | 消息到达前已核对 Info.plist/app.asar 为 2.0.56，应用图标为 icon.icns；主进程、预加载、最终 JS/CSS 与通过测试的生产资源逐字节一致 |
| `git diff --check` | 通过；使用工作区内置 Git，避开系统 Git 的 Xcode 许可问题 |

为了避免今后版本升级破坏旧单元测试，只将旧 2.0.55 测试中的固定版本断言改为版本来源一致性断言，没有执行该旧测试。新增测试脚本使用临时 PDF 与独立用户资料，关闭自己启动的窗口，不替换 `/Applications` 中的应用，不修改默认 PDF 应用，不发送 AI 请求。

结果和截图：`output/playwright/release-2.0.56-source.json`、`release-2.0.56-packaged.json`，以及对应 welcome、consent-rtl、zoom-zh、zoom-ar、16/32px 图标 PNG。成品原生应用小图标导出为 `release-2.0.56-native-app-small.png`。本机默认 PDF 应用仍为 `/Applications/PDFuck.app`，没有自动安装新版本。

在页面小于视区或滚动达到文档边界时，浏览器会限制可滚动范围；测试中的精确鼠标锚定测量使用存在可用滚动范围的场景。此版本继续保留原来的无鼠标位置时草稿/选区焦点和自动适合宽度行为。

## 交付

macOS arm64，Electron 43.4.0。从本轮生产 out 直接打包 .app，经 ad-hoc 签名；消息到达前 `codesign --verify --deep --strict` 已通过。没有 Developer ID 签名、未公证。DMG 由 electron-builder 从签名后的具体 .app 生成，ZIP 由 ditto 生成。没有生成 Windows 安装包或执行 Windows 成品测试。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `PDFuck-2.0.56-macOS.dmg` | 276954420 | `1e157f0f641ed1e4e10e7fc39ef2e51f756cc02c5cab412e497c1aca0ae41652` |
| `PDFuck-2.0.56-macOS.zip` | 277052035 | `001535c948f9d9036c83a9a74d3a5d7a2725d4c546cab438551522ea5bc830e2` |

交付目录：`release/`。清单：`PDFuck-2.0.56-macOS-release.json`；校验文件：`PDFuck-2.0.56-macOS-SHA256SUMS.txt`。
