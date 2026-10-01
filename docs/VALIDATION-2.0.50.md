# PDFuck 2.0.50 验收记录

## 功能与使用

框选裁切旁新增“保护边界”，与智能裁切、取消、确认范围放在同一操作条内。输入 0–50 mm，可用步进按钮或输入小数；默认 0 保持贴边。先设置数值再点击智能裁切，或识别后修改数值，均以主体外包围框为基准向四周留白。留白实时显示在裁切框上，独立于 PDF 缩放，不能超出原页面边缘；不会在页面外生成额外纸张。

增加、减小和重复应用保护边界均从原始识别结果计算，不累计留白。手动拖动或缩放裁切框后，原始识别结果失效，避免后续数值变化覆盖手调；再次点击智能裁切会重新识别当前选区。取消不改变 PDF，确认仍通过矢量 CropBox 裁切，支持保存及撤销。

新增标签、说明与单位提示覆盖中文、英语、日语、俄语、西班牙语、法语、德语、葡萄牙语、韩语和阿拉伯语。操作条使用现有字号变量，随可见视区和实际控件尺寸定位，支持换行、暗色主题和从右向左布局，保持小 PDF 倍率下的可操作尺寸。

## 本次执行范围

按用户要求仅执行本次新增测试，未执行旧单元/UI 回归、全部语言/字号审计或包含旧测试的 `npm run build`/一键发布脚本。

- `npm run typecheck`：通过。
- `node scripts/run-vitest.cjs run src/renderer/src/lib/release-2.0.50.test.ts`：6 项新增测试通过。
- `npx --no-install electron-vite build`：生产构建通过。
- `node scripts/release-2.0.50-ui-smoke.cjs`：源码真实 Electron 窗口检查通过。
- `git diff --check`：通过。

新增单元测试覆盖零留白、毫米到 PDF 点的四边换算、各页面边缘限制、负数/非有限值/超大数值、重复和递减计算不改变原主体、旋转且已裁切页面的 CropBox 保存/撤销/重做及矢量内容保留、十语言新增文案。

新增 UI 测试覆盖默认 0、识别前设置数值、识别后实时增减和小数、重复点击、输入规范化、边缘限制、手调保护、取消、十语言布局、阿拉伯语暗色主题、小窗口/最大界面字号/小 PDF 倍率组合、确认后的 CropBox 保存、矢量流保留和撤销。测试保存 IPC 使用本地替身，取得实际生成的 PDF 字节后写入独立测试文件，不覆盖用户文档。

## Windows 成品

通过 `npx --no-install electron-builder --win --config.electronDist=node_modules/electron/dist` 完成本轮源码的 Windows x64 打包，生成安装版、便携版和解包程序。

- 设置 `PDFUCK_SMOKE_EXECUTABLE` 为本轮 `release/win-unpacked/PDFuck.exe` 后执行新增 UI 脚本：通过，与源码构建相同的检查全部通过。
- `node scripts/release-2.0.50-portable-smoke.cjs`：通过，实际启动便携 EXE，无需安装打开 PDF，验证保护边界产生 2 mm 留白、数值改为 0 实时贴边、取消保留完整原页。
- 包内 `app.asar` 版本为 2.0.50，保护边界的控件、提示、单位及多语言代码均存在；原生打印 PDFium、许可证、Koffi、OCR 语言数据与工作线程存在。
- 安装版和便携版的文件/产品版本均为 2.0.50；解包程序文件版本为 2.0.50、产品版本为 2.0.50.0。
- 三个 EXE 的实际签名状态均为 `NotSigned`。当前未配置可信代码签名证书，Windows 首次运行可能显示未知发布者提示。

本次未执行完整发布回归、Windows 安装/卸载与文件关联、实体打印、外部 EPS 转换工具测试或 macOS 打包。保护边界以选区中识别到的可见主体为基准，受原页面范围限制，保留的是原页面区域及其背景。

| 交付文件 | SHA-256 |
| --- | --- |
| `PDFuck-2.0.50-Windows-Setup.exe` | `18e67bbf9bb6a8ea2fbb740f34643264931c11c2093006d33b536d081c4a4ace` |
| `PDFuck-2.0.50-Windows.exe` | `87dc3fee8022d633a462fbbb3ad922e9f74506c94f3c08ce5a95480c95c5cbb8` |

绝对路径：

```text
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\PDFuck-2.0.50-Windows-Setup.exe
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\PDFuck-2.0.50-Windows.exe
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\win-unpacked\PDFuck.exe
```

发布清单：`release/PDFuck-2.0.50-Windows-release.json`；校验值：`release/PDFuck-2.0.50-SHA256.txt`；包内检查：`release/PDFuck-2.0.50-package-verification.json`。

新增 UI 报告位于 `output/playwright/release-2.0.50-source.json`、`release-2.0.50-packaged.json`、`release-2.0.50-portable.json`。视觉检查截图为 `release-2.0.50-source-margin.png`、`release-2.0.50-source-rtl-dark.png`、`release-2.0.50-packaged-margin.png`、`release-2.0.50-packaged-rtl-dark.png`、`release-2.0.50-portable.png`。
