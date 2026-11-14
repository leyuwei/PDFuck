# 2.1.18 引导框定位修复

日期：2026-11-14。版本维持 2.1.18，README 不变。

## 问题与改动

第 3 步展开批注侧栏、收起书签时，PDF 页面会平移；只监听页面尺寸变化无法覆盖这种移动，之前测得的位置会残留。PDF 适配缩放和页面节点替换也会改变目标几何。

引导显示时逐帧重新获取目标并直接同步框体位置；ResizeObserver 在适配/缩放后补充同步测量，取消框体的位置/尺寸过渡。收起说明和关闭引导时停止监听。此修复共用于所有引导步骤，不改教学内容和文档操作。

## 本轮新增检查

- 新增 `tests/unit/renderer/src/components/GuidePosition.test.tsx`：3 项通过，覆盖无 resize/scroll 事件的纯平移、后备目标和 PDF 节点替换、收起/恢复及卸载清理。
- 新增 `tests/scripts/release-2.1.18-guide-position-ui.cjs`：32 组检查通过，在中文、英文、阿拉伯语及双主题下切换工具栏和书签、改变缩放，另检查窗口尺寸、说明收起恢复及切换编辑目标。33 次位置比对最大误差 0 px；renderer 无异常。布局切换完成后测量，动画期间的纯移动另由单元逐帧覆盖。
- `npm run typecheck`、直接 `npx --no-install electron-vite build`、`git diff --check` 通过。本轮未运行历史测试全集或此前版本专项。

结果：`tests/output/release-2.1.18/guide-position-unit.json`、`tests/output/release-2.1.18/guide-position/ui.json`。

修复截图：`tests/output/release-2.1.18/guide-position/aligned-step-3.png`。

## 打包

重建 macOS arm64 APP，ad-hoc 签名后生成同版本 DMG 和 ZIP。静态验收使用新增 `tests/scripts/release-2.1.18-guide-position-package-check.cjs`，核对生产文件、版本、签名、DMG/ZIP、许可证及 SHA-256。当前产物及校验结果以 `release/PDFuck-2.1.18-macOS-release.json`、`release/PDFuck-2.1.18-macOS-SHA256.txt` 为准。

此前练习引导安装包保存在 `release/previous-2.1.18-before-guide-position-20261114/`。未启动成品重跑 UI；未做 Windows/Intel 实机验证，macOS 未公证。
