# PDFuck 2.2.2 大 PDF、故事板和批注残影验收

## 设计

- 达到 128 MiB 的磁盘 PDF 使用按需读取。主进程持有按窗口授权的文件句柄，每次 IPC 最多传输 1 MiB。PDF.js 以 64 KiB 粒度获取索引和分散的页面对象，关闭后台自动读取。构建为该路径使用分段字节缓存，取消了按文件大小申请连续缓冲区的步骤。工作线程空闲时可回收过量的大图像分段，重访页面时按需重新读取。文件关闭时释放读取句柄。需要整份载入的损坏索引修复或超过 128 MiB 的单次读取会报告错误。
- 大文件阅读模式提供翻页、缩放、选取、搜索、书签和只读故事板。整份编辑、打印、导出和全文分析暂停。密码保护文件可在会话内解锁。小文件保留原有编辑模式，保存基线与撤销记录复用内部只读字节快照。
- 大文件视口串行绘制并释放离屏画布。翻页定位完成后立即保存阅读位置，切回标签时可恢复。故事板复用正在阅读的 PDF，在换组或关闭时取消旧任务，回收缓存和画布。缩略图失败时可点击重试。补齐 JPEG 2000 的 PDF.js 本地解码回退资源。
- 删除批注后用已删除批注的 PDF 快照刷新原生画布和交互层，消除撤销后再次删除时可能留下的原生外观。

## 新增源码专项

```powershell
npm run typecheck
npx --no-install electron-vite build
node tests/scripts/run-vitest.cjs run tests/unit/main/large-pdf-ranges.test.ts
node tests/scripts/release-2.2.2-annotation-delete-ui.cjs
node tests/scripts/release-2.2.2-large-pdf-ui.cjs
git diff --check
npx --no-install electron-builder --win --x64 --config.electronDist=node_modules/electron/dist --publish never
node tests/scripts/release-2.2.2-package-check.cjs --large-pdf --source-only
```

大文件用脚本写出各页独立、真实可解码的扫描图像流，周期性插入由 Python Pillow 生成的 JPEG 2000 页。测试抽查正文和缩略图像素、远距离跳页、搜索、故事板快速换组，以及十种界面语言、双主题和四档字号。批注专项检查高亮、下划线、自由批注的删除、撤销、再次删除和重做后，原生外观所在区域与邻近纸张像素一致。示例与输出位于 `tests/output/release-2.2.2-large-pdf/`。按交付要求仅启动源码构建。

## 最终源码结果

| 合成 PDF | 页数 | 首屏前读取量 | 首屏时间 | 当前轮末尾的渲染进程工作集 |
| ---: | ---: | ---: | ---: | ---: |
| 272 MiB | 36 | 18.1 MiB | 280 ms | 471 MiB |
| 496 MiB | 66 | 20.0 MiB | 232 ms | 444 MiB |
| 1,096 MiB | 145 | 25.0 MiB | 311 ms | 688 MiB |
| 2,120 MiB | 280 | 33.5 MiB | 310 ms | 947 MiB |

数据来自同一个 Windows 源码应用进程顺序打开四份刚生成的样本。读取量按主进程提供的字节数累计。计时包含文件打开和首屏绘制，样本生成后可能处于系统磁盘缓存中。工作集包含应用与之前操作，取样时刻为对应样本的搜索、跳页和故事板检查完成后。

28 次远距离页跳转和 327 张故事板缩略图通过像素检查。故事板完成 80 组语言、主题和字号组合。破损索引得到提示，切回超过 2 GiB 的 PDF 后恢复到上次定位页。字节范围专项验证了超过 2 GiB 的文件偏移、权限隔离、读取边界和文件截断。高亮、下划线和自由批注各完成三次删除并检查撤销和重做后的像素。

参考资料见 [PDF.js 分段读取 API](https://mozilla.github.io/pdf.js/api/draft/api.js.html)、[PDF.js 关于大文件和画布内存的说明](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions/81a843c3b413bc61d02519b145a5c78f4f43f0cd) 和 [Electron IPC 序列化](https://www.electronjs.org/docs/latest/api/ipc-renderer)。
