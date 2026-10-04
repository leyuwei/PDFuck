# PDFuck 2.0.55 验收记录

验收日期：2026-10-04（Asia/Shanghai）。版本来源及锁文件同步到 2.0.55。按用户要求，仅运行本次新增测试和必要静态检查，没有运行旧测试全集、`npm run build` 或一键发布脚本。

## 定位与修改计划

先阅读 README、PACKAGING_GUIDE、主进程窗口生命周期、统一聚焦函数、预加载契约、React 标题栏、样式和 electron-builder 的实际 plist 生成代码，再实施修改。

| 问题 | 定位 | 修复 |
| --- | --- | --- |
| Finder 打开 PDF 后仍需点击 Dock | macOS 关闭最后窗口后应用继续运行，`queuePdfPath` 仅排队而不创建窗口；原聚焦函数只操作窗口，没有激活/取消隐藏应用 | 未就绪时继续排队，已就绪且没有主窗口时立即创建，等待 ready-to-show 再显示；统一显示函数在 macOS 调用 app.show 和 app.focus，再聚焦目标窗口 |
| PDF 文件小图标异常 | 原 PDF 文件关联仅声明扩展名，文档图标回退为普通应用图标；旧小尺寸表示由打包器生成 | 独立原生 pdf.icns，声明 com.adobe.pdf、Editor、Default 和文档图标；macOS 专用 extraResources 确保图标位于 Contents/Resources，Windows 原文件关联保留在平台配置中 |
| 全屏仍保留窗口按钮空位 | macOS 标题栏固定 padding-left: 82px，主进程及桥接未传递原生全屏状态 | 每个应用窗口监听 enter/leave-full-screen，并提供初始查询；全屏留白改为 18px，退出恢复 82px，首次查询不覆盖较新的事件 |

窗口和 Logo 修复复用现有共享路径，不新增依赖或界面文案。macOS 标题栏固定物理左侧方向，使阿拉伯语界面下 Logo 仍位于左上角；其余界面继续保留 RTL。图标从现有矢量 Logo 生成，没有字体或语言相关字形。

API 依据：[Electron 应用激活](https://www.electronjs.org/docs/latest/api/app#appfocusoptions)、[Electron 原生全屏事件](https://www.electronjs.org/docs/latest/api/browser-window#event-enter-full-screen)、[Apple 文档类型声明](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundledocumenttypes)。

## 新增测试及结果

| 检查 | 结果 |
| --- | --- |
| `node scripts/run-vitest.cjs run src/main/release-2.0.55.test.ts` | 7 项通过：macOS 激活顺序、最小化恢复、已销毁窗口、普通焦点返回、Windows/Linux 隔离、全屏桥接查询/订阅清理、版本/关联配置和 ICNS 表示校验 |
| `npm run typecheck` | 渲染与主进程类型检查通过 |
| `npx --no-install electron-vite build` | 生产构建通过；原有 PDF.js 资源 URL 构建警告保留，资源由现有复制插件提供 |
| `node scripts/release-2.0.55-macos-smoke.cjs` | 源码态全部通过：启动打开 PDF、隐藏/最小化后 open-file 恢复、关闭最后窗口后自动重建、原生全屏进出及初始状态、窄窗口、重载、图标解码 |
| `PDFUCK_SMOKE_EXECUTABLE=…/PDFuck.app/Contents/MacOS/PDFuck node scripts/release-2.0.55-macos-smoke.cjs` | 最终 `.app` 全部通过，与源码使用相同测试，另核对包内 plist、版本及图标字节 |
| `node scripts/release-2.0.55-launchservices-smoke.cjs` | 通过：使用 `/usr/bin/open` 经 LaunchServices 向新进程发送真实文档 Apple 事件，文件不通过 CLI 参数传递；PDF 成功打开，原生应用自动位于前台，无需 Dock 操作 |
| 多语言全屏布局 | 源码及成品分别检查进入/退出全屏 × 10 语言 × 4 字号 × 2 主题，各 160 组；Logo 固定 30px，物理左距分别为 18px/82px，阿拉伯语 RTL 保留 |
| PDF 文件图标 | iconutil 与 Electron 成功解码全部 10 个普通/Retina 表示，覆盖 16–1024 像素；小尺寸使用原生 ARGB。NSWorkspace 确认默认 PDF 应用为本轮应用，读取实际文件图标并输出 PNG，目视正常 |
| `git diff --check` | 通过；使用 Codex 内置 Git 避开系统 Git 的 Xcode 许可检查 |

原生桌面测试在解锁环境完成。锁屏期间的失败没有被计为通过。测试使用隔离的临时用户数据和自建空白 PDF，仅结束自己启动的应用进程，没有替换 `/Applications` 中的已安装应用。文件名比较使用 Unicode NFC，兼容 macOS 文件系统传入的分解形式。系统默认 PDF 应用没有由测试调用设置接口修改。

结果与截图：`output/playwright/release-2.0.55-source.json`、`release-2.0.55-packaged.json`、`release-2.0.55-launchservices.json`、全屏/普通窗口截图和 `release-2.0.55-finder-file-icon.png`。

## macOS 成品

从本轮 `out` 使用本地 Electron 43.4.0 生成 arm64 `.app`，完成 ad-hoc 签名后，以 electron-builder 的 `--prepackaged` 生成 DMG，再用 ditto 生成 ZIP。

- `.app`、Info.plist 和 app.asar 的版本均为 2.0.55；主进程、预加载、HTML、最终 JS/CSS 与通过测试的生产资源逐字节一致。
- plist 只有一个 PDF 文档类型，UTI 为 com.adobe.pdf，角色为 Editor，图标为 pdf.icns；包内和 DMG 内图标与源码资源一致。
- codesign 的 deep/strict 验证通过。签名为 ad-hoc，未使用 Developer ID、未公证。
- hdiutil 镜像校验通过。实际挂载检查顶层 PDFuck.app、Applications 符号链接、卷图标及签名，不存在嵌套 PDFuck.app。
- ZIP 仅包含一个 PDFuck.app 根目录，含 Info.plist、app.asar 和 PDF 图标。

| 文件 | 大小（字节） | SHA-256 |
| --- | ---: | --- |
| `release/PDFuck-2.0.55-macOS.dmg` | 274821880 | `626aec5b09d1321f6a3b0ddbbbef5bc6c197c2ddd54b8a68e1bfb4160b19ca33` |
| `release/PDFuck-2.0.55-macOS.zip` | 276080509 | `d425f2ab5c2a6c6ffe2c0d79f71ca6c9d2d213c93f33f47a89798057619d97b1` |

交付清单：`release/PDFuck-2.0.55-macOS-release.json`；校验值：`release/PDFuck-2.0.55-macOS-SHA256SUMS.txt`；资源核验：`release/PDFuck-2.0.55-package-verification.json`。Windows 保留原关联行为并有新增聚焦单元测试隔离验证，本轮没有 Windows 主机运行测试或 Windows 安装包。
