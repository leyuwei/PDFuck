# 测试与验收

从仓库根目录执行命令。2.1.10 起，测试代码和依赖统一放在此目录；生产构建、图标及打包脚本仍在根目录 `scripts/`。

| 目录 | 内容 |
| --- | --- |
| `unit/` | 迁移的 101 个单元/组件测试文件，镜像原 `src/` 结构；新增版本用例也放在这里 |
| `scripts/` | Vitest 运行器、审计、Electron UI、便携版与包内资源检查 |
| `fixtures/` | 可复用原始输入，包含 `785904351dabdab98176b914912cc8dd.pdf` 两页回归样本 |
| `docs/` | 各版本计划、验收和交付记录 |
| `tmp/` | 运行中的临时 PDF、隔离用户配置，以及原根目录 tmp 的历史缓存 |
| `output/` | 截图、JSON 结果及原根目录 output 的历史输出 |
| `migration-map.json` | 270 个代码/说明文件的迁移对应关系；不保留样本的原文件名或整目录缓存/输出的对应关系 |

本次未添加或修改任何 `.gitignore`。测试代码和原始样本可被 Git 跟踪；临时目录和生成输出沿用仓库已有的 `tmp/`、`output/` 忽略规则。旧缓存/输出保留原内容，历史临时脚本不作为正式测试入口；不要从旧缓存恢复生产构建。

所有样本使用随机的 32 位十六进制文件名，扩展名保留；代码、历史用例引用和说明同步使用匿名名称，不提供原名对照表。此修改保留文件内容，既有 Git 历史不作改写。

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
