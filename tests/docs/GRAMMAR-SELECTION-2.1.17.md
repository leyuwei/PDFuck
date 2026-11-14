# 2.1.17 语法、框选与紧凑窗口验收（2026-11-13）

本轮对应五项需求，沿用 2.1.17，不回滚此前引文、图表、缩写、批注、书签及打印修订。只执行本轮新增测试与必要的类型、构建、静态包检查；不启动打包成品。此前阶段的结果保留，不计入本轮通过数量。

## 修改与原因

1. 搜索标题由 56px 的旧布局压缩为 34px，正文由控件区和独立滚动的结果区构成。默认窗口给结果区保留主要高度，窄窗口、多语言换行和正则控件不挤掉结果；保留拖动和缩放。
2. 删除旧的英文正则语法猜测。接入原版 LanguageTool 6.6 与 Temurin Java 17.0.21+9，固定官方来源和 SHA-256，随安装包附带全部规则、运行时及许可证。检查仅通过应用持有的本机回环子进程，启动不带 `--public`，正文不上传。IPC 校验参数及长度，校验返回偏移并拒绝不完整结果；闲置一分钟退出，应用结束时清理子进程。
3. 检查前按栏重建正文段落，连接换行断词，保留 UTF-16 偏移到原始字框的映射；正确连接中日文字形，跳过表格、图形、参考文献、裁切的不完整句子，屏蔽公式、数字及引用号。过滤词典拼写、大小写、排版、风格、标点及两个在技术符号附近误报的推测规则 `PRONOUN_NOUN`、`THE_SUPERLATIVE`。结果显示规则解释、替换建议，点击定位实际字框，取消原来全篇按相同单词标记的粗略行为。增加十语言进度、错误和结果提示。
4. 框选的根因是：左栏末端轻微越过栏缝时吸附到右栏缩进的参考文献；局部公式的 `visualBlock` 又错误触发横向跨栏结构选区。现在仅在未命中另一栏字框、且接近栏缝时保持原栏；局部公式块不再单独触发跨栏结构分支。真正触及另一栏、跨栏标题、表格单元格和正常跨栏阅读顺序保留。
5. 撤销/重做改为一致的 SVG 曲线箭头，重做镜像同一几何；关于窗口的更新说明及 Markdown 标题改用小号、正文号字体，限定样式作用域。

语法资源清单见 `resources/grammar/manifest.json`，许可证入口为 `resources/grammar/NOTICE.txt`。Java 运行时放在 asar 外，原版资源可替换。原有 macOS/Windows 打包命令增加资源准备；仅 macOS arm64 构建和交付在本轮实际验证。

## 输入脱敏

新增 `tests/fixtures/c9fe9631796c6ab68f91452345888070.pdf`，一页，sourceSlot 为 `selection-20261113`，清单 `release-2.1.17-selection-latest.json`。所有正文、数字和图像替换，原字体及元数据不复制，不包含原批注、链接、附件、书签和隐藏原文。随机文件名已合并进总清单，当前共 31 份、272 页。

生成时核对 87 行长原文未保留，并验证用户位置的原件哈希不变；不保存原始副本或截图。新增的档案检查再次核对 SHA-256、对象清除和总清单。原件的语义检查在内存中进行，输出仅含语言、字符数、规则数量；不将原文写入测试日志或夹具。

## 新增测试

| 检查 | 范围与结果 |
| --- | --- |
| 单元测试 | 20 项：段落/栏/表格/参考文献隔离、换行断词、公式及 UTF-16 定位、中日韩处理、SVG 镜像、十语言提示、真正跨栏标题、实际命中另一栏、表格单元格保护 |
| 真实离线引擎 | 英、德、法、西、葡、俄、中、日、阿九语言各一组错误句/正确句；错误有命中，正确句零命中；另验证科研正确句、参数限制、响应过滤与不完整结果，共 24 项检查 |
| 最新实际 PDF | 脱敏副本和只读原件，三缩放 × 两字体度量 × 正反输入，共 24 组几何；每组五种行末偏移，共 120 例，均无右栏泄漏；另外核对正常跨栏、两幅图形和参考文献隔离 |
| 原件语法 | 五个提取段落，经公式/参考文献处理后没有明确规则命中；这只是本样本结果，不代表任意文档不会误报 |
| 源码 Electron | 六次真实鼠标拖选，包括正反向、栏缝越界、两档缩放与复制；十界面语言 × 两主题 × 两窗口尺寸共 40 组搜索布局；实际搜索导航与拖动；真实语法 IPC、等待提示、建议和 PDF 定位；关于标题；实际批注新增后的撤销与重做按钮 |
| 档案与包 | 最新脱敏档案及 SHA-256；APP 内生产文件、11 个 OCR 模型、2,051 个语法资源条目及许可证；签名、DMG 安装布局与完整性、ZIP 完整性和包内字节一致性 |

结果文件位于忽略的 `tests/output/release-2.1.17/`：`grammar-unit-results.json`、`grammar-engine.json`、`selection-latest.json`、`selection-latest-privacy.json`、`selection-latest-archive.json`、`grammar-layout-ui.json`。源码截图位于 `grammar-source/`，只使用脱敏或合成内容。历史旧英文正则断言已随 API 删除迁移，不运行旧测试全集。

## 重现命令

```sh
npm run prepare:grammar
node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/lib/release-2.1.17-grammar-layout.test.tsx --reporter=json --outputFile=tests/output/release-2.1.17/grammar-unit-results.json
node tests/scripts/release-2.1.17-grammar-engine.cjs
node tests/scripts/release-2.1.17-selection-latest.cjs /Users/yuwei/Desktop/document.pdf
tests/tmp/release-2.1.16/venv/bin/python tests/scripts/release-2.1.17-selection-privacy.py
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.1.17-grammar-layout-ui.cjs
git diff --check
npx --no-install electron-builder --mac dir --config.electronDist=node_modules/electron/dist
codesign --force --deep --sign - release/mac-arm64/PDFuck.app
codesign --verify --deep --strict release/mac-arm64/PDFuck.app
npx --no-install electron-builder --prepackaged release/mac-arm64/PDFuck.app --mac dmg
ditto -c -k --keepParent release/mac-arm64/PDFuck.app release/PDFuck-2.1.17-macOS.zip
node tests/scripts/release-2.1.17-grammar-package-check.cjs
```

原件参数可省略，此时只测试公开脱敏 PDF；语法正反例由合成文本提供。包核验脚本用于本轮交付的完整证据，因此要求同时存在原件只读检查的结果。

交付为 `release/PDFuck-2.1.17-macOS.dmg` 和同名 ZIP，摘要在 `PDFuck-2.1.17-macOS-SHA256.txt`，结构化验收在 `PDFuck-2.1.17-macOS-release.json`。本轮不启动 APP、DMG 或 ZIP 内成品，也不执行包内 Java；运行功能由源码窗口证明，资源复制由静态哈希和签名证明。

## 边界

LanguageTool 各语言规则覆盖不同；韩语尚不受该引擎支持，界面明确提示，不以英语规则检查。低置信规则过滤会降低部分召回率，结果仍需结合语境审核。完整性错误会报错，不会当成“无问题”。首次启动需等待，本地进程 Java 堆上限为 768 MB，离线资源增大安装包。未运行历史全集、未做 Windows/Intel 成品实测、未重新验证打印硬件。macOS 使用 ad-hoc 签名，未经 Apple 公证。

开源来源：[LanguageTool 6.6](https://github.com/languagetool-org/languagetool/tree/v6.6)、[本地服务器](https://dev.languagetool.org/http-server.html)、[语言规则覆盖](https://dev.languagetool.org/languages)、[Temurin 发布](https://github.com/adoptium/temurin17-binaries/releases/tag/jdk-17.0.21%2B9)。

Final static package verification passed: 210 production files and all 2,051 grammar resource entries match. DMG: 573,658,504 bytes; ZIP: 574,145,468 bytes. Both contain the same signed APP payload. No packaged application or bundled Java process was launched.
