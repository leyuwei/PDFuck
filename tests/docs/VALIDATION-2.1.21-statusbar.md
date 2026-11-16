# 2.1.21 状态栏补修验收

仅调整 App.tsx 和 overrides.css 的 PDF 状态栏。选区统计组在右侧排列，计数与文字预览之后始终保留独立页码；预览过长时缩略，不挤掉页码。版权位置、中部下载进度以及 Markdown 字数/编码统计继续正常显示，沿用十语言文案。

本轮仅执行新增窗口专项：

```sh
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.1.21-statusbar-ui.cjs
```

40 组布局通过：十语言 × 明暗模式 × 1440/1080 两种窗口宽度，检查短/长选区在右侧、选区与版权有独立间距、页码贴右并保持完整、清除选区后页码不变。另有 4 项状态检查通过：无文档、第二页选区、下载进度共存、Markdown 统计。截图位于 tests/output/release-2.1.21-statusbar。

类型检查、生产构建、diff 检查通过。README、package.json、package-lock.json 的 SHA-256 与本轮开始一致；版本保持 2.1.21。没有新增文案或生产依赖，也没有更改 PDF 数据与选择算法。

备份旧产物后重打 macOS arm64 APP/DMG/ZIP，补齐并严格核验 ad-hoc 签名。新增 `release-2.1.21-statusbar-package-check.cjs` 检查生产文件逐字节一致、版本、资源/许可证、DMG、ZIP 和 SHA-256，输出 release/PDFuck-2.1.21-macOS-release.json。

未运行旧测试全集，未启动成品复测；Windows、Intel 及真实覆盖安装未实测。未公证。
