# OCR / 语法资源按需下载验收

## 本轮范围

沿用 2.1.17，仅处理 README 与资源交付方式。README 删除软件版本和修订流水，只微调 OCR、语法功能介绍及 LanguageTool / Temurin 致谢。此前 PDF 选择、图表、批注、书签和打印修订保留。本轮不运行历史全集、不启动成品。

## 实现

- 基础安装包不再带 Tesseract.js、WASM 内核、11 份语言模型、LanguageTool 或 Java。保留轻量调用层、固定资源清单和许可证说明。Tesseract.js 改为开发依赖，运行时从用户缓存动态加载；生产构建清理旧 `out/ocr`，打包配置移除原语法目录。
- 首次使用 OCR 才下载 13 个固定 npm 运行依赖，以及所选语言和英语模型；英语只取一个模型。切换语言复用引擎和已有模型。语法检查只在确实有可检查正文时请求 LanguageTool 和匹配平台的 Java；扫描页、无完整正文或仅不受支持的韩语段落不触发下载。
- 启动应用不会初始化资源服务、读取代理密码或发起资源下载。缓存位于 `app.getPath('userData')/feature-resources`，按资源内容指纹区分，不跟随软件补丁版本反复下载。
- 下载弹窗包含功能名称、下载大小与剩余大小、进度/速率、来源明细、暂停/继续/重试、取消和代理配置。标题可拖动，正文独立滚动，底部操作区保留；有十语言、深浅主题和 RTL。取消只结束本次功能请求，保留已下载字节，不误报识别完成或“没有语法问题”。
- `.part` 保存实际字节，独立原子 JSON 保存 ETag / Last-Modified。继续时使用 Range / If-Range，严格核对 Content-Range、长度和总大小；服务器忽略 Range 时重新写入完整文件，不追加到旧分片。错误范围会清理无效分片后重试。断网/超时有界重试，失败后保留可恢复数据；校验失败删除损坏内容。
- 所有下载限定为内置清单。npm 包使用 SHA-512 SRI，语言模型和语法资源使用 SHA-256。下载完成后才解包，不运行 npm 安装脚本。独立暂存目录、完整文件清单与原子目录提升，防止中断后的半套引擎被执行；资源服务下次初始化清理遗留暂存目录。已安装缓存首次使用时复核文件和符号链接，检测损坏后重新准备。
- 安装完成删除重复的压缩档案，保留已验证的运行目录；未完成任务保留分片和已下载档案以便恢复。软件退出、窗口关闭和手动取消都会中止当前请求；强制终止后也可按实际文件长度续传。
- 多窗口下载串行，共享完整缓存，各窗口只能控制自身任务。原生窗口的未保存退出流程先释放资源弹窗，避免遮住后续保存提示。
- 使用独立 Electron 网络会话，支持系统代理、直连、自定义 HTTP / HTTPS / SOCKS5。HTTP(S) 代理凭据只响应匹配代理的认证挑战，不给源站；不改变 PDF、AI 或更新网络会话。代理密码通过系统 safeStorage 加密，不可用或 Linux basic-text 后端时拒绝保存明文密码。SOCKS5 用户名/密码认证不受 Chromium 支持，界面明确提示。
- OCR 图像和语法正文只交给本地引擎，资源下载不提交文档。Java 保留原有空闲退出和应用退出清理。

资源与字节数：`resources/feature-resources.json`；基础包中的致谢和许可入口：`resources/feature-notices/`。固定版本与哈希只写在工程清单、测试及打包文档，不写 README 发布日志。

## 新增测试与结果

| 项目 | 本轮结果 |
| --- | --- |
| 新单元 | 36 项通过。覆盖下载/缓存、Range / If-Range、忽略范围、错误范围、416、断网恢复、校验失败、完整分片提升、损坏缓存、超时有界重试、磁盘权限、代理地址与密码保护、队列/窗口归属、退出恢复、准备中取消、十语言、弹窗状态及原生关闭事件 |
| 原生网络 | 5 项通过：真实 Electron 流式下载、原生 Range / If-Range、HTTP 代理认证、源站不接收代理密码、系统代理与凭据清除 |
| 强制终止 | 下载子进程 SIGKILL 后重启，从保留的实际字节位置续传，最终哈希与原始合成数据一致 |
| 实际资源安装 | 8 项通过：遗留暂存清理，固定运行包/所需模型安装，真实 OCR 生成隐形文字层，增加语言只补所缺模型，安装后的英中文语法检查，新资源服务离线复用，缓存损坏检测 |
| 源码主窗口 | 8 组通过：空正文不下载；语法首次使用明确提示；40 组语言/主题/窗口布局；拖动/代理失败恢复/取消；实际 OCR 下载暂停；软件退出再开续传并继续 OCR；切换语言只补一份模型；阻断资源网络后重复 OCR |
| 代理表单布局 | 小窗口十语言 × 两主题，共 20 组通过。输入不水平溢出，正文滚动且底部按钮可达 |
| 离线语法主窗口 | 使用安装后的缓存，阻断资源网络；主进程 IPC 返回两条真实语法建议并准确定位 PDF，未出现下载窗口或网络请求 |
| 惰性启动 | 新用户目录启动不创建资源缓存；首次显式使用才初始化并弹出确认，不自动下载 |
| 必要检查 | typecheck、直接生产构建和 diff 检查通过。新静态成品检查核对生产文件、资源缺失/许可存在、版本、签名、DMG / ZIP 完整性与哈希 |

全部新增图像、PDF、字节数据和代理凭据均为合成内容，没有使用新的用户原始文档。`tests/fixtures/ocr-resource-synthetic.png` 只包含白底和固定测试文字，是本轮公开 OCR 夹具；临时 PDF、缓存与截图存于被忽略的 `tests/tmp` / `tests/output`。之前脱敏档案未改。

实际 npm 运行包和英语模型来自固定官方 npm/CDN 分发，均经过生产校验链。语法安装测试复用先前官方来源下载的原版档案并重新核对固定 SHA-256，验证实际解包、安装、运行和离线复用，不重复下载数百 MB。测试脚本在没有该缓存时会正常从固定地址下载。源码退出恢复测试对真实 HTTPS 资源流做限速，确保能稳定操作暂停；真实请求的 Range 被记录。

主要报告位于 `tests/output/release-2.1.17/`：`resources-unit-results.json`、`resource-network.json`、`resource-crash.json`、`resource-install.json`、`resources-ui.json`、`resource-proxy-layout.json`、`resource-grammar-ui.json`、`resource-startup.json`。截图位于 `resource-source/`。不把此前阶段通过数计入本轮。

## 重现与打包

```sh
# 只运行本轮新增项；实际资源测试首次运行可能需要联网。
npm run test:resources
npm run typecheck
npm run test:resources-ui
git diff --check

# 沿用用户要求：直接构建和打包，不走包含历史全集的一键命令。
npx --no-install electron-vite build
npx --no-install electron-builder --mac dir --config.electronDist=node_modules/electron/dist
codesign --force --deep --sign - release/mac-arm64/PDFuck.app
codesign --verify --deep --strict release/mac-arm64/PDFuck.app
npx --no-install electron-builder --prepackaged release/mac-arm64/PDFuck.app --mac dmg
ditto -c -k --keepParent release/mac-arm64/PDFuck.app release/PDFuck-2.1.17-macOS.zip
node tests/scripts/release-2.1.17-resource-package-check.cjs
```

常规 macOS / Windows 打包脚本已取消预先下载语法引擎；开发用 `prepare:grammar` 不是打包前置步骤。本轮真实运行环境是 macOS arm64。未做 Windows/Intel 原生运行验收，也未连接打印机。系统代理、直连及本机 HTTP 认证代理经过实际 Electron 检查；不宣称测试过所有企业代理或网络环境。

成品不启动、不执行包内代码，仅静态检查。macOS 使用 ad-hoc 签名，未 Apple 公证。首次使用相应功能需要网络，完成下载后可离线使用；资源来源不可达时可调整下载代理并继续。

网络实现依据：[Electron net](https://www.electronjs.org/docs/latest/api/net)、[ClientRequest](https://www.electronjs.org/docs/latest/api/client-request)、[Session](https://www.electronjs.org/docs/latest/api/session)。

## 最终静态交付结果

已核对 197 个生产文件与构建输出一致；OCR/WASM/语言模型、LanguageTool 和 Java 均未进入安装包，许可说明保留。DMG 从 573,658,504 字节降到 154,017,107 字节，减少 73.2%。ZIP 为 152,801,310 字节。APP、DMG、ZIP 签名及包内内容一致，DMG/ZIP 完整性通过。成品运行检查为 false，遵守用户“成品勿复测”。

结构化结果：`release/PDFuck-2.1.17-macOS-release.json`；摘要：`release/PDFuck-2.1.17-macOS-SHA256.txt`。
