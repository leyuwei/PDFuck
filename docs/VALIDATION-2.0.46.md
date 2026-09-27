# PDFuck 2.0.46 验收记录

## 修复

- 80 页以上连续阅读时，书签、页内链接和搜索结果共用目标页挂载后的实际位置定位；定位期间滚动监听不覆盖请求页码。搜索命中高亮保留到下一次定位。
- 搜索窗扩大到 440px，输入与结果使用正文字号，结果显示页码、上下文与命中词；增加搜索中、无结果、初始提示，十种语言齐全，并适配暗色主题与窗口缩放。

## 本次验证

- 仅运行新增的 `npm run test:release-2.0.46`，使用 96 页交替页面高度的 PDF，在真实 Electron 窗口检查远距离书签、页内链接、搜索跳转、命中高亮、无结果、十种语言、字号、暗色主题和最小窗口布局。源码构建与 macOS 成品各通过一次。
- TypeScript 类型检查通过；`git diff --check` 通过；生产构建成功。
- macOS arm64 `.app` 采用 ad-hoc 签名，`codesign --verify --deep --strict` 通过；`Info.plist` 和 `app.asar` 均为 2.0.46；DMG 校验通过。未执行旧版测试项，未在 Windows 机器上打包或验证。

## 产物

| 文件 | SHA-256 |
| --- | --- |
| `release/PDFuck-2.0.46-macOS.dmg` | `b9db92d8d2f31bfe79f358526f9de258de1d9fa29e19465c7be3e4fc6fb9f60f` |
| `release/PDFuck-2.0.46-macOS.zip` | `1362082c4eb4d9e50369af5597fa6fc064fb3c81515e3f388ce41b03f6a3da90` |

视觉检查截图：`output/playwright/release-2.0.46-search.png`。
