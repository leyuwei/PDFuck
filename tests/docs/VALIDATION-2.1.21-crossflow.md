# 2.1.21 跨栏连续选择补修验收

用户澄清本次操作是主动跨栏，预期为连续阅读范围；旧行为只选中两栏相近高度的文字带。README、package.json、package-lock.json 的 SHA-256 与本轮开始时一致，版本仍为 2.1.21。

在实际文件第 10 页复现：两栏正文共用块编号 5，旧几何分支把范围限制在端点的高度带，只得到 14 个矩形。共用 `textSelectionBetween` 对明确的普通正文跨栏改用阅读顺序；目标栏上方的普通块不再因编号不同而遗漏。该范围现在有 55 个矩形，保留左栏余下内容和右栏开头至终点。单栏共享块限制在当前栏；图表区域、真实跨栏公式和表格单元格继续走既有规则。

本轮新增检查：

```sh
node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/lib/release-2.1.21-crossflow.test.ts --reporter=json --outputFile=tests/output/release-2.1.21-crossflow/unit.json
node tests/scripts/release-2.1.21-crossflow-selection.cjs
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.1.21-crossflow-ui.cjs
```

- 初始 7 项新增单元在旧代码上 4 项失败，覆盖共享块、相同高度终点和目标栏上方块丢失。修正后扩展至 11 项全部通过，包含正反向、局部字符、RTL、单栏隔离、图表、跨栏公式和单元格保护。
- 实际第 10 页与脱密副本 × 三档缩放 × 两种字体，共 12 组、144 个跨栏范围；逐字核对阅读范围、逆向结果相同，并独立检查起始栏底部和目标栏上方的几何覆盖。预期没有按端点高度先过滤词语。
- 源码 Electron 隔离配置共 16 次真实拖选通过：两个输入、两档缩放，各检查正向、反向、同高终点的跨栏连续选择及单栏隔离。原件使用完整 13 页文件的第 10 页。公开截图只使用替代文字的脱密页。
- 脱密副本 `tests/fixtures/fd554c1d917585050064b3f150a392f7.pdf` 仅保留替代文字、合成字体和几何；隐私审核排除原始长文本、图像、链接、批注、附件及元数据，源文件 SHA-256 不变。清单见 `tests/fixtures/release-2.1.21-crossflow-inputs.json`。
- 类型检查、直接生产构建和 diff 检查通过；无新增生产依赖。

重打同版本 macOS arm64 APP、DMG、ZIP；旧产物保存在 `release/backups`。新增静态包检查 `release-2.1.21-crossflow-package-check.cjs` 验证全部生产文件与 ASAR、版本、资源/许可证、签名、DMG Finder 布局、ZIP 和 SHA-256，以及 README/package/lock 未改。报告仍输出 `release/PDFuck-2.1.21-macOS-release.json`。

仅运行本轮新增测试，未重跑历史全集或启动成品复测；未验证 Windows、Intel 与真实覆盖安装。macOS 为 ad-hoc 签名，未公证。
