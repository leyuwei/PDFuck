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
