# 2.1.10 验证与交付

日期：2026-10-19。平台：Windows x64。清单及锁文件同步为 2.1.10，未新增依赖。

## 修改及根因

`785904351dabdab98176b914912cc8dd.pdf` 两页均是双栏，真实栏沟为 x≈300.03–311.98pt。旧算法只计算共用视觉基线的左右间隙，要求支持行数至少占全页基线数 20%。公式、分式和上下标增加基线数，左右两栏又错行；第 1 页 71 行只有 12 次栏沟支持，第 2 页 75 行只有 14 次，都低于 15 次门槛，因此漏检。

共享 `textItemsToWordBoxes` 现在合并相距不超过 1.25 个中位字高的邻近行的横向覆盖，再提取共同空白走廊。相邻正文可填满普通词间距，两栏也可在不同基线上共同支持真实栏沟。继续使用重复边缘与穿越文字限制，并要求支持证据至少是穿越证据的两倍，防止第二页的公式编号间隙被额外识别为一栏。没有为文件名、页号或中央 x 坐标写特例。

实际栏线为第 1 页 **306.002448pt**、第 2 页 **306.001836pt**；源码及成品一致。自动栏线、阅读顺序、鼠标/查询选区和页面文字编辑仍使用共享几何。手动边界及强制单栏继续优先。工具条改为允许文字与按钮换行、限制子项宽度，修复俄语在较大界面字号下溢出；延用现有明暗主题、翻译与 RTL 方向。

## 测试目录

逐文件迁移 284 项：101 个单元/组件测试、103 个原有测试脚本、14 份原始 PDF、66 份版本计划/验收文档。[migration-map.json](../migration-map.json) 现仅保留 270 项代码/说明文件的对应关系；14 份样本均已改为随机匿名名称，并移除原名映射。此外将原根目录 `tmp/`、`output/` 整目录保留到 `tests/tmp/`、`tests/output/`，包括历史缓存和结果；正式输入与生成文件分开保存。

所有 import/mock、拆分的 `path.join` 样本路径、package 命令、两平台发布脚本、TypeScript/Vitest 配置、中英文 README 和打包指南同步更新。Vitest 只发现 `tests/unit/`，类型检查继续覆盖迁移后的用例。`.gitignore` 未添加或修改；测试代码、样本和说明均可被 Git 跟踪，运行缓存/输出沿用原有忽略规则。生产 ASAR 不包含测试。

## 本轮新增检查

按用户要求只执行本轮新增项和必要构建检查，没有运行历史全集、`npm run build`、`dist:win` 或一键全量发布。

| 检查 | 结果 |
| --- | --- |
| 新增 `release-2.1.10.test.ts` | 12 项通过：真实两页，50%/75%/100%/216%/300% 五种缩放、原生字体度量、双向选区与邻栏隔离；错行双/三/四栏、短行、窄沟、密集上下标与分式、跨栏内容；中英/阿拉伯文、单栏与矩阵/编号误报、手工覆盖；迁移完整性、样本 SHA-256、版本与 gitignore 不变。首轮几何 11 项通过；校正迁移检查的 CRLF 比较后只重测该项并通过。 |
| 新增 `check-test-layout.cjs` | 270 个代码/说明迁移目标存在、原路径消失；样本匿名命名及引用单独核对；106 个 CJS 脚本静态解析通过，289 个本地引用可解析；不执行历史用例。额外静态检查 npm 单文件路径与 Markdown 本地链接。 |
| `npm run typecheck` | 通过，包含全部迁移后的单元/组件测试及新增用例。 |
| 直接 `electron-vite build` | 通过；PDF.js 的资源 URL 提示沿用原配置，实际资源由构建插件复制并作包内字节校验。 |
| 源码新增 UI | 两页各一条真实自动栏线；每页真实鼠标正反向跨行选择、复制均通过，选区不跨入邻栏。十语言 × 双主题 × 四字号共 80 组工具条边界/换行检查通过，无未翻译键或页面错误。 |
| 解包成品新增 UI | 同样的两页、4 次选择/复制及 80 组布局通过；核实运行版本 2.1.10、isPackaged 及 app.asar。 |
| 新增便携检查 | 实际启动本轮便携 EXE，运行版本 2.1.10，两页自动栏线及 4 次正反向选区隔栏检查通过；便携阶段未读取剪贴板。 |
| 新增包内核验 | 210 个生产文件逐字节一致；11 个 OCR 模型、PDFium 和 Koffi 完整；ASAR 中无 tests；三个 EXE 的版本和 SHA-256 已核对，Authenticode 均为 NotSigned。 |
| `git diff --check` | 通过。 |

源码/成品布局中发现俄语 16pt 按钮溢出后修复 CSS，并仅对本轮新增 UI 检查重新验收。原有界面行为的历史全量回归未执行。

新 UI 可通过 `--checks=behavior`、`--checks=layout` 单独复测；定向完整命令见 [测试说明](../README.md)。截图及机器记录：

- [源码 JSON](../output/release-2.1.10/source/result.json)、[成品 JSON](../output/release-2.1.10/packaged/result.json)、[便携版 JSON](../output/release-2.1.10/portable/result.json)。
- [第一页成品栏线](../output/release-2.1.10/packaged/page-1-boundary.png)、[第二页成品栏线](../output/release-2.1.10/packaged/page-2-boundary.png)。
- [成品阿拉伯语／深色／最大字号](../output/release-2.1.10/packaged/arabic-dark-large.png)。已目视检查源码与成品的对应布局。

## 交付

构建命令：`npx --no-install electron-builder --win --config.electronDist=node_modules/electron/dist`。

| 产物（绝对路径链接） | 字节 | SHA-256 |
| --- | ---: | --- |
| [PDFuck-2.1.10-Windows-Setup.exe](<C:/Users/Yuwei Le/Documents/GitHub/PDFuck/release/PDFuck-2.1.10-Windows-Setup.exe>) | 221,961,022 | `b0665e3276cd53d25b92f0fef383aa5f3dcce09e8b97930a903016cffbed99c5` |
| [PDFuck-2.1.10-Windows.exe](<C:/Users/Yuwei Le/Documents/GitHub/PDFuck/release/PDFuck-2.1.10-Windows.exe>) | 221,577,822 | `8783db839f4b960cebbc77ef15557a22c911e1e4820334be72f81cf1767f735d` |
| [PDFuck.exe](<C:/Users/Yuwei Le/Documents/GitHub/PDFuck/release/win-unpacked/PDFuck.exe>) | 225,589,248 | `b74f9970b1c76ae730b06b97f5d85c79adfa2d422f5edf129e0af07c2ed78ec4` |

三个 Windows EXE 均未签名（`NotSigned`）；本机未配置可信代码签名证书，系统可能显示未知发布者提示。

[发布 JSON（含绝对路径、版本、签名与验收范围）](../../release/PDFuck-2.1.10-Windows-release.json) · [SHA-256 清单](../../release/PDFuck-2.1.10-Windows-SHA256.txt)。

## 验收范围

本版后续样本匿名化：14 份实际 PDF 均改为随机 32 位十六进制文件名，逐文件 SHA-256 与改名前一致；6 份缺失历史输入的代码及说明引用同步匿名化。原名对照从迁移记录移除，迁移脚本也不再将样本别名写入记录。新增静态检查约束匿名命名并校验当前样本及已注明缺失样本的引用。重命名后的 12 项定向测试、类型检查、静态引用/本地文档链接和 diff 检查通过；新路径下实际打开两页、4 次双向选区/复制冒烟通过。此次仅更改样本名、测试引用、说明和一处生产代码中的样本注释；未更改 PDF 内容或既有 Git 历史。

本机为 Windows，未执行 macOS 构建及实机验收，未执行真实系统安装、UAC、更新/卸载或更改默认文件关联。部分历史样本在迁移前已缺失，详见 [样本说明](../fixtures/README.md)；相关用例没有被写成通过，也未用其他文件代替。此次所有新增检查使用随代码提供的真实样本，不依赖外部服务。
