# 定位稳定、高亮与 AI 报告验收

版本保持 2.1.21，README、package.json 和锁文件与本轮开始 SHA-256 一致，保留此前修订。

本轮仅运行新增专项：

- `node tests/scripts/run-vitest.cjs run tests/unit/renderer/focus-stability-2121.test.ts tests/unit/renderer/ai-report-clarity-2121.test.tsx`：21 项通过。覆盖目标已可见/视口边缘不滚动、视野外直接显示、超大目标、文内卡片满视口，以及十语言报告结构、完整回复、自动批注可读条目/空结果、安全 Markdown、无内部 JSON。
- `node tests/scripts/release-2.1.21-focus-ui.cjs`：15 项通过。连续与单页模式下搜索、书签、批注的视野内/外定位；85 页虚拟化远端书签；高亮超过一秒仍清晰并于 5 秒后淡出；文内卡片显示不滚动文档。记录视口滚动轨迹，目标显示后无二次位移，无 PDF 页内 scrollIntoView 调用，高亮无缩放变换。
- `node tests/scripts/release-2.1.21-report-pdf.cjs`：11 份真实 PDF 通过。通过应用真实 IPC/Chromium 排版导出十语言报告和长篇回复，逐页提取文字验证回复/原文/建议/原因完整，长报告包含第 120 条和最后标记；无提示词、内部标识/JSON、追加原 PDF 或附带原文。生成安全的合成旧版 sourcePdf/sourceText 请求验证不会混入成品。复核英文报告截图。

类型检查、直接生产构建、diff 检查通过。旧报告测试的预期已按新需求更新，本轮未执行该旧文件，未运行旧测试全集。没有新增生产依赖。报告新增标签完整覆盖十语言。

先备份旧 DMG/ZIP 与校验清单，再重建 macOS arm64 APP 并补齐 ad-hoc 签名，生成 DMG/ZIP。新增 `release-2.1.21-focus-package-check.cjs` 静态核验生产字节、版本、签名、安装镜像/ZIP、资源与许可证、README 不变及 SHA-256。结果见 release/PDFuck-2.1.21-macOS-release.json。

未启动成品复测；Windows、Intel 与真实覆盖安装未实测，macOS 包未公证。
