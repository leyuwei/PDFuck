# 浮层、图中文字与引导持久化验收

版本保持 2.1.21。README、package.json、锁文件与开始时 SHA-256 一致。

仅运行本轮新增专项：

- `node tests/scripts/run-vitest.cjs run tests/unit/renderer/visual-region-selection-2121.test.ts tests/unit/renderer/insertion-appearance-2121.test.ts tests/unit/renderer/guide-persistence-2121.test.ts`：15 项通过。覆盖图内正反选择/越界/邻图/正文隔离/表格限制，PDF 插入标记保存、改色及重开，新用户、历史迁移、跨版本完成状态及存储异常。
- `node tests/scripts/release-2.1.21-overlays-ui.cjs`：7 项交互检查及十语言×明暗主题 20 组布局通过。合成双页矢量图 PDF，真实右键/拖选/内部链接跳转；批注列表与文内模式仅显示一张合并卡片，Markdown、状态操作正常；一键图表覆盖仍存在；返回按钮滚动不移位，与临时提醒、进度及页码错开。截图复核后修正了零高度纵向提示栈的对齐方式，并新增查看区上边界断言。
- `node tests/scripts/release-2.1.21-guide-persistence-ui.cjs`：3 项通过。实际进程重启验证跳过持久化、关于手动入口、旧版本标记迁移后不再自动引导。

类型检查、直接 `electron-vite build`、diff 检查通过。原有 PracticeGuide 测试中“更新后重弹”的预期已按新需求修正，本轮未运行该旧测试文件。未运行旧测试全集。

旧 DMG/ZIP 与校验清单备份到 release/backups。重建 macOS arm64 APP，补齐 ad-hoc 签名后生成 DMG/ZIP；新增 `release-2.1.21-overlays-package-check.cjs` 静态检查成品生产字节、签名、安装镜像、资源/许可证、版本及 SHA-256。结果见 release/PDFuck-2.1.21-macOS-release.json。

未启动成品复测，未实测 Windows/Intel 和真实覆盖安装；macOS 包未公证。图中文字须有 PDF 文本对象，纯轮廓路径和位图沿用 OCR。
