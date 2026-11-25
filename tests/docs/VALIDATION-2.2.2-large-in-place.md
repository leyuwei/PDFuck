# PDFuck 2.2.2 大 PDF 查看工具与原位编辑

## 处理方式

- 搜索、识别书签、图表关联、引文关联、缩写快查和语法检查沿用现有工具入口与结果窗口。阅读分析按页处理，控制几何缓存。图表、引文、缩写和语法结果可提示无法提取内容的页数。书签识别结果通过 QPDF 写为标准 PDF 大纲。
- 编辑与批注在同一个标签页操作当前页，工具切换共用当前页的编辑记录。翻页时将改动暂存到应用临时目录。回到查看、导出或打印时，按需生成供该标签页读取的完整临时预览。应用不在用户目录创建编辑副本。
- 普通保存先在目标同目录写入完整 PDF，核对源文件版本，释放阻碍 Windows 替换目标文件的应用内句柄，再原子替换。源文件被其他程序修改或写入失败时，标签页保留待保存状态。另存为走现有文件选择流程。
- 可整页载入的页面使用现有编辑模型并支持页内撤销重做。换页后重新载入当前页，撤销历史以该次页内编辑为范围。单页超限时，支持在原位追加文字、图形和位置批注，原图保留在 PDF 中。已栅格化或超出内容提取预算的页面，全文工具可能没有可分析文本。QPDF 的页替换可能影响指向该页的原有链接或书签。 [QPDF 页操作](https://qpdf.readthedocs.io/en/latest/cli.html) · [QPDF 对象更新](https://qpdf.readthedocs.io/en/latest/json.html)

## 专项

合成样本包含 18 页、超过 128 MiB 的多页文档，以及单页超过 1 GiB 的图纸。专项验证六项工具的结果、标准书签输出、两页间暂存与原路径保存、外部修改冲突保护、单页叠加保存，以及阿拉伯语、深色主题和最大预置字号。语法检查使用确定性的本地服务替身，验证提交的正文与结果回显。

2026-11-25 在 Windows x64 上通过新增专项、类型检查和生产构建。第 5 页新增文字与第 6 页自由批注均写回同一份 18 页文件。关闭原文件句柄后，1,040 MiB 单页图纸的叠加修改也可用 Ctrl+S 直接保存。外部更新时间戳的模拟中，应用保留编辑状态并拒绝写回。

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/release-2.2.2-large-in-place-ui.cjs
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
node tests/scripts/release-2.2.2-package-check.cjs --large-in-place --source-only
```

源码测试结果写入 `tests/output/release-2.2.2-large-in-place/results.json`。成品记录版本、签名状态和 SHA-256。
