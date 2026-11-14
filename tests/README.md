# 测试与验收

从仓库根目录执行命令。2.1.10 起，测试代码和依赖统一放在此目录；生产构建、图标及打包脚本仍在根目录 `scripts/`。

| 目录 | 内容 |
| --- | --- |
| `unit/` | 迁移的 101 个单元/组件测试文件，镜像原 `src/` 结构；新增版本用例也放在这里 |
| `scripts/` | Vitest 运行器、审计、Electron UI、便携版与包内资源检查 |
| `fixtures/` | 可复用脱敏输入，包含 `785904351dabdab98176b914912cc8dd.pdf` 两页回归样本 |
| `docs/` | 各版本计划、验收和交付记录 |
| `tmp/` | 运行中的临时 PDF、隔离用户配置，以及原根目录 tmp 的历史缓存 |
| `output/` | 截图、JSON 结果及原根目录 output 的历史输出 |
| `migration-map.json` | 270 个代码/说明文件的迁移对应关系；不保留样本的原文件名或整目录缓存/输出的对应关系 |

本次未添加或修改任何 `.gitignore`。测试代码和脱敏样本可被 Git 跟踪；临时目录和生成输出沿用仓库已有的 `tmp/`、`output/` 忽略规则。旧缓存/输出保留原内容，历史临时脚本不作为正式测试入口；不要从旧缓存恢复生产构建。

所有 PDF 样本使用随机的 32 位十六进制文件名。2.1.16 已将公开样本全部重建为替代内容，原始 Git 历史不作自动改写，详见夹具说明。

## 2.1.17 按需资源（最新）

只运行本轮新测试。`npm run test:resources` 对应 36 项新增单元；`npm run test:resources-ui` 包含新的原生网络、强制退出恢复、实际资源安装和源码窗口检查，首次可能联网下载固定资源。图像夹具为公开合成的 `fixtures/ocr-resource-synthetic.png`；临时输出均在忽略目录。资源与代理界面支持十语言；结果和命令见 [按需资源验收](docs/ON-DEMAND-2.1.17.md)。新成品检查为 `release-2.1.17-resource-package-check.cjs`，只读核验，不启动成品。

## 2.1.17 离线语法与紧凑窗口（此前阶段）

本轮只运行新增 `release-2.1.17-grammar-layout.test.tsx`、`release-2.1.17-grammar-engine.cjs`、`release-2.1.17-selection-latest.cjs`、`release-2.1.17-selection-privacy.py`、`release-2.1.17-grammar-layout-ui.cjs` 及静态包检查。使用真实离线引擎、最新脱敏 PDF 和源码 Electron 窗口；不启动成品。计划见 [本轮计划](docs/PLAN-2.1.17-GRAMMAR-SELECTION.md)，完整结果和重现命令见 [本轮验收](docs/GRAMMAR-SELECTION-2.1.17.md)。原件可选参数只读且不落原文。

## 2.1.17 阅读与批注交互（此前阶段）

仅运行新增 `release-2.1.17-reading.test.tsx`、`release-2.1.17-reading-ui.cjs`、`release-2.1.17-reading-archive-ui.cjs` 、`release-2.1.17-reading-windows-ui.cjs` 和 `release-2.1.17-reading-previews-ui.cjs`。计划、命令、22 项单元及源码交互结果见 [本轮验收](docs/READING-2.1.17.md)。重建后只运行 `release-2.1.17-reading-package-check.cjs` 静态包检查，不启动成品。

## 2.1.17 长段落三线表专项（此前阶段）

新增 30 页脱敏输入存于 `fixtures/5d5c6d5b198ff6a22c879dd5c26ae5bf.pdf`。仅执行新增专项与必要检查，命令和完整结果见 [三线表验收](docs/OPEN-TABLES-2.1.17.md)：原件/副本 720 组、之前六份 216 组、8 项新单元和源码窗口 40 次真实拖选。成品不启动，仅静态核对。

## 2.1.17 表格回归专项（此前阶段）

```bash
npm run typecheck
node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/lib/release-2.1.17-tables.test.ts --reporter=json --outputFile=tests/output/release-2.1.17/table-unit-results.json
node tests/scripts/release-2.1.17-table-pdfs.cjs
npx --no-install electron-vite build
node tests/scripts/release-2.1.17-tables-ui.cjs
# 重建和签名 APP/DMG/ZIP 后，仅静态核验，不启动成品：
node tests/scripts/release-2.1.17-table-package-check.cjs
```

范围与证据见 [表格专项验收](docs/TABLES-2.1.17.md)。窗口摘录重建复用已有 PyMuPDF 隔离环境，只读取公开脱敏 PDF。旧版全量命令不在本轮执行范围。

## 2.1.17 六份输入归档与逐页验收（当前）

六份 PDF 存于 `tests/fixtures/`，文件名为随机 32 位十六进制；`fixtures/release-2.1.17-inputs.json` 按用户给定顺序用 sourceSlot 1–6 对应输入，包含页数、大小与 SHA-256；同时纳入总清单。仅保留替代文字与版式几何，原文字、字体、像素、元数据、批注、链接和附件不复制。

脱敏生成器 `scripts/sanitize-fixtures-2117.py` 需要按顺序传入六个原始路径，直接读取并核对原件未变，不备份原件。依赖已有隔离环境中的 PyMuPDF；不运行旧全量重建脚本。

```bash
tests/tmp/release-2.1.16/venv/bin/python tests/scripts/verify-fixtures-2117.py
node tests/scripts/release-2.1.17-input-pdfs.cjs
node tests/scripts/release-2.1.17-selection-review.cjs
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.1.17-input-ui.cjs
# 支持 PDFUCK_INPUT_SLOT=1..6 定向重试；合并结果仍须覆盖全部 18 页。
# 本轮按用户要求不启动成品复测，只做静态包核验。
```

直接读取六份脱敏 PDF 的全部 18 页，三档缩放 × 两种字体度量 × 正反输入顺序共 216 组；逐词检查正文选区且不允许页面没有正文用例。窗口测试逐页核对栏线、两档缩放、正文及存在的图/表题正反拖选、可见字形覆盖和复制字符完整性、双向复制内容一致性。源码每页两张截图，输出到 `tests/output/release-2.1.17/inputs-source`，JSON 记录每一次操作。几何 JSON 继续用于原始字体/坐标回归，不能代替实际 PDF 测试。

## 2.1.16 定向验收（当前）

只运行本轮新增项，不运行历史全集：

```bash
npm run typecheck
node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/lib/release-2.1.16.test.ts --reporter=json --outputFile=tests/output/release-2.1.16/unit-results.json
node tests/scripts/release-2.1.16-layout.cjs
npx --no-install electron-vite build
node tests/scripts/release-2.1.16-input-ui.cjs
node tests/scripts/release-2.1.16-ui.cjs
python3 tests/scripts/release-2.1.16-privacy.py
# 签名并生成包后：
PDFUCK_SMOKE_EXECUTABLE="$PWD/release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck" node tests/scripts/release-2.1.16-ui.cjs
node tests/scripts/release-2.1.16-package-check.cjs
git diff --check
```

隐私校验依赖 PyMuPDF，可使用已有隔离环境 `tests/tmp/release-2.1.16/venv/bin/python`。公开 PDF 全部替换正文和原图片，详见 [夹具说明](fixtures/README.md)。旧原文锚点用例未运行，不能直接应用于替代副本。输出沿用已忽略的 tests/output、tests/tmp，不修改忽略规则。

## 2.1.12 定向验收（当前）

```bash
npm run typecheck
npm run test:release-2.1.12
npx --no-install electron-vite build
node tests/scripts/release-2.1.12-ui.cjs
# 新增窗口项可用 --checks=form,tables,text 分阶段，只重试受影响项。
git diff --check
# APP 构建并签名后验收成品。
PDFUCK_SMOKE_EXECUTABLE="$PWD/release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck" node tests/scripts/release-2.1.12-ui.cjs
# DMG / ZIP 生成后检查资源、版本、签名和哈希。
node tests/scripts/release-2.1.12-package-check.cjs
```

新增 21 项单元覆盖原生表单值/AP 保留、精确过滤覆盖层、打印正常和重建外观、有框/分段/合并单元格、伪表格/图片/坐标轴排除、空单元格、纵向文字行优先、双向/键盘/RTL/精确引用边界。新窗口项验证五页原生表单，十四页中文输入的四张表/56 个单元格、16 次双向缩放拖选及跨页约束，并检查三页旧图形不会误变成表格；另有多行/勾选/单选/下拉/缺外观/旋转裁切的合成表单、导出/打印内容及 24 组实际字形边界、真实添加/重编/缩放/删除撤销/保存重开。临时和输出沿用现有 gitignore；输入文件可跟踪，见 [样本说明](fixtures/README.md)。只运行本轮新增项，详细结果见 [现行验收](docs/VALIDATION-2.1.12.md)。

## 2.1.11 图框可见范围验收（历史）

```bash
npm run typecheck
npm run test:release-2.1.11-visual-bounds
npx --no-install electron-vite build
node tests/scripts/release-2.1.11-visual-bounds-ui.cjs
git diff --check
# 生成 APP 并签名，再验收最终可执行文件。
PDFUCK_SMOKE_EXECUTABLE="$PWD/release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck" node tests/scripts/release-2.1.11-visual-bounds-ui.cjs
# 生成 DMG / ZIP 后检查包内资源和 SHA-256。
node tests/scripts/release-2.1.11-package-check.cjs
```

本轮新增 12 项单元覆盖 Form/路径/透明组裁剪、嵌套变换与恢复、重复图像实例、空裁剪、分图归组、正文隔离和两栏误报。新窗口脚本使用匿名归档的十页实际输入 `fixtures/c51a56aedd2c14bdb9350163dc6d7217.pdf`，逐页验证 Figure 1–6 的范围、完整图注、分图与正文隔离；另检查两页现有表格，实际点击全部六个索引、对照窗口框坐标并双向拖选/复制正文。逐页 PNG 与 JSON 分别位于 `output/release-2.1.11/visual-bounds-source/` 和 `visual-bounds-packaged/`。只运行本轮新增项，下方为历史执行范围；不执行旧脚本全集。

## 2.1.11 页外图表/批注修复验收（历史）

```bash
npm run typecheck
npm run test:release-2.1.11-followup
npx --no-install electron-vite build
node tests/scripts/release-2.1.11-followup-ui.cjs
git diff --check
# APP / 签名 / DMG / ZIP 沿用打包指南。
PDFUCK_SMOKE_EXECUTABLE="$PWD/release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck" node tests/scripts/release-2.1.11-followup-ui.cjs
node tests/scripts/release-2.1.11-package-check.cjs
```

该轮只运行上述 18 项新增单元和新增真实窗口测试。窗口输入包括四向页外图表、部分越界区域、旋转 CropBox；通过本地 AI IPC 执行两类检查和两次自动批注、两次润色，验证重叠合并、最新单一改写、撤销/重做和保存重开。单元覆盖人工内容保护、跨页分组、原文锚点、旧版重复记录、幂等及回滚。输出分别在 `tests/output/release-2.1.11/followup-source/` 和 `followup-packaged/`；临时输入在 `tests/tmp/release-2.1.11-followup/`，沿用已有忽略规则。下方为首轮记录，不记作该轮重测。详见 [现行验收](docs/VALIDATION-2.1.11.md)。

## 2.1.11 首次交付验收（历史）

```bash
npm run typecheck
npm run test:release-2.1.11
npx --no-install electron-vite build
node tests/scripts/release-2.1.11-ui.cjs
node tests/scripts/release-2.1.11-papers.cjs
git diff --check
npx --no-install electron-builder --mac dir --config.electronDist=node_modules/electron/dist
# 核验/补齐 APP 签名后，以 prepackaged 生成 DMG，ditto 生成 ZIP。
PDFUCK_SMOKE_EXECUTABLE="$PWD/release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck" node tests/scripts/release-2.1.11-ui.cjs
node tests/scripts/release-2.1.11-package-check.cjs
```

本版新增 13 项单元测试；实际窗口覆盖中文双向拖选/复制及两档缩放、四个图表的独立索引/淡色区域/正文隔离、十语言 × 双主题 × 四字号 80 组共用 AI 操作区与左对齐状态栏，并验证本地 AI 取消。UI 支持 `--checks=selection,visuals,layout` 定向阶段。论文脚本检查三个现有 PDF 的六页，包括跨栏表格及表注、整页表格、公式与正文误报。输出在 `tests/output/release-2.1.11/`；生成 PDF、环境和隔离配置在 `tests/tmp/release-2.1.11/`，均沿用已有忽略规则。只执行新增测试和必要构建检查。详见 [计划](docs/PLAN-2.1.11.md) 和 [验收](docs/VALIDATION-2.1.11.md)。

## 2.1.10 定向验收

用户要求仅运行本轮新增项，使用以下流程；不运行历史全集：

```powershell
npm run typecheck
npm run test:release-2.1.10
npx --no-install electron-vite build
node tests/scripts/release-2.1.10-ui.cjs
git diff --check
npx --no-install electron-builder --win --config.electronDist=node_modules/electron/dist
$env:PDFUCK_SMOKE_EXECUTABLE = (Resolve-Path 'release/win-unpacked/PDFuck.exe').Path
node tests/scripts/release-2.1.10-ui.cjs
Remove-Item Env:PDFUCK_SMOKE_EXECUTABLE
node tests/scripts/release-2.1.10-ui.cjs --portable
node tests/scripts/release-2.1.10-package-check.cjs
```

新 UI 检查使用真实鼠标拖选、复制和可视栏线；支持 `--checks=behavior` 或 `--checks=layout`，修改后只复测相关阶段。布局阶段覆盖十语言 × 双主题 × 四档界面字号 80 组。输出为 `tests/output/release-2.1.10/{source,packaged,portable}/`；成品哈希和发布 JSON 在 `release/`。

## 日常开发和历史回归

`npm test` 只发现 `unit/**/*.test.ts(x)`，不会递归扫描缓存。`npm run test:watch` 进入监听；单文件命令例如：

```powershell
node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/lib/text-layout.test.ts
```

现有 `test:*` 命令名保留，内部路径已同步；`npm run build` 和根目录平台打包脚本仍会运行历史全集，适用于全量发布。迁移静态检查 `node tests/scripts/check-test-layout.cjs` 只解析路径和脚本，不执行历史测试。TypeScript 检查继续包含迁移后的测试。

部分历史原始输入在迁移前已缺失，见 [样本说明](fixtures/README.md)。依赖这些原始输入的旧用例需补入真实文件后再运行；原本支持自生成夹具的脚本保留其既有行为。2.1.10 新增验收不依赖这些文件。

参见 [2.1.10 计划](docs/PLAN-2.1.10.md)、[2.1.10 验收](docs/VALIDATION-2.1.10.md) 和 [打包指南](../PACKAGING_GUIDE.md)。

表单交互及临时标签的补充验收见 [计划](docs/PLAN-2.1.12-form-followup.md) 和 [结果](docs/VALIDATION-2.1.12-form-followup.md)。新增单元文件为 `unit/renderer/src/lib/release-2.1.12-form-followup.test.tsx`（10 项），源码交互入口为 `scripts/release-2.1.12-form-followup-ui.cjs`（六组）。本次按用户要求不启动打包后的 APP 测试；交付包只做静态完整性、资源一致性与签名校验。临时输入及报告沿用已忽略的 `tests/tmp/`、`tests/output/`。


### 跨页框选、文字偏好与页码提示

本轮新增入口为 `release-2.1.17-crosspage-style.test.tsx`、`release-2.1.17-crosspage-pdfs.cjs`、`release-2.1.17-crosspage-style-ui.cjs` 和 `release-2.1.17-crosspage-extra-layouts.cjs`。使用既有脱敏档案，不读取用户原件；源码界面测试使用独立用户配置。具体命令、范围和限制见 [验收记录](docs/CROSSPAGE-STATUS-2.1.17.md)。成品只运行新的 `release-2.1.17-crosspage-package-check.cjs` 静态核验，不启动成品。


### 滚动提示阈值与侧栏跟手

当前专项入口为 `release-2.1.17-scroll-resize.test.tsx` 与 `release-2.1.17-scroll-resize-ui.cjs`；使用固定合成 PDF 和独立源码用户配置。旧背景页码/低阈值专项属于历史规则，当前需求改由删除校验和严格滚动判定覆盖。具体命令与范围见 [验收记录](docs/SCROLL-RESIZE-2.1.17.md)。新成品仅运行 `release-2.1.17-scroll-package-check.cjs` 静态核验。
