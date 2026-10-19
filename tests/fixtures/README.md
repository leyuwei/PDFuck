# 测试输入

这里保存从原根目录 `tmp/` 迁入的 14 份可复用原始 PDF，包括 2.1.10 报错样本 `test_multi_col.pdf`。这些文件可被 Git 跟踪；本次没有添加或修改 `.gitignore`。生成的 PDF、缓存和截图不混入输入目录。

历史用例还引用了本工作区原本就缺失的 `testOct.pdf`、`cpaper.pdf`、`try-eps.pdf`、`section_vii_changes.md`、`02_Scheduling0815m.pdf` 和 `Scheduling0813.pdf`。路径统一改为本目录，需要复跑依赖这些输入的用例时应先补入原始文件。本次未执行这些历史用例；原脚本已有的可选样本跳过或自生成 EPS 夹具行为保留。2.1.10 新增验收不依赖这些缺失文件。
