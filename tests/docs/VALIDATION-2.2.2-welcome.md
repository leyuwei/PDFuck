# PDFuck 2.2.2 首页、边栏与批注复制验收

首页打开文档区域使用工作区背景，按可用高度垂直居中。标题和拖放提示使用浅色、深色主题各自的正文颜色，按钮根据强调色选择黑字或白字，悬停沿用同一底色。按钮轮廓和键盘焦点与工作区有足够的区分。右侧最近打开列表继续使用原有卡片与独立滚动区。

查看、编辑、批注、保存工具模块和右侧批注列表分别保存展开状态。打开、定位或编辑批注时，已折叠的批注侧栏保持折叠。批注右键浮窗沿用原生文本选取和复制快捷键，正文、原因和自定义回复独立判断文字方向。

## 定向验证

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.2-welcome-ui.cjs
node tests/scripts/release-2.2.2-sidebar-copy-ui.cjs
git diff --check
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
node tests/scripts/release-2.2.2-package-check.cjs --welcome-sidebar-copy --source-only
```

新增专项检查透明外观、垂直居中、正文和辅助文字及主按钮对比度、长译文换行、键盘焦点，以及选择文档和 50 条最近记录的滚动。窗口矩阵覆盖十种语言、两种主题和四档字号，另检查三种窗口大小和浅深两主题下的六种自定义强调色。截图和结果位于 `tests/output/release-2.2.2-welcome/`。

边栏专项用隔离用户资料重启桌面进程，检查四模块混合的展开、折叠配置和批注列表的折叠配置。右键浮窗专项覆盖英文和阿拉伯语界面、浅色和深色主题、四档字号、原文和 Markdown，使用实际鼠标拖选和系统剪贴板。截图和结果位于 `tests/output/release-2.2.2-sidebar-copy/`。

## 结果

- 类型检查、生产构建和新增源码专项通过。首页覆盖 80 组布局、12 组强调色对比度、6 组窗口尺寸，以及选择文档和 50 条最近记录滚动。
- 重启后恢复四个工具模块的展开状态。单击、双击或右击批注时，已折叠的批注列表保持收起。34 次拖选均核对了系统剪贴板中的实际文本。
- 最新 Windows x64 安装版和便携版均已生成。收到停止复测的要求前，解包版自动拖选出现一次少选两个字符的断言。调整测试拖动落点和等待后仅重跑了源码专项。最终交付清单记录源码结果、产物信息和 SHA-256。
- README.md 的工作树内容与当前提交一致。
