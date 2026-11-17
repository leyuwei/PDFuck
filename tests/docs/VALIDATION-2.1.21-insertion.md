# 插入标记基线与自适应高度验收

用户确认竖线位于字符间隙，并反馈三角仍偏低后，最终采用真实文字基线，而非字框底部。竖线约为字号高度的 55%；三角下缘只略过基线，不向下一行延伸。预览、SVG 和原生 PDF 外观使用相同几何，RTL 下 SVG 明确固定在标记矩形左上角。沿用十语言，无新界面文案或生产依赖。

仅执行本轮新增专项：

- `node tests/scripts/run-vitest.cjs run tests/unit/renderer/insertion-alignment-2121.test.ts`：19 项通过。6/8/12/24/48 字高、空白页默认、四种页面旋转的矩形往返、保存/改色/移动/重开、无效字高拒绝、旧标记显式修正及撤销/输入校验、外部 Caret 保持定位、自动批注前后插入使用真实基线。
- `node tests/scripts/release-2.1.21-insertion-documents.cjs`：四份已有脱敏归档文件，12 组页面/缩放检查，共 1,713 个插入点，逐点检查本行位置和与下一行正文的间距。包含 2.1.19 两份、2.1.21 行号页及 crossflow 双栏页；缩放 0.65/1/2。
- `node tests/scripts/release-2.1.21-insertion-ui.cjs`：11 项交互与十语言布局通过。中文字符间隙、8/12/24/48 字号、预览和新建一致、右键和选区工具栏、旧标记原生外观修正、实际关闭标签后从保存文件重开不重复偏移，以及两份归档正文窗口。复核不同字号和密集正文截图。
- `node tests/scripts/release-2.1.21-insertion-native.cjs`：PDF.js 独立渲染实际保存 PDF 的 7 个原生标记，检查蓝色图形像素与保存矩形一致；不是仅检查应用叠加层。结果与截图见 tests/output/release-2.1.21-insertion。

类型检查、直接生产构建和 diff 检查通过。为新字高/几何更新了旧测试预期，本轮未执行旧测试文件或全集。README、package.json 与锁文件 SHA-256 不变，版本保持 2.1.21。

保存/导出/打印当前文档时，读取旧版自建标记附近文字的基线与字高，先在模型副本中更新外观，序列化成功后才替换模型，支持撤销；外部阅读器创建的 Caret 不自动改变定位。

备份旧 DMG/ZIP/校验清单后，重建 macOS arm64 APP，补齐 ad-hoc 签名，再生成 DMG/ZIP；新增 `release-2.1.21-insertion-package-check.cjs` 静态核验生产字节、版本、资源/许可证、签名、DMG、ZIP 和 SHA-256，输出 release/PDFuck-2.1.21-macOS-release.json。

未运行旧测试全集、未启动成品复测；Windows、Intel、真实覆盖安装及旋转页原生图形方向未实测。macOS 包未公证。
