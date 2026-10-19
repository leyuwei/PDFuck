# 2.1.7 页面文字可用性修复与交付验收（2026-10-12）

本记录取代此前的 2.1.7 验收。用户提供的 `3b95731def6670092b365d8fc1cf3b0b.md` 在实际应用中可以复现报错；此前验收没有覆盖默认无衬线字体的 Type3 子集，以及增字后继续编辑时新旧子集的歧义。保持版本 2.1.7，重新修复和打包。附件中的研究说明仅作为测试内容，不作为本项目操作指令。

## 本次根因与修复

1. **同名字体不是同一字符编码。** Chromium 默认无衬线 Markdown PDF 使用多份同名 Type3 字体，字体名在 FontDescriptor 中，通常没有 BaseFont。旧定位器仅按字体名选择资源，误选字符表后报“原页面文字已变化”。现在读取 FontDescriptor、ToUnicode 和完整字体信息，按字符表匹配。新补字子集可能是原大子集的一部分，优先完整字符表相等，避免两份字体同时匹配。
2. **文字提取结果不包含全部绘制字体。** PDF.js 可把多个 Type3 子集合成一个 TextItem，只报告首份字体。现在从 OperatorList 的字体、依赖和 ExtGState 收集页面实际使用的全部字体；定位器按实际子集字形序列识别聚合文字，字宽计算合并同一 Type3 字体的各子集。
3. **补字被拆成重叠编辑框。** 同一物理字体的新旧资源、系统补字资源的 loadedName 不同。现在按实际字体名称识别子集和本应用重排输出，保持原字号、字重与字形条件，并保留每片文字的源绑定。仅归一到同一字体族的不同物理字体仍分开，避免换字形。
4. **补字类别与复制编码错误。** 自动排版复用既有字体类别，识别 PingFang SC、Hiragino Sans，避免无衬线被默认换成宋体。Chromium 会新增子集前缀，并把程序字体名中的加号改成下划线；输出 Unicode 还原处理这项改写，同时读取 Type3 FontDescriptor。原标点、私有字形、CJK 部首及多字符映射保留可复制文本。
5. **内部错误被作为用户操作错误弹窗。** 页面文字编辑从通用错误弹窗路径分离。普通字体和布局差异自动进入既有矢量排版；实际输出失败时在编辑器内显示非阻断状态，保留草稿、原页面和重试按钮，不伪装成保存成功。

预览与应用共用文字写回函数。小改动复用原指令；增字、换行、格式修改采用现有 Chromium 排版并嵌入可复制的矢量文字。仅移除所选原字形，不使用白块或文字图片覆盖页面。未编辑段落、源 Markdown 和撤销历史保持。

## 分栏修复保留

真实 `tests/fixtures/15b0dac9d0578d2802c4235a5ab881ed.pdf` 第 9 页的栏沟为 **300.02–311.98pt**，窗口实际栏线为 **306pt**，缩放后为 **305.997046pt**。栏线、选择范围和段落宽度共用 PDF 字体度量及多行共同空白区间；跨栏公式不作为正文栏宽证据。实际鼠标正反向拖选右栏，复制结果均不包含左栏 yielding、(41) 或 provided。

## 仅关键验收

没有运行旧测试全集或一键发布脚本。执行 typecheck、生产构建、diff 检查，以及以下定向检查：

- `release-2.1.7-markdown.test.ts`：**8/8**。同名 Type3 字符表、重叠子集、ExtGState、完整子集字宽、原程序/补字合行、不同物理字体隔离、Unicode CMap 数组/范围/连字/补充平面，以及字体类别。
- `release-2.1.7-repair.test.ts`：**5/5**。真实第 9 页栏沟和双向隔离、窄三栏与跨栏公式、矢量增字及格式、原指令状态与邻行保留、中文标题及段落分离。
- `release-2.1.7-markdown-ui.cjs`：使用用户实际 Markdown 的副本，分别以 sans/serif 14pt 在真实窗口完成普通替换、增字、连续编辑、默认原字体、改字号、保存 PDF、重开后再编辑；校验原标点和文本编码、源文件不变。首次替换检查修改段落及 4pt 字形边缘区之外的像素变化为 **0**。
- 新 Markdown UI 检查模拟 PDF 输出失败：无错误弹窗、草稿完整、原页面像素未变、重试按钮可用；恢复输出后同一草稿成功应用。
- `release-2.1.7-repair-ui.cjs`：真实中英文增字、显式换行、改字号/颜色、撤销重做像素一致、保存重开像素一致、真实中文材料重开后再编辑；希腊文、俄文、日文、韩文、阿拉伯文、希伯来文经实际 Chromium PDF 输出并按连续词语提取；第 9 页实际栏线、缩放及双向鼠标框选。

旧 UI 入口 `release-2.1.7-ui.cjs` 转发到当前关键验收。像素隔离检查确认 Courier 精确替换与真实中文段落增字时，修改区之外均为 **0**；中文检查同时核对下一段实际字形起点，防止邻段覆盖。

输入未新增到版本库。用户 Markdown SHA-256：`7c2fa868e1e13b5a0e3cf2ad4e35c85917af91b39888c0cd548b1745ea0f19da`。原始 testOct 与中文材料的 SHA-256 也保持不变。源码报告及截图位于 `tests/output/release-2.1.7/markdown/`、`tests/output/release-2.1.7/repair/`。

## 复现与打包

```bash
npm run typecheck
npm run test:release-2.1.7
CSC_IDENTITY_AUTO_DISCOVERY=false npx --no-install electron-builder --mac dir --config.electronDist=node_modules/electron/dist
codesign --force --deep --sign - release/mac-arm64/PDFuck.app
codesign --verify --deep --strict release/mac-arm64/PDFuck.app
CSC_IDENTITY_AUTO_DISCOVERY=false npx --no-install electron-builder --prepackaged release/mac-arm64/PDFuck.app --mac dmg
ditto -c -k --keepParent release/mac-arm64/PDFuck.app release/PDFuck-2.1.7-macOS.zip
PDFUCK_SMOKE_EXECUTABLE="$PWD/release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck" node tests/scripts/release-2.1.7-markdown-ui.cjs
PDFUCK_SMOKE_EXECUTABLE="$PWD/release/mac-arm64/PDFuck.app/Contents/MacOS/PDFuck" node tests/scripts/release-2.1.7-repair-ui.cjs
node tests/scripts/release-2.1.7-package-check.cjs
```

本机 Node/npm 与 Command Line Tools 仅在构建命令中临时设置 PATH/DEVELOPER_DIR；没有接受 Xcode 许可或修改系统开发目录。无新增依赖。

## 支持范围与失败反馈

本次真实视觉验收覆盖用户 Markdown 的无衬线/衬线字体、标准西文字体、真实中文字体子集与双栏论文；六种语言脚本另外验证实际矢量输出和文本复制。没有声称覆盖所有损坏或特殊 PDF 绘制方式。字体子集没有新字形时自动补字，并在原字体选项中标明；预览显示最终 PDF 输出。页面编辑不使用通用失败弹窗；真实输出失败保留草稿，在编辑器内反馈，允许继续修改或重试。

## 最终 macOS arm64 成品

本次 APP、DMG、ZIP 已重新生成并通过最终验收，取代此前同名 2.1.7 包。两项关键 UI 验收均实际启动签名后的 `.app/Contents/MacOS/PDFuck`，使用独立用户目录，并断言 `app.isPackaged`、版本 2.1.7 和 app.asar 路径；没有启动旧安装或开发服务器。

| 实际成品检查 | 修改像素 | 修改区域外像素变化 |
| --- | ---: | ---: |
| 用户 Markdown / sans 14pt 首次替换 | 660 | **0** |
| 用户 Markdown / serif 14pt 首次替换 | 295 | **0** |
| Courier 精确替换 | 1251 | **0** |
| 真实中文增字重排 | 71278 | **0** |

两类 Markdown 字体的连续修改、默认原字体、改字号、保存重开再编辑、原标点与 Unicode、源文件保持均通过。模拟输出失败时无模态错误窗口、草稿和页面不变，恢复后重试通过。中英文及六种语言脚本检查、撤销重做、保存重开、第 9 页实际栏线与双向框选也通过。源码的 sans 首次替换为 660 像素、serif 为 292 像素；成品 serif 的字形边缘抗锯齿差异为 295 像素，两者指定区域外均为 0。

包检查通过：**210 个生产资源**与最新构建逐字节一致，**11 个 OCR 模型**齐全；源清单、锁文件、app.asar、APP 和 DMG 版本一致；APP 及镜像内 APP 深度严格签名验证通过；DMG 完整性、Logo 标志、双倍率背景、Applications 链接和无嵌套应用结构通过；ZIP CRC、app.asar、签名清单一致。

本机没有 Developer ID，使用 **ad-hoc 签名，未公证**。没有替换 `/Applications` 中的旧安装、改变默认应用或上传远端。

| 产物 | 字节数 | SHA-256 |
| --- | ---: | --- |
| PDFuck-2.1.7-macOS.dmg | 278689136 | c375cf4fcc77a92661798bb1c65558fc40c5be27fc1ab0ee60eed4ebc5fff284 |
| PDFuck-2.1.7-macOS.zip | 277373055 | a02b27fd29660daeca18647d30bf31f79b7969f04ec89a0202a8af5d92892d85 |

APP：`release/mac-arm64/PDFuck.app`。成品机器报告及截图：`tests/output/release-2.1.7/markdown-packaged/`、`tests/output/release-2.1.7/repair-packaged/`。发布清单与校验值：`release/PDFuck-2.1.7-macOS-release.json`、`release/PDFuck-2.1.7-macOS-SHA256.txt`。
