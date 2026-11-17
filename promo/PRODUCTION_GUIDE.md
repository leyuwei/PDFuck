# PDFuck 宣传物料制作规范

本目录是一套可重复运行的宣传制作工程。当前交付为中英文常青版；基于 README 的功能定义、PACKAGING_GUIDE 中当前版本说明以及本地生产构建。用户原脚本的五条主线保留：导师批注、AI 阅读工具、快捷查阅、智能裁切、常规编辑。

## 1. 文件与职责

|文件／目录|用途|更新时如何修改|
|---|---|---|
|PLAN.md|拍摄前方案、视觉规则|先确认叙事与功能范围|
|scenes.json / scenes.en.json|最终分镜、文案、时长、放大区域|日常改字与调节奏的主要入口|
|COPY.md|长短版宣传配文|按发布平台选用|
|scripts/make_sample.py|自制两页论文样本生成器|替换论文内容、图表、引文与缩写|
|scripts/capture.cjs|真实应用自动操作与 CDP 动态采集|UI 改版后调整定位器和动作|
|scripts/render.py|统一版式、转场、字幕、音乐与编码|改字号、配色、画幅和输出参数|
|scripts/verify.py|成片解码与尺寸／帧数／时间检查|与新输出规格保持一致|
|assets/|自制 PDF 与合成音乐|无私人文件，无远程素材|
|captures/|无损稳定画面与 motion/ 动态帧|重新采集会覆盖本目录同名素材|
|qa/|采集日志、分镜预览、检验记录|按 zh / en 分目录保存最新结果|
|output/|可发布文件|MP4、GIF、封面和 SRT|

## 2. 环境与运行

在仓库根目录运行。需要已有工程依赖（Playwright、Electron）及 `out/main/index.js` 生产构建。拍摄用的是本地生产构建的真实 renderer，不是重画的 UI；不触发构建、打包或发布。

Python 需要 Pillow、numpy、reportlab 和 imageio-ffmpeg。后者提供独立 FFmpeg，无需修改系统 PATH。字体默认使用 macOS 自带 STHeiti；迁移到其他系统时，将 `render.py` 的 FONT/REG 指向有中文字符的字体并重新检查排版。

本次使用的 Python：
`/Users/yuwei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`

可将下面的 `python3` 替换为上述路径，或在自己的虚拟环境安装依赖：

```sh
python3 -m pip install Pillow numpy reportlab imageio-ffmpeg
python3 promo/scripts/make_sample.py
node promo/scripts/capture.cjs
python3 promo/scripts/render.py --preview
# 检查 promo/qa/zh/storyboard.jpg（英文为 qa/en/storyboard.jpg） 和每幕 PNG 后，再执行完整输出
python3 promo/scripts/render.py
python3 promo/scripts/verify.py
# 英文真实界面、配字与同规格输出
node promo/scripts/capture.cjs --en
python3 promo/scripts/render.py --en --preview
python3 promo/scripts/render.py --en
python3 promo/scripts/verify.py --en
```

只改配字、时长、放大范围：修改 `scenes.json`，从预览步骤继续。UI、样本、功能逻辑改变：重新生成样本并完整采集，不能直接沿用旧版截图。未来软件更新只需核实功能是否变化；发布画面、文件名、封面、字幕与配文不标版本号。采集脚本从 package.json 读取内部测试版本参数；内部溯源记录可保留构建信息。

## 3. 自动演示步骤

1. 用 `make_sample.py` 生成 Demo.pdf。内容包含自制矢量流程图、对比表、RAG 定义和一个可识别参考文献。示例中的比较与结论不代表实际科研结果。
2. 启动带独立临时用户目录的 Electron。只关闭本脚本启动的窗口；不访问正常用户设置，不覆盖 Demo.pdf。
3. 关闭首次引导，并断言引导已经消失。设置仅监听 `127.0.0.1` 的固定 AI 响应服务，使用无价值的演示 key。
4. 切到批注实验室，打开全文评价，真实提交至本地服务，等到 Markdown 结果出现，点击添加到批注，开启 Markdown 显示。
5. 依次打开一键图表、关联引文、缩写快查，断言图表索引与引文结果，记录稳定结果。
6. 切换单页视图，关闭结果浮层，框选图表，设置 2 mm 保护边界，执行智能裁切，确认范围并确认页面裁切。
7. 打开保存模块，选择 EPS。这里演示格式选择，不声称已经完成 EPS 文件导出。
8. 撤销裁切，展示编辑模块和 OCR 配置入口。常规功能是入口展示，不伪造识别或转换结果。
9. 所有过程用 Chromium CDP 记录真实应用帧，同时保存稳定 PNG；窗口退出前停止记录、关闭本地服务、清理本次临时用户目录。

## 4. 文案与画面规范

- 成片 60 秒、1920×1080、30 fps。12 幕，同一章节内由功能入口推进到结果。
- 画面固定区域：品牌／章节顶栏；左侧标题与说明；右侧 1260×840 应用窗口；底部补充信息。字幕不覆盖 UI。
- 中文标题 62 px，英文标题 52 px（Arial），正文 28 px，底注 22 px；代码对每行文字测量宽度，超出安全区直接报错。
- 每幕开头复现到达目标状态前约 1.4 秒的真实动态帧，然后保持无损静帧。长等待被剪去，不能用视频时长宣称运行速度。
- 重点区域坐标基于原始 2880×1920 截图；`focus: [左, 上, 右, 下]`。镜头保持 3:2 的应用区域比例，限制在原图边界内，不拉伸 UI。
- 放大从约 1.5 秒开始，用 1.2 秒平缓完成；转场约 0.33 秒。放大属于剪辑镜头，不是伪装的软件功能。
- AI 镜头显式写“AI 回复为演示示例”。不展示真实 API Key，不暗示所有模型有相同结果。
- 原句“用 AI 解决每一个复杂的导师批注”改为“用 AI 拆解复杂的导师批注”。保留吸引力，避免绝对效果承诺。
- 音乐为本目录脚本合成的轻量背景音，无第三方音频，无配音；GIF 无声音。文字已直接合成入视频，SRT 用于后续再编辑，不要发布时重复叠加。

## 5. 质量检查与返工

先看 `qa/zh/storyboard.jpg（英文为 qa/en/storyboard.jpg）`，再打开每张全尺寸镜头 PNG。逐项确认：标题不换行错位、正文不溢出、品牌不挡控件、没有首次引导或报错弹窗、裁切内容完整、EPS 选择可见、引文和缩写结果可辨认。

真实 UI 内正常滚动产生的边缘内容允许出镜，但重点控件／结果不可被切断。若重点框被裁断，优先改 `focus` 或真实窗口布局；不要用绘图覆盖错误 UI。

编码后用 `verify.py` 全片解码 MP4，检查 1920×1080、30 fps、1800 帧与音轨，逐帧读取 GIF 并检查循环、尺寸与总时长。同时从最终 MP4 提取各幕末端画面，检查编码后的画面；不能只检查合成前 PNG。

本次检查记录在 `qa/VALIDATION.md` 和 `qa/zh/verification.json` / `qa/en/verification.json`。自动校验不能代替审美检查。修改任何配字、镜头、时长或采集结果后，重新生成预览并检查受影响镜头，最后重新编码与验证。

## 6. 发布与后续版本

- 视频平台优先使用 MP4；图文平台按其上传限制选择 GIF；封面可直接配长短版文字。
- GIF 是全长缩小版，960×540、10 fps、循环播放，使用调色板控制体积。平台压缩可能影响小字，详细操作以 MP4 为准。
- 输出目录共两个 MP4、四个 GIF（每种语言一个视频、一个完整动图、一个轻量动图）；避免把预览或旧版文件误发。
- 当前只在本机采集与制作，未上传、发布或发给他人。
- AI 需用户自配接口；图片解释需视觉模型。OCR 首次按需下载资源；Office 导入依赖 Office／LibreOffice；EPS 导出依赖 pdftocairo。
- 项目图标来自 resources/icon.png；样本与版式／配乐由本制作脚本生成。公开引用条目用于展示软件引用解析，不把第三方论文截图用于宣传。

## 7. 中英文常青版约定

- 不带参数默认中文，`--en` 切换英文；分别写入 captures/zh、captures/en、qa/zh、qa/en。英文通过应用语言设置真实重拍，包含英文 AI 固定回复，不以英文字幕覆盖中文 UI。
- 采集开始前注入 `.about-trigger small { visibility: hidden !important; }` 并断言不可见，仅作用于本次隔离窗口，避免版本号进入视频。不修改应用源代码，不隐藏功能限制。
- 稳定命名：PDFuck-promo-zh / PDFuck-promo-en；完整 GIF 同名，轻量 GIF 加 -small；封面 cover-zh.png / cover-en.png，字幕 promo.zh.srt / promo.en.srt。
- render.py 同时生成完整 GIF 和小于 2,000,000 字节的轻量 GIF。轻量从 640px、3 fps、64 色、无抖动开始；如超标自动降低帧率／尺寸，仍超标则失败。verify.py 全帧检查两类 GIF。
- README 图片固定引用中文轻量版；output 放行规则保持不变。英文文件可供英文发布渠道直接使用。
- 字符宽度断言、独立排版、60 秒时长与全片解码检查在两种语言分别执行。中文可读配字与英文自然短句优先，不逐字硬译。
