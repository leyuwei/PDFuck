# PDFuck 2.2.2 大 PDF 单页提示

单页编辑和批注的说明放在画布上方，随着窗口可用宽度换行。提示显示整份文档中的当前页与总页数，并解释逐页加载如何降低内存占用。多页文档显示页码栏提示。超限页说明可以在原图上叠加的内容。“返回全文”复用查看模块的切换操作，保留当页和待保存的改动。

新增源码专项以 18 页大文件、单页超过 1 GiB 的合成图纸和普通 PDF 验证提示。覆盖十种语言、两种主题、四档预置字号的代表性组合，以及阿拉伯语从右至左排版。检查最小窗口宽度下的按钮、文字对比度、画布布局、收起侧栏、换页更新、键盘返回和改动保留。

2026-11-26，Windows x64 源码专项、类型检查和生产构建通过。测试在第 4 页添加文字，切到第 5 页后返回全文，随后重新进入第 4 页确认改动仍在。超限图纸与普通 PDF 的提示条件通过。

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.2-large-page-notice-ui.cjs
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
node tests/scripts/release-2.2.2-package-check.cjs --large-page-notice --source-only
```

专项结果写入 `tests/output/release-2.2.2-large-page-notice/results.json`。成品记录版本、签名状态和 SHA-256。
