# PDFuck 2.0.49 验收记录

## 功能

- 框选裁切旁新增“智能裁切”。对当前框选范围做独立于屏幕缩放和主题的高分辨率渲染，识别可见像素的外边界，保留孤立标签和细线；空白选区保持原框并提示调整。检测只调整框，仍允许手调、取消，确认后沿用 PDF CropBox 裁切，支持撤销。
- 实验室新增“解释图片”和同风格 SVG 图标。页面框选得到所选区域 PNG，用户选择预设或编辑提示词后发送给当前模型。支持 OpenAI 兼容与 Claude 图片协议，复用请求恢复、取消和实时过程面板；窗口可拖动、最小化和恢复。趋势、坐标估读、图线比较、特征解读的标签与完整提示词均覆盖十种语言。坐标提示明确区分线性/对数轴、单位、可辨识点和估算误差。结果可复制或在原图边缘添加便笺，避免遮盖原图。
- 图片与图形共用跨页拖放、边缘自动滚动、鼠标跟随预览和目标页选择。单页模式可通过目标页选择移动；确认前只修改草稿，取消保留原对象，确认以同一标识转移原注释，不复制出重复对象，支持保存重开及撤销/重做。小倍率下操作条与图像分开，当前草稿页提高层级。长文档保留拖动源页与当前虚拟窗口，间隔用占位元素处理。

## 本次执行范围

按用户要求仅执行本次新增测试，未运行旧单元/UI 回归、全部多语言审计、全部字号审计或包含这些检查的 `npm run build`/一键发布脚本。

- `npm run typecheck`：通过。
- `npm run test:release-2.0.49`：6 项新增单元测试及新增真实 Electron 窗口测试通过，包含生产构建。
- `git diff --check`：通过。

新增单元测试验证白边与精确像素边界、浅色细线与孤立标签、透明像素、全空白区域、跨旋转/裁剪页移动及元数据、保存重开/撤销/重做、非法目标页不改变字节、两种图片请求协议、非法图片输入拦截以及十语言新增文案。

真实窗口测试验证智能裁切的四条边、确认和撤销，区域 PNG 尺寸、四种预设请求、流式结果、最小化恢复、复制与原页批注，十语言与阿拉伯语暗色布局，图片目标页切换/取消保护/真实跨页拖放，图形跨页保存及唯一对象标识，保存重开和再次编辑，单页模式的跨页草稿/取消，以及 96 页文档远距离移动/撤销（挂载不超过 18 页）。

AI、图片选择、复制及保存 IPC 使用本地测试替身；未发送真实文档到外部服务，未调用付费模型。智能裁切识别可见内容的外包围框；坐标解读是模型估算，需要支持图片输入的模型。未进行 EPS 转换工具的旧回归。

## 成品与平台验收

Windows x64 通过直接调用 electron-builder 构建安装版、便携版和解包程序。

- 新增真实窗口测试在源码构建与解包成品上各通过一次，报告分别为 `release-2.0.49-source.json`、`release-2.0.49-packaged.json`。
- `node scripts/release-2.0.49-portable-smoke.cjs` 通过：实际启动便携 EXE，打开已保存 PDF，核对 2.0.49，验证图片解释框选/四种预设/最小化、已保存图片的目标页选择。报告为 `release-2.0.49-portable.json`。
- `package.json`、`package-lock.json` 和包内 `app.asar` 均为 2.0.49。解包程序文件版本为 2.0.49、产品版本为 2.0.49.0；安装版和便携版文件/产品版本均为 2.0.49。包内包含智能裁切、图片解释及跨页控制代码，原生打印、Koffi 和 OCR 资源存在。
- 安装版与便携版均为 `NotSigned`；当前未配置可信代码签名证书，Windows 首次运行可能出现未知发布者提示。

本次不执行 macOS 打包、实体打印或 Windows 安装/卸载与文件关联回归。

源码测试报告：`output/playwright/release-2.0.49-source.json`。成品报告与截图以对应 `packaged` 文件名保存，校验值和发布清单位于 `release`。

| 交付文件 | SHA-256 |
| --- | --- |
| `PDFuck-2.0.49-Windows-Setup.exe` | `338471f124dc0d869739a5cfc6a95dca2b6894d86e152c985d2e111329a2ad2e` |
| `PDFuck-2.0.49-Windows.exe` | `6a9934b3c1c7ab366c396bca9504d8384b88cc490e759988db5a3284029a0bcb` |

绝对路径：

```text
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\PDFuck-2.0.49-Windows-Setup.exe
C:\Users\Yuwei Le\Documents\GitHub\PDFuck\release\PDFuck-2.0.49-Windows.exe
```

发布清单：`release/PDFuck-2.0.49-Windows-release.json`；校验文件：`release/PDFuck-2.0.49-SHA256.txt`；包内检查：`release/PDFuck-2.0.49-package-verification.json`。

视觉检查截图：`output/playwright/release-2.0.49-source-rtl-dark.png`、`release-2.0.49-source-objects.png`、`release-2.0.49-packaged-rtl-dark.png`、`release-2.0.49-packaged-objects.png`、`release-2.0.49-portable.png`。
