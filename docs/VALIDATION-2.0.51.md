# PDFuck 2.0.51 验收记录

## 修复

- “保护边界”由每页临时数值改为共享本地偏好，保存 0–50 mm 与小数，其他页面、PDF 和应用重启均可继续使用。挂载中的控件订阅偏好变化，独立窗口通过 storage 事件同步；已有智能裁切框按主体边界重新应用留白。缺少或损坏的存储值安全归零。
- 工具栏缩放原先只居中横向位置，未保留纵向页面锚点。现在由 React 更新前快照获取原页面坐标，页面尺寸更新后恢复横向与纵向滚动；优先保留视区内裁切框、图片/图形草稿或选区的焦点，否则保留阅读位置。Ctrl＋滚轮和侧栏自动缩放复用同一恢复逻辑，浏览器滚动锚定不再竞争；滚轮监听允许取消默认行为，避免缩放与默认滚动叠加。近期导航不因单纯缩放重新定位到页首。
- 草稿仍使用原 PDF 坐标，缩放不改变尺寸、内容或页码。页面比视区小时，滚动范围由实际页面布局限制；仍能看到原编辑区域。复用原十语言控件，无新增未翻译文案。

## 本轮检查

按本会话要求仅执行新增测试，未运行旧测试、全量语言/字号审计、完整发布回归或含这些检查的 `npm run build`。

- `npm run typecheck`：通过。
- `node scripts/run-vitest.cjs run src/renderer/src/lib/release-2.0.51.test.ts`：6 项新增单元测试通过。
- `npx --no-install electron-vite build`：生产构建通过。
- `node scripts/release-2.0.51-ui-smoke.cjs`：新增真实 Electron 窗口测试通过。
- `git diff --check`：通过。

单元测试覆盖小数偏好保存及共享控件通知、损坏/负数/超大值规范化、清除偏好归零、存储不可用时的会话回退、更新前阅读坐标快照与双轴恢复、裁切/图片/矩形/文本选区焦点和页间空隙滚轮回退。

UI 使用 96 页混合尺寸 PDF，在第 45 页验证裁切、待添加图片、保存后重新编辑图片和图形草稿。逐次检查放大、缩小、适合宽度、适合页面与真实 Ctrl＋滚轮后的 PDF 坐标、对象所在页、视区可见性和纵向漂移；另外检查侧栏折叠后适合宽度、再次展开自动缩放仍保留图片草稿焦点。同时验证跨页复用偏好、重启并打开另一 PDF 的偏好恢复、零值保存、单页模式及阿拉伯语暗色布局。图片选择 IPC 使用本地测试替身。

## 成品

通过 `npx --no-install electron-builder --win --config.electronDist=node_modules/electron/dist` 从最终生产资源构建 Windows x64 安装版、便携版和解包程序。

- 新增 UI 脚本通过 `PDFUCK_SMOKE_EXECUTABLE` 指向最终解包程序后再次通过，包含侧栏自动缩放、96 页文档、单页模式、重启及阿拉伯语暗色检查。
- `node scripts/release-2.0.51-portable-smoke.cjs`：通过。实际两次启动最终便携 EXE，在同一独立测试配置目录验证 2.5 mm 小数保护边界跨重启/不同 PDF 恢复，两次启动中裁切框放大后均保持纵向焦点。
- 包内 `app.asar` 版本为 2.0.51，存在共享保护边界偏好、变化事件、更新前缩放快照及恢复代码。原生打印 PDFium、许可证、Koffi、OCR 工作线程及语言资源均存在。
- 安装版、便携版文件/产品版本均为 2.0.51；解包程序文件版本为 2.0.51、产品版本为 2.0.51.0。
- 三个 EXE 签名状态均为 `NotSigned`；当前未配置可信代码签名证书，Windows 首次启动可能提示未知发布者。

本次未执行 macOS 打包、实体打印、外部 EPS 转换、Windows 安装/卸载与文件关联或完整发布回归。独立窗口的偏好同步由 storage 订阅实现，未另做双窗口专项运行测试。

| 交付文件 | SHA-256 |
| --- | --- |
| `PDFuck-2.0.51-Windows-Setup.exe` | `03f0fdd905d6e995be3603868eb69fabf7c5115a26eec291a2f80ec918e71e21` |
| `PDFuck-2.0.51-Windows.exe` | `8a87ec4e00ad8480fb5d9064416da04eff64f11f1c333819c92e52a25881d568` |

绝对路径：

```text
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\PDFuck-2.0.51-Windows-Setup.exe
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\PDFuck-2.0.51-Windows.exe
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\win-unpacked\PDFuck.exe
```

发布清单：`release/PDFuck-2.0.51-Windows-release.json`；校验值：`release/PDFuck-2.0.51-SHA256.txt`；包内检查：`release/PDFuck-2.0.51-package-verification.json`。

新增 UI 报告：`output/playwright/release-2.0.51-source.json`、`release-2.0.51-packaged.json`、`release-2.0.51-portable.json`。截图：对应 `source`/`packaged` 的 `crop.png`、`shape.png`、`rtl-dark.png`，以及 `release-2.0.51-portable-initial.png`、`release-2.0.51-portable-restart.png`。
