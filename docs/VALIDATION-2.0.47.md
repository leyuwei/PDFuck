# PDFuck 2.0.47 验收记录

## 改动

- 左侧新增与查看、编辑、批注、保存同级的“打印”按钮和同风格矢量打印机图标。点击直接打开原有打印弹窗，当前工具栏保持原样；保存模块移除打印入口和相关说明。原弹窗、页码选择、预览、打印设置、Ctrl/⌘+P 和作业流程沿用原实现。
- PDF 视区缩窄且当前页放不下时，自动按实际可用宽度缩放并保留当前页和阅读位置。覆盖书签/批注列表展开及拖宽、工具栏展开和窗口缩小；首次加载时自动出现的书签栏也参与适配。侧栏收起、视区扩大和已经放得下的手动缩放保持原比例。

## 验证范围

仅运行本次新增的 `test:release-2.0.47`；旧单元/UI 测试未执行。已有打印 UI、多语言 UI 和 ToolPanel 测试只同步入口与预期，未运行。类型检查与生产构建另行完成；未调用包含全量旧测试的 `npm run build` 或一键发布脚本。

新增测试生成 6 页混合宽度 PDF，在真实 Electron 窗口验证：

- 五个模块图标、2.0.47 版本、十种语言的打印按钮；每种语言点击均直接打开打印弹窗，工具栏内容不变。
- 保存模块仅含保存、另存为和导出；直接打印的预览和内置选页，指定第 2、4 页后，通过测试 IPC 收到包含两页的 PDF；Ctrl/⌘+P 可用，无文档时打印按钮禁用。
- 初始书签栏、书签展开/拖宽/收起、工具栏展开、批注列表出现/展开/拖宽/收起、较小手动缩放、小窗口以及暗色单页模式，共 12 个布局场景。自动缩放后的页面边界位于视区内，并检查页码与阅读偏移。

打印机枚举及打印 IPC 使用本地测试设备拦截，不派发实体纸张。

## 交付状态

- TypeScript 类型检查、生产构建和 `git diff --check` 通过。新增真实窗口测试在源码构建与 Windows 解包成品上各通过一次；便携版实际启动后，通过其 CDP 连接另外确认 2.0.47、PDF 打开和打印按钮直接打开弹窗。
- `package.json`、`package-lock.json`、`app.asar` 均为 2.0.47；解包程序产品版本为 2.0.47.0、文件版本为 2.0.47；安装版和便携版产品版本均为 2.0.47。包内包含打印图标及侧栏自动缩放代码，原生打印与 OCR 资源存在。
- Windows x64 安装版和便携版由本轮生产资源重新打包。两者均为 `NotSigned`，当前未配置可信代码签名证书，Windows 首次运行可能显示未知发布者提示。未执行安装/卸载、实体纸张打印或 macOS 打包验收。

| 文件 | SHA-256 |
| --- | --- |
| [Windows 安装版](../release/PDFuck-2.0.47-Windows-Setup.exe) | `d0f94272366c77544634ce9894381e7609e86b610b9c556ed3f68d65e085c72a` |
| [Windows 便携版](../release/PDFuck-2.0.47-Windows.exe) | `5d9ddd24c7a46604f150fed8816fc04a85b0f701a7c660f31e20b6d5b4297a1a` |

交付文件绝对路径：

```text
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\PDFuck-2.0.47-Windows-Setup.exe
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\PDFuck-2.0.47-Windows.exe
```

发布清单：`release/PDFuck-2.0.47-Windows-release.json`；校验文件：`release/PDFuck-2.0.47-SHA256.txt`。

视觉检查截图：`output/playwright/release-2.0.47-source.png`、`output/playwright/release-2.0.47-packaged.png`、`output/playwright/release-2.0.47-portable-print.png`。
