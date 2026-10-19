# 2.0.32 升级计划

保留未提交的 2.0.31 工作区，在其基础上升级，不提交或推送远端。

1. OCR：沿用离线 Tesseract 和隐形 PDF 层，提高识别输入质量，自动纠斜，低置信度采用另一种分割/阈值复识别并选择较可靠结果。纠斜后将文字坐标变换回原页。统一清理连续书写语言的伪空格，保留英文、韩文、阿拉伯文词间距与原始字形位置；不让 AI 自动改写论文原文。
2. 设置：多个命名模型配置，编辑与激活分离，旧配置自动迁移，新增 Grok。按连接、生成、Thinking 和高级参数分组；支持采样、总输出、思考预算、超时和 JSON 扩展，十语言、RTL、深浅主题、四字号适配。
3. 请求：默认 600 秒、65,536 输出 Token，总恢复预算不再限于 5 分钟；首包/Thinking 按完整配置等待。按服务商映射 Thinking，明确不兼容时降级参数，预算耗尽先扩容再降低思考，截断/错误流不能当成功写入。保留鉴权失败停止、取消、请求归属、批注单次写回。
4. 测试：旧配置迁移/激活/取消、参数映射、错误与截断恢复、长 Thinking/流解析、语言空格规则、真实 OCR 和坐标/像素保存回归；真实设置窗口十语言四字号主题检查。执行现有完整构建和 Windows 源码/成品发布检查。
5. 交付：同步 package 与锁文件为 2.0.32，更新 README、打包指南、交接和验收记录；生成 Windows 安装版/便携版、核验包内版本及 SHA-256。macOS 未在此 Windows 机器运行，按实记录。

参考：
- https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
- https://docs.x.ai/developers/model-capabilities/text/reasoning
- https://platform.claude.com/docs/en/build-with-claude/extended-thinking
- https://api-docs.deepseek.com/guides/thinking_mode/
