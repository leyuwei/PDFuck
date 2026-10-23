# 2.1.11 图框可见范围修复与重新交付

日期：2026-10-23（Asia/Shanghai）。平台：macOS arm64。版本保持 2.1.11，替换原同名 APP / DMG / ZIP。计划见 [PLAN-2.1.11.md](PLAN-2.1.11.md)。

## 本轮根因与修复

实际输入已按既有测试目录和匿名命名规则整理到 [测试样本](../fixtures/c51a56aedd2c14bdb9350163dc6d7217.pdf)，共十页、921,003 字节。SHA-256：`862e793beda6e35d0602c9fc65bb2dce1e4d37a856632d9bddb25182aaeaff97`。原始字节保持一致，不保留原名映射；未改写用户的原始 PDF。

**超大图框来自不可见绘图路径。** 第 2、3、7 页的 Form 图形内含超大背景填充，实际绘制时受 Form BBox 及路径裁剪约束。旧解析只看路径范围和纸张 CropBox，没有读这些局部裁剪，因此把看不见的部分合并进图框。三个错误框分别膨胀到约 `540×504`、`612×535`、`422×752`，吞入旁栏和下方正文。

共用 `pageGraphics` 现在跟随 Form 的矩阵和 BBox、clip/eoClip 消费路径、透明组边界及 save/restore；普通图像、重复图像、掩膜和矢量路径都先裁到当前绘图范围。空裁剪不产生证据，裁剪边界自身不被当成图片；退出嵌套对象后恢复父级坐标和裁剪。正文隔离、页面绘制、懒加载、页面快照与一键图表均使用同一入口，不额外添加依赖。

**多分图及图注一并修复。** Figure 3 原来被列成两个无名区域，Figure 6 的六个分图各自列出，部分区域与总图注重叠。现在只在总图注和连续 `(a)、(b)…` 标记均有明确证据时归组；出现另一图注或中间正文时不归并。图注间距使用图注自身的字号，避免小字图形内标签拉低阈值而漏掉图注。包含两栏正文的错误大框也能被排除；真正占据整页的大图保留。

三处用户报告的图框修复结果（612×792 页面坐标，包含完整图注，四舍五入）：

| 页面 / 图 | 左、上 | 右、下 | 范围检查 |
| --- | --- | --- | --- |
| 第 2 页 Figure 1 | 49、56 | 300、274 | 右栏 435 个文字框、下方 603 个文字框均保持正文 |
| 第 3 页 Figure 2 | 49、56 | 300、324 | 右栏 467 个文字框、下方 536 个文字框均保持正文 |
| 第 7 页 Figure 5 | 49、57 | 300、299 | 右栏 509 个文字框、下方 627 个文字框均保持正文 |

右栏与下方统计可重叠。第 4 页 Figure 3 的两个分图及第 8 页 Figure 6 的六个分图各归入一个条目，分图标记和完整图注均被隔离。第 6 页 Figure 4 正常保留，下方正文在框外。其余第 1、5、9、10 页不产生图表误报，整份输入最终正好六个 Figure 条目。

## 本轮新增测试

仅执行本轮新增项及必要类型、构建、资源与 diff 检查；首轮及上一轮批注测试结果属于历史记录，未计为本轮重测。

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/lib/release-2.1.11-visual-bounds.test.ts` | 新增 12 项通过；别名 `npm run test:release-2.1.11-visual-bounds` |
| `npx --no-install electron-vite build` | 通过 |
| `node tests/scripts/release-2.1.11-visual-bounds-ui.cjs` | 源码实际窗口通过 |
| `PDFUCK_SMOKE_EXECUTABLE=.../PDFuck.app/Contents/MacOS/PDFuck node tests/scripts/release-2.1.11-visual-bounds-ui.cjs` | 最终 APP 实际窗口通过 |
| `node tests/scripts/release-2.1.11-package-check.cjs` | 最终包资源、版本、签名、镜像和 ZIP 通过 |
| `git diff --check` | 通过 |

12 项单元覆盖：Form 背景裁剪及退出恢复、空 Form 不产生图片、嵌套矩阵及旋转视区、两种路径裁剪及同时绘制、空/不相交裁剪与父裁剪恢复、八种图像实例路径、透明组与 Form 不重复变换、零宽可见表格线/完全隐藏对象/null 边界、正文跨图双向选择、六分图完整图注、小标签与大图注间距、正文/独立图注阻止错误归组、两栏正文大框误报。

新 Electron 脚本逐页检查十页归档输入，断言图框边缘、图注、正文及分图隔离，并渲染每页带框 PNG；另检查现有 `0e86a90471d190285a1db37076d60656.pdf` 的第 3/17 页，完整保留 Table I 和带表注的 Table VI。实际窗口点击六个索引定位，逐项读取真实淡色框坐标与预期对比；对 Figure 1 右栏正文实际执行正向、反向拖选和剪贴板复制。源码和最终 APP 各执行一次。没有调用外部 AI 服务。

[源码结果](../output/release-2.1.11/visual-bounds-source/result.json) · [成品结果](../output/release-2.1.11/visual-bounds-packaged/result.json)

[Figure 1 成品窗口](../output/release-2.1.11/visual-bounds-packaged/index-figure-1.png) · [Figure 2 成品窗口](../output/release-2.1.11/visual-bounds-packaged/index-figure-2.png) · [Figure 5 成品窗口](../output/release-2.1.11/visual-bounds-packaged/index-figure-5.png)

逐页渲染人工核对了六个有图页面：三个异常框均收敛到左栏图和完整图注，Figure 3/6 的总框仅覆盖整组分图和图注，Figure 4 下方正文未被包含。

## 当前交付

- [APP](../../release/mac-arm64/PDFuck.app)
- [PDFuck-2.1.11-macOS.dmg](../../release/PDFuck-2.1.11-macOS.dmg)
- [PDFuck-2.1.11-macOS.zip](../../release/PDFuck-2.1.11-macOS.zip)
- [发布清单：字节、SHA-256、资源与本轮成品结果](../../release/PDFuck-2.1.11-macOS-release.json)
- [SHA-256 校验清单](../../release/PDFuck-2.1.11-macOS-SHA256.txt)

包内版本、锁文件、Info.plist 与 app.asar 均为 2.1.11；全部生产文件逐字节匹配，11 个 OCR 模型和图标齐全。APP 及 DMG 内 APP 的 ad-hoc 签名通过深度严格校验；DMG 校验和、Applications 快捷方式、Finder 图标标记、双分辨率背景和扁平布局通过；ZIP 完整性、app.asar 和签名清单一致。字节数和哈希以本轮重新生成的发布清单为准，旧包哈希已作废。

未新增项目依赖；已有 `.gitignore` 覆盖环境、构建、临时输入和测试输出，无需修改。原始测试 PDF 可被 Git 跟踪，原有 `.DS_Store` 修改保留。

## 之前两轮功能与历史证据

首轮保留实验室思考区/取消按钮留白、CJK 选区完整高度、状态栏左侧 12px、淡色图表隔离及单项索引。首轮结果在 `tests/output/release-2.1.11/{source,packaged,papers}/`。

上一轮已修复 CropBox 外图表、部分可见/旋转裁切页面及实验室多轮批注：共享写入按原文精确矩形交集和跨页组归并，独立说明按段落去重，可执行改写保留最新完整版本及其原文范围；保留人工改动/回复，锚点持久化，支持保存重开、幂等、原子回滚及撤销/重做。上一轮 18 项单元和窗口结果在 `followup-source/`、`followup-packaged/`，包含两类自动检查 × 两轮、两次润色及保存重开。本轮没有把这些旧报告写进新的包验收结果。

## 范围与限制

未运行历史全量回归，未构建 Windows 包或执行系统安装/卸载。macOS 产物为 arm64、ad-hoc 签名，未做 Apple 公证。图表识别采用保守几何证据；任意不规则裁剪轮廓当前按外接矩形处理，未实现逐像素语义识别，不承诺任意 PDF 零误差。
