# PDFuck 2.0.42 验收记录

日期：2026-09-19  
平台：Windows x64

## 根因与修复

- 样本 `tmp/test-enc.pdf` 使用的是空用户密码的标准权限加密。PDF.js 可以直接打开，因此旧逻辑没有把它标记为加密文档；进入编辑链路后，pdf-lib 拒绝加载，最终把底层英文异常直接显示给用户。
- 打开文件时现在统一读取加密标记、打印/复制/修改/批注权限和签名字段。权限加密文档保持可阅读，并显示明确的安全提示，不再进入会失败的编辑加载路径。
- 新增 PDF detached CMS 签名完整性验证入口，显示签名状态、签名人、颁发者、证书有效期和是否覆盖整份文件。这里验证的是文件完整性，不冒充 Windows/系统信任链验证。
- 受加密权限限制的文件可生成 144 DPI 可编辑副本：逐页渲染到新的未加密 PDF，移除原权限和旧签名结构，并强制另存为，绝不覆盖原文件。界面会预先说明表单、链接、矢量和可选文字将被扁平化。
- 已签名但未加密的文件仍允许编辑；一旦修改，界面明确提示原签名将失效。
- 验签详情正文使用随界面字号缩放的统一纵向间距，标题、权限、签名卡、信任说明和按钮区不再紧贴。
- 修正滚动容器引入后仍按“直接子元素”匹配的旧弹窗样式；确认、错误、密码、安全存储、另存为、更新、翻译、关于和界面字号九类轻量弹窗现在共享一致的内容边线，专用正文内边距不会再被通用规则覆盖。
- 安全提示、验签详情、权限说明、确认和进度文本覆盖现有 10 种界面语言，并继承四档界面字号。
- `package.json`、`package-lock.json`、包内清单和 Windows 文件属性均为 `2.0.42`。

## 执行结果

按用户要求，仅执行本次新增测试项，未运行既有回归套件。

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run test:release-2.0.42-ui` | 通过，源码态；使用真实 `tmp/test-enc.pdf` |
| `PDFUCK_SMOKE_EXECUTABLE=release/win-unpacked/PDFuck.exe node scripts/release-2.0.42-ui-smoke.cjs` | 通过，Windows 成品态 |
| 权限加密 | 正确识别；无底层英文错误；只读打开正常 |
| PDF 签名 | detached CMS 完整性有效；签名人 National Immigration Administration；颁发者 BJCA DocSign CA3；覆盖整份文件 |
| 可编辑副本 | 可生成和保存；1 页；无 `/Encrypt`、无 `/ByteRange`；原文件未覆盖 |
| 多语言 | 10 种语言下安全提示及两个操作入口均可见且不溢出 |
| 验签详情排版 | 通过；正文顶部及相邻信息区块的实际间距均不小于 12px |
| 轻量弹窗排版 | 通过；九类弹窗逐一测量标题、正文或信息卡左边线，偏差不超过 1px |
| `git diff --check` | 通过；仅 Git 提示工作区换行符将来可能转为 CRLF |
| 包内 `app.asar` | 清单版本 `2.0.42` |

生产资源使用 `electron-vite build` 重新生成，Windows 安装版与便携版使用 `electron-builder --win` 生成。隐私安全的局部视觉记录保存在 `output/playwright/release-2.0.42-pdf-security-notice*.png`、`release-2.0.42-pdf-signature-details*.png`、`release-2.0.42-compact-dialogs*.png` 和 `release-2.0.42-pdf-security-editable*.png`。

## Windows 产物

| 产物 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `release/PDFuck-2.0.42-Windows-Setup.exe` | 221,686,812 | `C265DFA16A481D29709B41922BA16D0E547907492AB7E67638148639D57BAD3E` |
| `release/PDFuck-2.0.42-Windows.exe` | 221,346,472 | `34D9DCFFE78BAEF89AD2509934A65AC39BCE603CC355889A6DBB54C71A0770D1` |
| `release/win-unpacked/PDFuck.exe` | 225,589,248 | `CD6C62B2FBE0796AAE52E8E2F3C139D4F054613002DC65A656FCF872FA106270` |

三个文件的 Authenticode 状态均为 `NotSigned`；它们适用于内部验收，公开分发仍应使用可信代码签名证书。当前为 Windows 环境，未生成或验证 macOS `.app`、DMG 和 ZIP。

## 未执行范围

- 按用户“仅对新增测试项做好简单测试”的要求，未执行 OCR、打印、框选、AI、书签等既有回归。
- 未执行安装器的真实安装、卸载及系统文件关联变更。
- 未执行在线吊销检查或 Windows 根证书链信任判断；“有效”仅代表 PDF 内签名的 CMS 加密完整性通过且签名覆盖范围符合显示结果。
- 未进行实体打印、外部 AI 请求或 macOS 构建。
