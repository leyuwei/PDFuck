# 2.1.20 验收

本轮处理七项反馈，界面文字覆盖现有十种语言，README 未修改。

- hint 改为 1.5 秒、12px，只读取功能按钮的补充说明；与按钮文字相同的说明不显示，批注列表、批注悬浮原文及编辑内容不参与按钮 hint。
- 漏字来自选择层水印过滤：大量小字号图表标签把页面中位字号拉低，普通字体的正常正文片段被当成大字水印删除。改为按文字量统计字号，并要求重复/水印特征及实质重叠；保留明确标记水印过滤。
- Markdown 批注编辑与预览左右排列，分隔条支持拖动和键盘调整。原文复用复制文本的断行和断词整理。
- 更新下载使用 GitHub 官方 release 的安装资源、平台与架构优先匹配、SHA-256 校验和既有断点下载器。支持暂停、继续、网络重试、进程重启恢复；校验失败不能安装。更新与功能资源共用网络配置，避免检查更新中断资源下载。
- 安装前走现有未保存文档关闭流程；取消关闭会取消安装请求。macOS 辅助脚本等待进程退出、验证应用标识/版本/签名/架构、分阶段覆盖并保留失败回滚与本地化提示；Windows 调用 NSIS 安装包。
- 两类下载窗口均可最小化至版权位置，进度继续刷新，点击恢复窗口；最小化不会发送暂停/取消。
- 可调弹窗按实际顶部位置计算可用高度，四边缩放继续有效。

仅运行本轮新增测试：

```sh
node tests/scripts/run-vitest.cjs run tests/unit/renderer/src/components/Release2120.test.tsx tests/unit/main/release-2.1.20-update.test.ts tests/unit/main/release-2.1.20-network.test.ts --reporter=json --outputFile=tests/output/release-2.1.20/unit.json
node tests/scripts/release-2.1.20-text-layer.cjs
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.1.20-ui.cjs
```

23 项新增单元通过。两个原始输入仅在本机只读验证，不复制原内容至公开测试夹具；159/159 与 885/885 个非空文本项完整保留，三档缩放、两种字体模式共 12 组、342 组正反向选择范围通过。源码 Electron 窗口 8 项交互通过，包含实际拖选跨过两处此前遗漏正文并核对选区覆盖。公开截图仅使用内置练习文档。

产物为 macOS arm64 APP、DMG、ZIP。包检查使用新增 `release-2.1.20-package-check.cjs`，核对生产文件逐字节一致、版本、资源排除/许可证、严格签名、DMG Finder 布局、ZIP 与 SHA-256。具体结果记录于 `release/PDFuck-2.1.20-macOS-release.json`。

历史 hint 用例仅同步新的等待时长与图标按钮夹具，未执行。未运行旧测试全集、未启动打包成品复测、未覆盖本机现有应用；真实系统替换安装、Windows/Intel 运行与安装未验证。签名为 ad-hoc，未公证。GitHub 无匹配安装资源或无 SHA-256 时保留发布页入口。
