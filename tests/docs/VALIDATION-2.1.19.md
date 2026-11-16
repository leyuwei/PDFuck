# 2.1.19 验收

日期：2026-11-16，macOS arm64；README 不变，无新生产依赖。

## 改动

- 检测到稳定双栏时，选区中段以实际栏缝约束正文流，使用单词几何判断归属，避免端点的窄字体片段裁掉中间文本，也避免范围扩张到邻栏。表格与图表仍沿用既有独立选择域。
- 可缩放浮窗的共用控制器支持上下左右四边和角点拖动，保持对边位置；实际尺寸逐帧更新并沿用原有尺寸持久化。
- 全局应用内按钮提示从已有 data-hint、title、aria-label 或可见文字取内容；支持禁用按钮、子元素移动、键盘焦点，点击、滚动和失焦清除。提示保持在视口内并关联 aria-describedby。缩放与翻页补齐十语言标签。
- 重绘适合宽度/页面图标；页码浮层背景固定为 58% 不透明度，明暗主题分别取色。

## 两份输入脱密

文件为 `tests/fixtures/688ba7ffc4b452610cdde9ad379c27c3.pdf` 和 `tests/fixtures/49d7d5d4cb95feae7b946643301253e5.pdf`，各一页；清单 `release-2.1.19-inputs.json`，同时更新总清单 `sanitization-manifest.json`。

沿用现有重建器，替换文字、数字和特殊字符，只保留字符几何与直线框线。原始字体、图像、批注、链接、附件、元数据不复制。125 行长原文检查未残留，原件只读且哈希未变。原始 PDF/截图不放入仓库或安装包。审计：`tests/output/release-2.1.19/privacy.json`。

## 仅本轮新增检查

- `node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/components/Release2119.test.tsx`：17 项通过，涵盖四边尺寸/对边固定、提示悬浮/禁用/焦点/恢复、十语言标签及窄片段正文流。
- `node tests/scripts/release-2.1.19-selection.cjs`：原件只读输入和脱密副本、三档缩放、原生字体/后备度量，共 24 组配置、360 个段落范围。选择中段几何覆盖、邻栏排除、反向结果一致通过。端点取行中不同位置；旧 HEAD 代码对同一新增测试会出现中间词块漏选，修复版通过。旧代码对照是新增专项中的复现，不是历史测试重跑。
- `node tests/scripts/release-2.1.19-ui.cjs`：9 组专项通过，包括禁用按钮提示，中英阿语言提示、RTL 模型设置窗口四边拖动、明暗主题页码背景 alpha=0.58，以及两份脱密 PDF 的实际窗口拖选。四次实际边沿拖动均改变尺寸并保持对边。renderer 无异常。
- `npm run typecheck`、直接 `npx --no-install electron-vite build`、`git diff --check` 通过。

结果位于 `tests/output/release-2.1.19/{unit,selection,ui,privacy}.json`。未运行旧测试全集或历史 UI 脚本。PDF.js 对用户原件的 XFA 富文本解析输出一条警告，正文解析及本轮选择检查完成；Vite 动态 PDF.js 资源 URL 提示保留，实际 PDF 窗口可渲染。

## 交付与边界

当前平台打包 `release/mac-arm64/PDFuck.app`、`release/PDFuck-2.1.19-macOS.dmg` 和 `release/PDFuck-2.1.19-macOS.zip`。新增静态核验：`node tests/scripts/release-2.1.19-package-check.cjs`；版本、生产资源、签名、DMG/ZIP 和 SHA-256 写入 `release/PDFuck-2.1.19-macOS-release.json` 及校验文本。

未做 Windows/Intel 构建或实机验证；四边操作和提示使用共用跨平台代码。macOS ad-hoc 签名，未公证；成品只做静态校验，没有启动成品重跑 UI。本轮不向 AI 服务提交文档，也不重跑 OCR/打印等旧功能测试。
