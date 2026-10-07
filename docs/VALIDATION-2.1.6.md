# PDFuck 2.1.6 验收记录

日期：2026-10-07。环境：Windows x64；Electron 43.4.0、electron-builder 26.15.3。版本和锁文件同步为 2.1.6，无新增依赖。

## 交付行为

- 顶部保存左侧增加 36px 新建图标。无标题浮窗提供 Markdown/TXT 两张类型卡片，可键盘选择、Escape/关闭/点击背景取消；取消恢复触发按钮焦点。
- 按用户最终要求，类型选择浮窗没有警示框。创建后在源码工作区显示保存提醒，纯编辑器/PDF/双栏视图都能看到；成功保存后消失，可手动关闭提醒。
- 新文档仅保存在内存中，空白内容也启用保存。首次保存强制选择磁盘路径，取消保存保留原文、未保存状态和提醒；关闭复用保存/放弃/取消确认。未保存文档的标签存档不记录虚构路径，MD/TXT 标签正确区分类型。
- 新文件复用已有模板、独立历史、字体、主题、编码、自动换行等设置。若此前仅 PDF 视图，新建时显示源码；支持输入区焦点恢复。未保存文件不能重新从磁盘读取编码，但可以选择保存编码。
- Tab 在光标处插入真实制表符；单行选区替换为 Tab，多行选区逐行缩进。选区恰好结束于下一行开头时不缩进该行。Shift+Tab 删除一档前导制表符或最多四空格；选区/光标随文本同步恢复。
- 缩进复用已有撤销/重做历史，输入法组字不拦截，Escape 可把焦点移出编辑区。制表符显示为四字符宽，与 TXT PDF 排版一致；Markdown 能渲染二级列表。
- 浮窗、警告及操作提示有十语言翻译；明暗主题、RTL、界面四档字号与编辑器 S/M/L 均复用现有规范。
- 根目录 `index-CWy75cA3.css` 为历史遗留文件，未找到工程引用，当前构建及打包均不使用；原文件保留。实际本版 CSS 为 `out/renderer/assets/index-C4pua87e.css`。

## 新增测试与必要检查

仅执行本版新增检查，不运行旧测试全集、`npm run build` 或一键发布脚本。

- `src/renderer/src/lib/release-2.1.6.test.ts`：6 项通过。Unicode/选区 Tab、逐行缩进/下一行边界、反缩进/空行/光标映射、真实 Markdown 嵌套列表与历史、长度上限、空文档未保存状态及十语言文案。
- `src/main/release-2.1.6.test.ts`：2 项通过。无磁盘路径的新文件可渲染；首次保存前不读取相对路径图片，保留替代文本；IPC 渲染边界拒绝无效未保存标记。追加边界检查后仅重测该新文件。
- `node scripts/release-2.1.6-ui.cjs` 的 behavior 阶段：Markdown/TXT 真实创建，空文件首次取消/实际保存、Unicode 和 Tab 文件保存、警告生命周期、Tab/Shift+Tab 选区及撤销重做、输入法保护、Escape、S/M/L、自动换行、空文档关闭确认及取消保留。
- `--checks=layout,labels`：最终无警告的类型浮窗在应用最小 1080×680 窗口下通过十语言 × 双主题 × 四字号共 80 组检查；按钮紧挨保存、同高 36px，卡片和警告不溢出。MD/TXT 标签、语言切换后的状态提示及 RTL 下 LTR 后缀/图标通过。截图已目视核验。
- `--checks=edge`：两种文档选中已有 Tab 再按 Tab，内容不变时也立即收拢选区；后续输入位置正确。
- `npm run typecheck`、`npx --no-install electron-vite build`、`git diff --check` 通过。沿用生产构建对 PDF.js 静态资源 URL 的提示，资源由已有构建插件复制；未新增依赖。
- 首轮 UI 暴露选区恢复晚一帧，修复后重新验证键盘阶段；截图暴露新文件标签类型与语言切换提示，修复后只补测 labels；用户取消浮窗警告后只补测受影响布局，保留其余已通过结果。

证据位于 `output/playwright/release-2.1.6-*.json` 和同名前缀 PNG。成品及哈希记录见本页后续章节和 `release/PDFuck-2.1.6-Windows-release.json`。

## 验收范围

本轮在 Windows 构建交付；未构建或宣称 macOS 原生验收。文件对话框在开发验收中用本地主进程替身选择临时路径，实际通过原 IPC、编码转换及原子写入检查文件内容；成品检查使用真实 EXE 和键盘。未运行安装/卸载旧测试，不修改本机默认文件关联；未发布 GitHub Release。

## 最终成品检查

直接 electron-builder 打包成功，生成安装版、便携版、解包应用及安装器 blockmap；没有调用旧完整发布流程。

`node scripts/release-2.1.6-packaged.cjs` 通过：实际启动最终解包 EXE、便携 EXE 和同一临时资料目录的便携重启。两种新文档都检查正确 MD/TXT 标签、空白未保存状态、创建后提醒、类型选择窗没有警告、Tab/Shift+Tab、选区、撤销重做、Unicode、输入法和 Escape；真实关闭流程确认放弃后退出。源码视图、深色主题、L 字号及换行设置跨启动恢复。

`node scripts/release-2.1.6-resources.cjs` 通过：app.asar 版本 2.1.6；210 个生产文件与 out 逐字节相同，包含本版 JS/CSS；根目录历史 CSS 未入包；PDFium、Koffi、原生打印导入修补及 11 个 OCR 模型完整。最终资源分别为 `index-DnVmN_wJ.js` 和 `index-C4pua87e.css`。

三个 EXE 的 Authenticode 状态都是 `NotSigned`。版本、字节数、哈希和测试范围已保存至 `release/PDFuck-2.1.6-Windows-release.json`，独立校验清单为 `release/PDFuck-2.1.6-Windows-SHA256SUMS.txt`。

| 成品 | 字节数 | 产品版本 | SHA-256 |
| --- | ---: | --- | --- |
| PDFuck-2.1.6-Windows-Setup.exe | 221938061 | 2.1.6 | `11B90A7471E5ADC110AA24120987C721470274EBF8B84D9EED6A8ED1520C316A` |
| PDFuck-2.1.6-Windows.exe | 221554847 | 2.1.6 | `05AD30C05892F395B142E41C67018F7828CF35A39F87273649B49D9884E4EE28` |
| win-unpacked/PDFuck.exe | 225589248 | 2.1.6.0 | `A1CE4F4521F10EAED2FBC8FB8FEB1675DB7A1BAD63700167E60A095BB72AE0D2` |
