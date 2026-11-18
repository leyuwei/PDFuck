# PDF 2.2.0 缺字修订验收

## 根因

原件同页同时使用 WinAnsi 和 Identity-H 字体。旧画布曾跳过可提取的字母、数字和汉字。嵌入 TrueType 的字形位置数据无法按常规字形表完整解码。PDF.js 校验后仍能通过 PDF 编码或 ToUnicode 获得文本，但把缺失的字形标为 `isInFont: false`，画布因此跳过这些位置。关闭浏览器字体接口、改用 PDF.js 字形轮廓仍然缺字。

新版在字体子集缺少可用字形且存在可用 Unicode 映射时，按原坐标、字距及填色或描边调用系统字体。普通字形走原有渲染路径。隐形 OCR 文字、纯裁剪文字、无可靠映射和仅含空白或占位符的字符仍不补绘。查看和打印预览使用同一字体补绘逻辑，CMap 和标准字体资源默认从应用本地加载。此变更没有新增界面文案。

## 新增源码专项

| 检查 | 结果 |
| --- | ---: |
| 十种界面语言 × 两种缩放 × 11 个正常及缺失字形的画布像素 | 220 处通过 |
| 隐形、纯裁剪、不可用映射及无映射位置 | 120 处保持空白 |
| 每次画布测试的可见描边字形与 PDF 描边颜色 | 20 处通过 |
| 内置 CMap 支持的日文字形 | 60 处通过 |
| 打印预览中的嵌入、补绘和 CMap 字形 | 14 处通过 |
| 实际拖选与复制 | 1 次通过 |
| 原件旧画布的空白字位置 | 18 个汉字、60 个数字和 1 个拉丁字母恢复 |
| 脱密归档页显示与可选文本 | 1 页通过 |

执行本轮新增的 `tests/scripts/release-2.2.0-glyphs-ui.cjs`。合成回归件为 `tests/fixtures/release-2.2.0-glyph-regression.pdf`，可由 `tests/scripts/make-glyph-fixture-220.py` 重建。原件像素探针使用未修复源画布和原件字符边界交叉取得，报告保存统计和坐标。

另执行 `npm run typecheck`、`node_modules/.bin/electron-vite build` 和 `git diff --check`。README 与原件 SHA-256 保持一致。

## 脱密归档

`tests/fixtures/43758d35fbe94821a2cb6e877c271bd6.pdf` 保留页尺寸、文本位置和表格线。正文为合成文字，图像以新图形替代。新建 PDF 不继承原件的字体文件、图片、元数据和嵌入对象。清单见 `tests/fixtures/release-2.2.0-glyph-inputs.json`。

## 打包验证

执行 `node tests/scripts/release-2.2.0-package-check.cjs --glyphs` 静态核验 macOS arm64 APP、DMG、ZIP、包内生产字节、签名、脱密件未打入安装包及 SHA-256。交付版使用临时签名，保持 2.2.0。测试在打包前运行，成品未启动。
