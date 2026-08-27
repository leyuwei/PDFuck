export type InterfaceLanguage = 'zh' | 'en' | 'ja' | 'ru' | 'es'
export const INTERFACE_LANGUAGES: readonly InterfaceLanguage[] = ['zh', 'en', 'ja', 'ru', 'es']

/** English lives here with every other locale; call sites contain message keys only. */
export const englishPhrases: Record<string, string> = {
  " · 未保存": " · Unsaved",
  "。新版安装包已经发布，可前往 GitHub Releases 下载。": ". The new installer is available on GitHub Releases.",
  "（加密，只读）": " (Encrypted, read-only)",
  "{count} 个文件": "{count} files",
  "← 拖动调节 →": "← Drag to adjust →",
  "白色": "White",
  "饱和度和明度": "Saturation and brightness",
  "保持原文件页序": "Keep the source page order",
  "保存": "Save",
  "保存 PDF": "Save PDF",
  "保存完整文档，或只打印、导出真正需要的页面。": "Save the complete document, or print and export only the pages you need.",
  "保存修改": "Save Changes",
  "保存需要新位置": "A New Save Location Is Required",
  "保留": "Keep",
  "本地保存的密码已失效，请输入当前密码。": "The locally saved password is no longer valid. Enter the current password.",
  "比例未锁定": "Ratio Unlocked",
  "比例已锁定": "Ratio Locked",
  "编辑": "Edit",
  "编辑批注": "Edit Annotation",
  "编辑批注内容…": "Edit Annotation…",
  "编辑文字": "Edit Text",
  "编辑文字：": "Edit text: ",
  "编辑页面文字": "Edit Page Text",
  "不能删除全部页面，请至少取消选择一页。": "You cannot delete every page. Leave at least one page unselected.",
  "不再提示此版本": "Do not remind me about this version",
  "不做了": "Won’t Fix",
  "操作失败": "Action failed",
  "插入位置": "Insertion Point",
  "插入文字": "Insert Text",
  "查看": "View",
  "常用正则表达式": "Common Regular Expressions",
  "撤销": "Undo",
  "撤销 (Ctrl+Z)": "Undo (Ctrl+Z)",
  "橙色": "Orange",
  "创建合并 PDF": "Create Merged PDF",
  "此文档受密码保护，请验证后继续。": "This document is password protected. Verify it to continue.",
  "此文档已确认受密码保护。继续后，PDFuck 会尝试读取本机保存的打开密码；如果你选择保存新密码，也会交给系统安全存储保护。": "This document is confirmed as password protected. Continuing lets PDFuck try the saved local password; any newly saved password is protected by system secure storage.",
  "从文件合并 PDF": "Merge PDF from Files",
  "从文件合并 PDF…": "Merge PDF from Files…",
  "粗体": "Bold",
  "打开": "Open",
  "打开 PDF": "Open PDF",
  "打开 PDF 开始工作": "Open a PDF to Get Started",
  "打开保存工具": "Open Save tools",
  "打开编辑工具": "Open Edit tools",
  "打开查看工具": "Open View tools",
  "打开过的文件可以从这里一键继续阅读": "Resume reading any previous file in one click.",
  "打开批注工具": "Open Annotate tools",
  "打开文件夹": "Open Folder",
  "打开系统打印": "Open System Print",
  "打印": "Print",
  "打印时保留浅灰分隔线": "Keep light-gray separators when printing.",
  "打印预览": "Print Preview",
  "待添加图片": "Image Preview",
  "单面": "Single-sided",
  "单面打印": "Single-sided",
  "单行": "Single Line",
  "单页查看": "Single Page",
  "单页铺放": "One page per sheet",
  "当前 PDF 会从独立窗口回到这里，不会丢失未保存修改。": "The current PDF will return here from its separate window, including unsaved changes.",
  "当前版本 ": "Current version ",
  "当前编辑引擎无法安全写回加密 PDF，阅读和缩放不受影响。": "The editor cannot safely write back to this encrypted PDF. Reading and zoom remain available.",
  "当前文件可能处于临时目录，请注意另存，防止走丢！": "This file may be in a temporary folder. Save it elsewhere to avoid losing it.",
  "当前页": "Current Page",
  "导出": "Export",
  "导入 PNG 或 JPG；在当前页调整位置、大小和旋转后再确认。": "Import PNG or JPG, then position, resize, rotate, and confirm it on this page.",
  "导入文件顺序": "Imported File Order",
  "点击已添加图片重新编辑": "Click an added image to edit it again",
  "点击直接编辑这段文字": "Click to edit this text.",
  "靛蓝": "Indigo",
  "调整导入文件的顺序后，即可创建新的合并 PDF。": "Arrange imported files, then create a new merged PDF.",
  "调整批注列表宽度": "Resize annotation list",
  "对齐": "Alignment",
  "多行": "Multi-line",
  "发现新版本 ": "New version available: ",
  "反选": "Invert",
  "服务商": "Provider",
  "复制": "Copy",
  "复制参考文献": "Copy reference",
  "复制回复": "Copy Response",
  "复制全部参考文献": "Copy all references",
  "高亮说明": "Highlight description",
  "个文件": "files",
  "工具": "tools",
  "共 {count} 页": "{count} pages",
  "关闭": "Close",
  "关闭打印设置": "Close print settings",
  "关闭结果": "Close results",
  "关闭临时目录提示": "Dismiss temporary-folder notice",
  "关闭模型设置": "Close model settings",
  "关闭提示": "Dismiss notice",
  "关闭文档标签": "Close document tab",
  "关闭引文标记": "Hide Citation Links",
  "关闭引文信息": "Close citation details",
  "关联引文": "Link Citations",
  "管理页面…": "Manage Pages…",
  "还没有批注": "No annotations yet",
  "合并多页到一张纸": "Print Multiple Pages per Sheet",
  "合并为一个 PDF": "Combine into One PDF",
  "合并文档.pdf": "Merged Document.pdf",
  "横向": "Landscape",
  "琥珀": "Amber",
  "恢复默认": "Restore Defaults",
  "恢复默认 PDF 纸张背景": "Restore default PDF paper background",
  "恢复默认软件主题色": "Restore default app accent",
  "回复": "Reply",
  "回复统计": "Reply Summary",
  "继续尝试": "Continue",
  "加密": "Encrypted",
  "加密 PDF": "Encrypted PDF",
  "加密 PDF 以只读模式打开": "Encrypted PDF opened read-only",
  "加密文档 · 只读": "Encrypted Document · Read-only",
  "加密文档将以只读模式打开": "The encrypted document will open read-only.",
  "加下划线": "Underline Text",
  "将插入到第 {page} 页之后。": "Files will be inserted after page {page}.",
  "将插入到第 {page} 页之前。": "Files will be inserted before page {page}.",
  "将插入到文档开头。": "Files will be inserted at the beginning of the document.",
  "将插入到文档末尾。": "Files will be inserted at the end of the document.",
  "将创建一个新的合并 PDF。": "A new merged PDF will be created.",
  "将当前所有修改写回此文件。": "Write all current changes back to this file.",
  "将当前页面裁切为框选区域？": "Crop the current page to the selected area?",
  "将在当前标签中打开": "The document will open in this tab.",
  "将在当前窗口新增一个文档标签": "A new document tab will open in this window.",
  "接口地址": "API Endpoint",
  "解锁并打开": "Unlock & Open",
  "界面语言": "Interface Language",
  "仅作用于当前 PDF": "Current PDF only",
  "紧凑": "Compact",
  "居中": "Center",
  "开始润色": "Polish Text",
  "可导入的文件": "Importable Files",
  "可输入 1 到 {count}。": "Enter a number from 1 to {count}.",
  "可选不连续页码；文件名保留原文档页码后缀。": "Non-contiguous pages are supported; filenames keep the original page suffix.",
  "可选择连续或不连续页码，包含尚未保存的修改。": "Choose continuous or non-contiguous pages, including unsaved changes.",
  "可以补充说明并选择醒目的标记颜色。": "Add an optional note and choose a visible marker color.",
  "可直接按字符框选 PDF 文字，按 Ctrl+C 或右键复制": "Select PDF text precisely by character, then press Ctrl+C or right-click to copy.",
  "可直接点选页面，也可输入不连续页码和范围。": "Click pages directly, or enter non-contiguous page numbers and ranges.",
  "控制按钮与强调色": "Buttons and highlights",
  "快速打开": "Quick Open",
  "宽松": "Relaxed",
  "框选裁切页面": "Crop Page",
  "框选文字 · Ctrl+H / ⌘H": "Select text · Ctrl+H / ⌘H",
  "框选文字 · Ctrl+I / ⌘I": "Select text · Ctrl+I / ⌘I",
  "框选文字 · Ctrl+U / ⌘U": "Select text · Ctrl+U / ⌘U",
  "框选文字 · Delete": "Select text · Delete",
  "框选原文 · Ctrl+R / ⌘R": "Select original text · Ctrl+R / ⌘R",
  "蓝色": "Blue",
  "连续滚动": "Continuous",
  "亮蓝": "Bright Blue",
  "列表字号": "List Font Size",
  "列数": "Columns",
  "另存为 PDF…": "Save As PDF…",
  "莓紫": "Berry Purple",
  "每页单独 PDF": "One PDF per Page",
  "每张纸页数": "Pages per Sheet",
  "密码": "Password",
  "密码保护的只读文档": "Password-protected read-only document",
  "密码不正确，请重新输入。": "Incorrect password. Please try again.",
  "明黄": "Bright Yellow",
  "明快": "Bright",
  "模糊匹配": "Fuzzy Match",
  "模型": "Model",
  "模型设置": "Model Settings",
  "墨黑": "Ink Black",
  "墨绿": "Deep Green",
  "某页之后": "After a Page",
  "某页之前": "Before a Page",
  "目标页码": "Target Page",
  "目录：": "Folder: ",
  "内容": "Content",
  "内容（双击编辑）": "Content (double-click to edit)",
  "你的修改仍保留在当前窗口": "Your changes remain in this window",
  "你可能会看到系统安全授权": "You may see a system security prompt",
  "你正在使用 ": "You are using ",
  "暖灰": "Warm Gray",
  "偶数页": "Even Pages",
  "批量删除页面": "Delete Pages",
  "批量删除页面…": "Delete Pages…",
  "批注": "Annotate",
  "批注列表": "Annotation List",
  "批注模式：按字符精准框选文字；右键可复制或添加批注": "Annotation mode: select text precisely by character; right-click to copy or add an annotation.",
  "批注内容": "Annotation content",
  "批注设置": "Annotation Settings",
  "批注颜色：": "Annotation color: ",
  "匹配大小写": "Match Case",
  "拼版": "layout",
  "奇数页": "Odd Pages",
  "前往下载": "Download",
  "浅灰蓝": "Pale Blue Gray",
  "青绿": "Teal",
  "清除": "Clear",
  "清空": "Clear",
  "请确认": "Please Confirm",
  "请输入 1 到 {count} 之间的页码。": "Enter a page number from 1 to {count}.",
  "请输入有效的目标页码。": "Enter a valid target page number.",
  "请先框选 PDF 文字": "Select text in the PDF first",
  "取消": "Cancel",
  "全部": "All",
  "确定": "Confirm",
  "确认并合并": "Confirm & Merge",
  "确认更新图片": "Confirm Image Changes",
  "确认后将按上列顺序一次性写入。": "After confirmation, files will be inserted together in the order above.",
  "确认添加图片": "Confirm Add Image",
  "软件主题色": "App Accent",
  "润色提示词": "Polishing instruction",
  "色相": "Hue",
  "森林绿": "Forest Green",
  "删除": "Delete",
  "删除标记": "Deletion mark",
  "删除批注": "Delete Annotation",
  "删除所选页面": "Delete Selected Pages",
  "删除图片": "Delete Image",
  "删除这条批注": "Delete This Annotation",
  "珊瑚红": "Coral Red",
  "上一张纸": "Previous Sheet",
  "上移文件": "Move File Up",
  "尚未选择页面": "No pages selected",
  "稍后提醒": "Remind me later",
  "设置文字内容和显示格式。添加后可在页面上拖动，双击可再次编辑。": "Set the text and its formatting. Drag it after adding; double-click to edit again.",
  "深蓝": "Deep Blue",
  "石墨": "Graphite",
  "实验室": "Lab",
  "使用本机安全存储": "Use Local Secure Storage",
  "使用系统安全存储加密，下次打开时自动尝试": "Encrypted with system secure storage and tried automatically next time.",
  "适合宽度": "Fit Width",
  "释放以打开 PDF": "Drop to Open PDF",
  "释放以移回文档标签页": "Drop to Move into Document Tabs",
  "收起": "Collapse",
  "收起保存工具": "Collapse Save tools",
  "收起编辑工具": "Collapse Edit tools",
  "收起查看工具": "Collapse View tools",
  "收起回复统计": "Collapse reply summary",
  "收起批注工具": "Collapse Annotate tools",
  "收起批注列表": "Collapse annotation list",
  "收起统计": "Collapse summary",
  "受保护的 PDF": "Protected PDF",
  "输出清晰度": "Output Resolution",
  "输出效果与下方纸张比例一致": "Output matches the paper proportions below.",
  "输入打开密码": "Enter Password",
  "双面": "Double-sided",
  "双面 · 短边翻页": "Double-sided · Short Edge",
  "双面 · 长边翻页": "Double-sided · Long Edge",
  "搜索": "Search",
  "搜索 PDF": "Search PDF",
  "搜索文档": "Search Document",
  "缩放": "Scale",
  "所选": "Selected",
  "所选图片没有可用尺寸。": "The selected image has no usable dimensions.",
  "锁": "Lock",
  "替换为": "Replace with",
  "添加": "Add",
  "添加到批注": "Add to Annotations",
  "添加文字": "Add Text",
  "填写批注内容，并选择适合的标记颜色。": "Enter the annotation content and choose a suitable marker color.",
  "条": "items",
  "条批注": "annotations",
  "跳过并手动输入": "Skip and Enter Manually",
  "图表定位结果": "Figures & Tables",
  "图片文件": "Image Files",
  "推荐色": "Suggested Colors",
  "拖出文本框后设置内容和格式": "Drag out a text box, then set its content and formatting.",
  "拖动、缩放、旋转或切换比例锁后确认": "Move, resize, rotate, or change the aspect lock, then confirm",
  "拖动标签可调整顺序、移回另一个 PDFuck 窗口或拖出标签栏打开新窗口：": "Drag to reorder, move to another PDFuck window, or drag outside the tab bar to open a new window: ",
  "拖动标签可调整顺序；拖到另一个 PDFuck 窗口可移回标签页；拖出标签栏可在新窗口打开": "Drag to reorder; drag to another PDFuck window to move it back into tabs; drag outside the tab bar to open in a new window",
  "拖动调整批注列表宽度": "Drag to resize annotation list",
  "拖动浮窗": "Drag toolbar",
  "拖动卡片或使用上下按钮排序；每个文件内部页面保持原有顺序。": "Drag cards or use the arrow buttons. Pages within each file keep their original order.",
  "拖动控制点调整图片大小": "Drag handle to resize image",
  "拖动框选文字；Ctrl/⌘ 加选，Shift 选择连续批注，Delete 批量删除。": "Drag to select text; Ctrl/⌘ adds selections, Shift selects a range, and Delete removes annotations in bulk.",
  "拖动框选要保留的页面区域": "Drag to select the area to keep.",
  "拖动批注快捷浮窗": "Drag annotation toolbar",
  "拖动色彩面板选择任意颜色，或输入精确 HEX 值": "Drag in the color field to choose any color, or enter an exact HEX value.",
  "拖动图片调整位置": "Drag image to reposition",
  "拖动旋转控制点调整图片角度": "Drag rotation handle to rotate image",
  "完成": "Done",
  "未保存": "Unsaved",
  "未保存到磁盘": "Not saved to disk",
  "未打开": "Not Open",
  "未打开文档": "No Document Open",
  "未发现可定位项目": "No matching items found",
  "未回复": "Unreplied",
  "未锁定原始比例": "Original aspect ratio unlocked",
  "未选择": "Not Selected",
  "位置批注": "Position Annotations",
  "文本高亮": "Highlight Text",
  "文本批注": "Text Annotations",
  "文本删除": "Delete Text",
  "文本替换": "Replace Text",
  "文档标签": "Document Tabs",
  "文档开头": "Beginning of Document",
  "文档末尾": "End of Document",
  "文件格式": "File Format",
  "无法读取所选图片。请确认文件未损坏。": "Unable to read the selected image. Check that the file is not corrupted.",
  "无法直接保存此文件": "This File Cannot Be Saved Here",
  "无需先打开 PDF；选择插入位置并调整导入文件顺序。": "No PDF needs to be open. Choose an insertion point and arrange imported files.",
  "下划线说明": "Underline description",
  "下一张纸": "Next Sheet",
  "下移文件": "Move File Down",
  "先选择插入位置，再调整导入文件的顺序。": "Choose the insertion point first, then arrange imported files.",
  "显示": "Show",
  "显示当前页文本块，点击任意一处直接编辑": "Show text blocks on this page and click one to edit.",
  "显示页面边框": "Show Page Borders",
  "想一想": "Review Later",
  "斜体": "Italic",
  "新标签": "New Tab",
  "行距": "Line Spacing",
  "行数": "Rows",
  "选择 PDF 文件": "Choose PDF File",
  "选择适合当前阅读场景的页面布局。": "Choose a page layout for your reading flow.",
  "选择位置另存…": "Choose Another Location…",
  "选择文字 · Ctrl+N / ⌘N": "Select text · Ctrl+N / ⌘N",
  "选择文字 · Insert": "Select text · Insert",
  "选择新位置保存，原文件保持不变。": "Choose a new location and keep the original file unchanged.",
  "选择要打印的页面": "Select Pages to Print",
  "选择要导出的页面": "Select Pages to Export",
  "选择要删除的页码。删除后至少需要保留一页。": "Choose pages to delete. At least one page must remain.",
  "选择要添加的图片": "Choose an Image to Add",
  "选择页面并打印…": "Select Pages & Print…",
  "选择页面并导出…": "Select Pages & Export…",
  "颜色": "Color",
  "颜色浓度与明暗": "Saturation & Brightness",
  "颜色与回复": "Color & Reply",
  "也可以把 PDF 文件直接拖到窗口中": "You can also drag a PDF file into this window.",
  "页": "Page",
  "页码范围": "Page Range",
  "页面": "Page",
  "页面布局": "Page Layout",
  "页面方向": "Orientation",
  "夜间": "Dark",
  "一键图表": "Find Figures & Tables",
  "已保存": "Saved",
  "已处理": "Resolved",
  "已创建合并文档，已导入 {count} 个文件": "Created a merged document and imported {count} file(s)",
  "已复制参考文献": "Reference copied",
  "已合并 {count} 个文件": "Merged {count} file(s)",
  "已合并 {count} 个文件；请确认页面顺序": "Merged {count} file(s); confirm the page order.",
  "已锁定原始比例": "Original aspect ratio locked",
  "已新建合并文档并导入 {count} 个文件；请确认页面顺序": "Created a new merged document and imported {count} file(s); confirm the page order.",
  "已选择": "Selected",
  "已选择：": "Selected: ",
  "已移回文档标签页": "Document moved back into document tabs",
  "已在独立窗口中打开文档": "Document opened in a separate window",
  "引文关联结果": "Citation Links",
  "隐藏": "Hide",
  "印刷方式": "Print Mode",
  "有未保存修改": "Has unsaved changes",
  "右对齐": "Right",
  "语法检查": "Grammar Check",
  "语法检查结果": "Grammar Results",
  "预览、调整顺序并批量删除页面。": "Preview, reorder, and remove pages in a batch.",
  "阅读、编辑、批注与导出，都在一个干净的窗口里完成。": "Read, edit, annotate, and export in one focused workspace.",
  "阅读工具": "Reading Tools",
  "阅读提示": "Reading Tip",
  "在 Finder 或文件管理器中显示当前 PDF 所在文件夹": "Show the current PDF in Finder or File Explorer",
  "在此设备上保存密码": "Save password on this device",
  "在此页之后插入": "Insert after this page",
  "在此页之前插入": "Insert before this page",
  "在当前窗口打开另一份 PDF": "Open another PDF in this window",
  "在页面上框选文字开始批注": "Select text on the page to start annotating.",
  "在页面上添加图片…": "Add Image to Page…",
  "在页面上添加文字": "Add Text to Page",
  "暂不保存": "Don’t Save Yet",
  "暂无记录": "No recent files",
  "展开": "Expand",
  "展开回复统计": "Expand reply summary",
  "展开批注列表": "Expand annotation list",
  "展开统计": "Expand summary",
  "这是 macOS 钥匙串或 Windows 系统凭据保护的正常提示，仅用于保护这个 PDF 的密码。普通未加密 PDF 不会触发此流程。": "This is a normal macOS Keychain or Windows credential prompt used only to protect this PDF password. Ordinary unencrypted PDFs do not trigger this flow.",
  "正文": "Body",
  "正在编辑已添加图片": "Editing Added Image",
  "正在打开打印对话框…": "Opening print dialog…",
  "正在获取回复…": "Getting response…",
  "正在生成预览": "Generating preview",
  "正在添加…": "Adding…",
  "正则表达式": "Regular Expression",
  "支持逗号、空格和短横线；页码可不连续": "Commas, spaces, and hyphens are supported; pages need not be consecutive.",
  "直接调整页面或添加带格式的文字和图片内容。": "Adjust pages directly or add formatted text and images.",
  "直接调整页面或添加带格式的文字内容。": "Adjust pages directly or add formatted text.",
  "纸张尺寸": "Paper Size",
  "纸张设置": "Paper Settings",
  "纸张预览": "Paper Preview",
  "指定页面导出": "Export Selected Pages",
  "智能润色": "AI Polish",
  "智能润色 (Ctrl/⌘I)": "AI Polish (Ctrl/⌘I)",
  "智能润色模型设置": "AI Polish Model Settings",
  "重做": "Redo",
  "重做 (Ctrl+Y / Ctrl+Shift+Z)": "Redo (Ctrl+Y / Ctrl+Shift+Z)",
  "主题": "Theme",
  "状态": "Status",
  "状态：": "Status: ",
  "准备就绪": "Ready",
  "紫色": "Purple",
  "字号": "Font Size",
  "字体": "Font",
  "自定义 OpenAI 兼容": "Custom OpenAI-compatible",
  "自定义回复": "Custom reply",
  "自定义回复…": "Custom reply…",
  "自定义批注颜色": "Custom annotation color",
  "自定义颜色": "Custom color",
  "自由批注": "Note",
  "纵向": "Portrait",
  "最近打开": "Recent Files",
  "最近打开的 PDF 会显示在这里": "Recently opened PDFs appear here",
  "最新版本 ": "Latest version ",
  "左对齐": "Left",
  "API 密钥": "API Key",
  "API Key": "API Key",
  "Claude / 中转": "Claude / Relay",
  "Ctrl/⌘ + 滚轮缩放；Alt/Option + 左右方向键快速翻页。": "Use Ctrl/⌘ + wheel to zoom; Alt/Option + arrow keys to change pages.",
  "OpenAI / 中转": "OpenAI / Relay",
  "PDF 输出方式": "PDF Output",
  "PDF 文档标签管理": "PDF document tabs",
  "PDF 文件": "PDF Files",
  "PDF 纸张背景": "PDF Paper Background",
  "PDF 纸张背景仅保存在当前文档的本机偏好中。": "The paper background is stored locally for this PDF only.",
  "PDFuck 更新检测": "PDFuck Update Check",
  "PDFuck 将按右侧预览直接生成拼版": "PDFuck will generate the layout shown in the preview."
}

export type AdditionalInterfaceLanguage = 'ja' | 'ru' | 'es'

/**
 * Renderer-visible terms that appear outside the small parameterized catalogue.
 * The Chinese source string is a stable key; it is never applied to PDF text or
 * user content.  Unlisted presentation copy safely falls back to its existing
 * English translation, so a non-Chinese interface never leaks Chinese labels.
 */
export const localePhrases: Record<AdditionalInterfaceLanguage, Record<string, string>> = {
  ja: {
    '界面语言': '表示言語', '显示语言': '表示言語', '选择 PDFuck 的显示语言。': 'PDFuck の表示言語を選択します。', '查看': '表示', '编辑': '編集', '批注': '注釈', '保存': '保存', '打开 PDF': 'PDF を開く', '打开文件夹': 'フォルダーを開く', '适合宽度': '幅に合わせる', '撤销': '元に戻す', '重做': 'やり直す', '未保存': '未保存', '已保存': '保存済み', '未打开': '未開封', '加密': '暗号化', '页面': 'ページ', '内容': '内容', '页面布局': 'ページレイアウト', '连续滚动': '連続スクロール', '单页查看': '単一ページ', '主题': 'テーマ', '当前配色': 'ライト', '夜间': 'ダーク', '软件主题色': 'アプリアクセント', 'PDF 纸张背景': 'PDF 用紙の背景', '恢复默认': '既定値に戻す', '阅读工具': '閲覧ツール', '搜索 PDF': 'PDF を検索', '一键图表': '図表を検索', '关联引文': '引用をリンク', '关闭引文标记': '引用リンクを隠す', '语法检查': '文法チェック', '阅读提示': '閲覧のヒント', '编辑页面文字': 'ページ文字を編集', '在页面上添加文字': 'ページに文字を追加', '框选裁切页面': 'ページをトリミング', '批量删除页面…': 'ページを削除…', '文本批注': 'テキスト注釈', '位置批注': '位置注釈', '文本高亮': 'テキストを強調表示', '文本替换': 'テキストを置換', '文本删除': 'テキストを削除', '加下划线': '下線', '自由批注': 'メモ', '插入文字': '文字を挿入', '保存 PDF': 'PDF を保存', '另存为 PDF…': 'PDF に名前を付けて保存…', '打印': '印刷', '选择页面并打印…': 'ページを選択して印刷…', '指定页面导出': '選択ページをエクスポート', '文件格式': 'ファイル形式', 'PDF 输出方式': 'PDF 出力', '合并为一个 PDF': '1 つの PDF に結合', '每页单独 PDF': 'ページごとに PDF', '输出清晰度': '出力解像度', '选择页面并导出…': 'ページを選択してエクスポート…', '批注列表': '注釈リスト', '列表字号': 'リストの文字サイズ', '单行': '1 行', '多行': '複数行', '回复统计': '返信の集計', '未回复': '未返信', '已处理': '対応済み', '想一想': '要確認', '不做了': '対応しない', '状态': '状態', '颜色': '色', '回复': '返信', '清除': 'クリア', '自定义回复…': 'カスタム返信…', '实验室': 'ラボ', '智能润色': 'AI 推敲', '模型设置': 'モデル設定', '服务商': 'プロバイダー', '接口地址': 'API エンドポイント', '模型': 'モデル', '开始润色': '推敲を開始', '正在获取回复…': '応答を取得中…', '复制回复': '応答をコピー', '添加到批注': '注釈に追加', '请先框选 PDF 文字': '先に PDF の文字を選択してください', '润色提示词': '推敲指示', '关闭': '閉じる', '取消': 'キャンセル', '确定': '確認', '添加': '追加', '删除': '削除', '保留': '保持', '字体': 'フォント', '字号': '文字サイズ', '对齐': '配置', '左对齐': '左揃え', '居中': '中央揃え', '右对齐': '右揃え', '行距': '行間', '紧凑': '狭い', '正文': '標準', '宽松': '広い', '粗体': '太字', '斜体': '斜体', '编辑批注': '注釈を編集', '添加文字': '文字を追加', '编辑文字': '文字を編集', '受保护的 PDF': '保護された PDF', '输入打开密码': '開くためのパスワードを入力', '密码': 'パスワード', '隐藏': '隠す', '显示': '表示', '解锁并打开': 'ロック解除して開く', '批量删除页面': 'ページを一括削除', '当前页': '現在のページ', '奇数页': '奇数ページ', '偶数页': '偶数ページ', '删除所选页面': '選択ページを削除', '选择要打印的页面': '印刷するページを選択', '选择要导出的页面': 'エクスポートするページを選択', '页码范围': 'ページ範囲', '全部': 'すべて', '反选': '選択を反転', '已选择': '選択済み', '未选择': '未選択', '打印预览': '印刷プレビュー', '纸张设置': '用紙設定', '纸张尺寸': '用紙サイズ', '页面方向': '方向', '纵向': '縦', '横向': '横', '印刷方式': '印刷方法', '单面打印': '片面印刷', '双面 · 长边翻页': '両面・長辺とじ', '双面 · 短边翻页': '両面・短辺とじ', '合并多页到一张纸': '1 枚に複数ページ', '每张纸页数': '1 枚あたりのページ数', '缩放': '倍率', '行数': '行数', '列数': '列数', '显示页面边框': 'ページ枠を表示', '纸张预览': '用紙プレビュー', '上一张纸': '前の用紙', '下一张纸': '次の用紙', '打开系统打印': 'システム印刷を開く', '搜索文档': '文書を検索', '匹配大小写': '大文字と小文字を区別', '模糊匹配': 'あいまい一致', '正则表达式': '正規表現', '常用正则表达式': 'よく使う正規表現', '搜索': '検索', '复制': 'コピー', '图表定位结果': '図表の検索結果', '引文关联结果': '引用リンクの結果', '语法检查结果': '文法チェックの結果', '关闭结果': '結果を閉じる', '拖动浮窗': 'ツールバーをドラッグ', '关闭引文信息': '引用情報を閉じる', '复制参考文献': '参考文献をコピー', '复制全部参考文献': 'すべての参考文献をコピー', '已复制参考文献': '参考文献をコピーしました', '高亮说明': 'ハイライトの説明', '批注内容': '注釈内容', '替换为': '置換後の文字', '删除标记': '削除マーク', '下划线说明': '下線の説明', '自定义批注颜色': 'カスタム注釈色', '明黄': '明るい黄色', '深蓝': '濃い青', '亮蓝': '明るい青', '珊瑚红': 'コーラルレッド', '墨绿': '深緑', '紫色': '紫', '橙色': 'オレンジ', '墨黑': '黒', '完成': '完了', '推荐色': 'おすすめの色', '色相': '色相', '打开 PDF 开始工作': 'PDF を開いて開始', '选择 PDF 文件': 'PDF ファイルを選択', '最近打开': '最近開いたファイル', '暂无记录': '履歴はありません', '文档标签': '文書タブ', '新标签': '新しいタブ', '未打开文档': '文書が開かれていません', '准备就绪': '準備完了'
  },
  ru: {
    '界面语言': 'Язык интерфейса', '显示语言': 'Язык отображения', '选择 PDFuck 的显示语言。': 'Выберите язык интерфейса PDFuck.', '查看': 'Просмотр', '编辑': 'Редактирование', '批注': 'Аннотации', '保存': 'Сохранить', '打开 PDF': 'Открыть PDF', '打开文件夹': 'Открыть папку', '适合宽度': 'По ширине', '撤销': 'Отменить', '重做': 'Повторить', '未保存': 'Не сохранено', '已保存': 'Сохранено', '未打开': 'Не открыто', '加密': 'Зашифровано', '页面': 'Страница', '内容': 'Содержимое', '页面布局': 'Макет страниц', '连续滚动': 'Непрерывная прокрутка', '单页查看': 'Одна страница', '主题': 'Тема', '当前配色': 'Светлая', '夜间': 'Тёмная', '软件主题色': 'Акцент приложения', 'PDF 纸张背景': 'Фон листа PDF', '恢复默认': 'Восстановить по умолчанию', '阅读工具': 'Инструменты чтения', '搜索 PDF': 'Поиск в PDF', '一键图表': 'Найти рисунки и таблицы', '关联引文': 'Связать цитаты', '关闭引文标记': 'Скрыть ссылки на цитаты', '语法检查': 'Проверка грамматики', '阅读提示': 'Подсказка по чтению', '编辑页面文字': 'Редактировать текст страницы', '在页面上添加文字': 'Добавить текст на страницу', '框选裁切页面': 'Обрезать страницу', '批量删除页面…': 'Удалить страницы…', '文本批注': 'Текстовые аннотации', '位置批注': 'Позиционные аннотации', '文本高亮': 'Выделить текст', '文本替换': 'Заменить текст', '文本删除': 'Удалить текст', '加下划线': 'Подчеркнуть текст', '自由批注': 'Заметка', '插入文字': 'Вставить текст', '保存 PDF': 'Сохранить PDF', '另存为 PDF…': 'Сохранить PDF как…', '打印': 'Печать', '指定页面导出': 'Экспорт выбранных страниц', '文件格式': 'Формат файла', 'PDF 输出方式': 'Вывод PDF', '合并为一个 PDF': 'Объединить в один PDF', '每页单独 PDF': 'PDF для каждой страницы', '输出清晰度': 'Разрешение вывода', '选择页面并导出…': 'Выбрать страницы и экспортировать…', '批注列表': 'Список аннотаций', '列表字号': 'Размер текста списка', '单行': 'Одна строка', '多行': 'Несколько строк', '回复统计': 'Сводка ответов', '未回复': 'Без ответа', '已处理': 'Обработано', '想一想': 'Проверить позже', '不做了': 'Не исправлять', '状态': 'Статус', '颜色': 'Цвет', '回复': 'Ответ', '清除': 'Очистить', '自定义回复…': 'Свой ответ…', '实验室': 'Лаборатория', '智能润色': 'ИИ-редактирование', '模型设置': 'Настройки модели', '服务商': 'Поставщик', '接口地址': 'Конечная точка API', '模型': 'Модель', '开始润色': 'Редактировать', '正在获取回复…': 'Получение ответа…', '复制回复': 'Копировать ответ', '添加到批注': 'Добавить в аннотации', '请先框选 PDF 文字': 'Сначала выделите текст в PDF', '润色提示词': 'Инструкция по редактированию', '关闭': 'Закрыть', '取消': 'Отмена', '确定': 'Подтвердить', '添加': 'Добавить', '删除': 'Удалить', '保留': 'Оставить', '字体': 'Шрифт', '字号': 'Размер шрифта', '对齐': 'Выравнивание', '左对齐': 'По левому краю', '居中': 'По центру', '右对齐': 'По правому краю', '行距': 'Межстрочный интервал', '紧凑': 'Компактный', '正文': 'Обычный', '宽松': 'Свободный', '粗体': 'Полужирный', '斜体': 'Курсив', '编辑批注': 'Редактировать аннотацию', '添加文字': 'Добавить текст', '编辑文字': 'Редактировать текст', '受保护的 PDF': 'Защищённый PDF', '输入打开密码': 'Введите пароль для открытия', '密码': 'Пароль', '隐藏': 'Скрыть', '显示': 'Показать', '解锁并打开': 'Разблокировать и открыть', '批量删除页面': 'Массовое удаление страниц', '当前页': 'Текущая страница', '奇数页': 'Нечётные страницы', '偶数页': 'Чётные страницы', '删除所选页面': 'Удалить выбранные страницы', '选择要打印的页面': 'Выберите страницы для печати', '选择要导出的页面': 'Выберите страницы для экспорта', '页码范围': 'Диапазон страниц', '全部': 'Все', '反选': 'Инвертировать', '已选择': 'Выбрано', '未选择': 'Не выбрано', '打印预览': 'Предпросмотр печати', '纸张设置': 'Настройки бумаги', '纸张尺寸': 'Размер бумаги', '页面方向': 'Ориентация', '纵向': 'Книжная', '横向': 'Альбомная', '印刷方式': 'Режим печати', '单面打印': 'Односторонняя', '双面 · 长边翻页': 'Двусторонняя · по длинному краю', '双面 · 短边翻页': 'Двусторонняя · по короткому краю', '合并多页到一张纸': 'Несколько страниц на листе', '每张纸页数': 'Страниц на листе', '缩放': 'Масштаб', '行数': 'Строки', '列数': 'Столбцы', '显示页面边框': 'Показывать границы страниц', '纸张预览': 'Предпросмотр листа', '上一张纸': 'Предыдущий лист', '下一张纸': 'Следующий лист', '打开系统打印': 'Открыть системную печать', '搜索文档': 'Поиск в документе', '匹配大小写': 'Учитывать регистр', '模糊匹配': 'Неточное совпадение', '正则表达式': 'Регулярное выражение', '常用正则表达式': 'Частые регулярные выражения', '搜索': 'Поиск', '复制': 'Копировать', '图表定位结果': 'Результаты поиска рисунков и таблиц', '引文关联结果': 'Результаты ссылок на цитаты', '语法检查结果': 'Результаты проверки грамматики', '关闭结果': 'Закрыть результаты', '拖动浮窗': 'Перетащить панель', '关闭引文信息': 'Закрыть сведения о цитате', '复制参考文献': 'Копировать источник', '复制全部参考文献': 'Копировать все источники', '已复制参考文献': 'Источник скопирован', '高亮说明': 'Описание выделения', '批注内容': 'Содержание аннотации', '替换为': 'Заменить на', '删除标记': 'Пометка удаления', '下划线说明': 'Описание подчёркивания', '自定义批注颜色': 'Свой цвет аннотации', '明黄': 'Ярко-жёлтый', '深蓝': 'Тёмно-синий', '亮蓝': 'Ярко-синий', '珊瑚红': 'Коралловый', '墨绿': 'Тёмно-зелёный', '紫色': 'Фиолетовый', '橙色': 'Оранжевый', '墨黑': 'Чёрный', '完成': 'Готово', '推荐色': 'Рекомендуемые цвета', '色相': 'Оттенок', '打开 PDF 开始工作': 'Откройте PDF, чтобы начать', '选择 PDF 文件': 'Выбрать файл PDF', '最近打开': 'Недавние файлы', '暂无记录': 'Нет недавних файлов', '文档标签': 'Вкладки документов', '新标签': 'Новая вкладка', '未打开文档': 'Документ не открыт', '准备就绪': 'Готово'
  },
  es: {
    '界面语言': 'Idioma de la interfaz', '显示语言': 'Idioma de visualización', '选择 PDFuck 的显示语言。': 'Elige el idioma de visualización de PDFuck.', '查看': 'Ver', '编辑': 'Editar', '批注': 'Anotar', '保存': 'Guardar', '打开 PDF': 'Abrir PDF', '打开文件夹': 'Abrir carpeta', '适合宽度': 'Ajustar al ancho', '撤销': 'Deshacer', '重做': 'Rehacer', '未保存': 'Sin guardar', '已保存': 'Guardado', '未打开': 'Sin abrir', '加密': 'Cifrado', '页面': 'Página', '内容': 'Contenido', '页面布局': 'Diseño de página', '连续滚动': 'Desplazamiento continuo', '单页查看': 'Página única', '主题': 'Tema', '当前配色': 'Claro', '夜间': 'Oscuro', '软件主题色': 'Acento de la aplicación', 'PDF 纸张背景': 'Fondo del papel PDF', '恢复默认': 'Restaurar valores predeterminados', '阅读工具': 'Herramientas de lectura', '搜索 PDF': 'Buscar en PDF', '一键图表': 'Buscar figuras y tablas', '关联引文': 'Vincular citas', '关闭引文标记': 'Ocultar vínculos de citas', '语法检查': 'Revisión gramatical', '阅读提示': 'Consejo de lectura', '编辑页面文字': 'Editar texto de página', '在页面上添加文字': 'Añadir texto a la página', '框选裁切页面': 'Recortar página', '批量删除页面…': 'Eliminar páginas…', '文本批注': 'Anotaciones de texto', '位置批注': 'Anotaciones de posición', '文本高亮': 'Resaltar texto', '文本替换': 'Reemplazar texto', '文本删除': 'Eliminar texto', '加下划线': 'Subrayar texto', '自由批注': 'Nota', '插入文字': 'Insertar texto', '保存 PDF': 'Guardar PDF', '另存为 PDF…': 'Guardar PDF como…', '打印': 'Imprimir', '指定页面导出': 'Exportar páginas seleccionadas', '文件格式': 'Formato de archivo', 'PDF 输出方式': 'Salida PDF', '合并为一个 PDF': 'Combinar en un PDF', '每页单独 PDF': 'Un PDF por página', '输出清晰度': 'Resolución de salida', '选择页面并导出…': 'Seleccionar páginas y exportar…', '批注列表': 'Lista de anotaciones', '列表字号': 'Tamaño de texto de la lista', '单行': 'Una línea', '多行': 'Varias líneas', '回复统计': 'Resumen de respuestas', '未回复': 'Sin respuesta', '已处理': 'Resuelto', '想一想': 'Revisar después', '不做了': 'No corregir', '状态': 'Estado', '颜色': 'Color', '回复': 'Respuesta', '清除': 'Limpiar', '自定义回复…': 'Respuesta personalizada…', '实验室': 'Laboratorio', '智能润色': 'Edición con IA', '模型设置': 'Configuración del modelo', '服务商': 'Proveedor', '接口地址': 'Punto de conexión API', '模型': 'Modelo', '开始润色': 'Editar texto', '正在获取回复…': 'Obteniendo respuesta…', '复制回复': 'Copiar respuesta', '添加到批注': 'Añadir a anotaciones', '请先框选 PDF 文字': 'Primero seleccione texto en el PDF', '润色提示词': 'Instrucción de edición', '关闭': 'Cerrar', '取消': 'Cancelar', '确定': 'Confirmar', '添加': 'Añadir', '删除': 'Eliminar', '保留': 'Conservar', '字体': 'Fuente', '字号': 'Tamaño de fuente', '对齐': 'Alineación', '左对齐': 'Alinear a la izquierda', '居中': 'Centrar', '右对齐': 'Alinear a la derecha', '行距': 'Interlineado', '紧凑': 'Compacto', '正文': 'Normal', '宽松': 'Amplio', '粗体': 'Negrita', '斜体': 'Cursiva', '编辑批注': 'Editar anotación', '添加文字': 'Añadir texto', '编辑文字': 'Editar texto', '受保护的 PDF': 'PDF protegido', '输入打开密码': 'Introduzca la contraseña de apertura', '密码': 'Contraseña', '隐藏': 'Ocultar', '显示': 'Mostrar', '解锁并打开': 'Desbloquear y abrir', '批量删除页面': 'Eliminar páginas en lote', '当前页': 'Página actual', '奇数页': 'Páginas impares', '偶数页': 'Páginas pares', '删除所选页面': 'Eliminar páginas seleccionadas', '选择要打印的页面': 'Seleccione páginas para imprimir', '选择要导出的页面': 'Seleccione páginas para exportar', '页码范围': 'Intervalo de páginas', '全部': 'Todo', '反选': 'Invertir selección', '已选择': 'Seleccionado', '未选择': 'No seleccionado', '打印预览': 'Vista previa de impresión', '纸张设置': 'Configuración del papel', '纸张尺寸': 'Tamaño de papel', '页面方向': 'Orientación', '纵向': 'Vertical', '横向': 'Horizontal', '印刷方式': 'Modo de impresión', '单面打印': 'Una cara', '双面 · 长边翻页': 'Doble cara · borde largo', '双面 · 短边翻页': 'Doble cara · borde corto', '合并多页到一张纸': 'Varias páginas por hoja', '每张纸页数': 'Páginas por hoja', '缩放': 'Escala', '行数': 'Filas', '列数': 'Columnas', '显示页面边框': 'Mostrar bordes de página', '纸张预览': 'Vista previa de hoja', '上一张纸': 'Hoja anterior', '下一张纸': 'Hoja siguiente', '打开系统打印': 'Abrir impresión del sistema', '搜索文档': 'Buscar documento', '匹配大小写': 'Distinguir mayúsculas', '模糊匹配': 'Coincidencia aproximada', '正则表达式': 'Expresión regular', '常用正则表达式': 'Expresiones regulares habituales', '搜索': 'Buscar', '复制': 'Copiar', '图表定位结果': 'Resultados de figuras y tablas', '引文关联结果': 'Resultados de vínculos de citas', '语法检查结果': 'Resultados de revisión gramatical', '关闭结果': 'Cerrar resultados', '拖动浮窗': 'Arrastrar barra de herramientas', '关闭引文信息': 'Cerrar información de cita', '复制参考文献': 'Copiar referencia', '复制全部参考文献': 'Copiar todas las referencias', '已复制参考文献': 'Referencia copiada', '高亮说明': 'Descripción del resaltado', '批注内容': 'Contenido de la anotación', '替换为': 'Reemplazar por', '删除标记': 'Marca de eliminación', '下划线说明': 'Descripción del subrayado', '自定义批注颜色': 'Color de anotación personalizado', '明黄': 'Amarillo brillante', '深蓝': 'Azul oscuro', '亮蓝': 'Azul brillante', '珊瑚红': 'Rojo coral', '墨绿': 'Verde oscuro', '紫色': 'Morado', '橙色': 'Naranja', '墨黑': 'Negro tinta', '完成': 'Listo', '推荐色': 'Colores sugeridos', '色相': 'Tono', '打开 PDF 开始工作': 'Abra un PDF para comenzar', '选择 PDF 文件': 'Elegir archivo PDF', '最近打开': 'Archivos recientes', '暂无记录': 'No hay archivos recientes', '文档标签': 'Pestañas de documentos', '新标签': 'Nueva pestaña', '未打开文档': 'No hay documento abierto', '准备就绪': 'Listo'
  }
}

Object.assign(localePhrases.ja, { '选择页面并打印…': 'ページを選択して印刷…' })
Object.assign(localePhrases.ru, { '选择页面并打印…': 'Выбрать страницы и напечатать…' })
Object.assign(localePhrases.es, { '选择页面并打印…': 'Seleccionar páginas e imprimir…' })

/**
 * Additional copy that is rendered directly by dialogs, overlays, status
 * messages, and accessibility attributes.  Keeping all four non-Chinese
 * variants together makes omissions mechanically detectable in tests.
 */
export const phraseTranslations: Record<string, Record<'en' | AdditionalInterfaceLanguage, string>> = {
  '收起查看工具': { en: 'Collapse View tools', ja: '表示ツールを折りたたむ', ru: 'Свернуть инструменты просмотра', es: 'Contraer herramientas de vista' },
  '打开查看工具': { en: 'Open View tools', ja: '表示ツールを開く', ru: 'Открыть инструменты просмотра', es: 'Abrir herramientas de vista' },
  '收起编辑工具': { en: 'Collapse Edit tools', ja: '編集ツールを折りたたむ', ru: 'Свернуть инструменты редактирования', es: 'Contraer herramientas de edición' },
  '打开编辑工具': { en: 'Open Edit tools', ja: '編集ツールを開く', ru: 'Открыть инструменты редактирования', es: 'Abrir herramientas de edición' },
  '收起批注工具': { en: 'Collapse Annotate tools', ja: '注釈ツールを折りたたむ', ru: 'Свернуть инструменты аннотаций', es: 'Contraer herramientas de anotación' },
  '打开批注工具': { en: 'Open Annotate tools', ja: '注釈ツールを開く', ru: 'Открыть инструменты аннотаций', es: 'Abrir herramientas de anotación' },
  '收起保存工具': { en: 'Collapse Save tools', ja: '保存ツールを折りたたむ', ru: 'Свернуть инструменты сохранения', es: 'Contraer herramientas de guardado' },
  '打开保存工具': { en: 'Open Save tools', ja: '保存ツールを開く', ru: 'Открыть инструменты сохранения', es: 'Abrir herramientas de guardado' },
  '删除批注': { en: 'Delete Annotation', ja: '注釈を削除', ru: 'Удалить аннотацию', es: 'Eliminar anotación' },
  '设置文字内容和显示格式。添加后可在页面上拖动，双击可再次编辑。': { en: 'Set the text and its display format. Drag it on the page after adding; double-click to edit again.', ja: '文字内容と表示形式を設定します。追加後はページ上でドラッグでき、ダブルクリックで再編集できます。', ru: 'Настройте текст и формат отображения. После добавления его можно перетаскивать по странице и редактировать двойным щелчком.', es: 'Configure el texto y su formato de visualización. Después de añadirlo, arrástrelo por la página y haga doble clic para editarlo de nuevo.' },
  '保存需要新位置': { en: 'A New Save Location Is Required', ja: '新しい保存場所が必要です', ru: 'Требуется новое место сохранения', es: 'Se requiere una nueva ubicación para guardar' },
  '无法直接保存此文件': { en: 'This File Cannot Be Saved Here', ja: 'この場所にはファイルを直接保存できません', ru: 'Этот файл нельзя сохранить здесь', es: 'Este archivo no se puede guardar aquí' },
  '你的修改仍保留在当前窗口': { en: 'Your changes remain in this window', ja: '変更はこのウィンドウに保持されています', ru: 'Ваши изменения остаются в этом окне', es: 'Sus cambios permanecen en esta ventana' },
  '暂不保存': { en: 'Don’t Save Yet', ja: 'まだ保存しない', ru: 'Пока не сохранять', es: 'No guardar todavía' },
  '选择位置另存…': { en: 'Choose Another Location…', ja: '別の場所を選択して保存…', ru: 'Выбрать другое место…', es: 'Elegir otra ubicación…' },
  '在此设备上保存密码': { en: 'Save password on this device', ja: 'このデバイスにパスワードを保存', ru: 'Сохранить пароль на этом устройстве', es: 'Guardar la contraseña en este dispositivo' },
  '使用系统安全存储加密，下次打开时自动尝试': { en: 'Encrypted with system secure storage and tried automatically next time.', ja: 'システムの安全なストレージで暗号化し、次回は自動で試行します。', ru: 'Защищается системным хранилищем и будет автоматически использован при следующем открытии.', es: 'Se protege con el almacenamiento seguro del sistema y se probará automáticamente la próxima vez.' },
  '加密 PDF': { en: 'Encrypted PDF', ja: '暗号化 PDF', ru: 'Зашифрованный PDF', es: 'PDF cifrado' },
  '使用本机安全存储': { en: 'Use Local Secure Storage', ja: 'ローカルの安全なストレージを使用', ru: 'Использовать локальное защищённое хранилище', es: 'Usar almacenamiento seguro local' },
  '跳过并手动输入': { en: 'Skip and Enter Manually', ja: 'スキップして手動入力', ru: 'Пропустить и ввести вручную', es: 'Omitir e introducir manualmente' },
  '继续尝试': { en: 'Continue', ja: '続行', ru: 'Продолжить', es: 'Continuar' },
  '正在生成预览': { en: 'Generating preview', ja: 'プレビューを生成中', ru: 'Создание предпросмотра', es: 'Generando vista previa' },
  '所选': { en: 'Selected', ja: '選択した', ru: 'Выбранные', es: 'Seleccionadas' },
  '编辑文字：': { en: 'Edit text: ', ja: '文字を編集: ', ru: 'Редактировать текст: ', es: 'Editar texto: ' },
  '条批注': { en: 'annotations', ja: '件の注釈', ru: 'аннотаций', es: 'anotaciones' },
  '锁': { en: 'Lock', ja: 'ロック', ru: 'Замок', es: 'Bloqueo' },
  '加密文档将以只读模式打开': { en: 'The encrypted document will open read-only.', ja: '暗号化文書は読み取り専用で開きます。', ru: 'Зашифрованный документ откроется только для чтения.', es: 'El documento cifrado se abrirá en modo de solo lectura.' },
  '此文档已确认受密码保护。继续后，PDFuck 会尝试读取本机保存的打开密码；如果你选择保存新密码，也会交给系统安全存储保护。': { en: 'This document is password protected. Continuing lets PDFuck try the saved local password; a newly saved password is protected by system secure storage.', ja: 'この文書はパスワードで保護されています。続行すると PDFuck は保存済みのローカルパスワードを試し、新しく保存するパスワードはシステムの安全なストレージで保護されます。', ru: 'Этот документ защищён паролем. После продолжения PDFuck попробует сохранённый локальный пароль, а новый пароль будет защищён системным безопасным хранилищем.', es: 'Este documento está protegido por contraseña. Al continuar, PDFuck probará la contraseña local guardada y cualquier contraseña nueva quedará protegida por el almacenamiento seguro del sistema.' },
  '你可能会看到系统安全授权': { en: 'You may see a system security prompt', ja: 'システムのセキュリティ確認が表示される場合があります', ru: 'Может появиться системный запрос безопасности', es: 'Es posible que vea un aviso de seguridad del sistema' },
  '这是 macOS 钥匙串或 Windows 系统凭据保护的正常提示，仅用于保护这个 PDF 的密码。普通未加密 PDF 不会触发此流程。': { en: 'This is a normal macOS Keychain or Windows credential prompt used only to protect this PDF password. Ordinary unencrypted PDFs do not trigger it.', ja: 'これはこの PDF のパスワード保護にのみ使われる、通常の macOS キーチェーンまたは Windows 資格情報の確認です。通常の暗号化されていない PDF では表示されません。', ru: 'Это обычный запрос macOS Keychain или учётных данных Windows, используемый только для защиты пароля этого PDF. Для обычных незашифрованных PDF он не появляется.', es: 'Este es un aviso normal del llavero de macOS o de credenciales de Windows, usado solo para proteger la contraseña de este PDF. Los PDF normales sin cifrar no lo activan.' },
  '选择要删除的页码。删除后至少需要保留一页。': { en: 'Choose pages to delete. At least one page must remain.', ja: '削除するページを選択してください。少なくとも 1 ページは残す必要があります。', ru: 'Выберите страницы для удаления. Должна остаться хотя бы одна страница.', es: 'Elija las páginas que desea eliminar. Debe conservarse al menos una página.' },
  'PDFuck 将按右侧预览直接生成拼版': { en: 'PDFuck will generate the layout shown in the preview.', ja: 'PDFuck は右側のプレビューどおりに面付けを生成します。', ru: 'PDFuck создаст макет в соответствии с предпросмотром справа.', es: 'PDFuck generará la composición mostrada en la vista previa.' },
  '打印时保留浅灰分隔线': { en: 'Keep light-gray separators when printing.', ja: '印刷時に薄いグレーの区切り線を残す。', ru: 'Сохранять светло-серые разделители при печати.', es: 'Conservar separadores gris claro al imprimir.' },
  '输出效果与下方纸张比例一致': { en: 'Output matches the paper proportions below.', ja: '出力は下の用紙比率と一致します。', ru: 'Результат соответствует пропорциям бумаги ниже.', es: 'La salida coincide con las proporciones de papel indicadas abajo.' },
  '单页铺放': { en: 'One page per sheet', ja: '1 枚に 1 ページ', ru: 'Одна страница на лист', es: 'Una página por hoja' },
  'PDFuck 更新检测': { en: 'PDFuck Update Check', ja: 'PDFuck の更新確認', ru: 'Проверка обновлений PDFuck', es: 'Comprobación de actualizaciones de PDFuck' },
  '发现新版本 ': { en: 'New version available: ', ja: '新しいバージョンがあります: ', ru: 'Доступна новая версия: ', es: 'Nueva versión disponible: ' },
  '你正在使用 ': { en: 'You are using ', ja: '現在使用中: ', ru: 'Вы используете ', es: 'Está usando ' },
  '。新版安装包已经发布，可前往 GitHub Releases 下载。': { en: '. The new installer is available on GitHub Releases.', ja: '。新しいインストーラーは GitHub Releases からダウンロードできます。', ru: '. Новый установщик доступен в GitHub Releases.', es: '. El nuevo instalador está disponible en GitHub Releases.' },
  '当前版本 ': { en: 'Current version ', ja: '現在のバージョン ', ru: 'Текущая версия ', es: 'Versión actual ' },
  '最新版本 ': { en: 'Latest version ', ja: '最新バージョン ', ru: 'Последняя версия ', es: 'Última versión ' },
  '不再提示此版本': { en: 'Do not remind me about this version', ja: 'このバージョンを今後表示しない', ru: 'Больше не напоминать об этой версии', es: 'No volver a avisarme de esta versión' },
  '稍后提醒': { en: 'Remind me later', ja: '後で通知', ru: 'Напомнить позже', es: 'Recordármelo más tarde' },
  '前往下载': { en: 'Download', ja: 'ダウンロードへ', ru: 'Скачать', es: 'Descargar' },
  'API Key': { en: 'API Key', ja: 'API キー', ru: 'Ключ API', es: 'Clave API' },
  'API 密钥': { en: 'API Key', ja: 'API キー', ru: 'Ключ API', es: 'Clave API' },
  '快速打开': { en: 'Quick Open', ja: 'クイックオープン', ru: 'Быстрое открытие', es: 'Apertura rápida' },
  '已打开': { en: 'Opened', ja: '開きました', ru: 'Открыто', es: 'Abierto' },
  '已用密码打开': { en: 'Opened with password', ja: 'パスワードで開きました', ru: 'Открыто с паролем', es: 'Abierto con contraseña' },
  '加密文档只读': { en: 'encrypted document is read-only', ja: '暗号化文書は読み取り専用です', ru: 'зашифрованный документ доступен только для чтения', es: 'el documento cifrado es de solo lectura' },
  '系统安全存储不可用，未保存密码': { en: 'system secure storage unavailable; password was not saved', ja: 'システムの安全なストレージを利用できないため、パスワードは保存されませんでした', ru: 'защищённое хранилище недоступно; пароль не сохранён', es: 'el almacenamiento seguro no está disponible; la contraseña no se guardó' },
  '选择页面并打印…': { en: 'Select Pages & Print…', ja: 'ページを選択して印刷…', ru: 'Выбрать страницы и напечатать…', es: 'Seleccionar páginas e imprimir…' },
  ' · 未保存': { en: ' · Unsaved', ja: ' ・未保存', ru: ' · Не сохранено', es: ' · Sin guardar' },
  ' · 系统安全存储不可用，未保存密码': { en: ' · secure storage unavailable; password not saved', ja: ' ・システムの安全なストレージを利用できないため、パスワードは保存されませんでした', ru: ' · защищённое хранилище недоступно; пароль не сохранён', es: ' · el almacenamiento seguro no está disponible; la contraseña no se guardó' },
  '(?:19|20)\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?': { en: '(?:19|20)\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?', ja: '(?:19|20)\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?', ru: '(?:19|20)\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?', es: '(?:19|20)\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?' },
  'Claude / 中转': { en: 'Claude / Relay', ja: 'Claude / 中継', ru: 'Claude / прокси', es: 'Claude / proxy' },
  'Ctrl/⌘ + 滚轮缩放；Alt/Option + 左右方向键快速翻页。': { en: 'Use Ctrl/⌘ + wheel to zoom; Alt/Option + arrow keys to change pages.', ja: 'Ctrl/⌘＋ホイールで拡大縮小し、Alt/Option＋左右矢印でページを切り替えます。', ru: 'Масштабируйте Ctrl/⌘ + колесом; Alt/Option + стрелки переключают страницы.', es: 'Use Ctrl/⌘ + rueda para ampliar; Alt/Option + flechas cambia de página.' },
  'OpenAI / 中转': { en: 'OpenAI / Relay', ja: 'OpenAI / 中継', ru: 'OpenAI / прокси', es: 'OpenAI / proxy' },
  'PDF 文档标签管理': { en: 'PDF document tabs', ja: 'PDF 文書タブ', ru: 'Вкладки PDF-документов', es: 'Pestañas de documentos PDF' },
  '可直接点选页面，也可输入不连续页码和范围。': { en: 'Click pages directly, or enter non-contiguous page numbers and ranges.', ja: 'ページを直接選択するか、連続しないページ番号や範囲を入力できます。', ru: 'Выбирайте страницы напрямую или вводите несмежные номера и диапазоны.', es: 'Seleccione páginas directamente o introduzca números y rangos no contiguos.' },
  '清空': { en: 'Clear', ja: 'クリア', ru: 'Очистить', es: 'Limpiar' },
  '拖动标签可调整顺序，拖出标签栏可在新窗口打开': { en: 'Drag to reorder; drag outside the tab bar to open in a new window', ja: 'ドラッグで並べ替え、タブバーの外へドラッグすると新しいウィンドウで開きます', ru: 'Перетаскивайте для изменения порядка; вынесите за панель вкладок, чтобы открыть в новом окне', es: 'Arrastre para reordenar; arrastre fuera de la barra de pestañas para abrir en una ventana nueva' },
  '拖动标签可调整顺序，拖出标签栏可在新窗口打开：': { en: 'Drag to reorder or drag outside the tab bar to open in a new window: ', ja: 'ドラッグで並べ替え、タブバーの外へドラッグすると新しいウィンドウで開きます: ', ru: 'Перетаскивайте для изменения порядка или вынесите за панель вкладок, чтобы открыть в новом окне: ', es: 'Arrastre para reordenar o fuera de la barra de pestañas para abrir en una ventana nueva: ' },
  '拖动标签可调整顺序；拖到另一个 PDFuck 窗口可移回标签页；拖出标签栏可在新窗口打开': { en: 'Drag to reorder; drag to another PDFuck window to move it back into tabs; drag outside the tab bar to open in a new window', ja: 'ドラッグで並べ替え、別の PDFuck ウィンドウへドラッグするとタブに戻せます。タブバーの外へドラッグすると新しいウィンドウで開きます', ru: 'Перетаскивайте для изменения порядка; перетащите в другое окно PDFuck, чтобы вернуть во вкладки; вынесите за панель вкладок, чтобы открыть в новом окне', es: 'Arrastre para reordenar; arrastre a otra ventana de PDFuck para devolverlo a las pestañas; arrastre fuera de la barra de pestañas para abrir en una ventana nueva' },
  '拖动标签可调整顺序、移回另一个 PDFuck 窗口或拖出标签栏打开新窗口：': { en: 'Drag to reorder, move to another PDFuck window, or drag outside the tab bar to open a new window: ', ja: 'ドラッグで並べ替え、別の PDFuck ウィンドウへ戻す、またはタブバーの外へドラッグして新しいウィンドウで開く: ', ru: 'Перетаскивайте для изменения порядка, переноса в другое окно PDFuck или вынесите за панель вкладок, чтобы открыть новое окно: ', es: 'Arrastre para reordenar, mover a otra ventana de PDFuck o fuera de la barra de pestañas para abrir una ventana nueva: ' },
  '已在独立窗口中打开文档': { en: 'Document opened in a separate window', ja: '文書を別のウィンドウで開きました', ru: 'Документ открыт в отдельном окне', es: 'Documento abierto en una ventana independiente' },
  '已移回文档标签页': { en: 'Document moved back into document tabs', ja: '文書をタブに戻しました', ru: 'Документ возвращён во вкладки', es: 'El documento volvió a las pestañas' },
  '释放以移回文档标签页': { en: 'Drop to Move into Document Tabs', ja: 'ドロップして文書タブに戻す', ru: 'Отпустите, чтобы вернуть во вкладки документов', es: 'Suelte para mover a las pestañas del documento' },
  '当前 PDF 会从独立窗口回到这里，不会丢失未保存修改。': { en: 'The current PDF will return here from its separate window, including unsaved changes.', ja: '現在の PDF は未保存の変更を保持したまま、別ウィンドウからここへ戻ります。', ru: 'Текущий PDF вернётся сюда из отдельного окна вместе с несохранёнными изменениями.', es: 'El PDF actual volverá aquí desde su ventana independiente, incluidos los cambios sin guardar.' },
  '文档窗口转移请求无效。': { en: 'The document window transfer request is invalid.', ja: '文書ウィンドウの移動リクエストが無効です。', ru: 'Запрос на перенос окна документа недействителен.', es: 'La solicitud para mover la ventana del documento no es válida.' },
  'PDF 纸张背景仅保存在当前文档的本机偏好中。': { en: 'The paper background is stored locally for this PDF only.', ja: '用紙の背景は、この PDF のローカル設定にのみ保存されます。', ru: 'Фон бумаги сохраняется локально только для этого PDF.', es: 'El fondo del papel se guarda localmente solo para este PDF.' },
  '← 拖动调节 →': { en: '← Drag to adjust →', ja: '← ドラッグして調整 →', ru: '← Перетащите для настройки →', es: '← Arrastre para ajustar →' },
  '不能删除全部页面，请至少取消选择一页。': { en: 'You cannot delete every page. Leave at least one page unselected.', ja: 'すべてのページは削除できません。少なくとも 1 ページは選択解除してください。', ru: 'Нельзя удалить все страницы. Оставьте хотя бы одну страницу невыбранной.', es: 'No puede eliminar todas las páginas. Deje al menos una página sin seleccionar.' },
  '个文件': { en: 'files', ja: '件のファイル', ru: 'файлов', es: 'archivos' },
  '中文手机号': { en: 'Chinese mobile number', ja: '中国の携帯電話番号', ru: 'Китайский номер мобильного телефона', es: 'Número de móvil chino' },
  '也可以把 PDF 文件直接拖到窗口中': { en: 'You can also drag a PDF file into this window.', ja: 'PDF ファイルをこのウィンドウにドラッグすることもできます。', ru: 'Можно также перетащить PDF-файл в это окно.', es: 'También puede arrastrar un archivo PDF a esta ventana.' },
  '仅作用于当前 PDF': { en: 'Current PDF only', ja: '現在の PDF のみ', ru: 'Только для текущего PDF', es: 'Solo PDF actual' },
  '例如：1-3, 5, 8-10': { en: 'For example: 1-3, 5, 8-10', ja: '例：1-3、5、8-10', ru: 'Например: 1-3, 5, 8-10', es: 'Por ejemplo: 1-3, 5, 8-10' },
  '便笺已添加': { en: 'Note added', ja: 'メモを追加しました', ru: 'Заметка добавлена', es: 'Nota añadida' },
  '保存修改': { en: 'Save Changes', ja: '変更を保存', ru: 'Сохранить изменения', es: 'Guardar cambios' },
  '保存完整文档，或只打印、导出真正需要的页面。': { en: 'Save the complete document, or print and export only the pages you need.', ja: '文書全体を保存するか、必要なページだけを印刷・エクスポートします。', ru: 'Сохраните весь документ или печатайте и экспортируйте только нужные страницы.', es: 'Guarde todo el documento o imprima y exporte solo las páginas necesarias.' },
  '关闭临时目录提示': { en: 'Dismiss temporary-folder notice', ja: '一時フォルダーの通知を閉じる', ru: 'Закрыть уведомление о временной папке', es: 'Descartar aviso de carpeta temporal' },
  '关闭打印设置': { en: 'Close print settings', ja: '印刷設定を閉じる', ru: 'Закрыть настройки печати', es: 'Cerrar ajustes de impresión' },
  '关闭批注设置': { en: 'Close annotation settings', ja: '注釈設定を閉じる', ru: 'Закрыть настройки аннотации', es: 'Cerrar ajustes de anotación' },
  '关闭提示': { en: 'Dismiss notice', ja: '通知を閉じる', ru: 'Закрыть уведомление', es: 'Descartar aviso' },
  '关闭搜索': { en: 'Close search', ja: '検索を閉じる', ru: 'Закрыть поиск', es: 'Cerrar búsqueda' },
  '关闭文档标签': { en: 'Close document tab', ja: '文書タブを閉じる', ru: 'Закрыть вкладку документа', es: 'Cerrar pestaña de documento' },
  '关闭模型设置': { en: 'Close model settings', ja: 'モデル設定を閉じる', ru: 'Закрыть настройки модели', es: 'Cerrar configuración del modelo' },
  '内容（双击编辑）': { en: 'Content (double-click to edit)', ja: '内容（ダブルクリックで編集）', ru: 'Содержимое (двойной щелчок для редактирования)', es: 'Contenido (doble clic para editar)' },
  '减小字号': { en: 'Decrease font size', ja: '文字サイズを小さく', ru: 'Уменьшить размер текста', es: 'Reducir tamaño de texto' },
  '减小批注列表字号': { en: 'Decrease annotation list font size', ja: '注釈リストの文字サイズを小さく', ru: 'Уменьшить размер текста списка аннотаций', es: 'Reducir tamaño de texto de la lista de anotaciones' },
  '切换为完整多行显示': { en: 'Switch to full multi-line display', ja: '複数行の完全表示に切り替え', ru: 'Переключить на полный многострочный вид', es: 'Cambiar a visualización completa en varias líneas' },
  '切换为紧凑单行显示': { en: 'Switch to compact single-line display', ja: 'コンパクトな 1 行表示に切り替え', ru: 'Переключить на компактный однострочный вид', es: 'Cambiar a visualización compacta de una línea' },
  '删除这条批注': { en: 'Delete This Annotation', ja: 'この注釈を削除', ru: 'Удалить эту аннотацию', es: 'Eliminar esta anotación' },
  '加密 PDF 以只读模式打开': { en: 'Encrypted PDF opened read-only', ja: '暗号化 PDF は読み取り専用で開きます', ru: 'Зашифрованный PDF открыт только для чтения', es: 'El PDF cifrado se abre en modo de solo lectura' },
  '加密 PDF 当前以只读模式打开，仅支持阅读、翻页和缩放': { en: 'This encrypted PDF is open read-only; only reading, page navigation, and zoom are available.', ja: 'この暗号化 PDF は読み取り専用で開かれています。閲覧、ページ移動、拡大縮小のみ可能です。', ru: 'Этот зашифрованный PDF открыт только для чтения; доступны только просмотр, навигация и масштабирование.', es: 'Este PDF cifrado está abierto en solo lectura; solo permite leer, navegar y ampliar.' },
  '加密文档 · 只读': { en: 'Encrypted Document · Read-only', ja: '暗号化文書・読み取り専用', ru: 'Зашифрованный документ · только чтение', es: 'Documento cifrado · solo lectura' },
  '单面': { en: 'Single-sided', ja: '片面', ru: 'Односторонняя', es: 'Una cara' },
  '双面': { en: 'Double-sided', ja: '両面', ru: 'Двусторонняя', es: 'Doble cara' },
  '可以补充说明并选择醒目的标记颜色。': { en: 'Add an optional note and choose a visible marker color.', ja: '補足説明を追加し、目立つマーカー色を選択できます。', ru: 'Добавьте пояснение и выберите заметный цвет маркера.', es: 'Añada una nota opcional y elija un color de marca visible.' },
  '可直接按字符框选 PDF 文字，按 Ctrl+C 或右键复制': { en: 'Select PDF text precisely by character, then press Ctrl+C or right-click to copy.', ja: 'PDF の文字を文字単位で選択し、Ctrl+C または右クリックでコピーできます。', ru: 'Выделяйте текст PDF посимвольно, затем копируйте Ctrl+C или правой кнопкой.', es: 'Seleccione texto del PDF carácter a carácter y copie con Ctrl+C o clic derecho.' },
  '可选不连续页码；文件名保留原文档页码后缀。': { en: 'Non-contiguous pages are supported; filenames keep the original page suffix.', ja: '連続しないページも選択でき、ファイル名には元のページ番号の接尾辞が残ります。', ru: 'Поддерживаются несмежные страницы; имена файлов сохраняют исходный суффикс номера страницы.', es: 'Se admiten páginas no contiguas; los nombres conservan el sufijo de página original.' },
  '可选择连续或不连续页码，包含尚未保存的修改。': { en: 'Choose continuous or non-contiguous pages, including unsaved changes.', ja: '連続・不連続のページを選択でき、未保存の変更も含まれます。', ru: 'Выбирайте смежные или несмежные страницы, включая несохранённые изменения.', es: 'Elija páginas contiguas o no contiguas, incluidos cambios sin guardar.' },
  '右': { en: 'Right', ja: '右', ru: 'Справа', es: 'Derecha' },
  '在 Finder 或文件管理器中显示当前 PDF 所在文件夹': { en: 'Show the current PDF in Finder or File Explorer', ja: 'Finder またはファイルエクスプローラーで現在の PDF のフォルダーを表示', ru: 'Показать папку текущего PDF в Finder или Проводнике', es: 'Mostrar la carpeta del PDF actual en Finder o el Explorador de archivos' },
  '在当前窗口打开另一份 PDF': { en: 'Open another PDF in this window', ja: 'このウィンドウで別の PDF を開く', ru: 'Открыть другой PDF в этом окне', es: 'Abrir otro PDF en esta ventana' },
  '在页面上框选文字开始批注': { en: 'Select text on the page to start annotating.', ja: 'ページ上の文字を選択して注釈を開始します。', ru: 'Выделите текст на странице, чтобы начать добавлять аннотации.', es: 'Seleccione texto en la página para empezar a anotar.' },
  '填写批注内容，并选择适合的标记颜色。': { en: 'Enter the annotation content and choose a suitable marker color.', ja: '注釈内容を入力し、適したマーカー色を選択してください。', ru: 'Введите содержимое аннотации и выберите подходящий цвет маркера.', es: 'Introduzca el contenido de la anotación y elija un color de marca adecuado.' },
  '增大字号': { en: 'Increase font size', ja: '文字サイズを大きく', ru: 'Увеличить размер текста', es: 'Aumentar tamaño de texto' },
  '增大批注列表字号': { en: 'Increase annotation list font size', ja: '注釈リストの文字サイズを大きく', ru: 'Увеличить размер текста списка аннотаций', es: 'Aumentar tamaño de texto de la lista de anotaciones' },
  '字符间距': { en: 'Character spacing', ja: '文字間隔', ru: 'Межбуквенный интервал', es: 'Espaciado entre caracteres' },
  '密码不正确，请重新输入。': { en: 'Incorrect password. Please try again.', ja: 'パスワードが正しくありません。もう一度入力してください。', ru: 'Неверный пароль. Повторите ввод.', es: 'La contraseña es incorrecta. Inténtelo de nuevo.' },
  '密码保护的只读文档': { en: 'Password-protected read-only document', ja: 'パスワード保護された読み取り専用文書', ru: 'Защищённый паролем документ только для чтения', es: 'Documento de solo lectura protegido con contraseña' },
  '将在当前标签中打开': { en: 'The document will open in this tab.', ja: 'このタブで文書を開きます。', ru: 'Документ откроется в этой вкладке.', es: 'El documento se abrirá en esta pestaña.' },
  '将在当前窗口新增一个文档标签': { en: 'A new document tab will open in this window.', ja: 'このウィンドウに新しい文書タブを開きます。', ru: 'В этом окне откроется новая вкладка документа.', es: 'Se abrirá una nueva pestaña de documento en esta ventana.' },
  '将当前页面裁切为框选区域？': { en: 'Crop the current page to the selected area?', ja: '現在のページを選択範囲にトリミングしますか？', ru: 'Обрезать текущую страницу по выбранной области?', es: '¿Recortar la página actual al área seleccionada?' },
  '尚未选择页面': { en: 'No pages selected', ja: 'ページが選択されていません', ru: 'Страницы не выбраны', es: 'No hay páginas seleccionadas' },
  '展开': { en: 'Expand', ja: '展開', ru: 'Развернуть', es: 'Expandir' },
  '展开回复统计': { en: 'Expand reply summary', ja: '返信の集計を展開', ru: 'Развернуть сводку ответов', es: 'Expandir resumen de respuestas' },
  '展开批注列表': { en: 'Expand annotation list', ja: '注釈リストを展開', ru: 'Развернуть список аннотаций', es: 'Expandir lista de anotaciones' },
  '展开统计': { en: 'Expand summary', ja: '集計を展開', ru: 'Развернуть сводку', es: 'Expandir resumen' },
  '工具': { en: 'tools', ja: 'ツール', ru: 'инструменты', es: 'herramientas' },
  '左': { en: 'Left', ja: '左', ru: 'Слева', es: 'Izquierda' },
  '已取消导出': { en: 'Export canceled', ja: 'エクスポートをキャンセルしました', ru: 'Экспорт отменён', es: 'Exportación cancelada' },
  '已取消打印': { en: 'Printing canceled', ja: '印刷をキャンセルしました', ru: 'Печать отменена', es: 'Impresión cancelada' },
  '已撤销上一步操作': { en: 'Undid the previous action', ja: '前の操作を取り消しました', ru: 'Предыдущее действие отменено', es: 'Se deshizo la acción anterior' },
  '已选择：': { en: 'Selected: ', ja: '選択: ', ru: 'Выбрано: ', es: 'Seleccionado: ' },
  '已重做上一步操作': { en: 'Redid the previous action', ja: '前の操作をやり直しました', ru: 'Предыдущее действие повторено', es: 'Se rehízo la acción anterior' },
  '引用编号': { en: 'Citation number', ja: '引用番号', ru: 'Номер цитирования', es: 'Número de cita' },
  '当前 PDF': { en: 'Current PDF', ja: '現在の PDF', ru: 'Текущий PDF', es: 'PDF actual' },
  '当前文件可能处于临时目录，请注意另存，防止走丢！': { en: 'This file may be in a temporary folder. Save it elsewhere to avoid losing it.', ja: 'このファイルは一時フォルダーにある可能性があります。紛失を防ぐため別の場所に保存してください。', ru: 'Этот файл может находиться во временной папке. Сохраните его в другом месте, чтобы не потерять.', es: 'Este archivo puede estar en una carpeta temporal. Guárdelo en otro lugar para no perderlo.' },
  '当前编辑引擎无法安全写回加密 PDF，阅读和缩放不受影响。': { en: 'The editor cannot safely write back to this encrypted PDF. Reading and zoom remain available.', ja: 'この編集エンジンでは暗号化 PDF に安全に書き戻せません。閲覧と拡大縮小は利用できます。', ru: 'Редактор не может безопасно записать изменения в этот зашифрованный PDF. Просмотр и масштабирование доступны.', es: 'El editor no puede guardar con seguridad en este PDF cifrado. La lectura y el zoom siguen disponibles.' },
  '恢复默认 PDF 纸张背景': { en: 'Restore default PDF paper background', ja: '既定の PDF 用紙背景に戻す', ru: 'Восстановить фон бумаги PDF по умолчанию', es: 'Restaurar fondo de papel PDF predeterminado' },
  '恢复默认软件主题色': { en: 'Restore default app accent', ja: '既定のアプリアクセントに戻す', ru: 'Восстановить акцент приложения по умолчанию', es: 'Restaurar acento predeterminado de la aplicación' },
  '打开': { en: 'Open', ja: '開く', ru: 'Открыть', es: 'Abrir' },
  '打开过的文件可以从这里一键继续阅读': { en: 'Resume reading any previous file in one click.', ja: '以前に開いたファイルをここからワンクリックで再開できます。', ru: 'Продолжайте чтение любого ранее открытого файла одним щелчком.', es: 'Reanude la lectura de cualquier archivo anterior con un clic.' },
  '批注位置已更新': { en: 'Annotation position updated', ja: '注釈の位置を更新しました', ru: 'Положение аннотации обновлено', es: 'Posición de anotación actualizada' },
  '批注内容、颜色和回复已更新': { en: 'Annotation content, color, and reply updated', ja: '注釈の内容、色、返信を更新しました', ru: 'Содержимое, цвет и ответ аннотации обновлены', es: 'Se actualizaron el contenido, color y respuesta de la anotación' },
  '批注内容已在列表中更新': { en: 'Annotation content updated in the list', ja: '注釈内容をリストで更新しました', ru: 'Содержимое аннотации обновлено в списке', es: 'El contenido de la anotación se actualizó en la lista' },
  '批注回复已清除': { en: 'Annotation reply cleared', ja: '注釈の返信を消去しました', ru: 'Ответ аннотации очищен', es: 'Se borró la respuesta de la anotación' },
  '批注已删除，可按 Ctrl/⌘Z 撤销': { en: 'Annotation deleted. Press Ctrl/⌘Z to undo.', ja: '注釈を削除しました。Ctrl/⌘Z で元に戻せます。', ru: 'Аннотация удалена. Нажмите Ctrl/⌘Z, чтобы отменить.', es: 'Anotación eliminada. Pulse Ctrl/⌘Z para deshacer.' },
  '批注模式：按字符精准框选文字；右键可复制或添加批注': { en: 'Annotation mode: select text precisely by character; right-click to copy or add an annotation.', ja: '注釈モード：文字単位で正確に選択し、右クリックでコピーまたは注釈を追加できます。', ru: 'Режим аннотаций: выделяйте текст посимвольно; правой кнопкой можно копировать или добавлять аннотацию.', es: 'Modo de anotación: seleccione texto carácter a carácter; con clic derecho puede copiar o añadir una anotación.' },
  '批注颜色已更新': { en: 'Annotation color updated', ja: '注釈の色を更新しました', ru: 'Цвет аннотации обновлён', es: 'Color de anotación actualizado' },
  '批注颜色：': { en: 'Annotation color: ', ja: '注釈の色: ', ru: 'Цвет аннотации: ', es: 'Color de anotación: ' },
  '拖出文本框后设置内容和格式': { en: 'Drag out a text box, then set its content and formatting.', ja: 'テキストボックスをドラッグして作成し、内容と書式を設定します。', ru: 'Перетащите, чтобы создать текстовое поле, затем настройте содержимое и формат.', es: 'Arrastre para crear un cuadro de texto y ajuste su contenido y formato.' },
  '拖动批注快捷浮窗': { en: 'Drag annotation toolbar', ja: '注釈ツールバーをドラッグ', ru: 'Перетащить панель аннотаций', es: 'Arrastrar barra de anotaciones' },
  '拖动框选文字；Ctrl/⌘ 加选，Shift 选择连续批注，Delete 批量删除。': { en: 'Drag to select text; Ctrl/⌘ adds selections, Shift selects a range, and Delete removes annotations in bulk.', ja: 'ドラッグで文字を選択します。Ctrl/⌘ で追加、Shift で連続選択、Delete で一括削除できます。', ru: 'Перетаскивайте для выделения текста; Ctrl/⌘ добавляет выбор, Shift выбирает диапазон, Delete удаляет аннотации массово.', es: 'Arrastre para seleccionar texto; Ctrl/⌘ añade selecciones, Shift selecciona un rango y Delete elimina anotaciones en lote.' },
  '拖动框选要保留的页面区域': { en: 'Drag to select the area to keep.', ja: '残すページ範囲をドラッグして選択します。', ru: 'Перетащите, чтобы выбрать сохраняемую область страницы.', es: 'Arrastre para seleccionar el área de página que desea conservar.' },
  '拖动色彩面板选择任意颜色，或输入精确 HEX 值': { en: 'Drag in the color field to choose any color, or enter an exact HEX value.', ja: 'カラーフィールドをドラッグして色を選ぶか、正確な HEX 値を入力します。', ru: 'Перетащите в поле цвета, чтобы выбрать любой цвет, или введите точное HEX-значение.', es: 'Arrastre en el campo de color para elegir cualquier color o introduzca un valor HEX exacto.' },
  '拖动调整位置，双击编辑文字和格式': { en: 'Drag to reposition; double-click to edit text and formatting.', ja: 'ドラッグで位置を変更し、ダブルクリックで文字と書式を編集します。', ru: 'Перетащите для изменения позиции; двойной щелчок редактирует текст и формат.', es: 'Arrastre para mover; doble clic para editar texto y formato.' },
  '拖动调整批注列表宽度': { en: 'Drag to resize annotation list', ja: 'ドラッグして注釈リストの幅を変更', ru: 'Перетащите, чтобы изменить ширину списка аннотаций', es: 'Arrastre para cambiar el ancho de la lista de anotaciones' },
  '括号内容': { en: 'Bracketed content', ja: '括弧内の内容', ru: 'Содержимое в скобках', es: 'Contenido entre paréntesis' },
  '拼版': { en: 'layout', ja: '面付け', ru: 'раскладка', es: 'composición' },
  '控制按钮与强调色': { en: 'Buttons and highlights', ja: 'ボタンと強調表示', ru: 'Кнопки и выделения', es: 'Botones y resaltados' },
  '插入文字标记已添加': { en: 'Insert-text mark added', ja: '挿入文字マークを追加しました', ru: 'Метка вставки текста добавлена', es: 'Marca de inserción de texto añadida' },
  '搜索表达式无效': { en: 'Invalid search expression', ja: '検索式が無効です', ru: 'Недопустимое поисковое выражение', es: 'Expresión de búsqueda no válida' },
  '撤销 (Ctrl+Z)': { en: 'Undo (Ctrl+Z)', ja: '元に戻す (Ctrl+Z)', ru: 'Отменить (Ctrl+Z)', es: 'Deshacer (Ctrl+Z)' },
  '操作失败': { en: 'Action failed', ja: '操作に失敗しました', ru: 'Сбой операции', es: 'Error de operación' },
  '支持逗号、空格和短横线；页码可不连续': { en: 'Commas, spaces, and hyphens are supported; pages need not be consecutive.', ja: 'カンマ、空白、ハイフンに対応し、ページは連続していなくてもかまいません。', ru: 'Поддерживаются запятые, пробелы и дефисы; страницы могут быть несмежными.', es: 'Se admiten comas, espacios y guiones; las páginas no tienen que ser consecutivas.' },
  '收起': { en: 'Collapse', ja: '折りたたむ', ru: 'Свернуть', es: 'Contraer' },
  '收起回复统计': { en: 'Collapse reply summary', ja: '返信の集計を折りたたむ', ru: 'Свернуть сводку ответов', es: 'Contraer resumen de respuestas' },
  '收起批注列表': { en: 'Collapse annotation list', ja: '注釈リストを折りたたむ', ru: 'Свернуть список аннотаций', es: 'Contraer lista de anotaciones' },
  '收起统计': { en: 'Collapse summary', ja: '集計を折りたたむ', ru: 'Свернуть сводку', es: 'Contraer resumen' },
  '数字': { en: 'Number', ja: '数字', ru: 'Число', es: 'Número' },
  '文字位置已更新': { en: 'Text position updated', ja: '文字の位置を更新しました', ru: 'Положение текста обновлено', es: 'Posición del texto actualizada' },
  '文字内容和格式已更新': { en: 'Text content and formatting updated', ja: '文字内容と書式を更新しました', ru: 'Содержимое и формат текста обновлены', es: 'Se actualizaron el contenido y formato del texto' },
  '文字已删除，可按 Ctrl/⌘Z 撤销': { en: 'Text deleted. Press Ctrl/⌘Z to undo.', ja: '文字を削除しました。Ctrl/⌘Z で元に戻せます。', ru: 'Текст удалён. Нажмите Ctrl/⌘Z, чтобы отменить.', es: 'Texto eliminado. Pulse Ctrl/⌘Z para deshacer.' },
  '文字图像编码失败。': { en: 'Text image encoding failed.', ja: '文字画像のエンコードに失敗しました。', ru: 'Не удалось закодировать изображение текста.', es: 'Falló la codificación de la imagen de texto.' },
  '要编辑的页面不存在。': { en: 'The page to edit does not exist.', ja: '編集するページが存在しません。', ru: 'Страница для редактирования не существует.', es: 'La página que desea editar no existe.' },
  '文字宽度': { en: 'Text width', ja: '文字幅', ru: 'Ширина текста', es: 'Ancho de texto' },
  '文字宽度比例': { en: 'Text width scale', ja: '文字幅の比率', ru: 'Масштаб ширины текста', es: 'Escala de ancho del texto' },
  '文字已添加；可拖动位置，双击重新编辑': { en: 'Text added. Drag to reposition; double-click to edit again.', ja: '文字を追加しました。ドラッグで移動し、ダブルクリックで再編集できます。', ru: 'Текст добавлен. Перетащите для перемещения; двойной щелчок редактирует снова.', es: 'Texto añadido. Arrastre para mover y haga doble clic para editar de nuevo.' },
  '文字颜色': { en: 'Text color', ja: '文字色', ru: 'Цвет текста', es: 'Color de texto' },
  '无法直接保存：请选择其他位置另存': { en: 'Cannot save directly: choose another location with Save As', ja: '直接保存できません。別の場所を指定して名前を付けて保存してください。', ru: 'Невозможно сохранить напрямую: выберите другое место через «Сохранить как».', es: 'No se puede guardar directamente: elija otra ubicación con Guardar como.' },
  '日期': { en: 'Date', ja: '日付', ru: 'Дата', es: 'Fecha' },
  '显示当前页文本块，点击任意一处直接编辑': { en: 'Show text blocks on this page and click one to edit.', ja: '現在のページのテキストブロックを表示し、クリックして直接編集します。', ru: 'Показать текстовые блоки на этой странице и щёлкнуть для редактирования.', es: 'Muestre los bloques de texto de esta página y haga clic para editar.' },
  '智能润色 (Ctrl/⌘I)': { en: 'AI Polish (Ctrl/⌘I)', ja: 'AI 推敲 (Ctrl/⌘I)', ru: 'ИИ-редактирование (Ctrl/⌘I)', es: 'Edición con IA (Ctrl/⌘I)' },
  '智能润色已添加到批注列表': { en: 'AI polish result added to annotations', ja: 'AI 推敲結果を注釈リストに追加しました', ru: 'Результат ИИ-редактирования добавлен в аннотации', es: 'El resultado de edición con IA se añadió a las anotaciones' },
  '智能润色模型设置': { en: 'AI Polish Model Settings', ja: 'AI 推敲モデル設定', ru: 'Настройки модели ИИ-редактирования', es: 'Configuración del modelo de edición con IA' },
  '批注设置': { en: 'Annotation Settings', ja: '注釈設定', ru: 'Настройки аннотации', es: 'Configuración de anotaciones' },
  '通俗化解释': { en: 'Plain-language explanation', ja: 'わかりやすく説明', ru: 'Объяснить простым языком', es: 'Explicación sencilla' },
  '逻辑需优化': { en: 'Improve logic', ja: '論理を改善', ru: 'Улучшить логику', es: 'Mejorar la lógica' },
  '仅语法检查': { en: 'Grammar only', ja: '文法のみ確認', ru: 'Только грамматика', es: 'Solo gramática' },
  '类人化表达': { en: 'Natural phrasing', ja: '自然な表現', ru: 'Естественная формулировка', es: 'Redacción natural' },
  '前后不一致': { en: 'Resolve inconsistencies', ja: '不整合を解消', ru: 'Устранить несоответствия', es: 'Resolver incoherencias' },
  '要突出亮点': { en: 'Highlight strengths', ja: '強みを強調', ru: 'Подчеркнуть сильные стороны', es: 'Destacar puntos fuertes' },
  '暖灰': { en: 'Warm Gray', ja: 'ウォームグレー', ru: 'Тёплый серый', es: 'Gris cálido' },
  '最近打开的 PDF 会显示在这里': { en: 'Recently opened PDFs appear here', ja: '最近開いた PDF がここに表示されます', ru: 'Недавно открытые PDF появятся здесь', es: 'Aquí aparecerán los PDF abiertos recientemente' },
  '有未保存修改': { en: 'Has unsaved changes', ja: '未保存の変更あり', ru: 'Есть несохранённые изменения', es: 'Tiene cambios sin guardar' },
  '未保存到磁盘': { en: 'Not saved to disk', ja: 'ディスクに保存されていません', ru: 'Не сохранено на диск', es: 'No guardado en disco' },
  '未发现可定位项目': { en: 'No matching items found', ja: '該当する項目は見つかりませんでした', ru: 'Подходящие элементы не найдены', es: 'No se encontraron elementos coincidentes' },
  '本地保存的密码已失效，请输入当前密码。': { en: 'The locally saved password is no longer valid. Enter the current password.', ja: 'ローカルに保存されたパスワードは無効です。現在のパスワードを入力してください。', ru: 'Локально сохранённый пароль больше не действует. Введите текущий пароль.', es: 'La contraseña guardada localmente ya no es válida. Introduzca la contraseña actual.' },
  '条': { en: 'items', ja: '件', ru: 'элементов', es: 'elementos' },
  '标记删除': { en: 'Marked for deletion', ja: '削除としてマークしました', ru: 'Помечено для удаления', es: 'Marcado para eliminar' },
  '框选原文 · Ctrl+R / ⌘R': { en: 'Select original text · Ctrl+R / ⌘R', ja: '原文を選択 · Ctrl+R / ⌘R', ru: 'Выделить исходный текст · Ctrl+R / ⌘R', es: 'Seleccionar texto original · Ctrl+R / ⌘R' },
  '框选文字 · Ctrl+H / ⌘H': { en: 'Select text · Ctrl+H / ⌘H', ja: '文字を選択 · Ctrl+H / ⌘H', ru: 'Выделить текст · Ctrl+H / ⌘H', es: 'Seleccionar texto · Ctrl+H / ⌘H' },
  '框选文字 · Ctrl+I / ⌘I': { en: 'Select text · Ctrl+I / ⌘I', ja: '文字を選択 · Ctrl+I / ⌘I', ru: 'Выделить текст · Ctrl+I / ⌘I', es: 'Seleccionar texto · Ctrl+I / ⌘I' },
  '框选文字 · Ctrl+U / ⌘U': { en: 'Select text · Ctrl+U / ⌘U', ja: '文字を選択 · Ctrl+U / ⌘U', ru: 'Выделить текст · Ctrl+U / ⌘U', es: 'Seleccionar texto · Ctrl+U / ⌘U' },
  '框选文字 · Delete': { en: 'Select text · Delete', ja: '文字を選択 · Delete', ru: 'Выделить текст · Delete', es: 'Seleccionar texto · Delete' },
  '森林绿': { en: 'Forest Green', ja: 'フォレストグリーン', ru: 'Лесной зелёный', es: 'Verde bosque' },
  '正在打开打印对话框…': { en: 'Opening print dialog…', ja: '印刷ダイアログを開いています…', ru: 'Открывается диалог печати…', es: 'Abriendo diálogo de impresión…' },
  '正在添加…': { en: 'Adding…', ja: '追加中…', ru: 'Добавление…', es: 'Añadiendo…' },
  '此文档受密码保护，请验证后继续。': { en: 'This document is password protected. Verify it to continue.', ja: 'この文書はパスワードで保護されています。確認して続行してください。', ru: 'Этот документ защищён паролем. Подтвердите его, чтобы продолжить.', es: 'Este documento está protegido con contraseña. Verifíquela para continuar.' },
  '段前距': { en: 'Space before paragraph', ja: '段落前の間隔', ru: 'Интервал перед абзацем', es: 'Espacio antes del párrafo' },
  '段后距': { en: 'Space after paragraph', ja: '段落後の間隔', ru: 'Интервал после абзаца', es: 'Espacio después del párrafo' },
  '段落行距': { en: 'Paragraph line spacing', ja: '段落の行間', ru: 'Межстрочный интервал абзаца', es: 'Interlineado del párrafo' },
  '浅灰蓝': { en: 'Pale Blue Gray', ja: '淡い青灰色', ru: 'Светлый голубовато-серый', es: 'Gris azulado pálido' },
  '点击直接编辑这段文字': { en: 'Click to edit this text.', ja: 'クリックしてこの文字を編集', ru: 'Щёлкните, чтобы редактировать этот текст.', es: 'Haga clic para editar este texto.' },
  '状态：': { en: 'Status: ', ja: '状態: ', ru: 'Статус: ', es: 'Estado: ' },
  '琥珀': { en: 'Amber', ja: 'アンバー', ru: 'Янтарный', es: 'Ámbar' },
  '白色': { en: 'White', ja: '白', ru: 'Белый', es: 'Blanco' },
  '目录：': { en: 'Folder: ', ja: 'フォルダー: ', ru: 'Папка: ', es: 'Carpeta: ' },
  '直接调整页面或添加带格式的文字内容。': { en: 'Adjust pages directly or add formatted text.', ja: 'ページを直接調整するか、書式付きの文字を追加します。', ru: 'Настраивайте страницы напрямую или добавляйте форматированный текст.', es: 'Ajuste páginas directamente o añada texto con formato.' },
  '石墨': { en: 'Graphite', ja: 'グラファイト', ru: 'Графитовый', es: 'Grafito' },
  '编辑批注内容…': { en: 'Edit Annotation…', ja: '注釈を編集…', ru: 'Редактировать аннотацию…', es: 'Editar anotación…' },
  '编辑页面文字内容': { en: 'Edit page text content', ja: 'ページ文字の内容を編集', ru: 'Редактировать текст страницы', es: 'Editar contenido de texto de página' },
  '网址': { en: 'Website', ja: 'Web サイト', ru: 'Веб-сайт', es: 'Sitio web' },
  '自定义 OpenAI 兼容': { en: 'Custom OpenAI-compatible', ja: 'カスタム OpenAI 互換', ru: 'Пользовательский OpenAI-совместимый', es: 'Compatible personalizado con OpenAI' },
  '自定义回复': { en: 'Custom reply', ja: 'カスタム返信', ru: 'Свой ответ', es: 'Respuesta personalizada' },
  '自定义提示词…': { en: 'Custom instruction…', ja: 'カスタム指示…', ru: 'Своя инструкция…', es: 'Instrucción personalizada…' },
  '自定义颜色': { en: 'Custom color', ja: 'カスタムカラー', ru: 'Свой цвет', es: 'Color personalizado' },
  '英文单词': { en: 'English word', ja: '英単語', ru: 'Английское слово', es: 'Palabra en inglés' },
  '莓紫': { en: 'Berry Purple', ja: 'ベリーパープル', ru: 'Ягодный фиолетовый', es: 'Morado baya' },
  '蓝色': { en: 'Blue', ja: '青', ru: 'Синий', es: 'Azul' },
  '语法或拼写检查结果': { en: 'Grammar or spelling results', ja: '文法・スペルチェックの結果', ru: 'Результаты проверки грамматики или орфографии', es: 'Resultados de gramática u ortografía' },
  '请修正页码范围后继续': { en: 'Correct the page range to continue', ja: 'ページ範囲を修正して続行してください', ru: 'Исправьте диапазон страниц, чтобы продолжить', es: 'Corrija el intervalo de páginas para continuar' },
  '请先在 PDF 页面框选需要润色的文字。': { en: 'Select the text to polish on the PDF page first.', ja: 'まず PDF ページで推敲したい文字を選択してください。', ru: 'Сначала выделите на странице PDF текст для редактирования.', es: 'Primero seleccione en la página PDF el texto que desea mejorar.' },
  '请拖入 PDF 文件': { en: 'Drop a PDF file here', ja: 'PDF ファイルをここにドロップしてください', ru: 'Перетащите сюда PDF-файл', es: 'Suelte aquí un archivo PDF' },
  '请确认': { en: 'Please Confirm', ja: '確認してください', ru: 'Подтвердите', es: 'Confirme, por favor' },
  '调整批注列表宽度': { en: 'Resize annotation list', ja: '注釈リストの幅を変更', ru: 'Изменить ширину списка аннотаций', es: 'Cambiar ancho de la lista de anotaciones' },
  '输入文字或正则表达式': { en: 'Enter text or a regular expression', ja: '文字または正規表現を入力', ru: 'Введите текст или регулярное выражение', es: 'Introduzca texto o una expresión regular' },
  '还没有批注': { en: 'No annotations yet', ja: '注釈はまだありません', ru: 'Аннотаций пока нет', es: 'Aún no hay anotaciones' },
  '选择文字 · Ctrl+N / ⌘N': { en: 'Select text · Ctrl+N / ⌘N', ja: '文字を選択 · Ctrl+N / ⌘N', ru: 'Выделить текст · Ctrl+N / ⌘N', es: 'Seleccionar texto · Ctrl+N / ⌘N' },
  '选择文字 · Insert': { en: 'Select text · Insert', ja: '文字を選択 · Insert', ru: 'Выделить текст · Insert', es: 'Seleccionar texto · Insert' },
  '选择适合当前阅读场景的页面布局。': { en: 'Choose a page layout for your reading flow.', ja: '現在の閲覧に適したページレイアウトを選択します。', ru: 'Выберите макет страницы для текущего чтения.', es: 'Elija un diseño de página adecuado para su lectura.' },
  '邮箱': { en: 'Email address', ja: 'メールアドレス', ru: 'Адрес электронной почты', es: 'Correo electrónico' },
  '释放以打开 PDF': { en: 'Drop to Open PDF', ja: 'ドロップして PDF を開く', ru: 'Отпустите, чтобы открыть PDF', es: 'Suelte para abrir PDF' },
  '重做 (Ctrl+Y / Ctrl+Shift+Z)': { en: 'Redo (Ctrl+Y / Ctrl+Shift+Z)', ja: 'やり直す (Ctrl+Y / Ctrl+Shift+Z)', ru: 'Повторить (Ctrl+Y / Ctrl+Shift+Z)', es: 'Rehacer (Ctrl+Y / Ctrl+Shift+Z)' },
  '阅读、编辑、批注与导出，都在一个干净的窗口里完成。': { en: 'Read, edit, annotate, and export in one focused workspace.', ja: '閲覧、編集、注釈、エクスポートを 1 つの使いやすい画面で行えます。', ru: 'Читайте, редактируйте, добавляйте аннотации и экспортируйте в одном рабочем пространстве.', es: 'Lea, edite, anote y exporte en un único espacio de trabajo.' },
  '青绿': { en: 'Teal', ja: 'ティール', ru: 'Бирюзовый', es: 'Verde azulado' },
  '靛蓝': { en: 'Indigo', ja: 'インディゴ', ru: 'Индиго', es: 'Índigo' },
  '页': { en: 'Page', ja: 'ページ', ru: 'Страница', es: 'Página' },
  '页 · 第': { en: 'pages · Page', ja: 'ページ・ページ', ru: 'страниц · Страница', es: 'páginas · Página' },
  '页面已裁切；如需继续裁切，请再次点击“框选裁切页面”': { en: 'Page cropped. Click “Crop Page” again to continue cropping.', ja: 'ページをトリミングしました。続けてトリミングするには、もう一度「ページをトリミング」をクリックしてください。', ru: 'Страница обрезана. Нажмите «Обрезать страницу» ещё раз, чтобы продолжить.', es: 'Página recortada. Pulse «Recortar página» de nuevo para continuar.' },
  '页面文字已更新；可继续点击当前页其他文本块': { en: 'Page text updated. Click another text block on this page to continue editing.', ja: 'ページ文字を更新しました。現在のページの別のテキストブロックをクリックして編集を続けられます。', ru: 'Текст страницы обновлён. Щёлкните другой текстовый блок на этой странице, чтобы продолжить редактирование.', es: 'El texto de la página se actualizó. Haga clic en otro bloque de texto para seguir editando.' },
  '颜色与回复': { en: 'Color & Reply', ja: '色と返信', ru: 'Цвет и ответ', es: 'Color y respuesta' },
  '颜色浓度与明暗': { en: 'Saturation & Brightness', ja: '彩度と明るさ', ru: 'Насыщенность и яркость', es: 'Saturación y brillo' },
  '饱和度和明度': { en: 'Saturation and brightness', ja: '彩度と明度', ru: 'Насыщенность и яркость', es: 'Saturación y brillo' },
  '（加密，只读）': { en: ' (Encrypted, read-only)', ja: '（暗号化・読み取り専用）', ru: ' (зашифровано, только чтение)', es: ' (cifrado, solo lectura)' },
  '无内容': { en: 'No content', ja: '内容なし', ru: 'Нет содержимого', es: 'Sin contenido' },
  '智能润色请求无效。': { en: 'The AI polish request is invalid.', ja: 'AI 推敲リクエストが無効です。', ru: 'Запрос ИИ-редактирования недействителен.', es: 'La solicitud de edición con IA no es válida.' },
  '智能润色请求过大，请缩短框选内容后重试。': { en: 'The AI polish request is too large. Shorten the selected text and try again.', ja: 'AI 推敲リクエストが大きすぎます。選択した文字を短くして再試行してください。', ru: 'Запрос ИИ-редактирования слишком большой. Сократите выделенный текст и повторите попытку.', es: 'La solicitud de edición con IA es demasiado grande. Reduzca el texto seleccionado e inténtelo de nuevo.' },
  '接口地址无效，请检查 URL 是否完整（需以 http:// 或 https:// 开头）。': { en: 'The API endpoint is invalid. Check that the URL is complete and starts with http:// or https://.', ja: 'API エンドポイントが無効です。URL が完全で http:// または https:// から始まることを確認してください。', ru: 'Конечная точка API недействительна. Проверьте, что URL указан полностью и начинается с http:// или https://.', es: 'El punto de conexión API no es válido. Compruebe que la URL esté completa y empiece por http:// o https://.' },
  '接口地址只支持 http:// 或 https://。': { en: 'The API endpoint supports only http:// or https://.', ja: 'API エンドポイントは http:// または https:// のみ対応しています。', ru: 'Конечная точка API поддерживает только http:// или https://.', es: 'El punto de conexión API solo admite http:// o https://.' },
  '接口地址不能包含账号或密码。': { en: 'The API endpoint must not include a username or password.', ja: 'API エンドポイントにユーザー名やパスワードを含めることはできません。', ru: 'Конечная точка API не должна содержать имя пользователя или пароль.', es: 'El punto de conexión API no debe incluir usuario ni contraseña.' },
  '请求超时（45 秒）。请检查网络、代理或接口地址后重试。': { en: 'The request timed out (45 seconds). Check the network, proxy, or API endpoint and try again.', ja: 'リクエストがタイムアウトしました（45 秒）。ネットワーク、プロキシ、API エンドポイントを確認して再試行してください。', ru: 'Время запроса истекло (45 секунд). Проверьте сеть, прокси или конечную точку API и повторите попытку.', es: 'La solicitud agotó el tiempo (45 segundos). Revise red, proxy o punto de conexión API e inténtelo de nuevo.' },
  '只能打开 PDF 文件。': { en: 'Only PDF files can be opened.', ja: 'PDF ファイルのみ開けます。', ru: 'Можно открыть только PDF-файлы.', es: 'Solo se pueden abrir archivos PDF.' },
  '无效的窗口请求。': { en: 'Invalid window request.', ja: '無効なウィンドウリクエストです。', ru: 'Недопустимый запрос окна.', es: 'Solicitud de ventana no válida.' },
  '当前 PDF 没有可打印的内容。': { en: 'The current PDF has no printable content.', ja: '現在の PDF には印刷可能な内容がありません。', ru: 'В текущем PDF нет содержимого для печати.', es: 'El PDF actual no tiene contenido imprimible.' },
  '打印对话框已经打开。': { en: 'The print dialog is already open.', ja: '印刷ダイアログはすでに開いています。', ru: 'Диалог печати уже открыт.', es: 'El diálogo de impresión ya está abierto.' },
  '当前文件不是 PDF。': { en: 'The current file is not a PDF.', ja: '現在のファイルは PDF ではありません。', ru: 'Текущий файл не является PDF.', es: 'El archivo actual no es un PDF.' },
  '当前 PDF 文件已不存在。': { en: 'The current PDF file no longer exists.', ja: '現在の PDF ファイルは存在しません。', ru: 'Текущий PDF-файл больше не существует.', es: 'El archivo PDF actual ya no existe.' },
  'PDF 密码保存请求无效。': { en: 'The PDF password save request is invalid.', ja: 'PDF パスワード保存リクエストが無効です。', ru: 'Запрос на сохранение пароля PDF недействителен.', es: 'La solicitud para guardar la contraseña PDF no es válida.' },
  '阅读位置请求无效。': { en: 'The reading position request is invalid.', ja: '閲覧位置リクエストが無効です。', ru: 'Запрос позиции чтения недействителен.', es: 'La solicitud de posición de lectura no es válida.' },
  '不支持的导出格式。': { en: 'Unsupported export format.', ja: 'サポートされていないエクスポート形式です。', ru: 'Неподдерживаемый формат экспорта.', es: 'Formato de exportación no compatible.' },
  '复制内容无效或过长。': { en: 'The copied content is invalid or too long.', ja: 'コピーする内容が無効か長すぎます。', ru: 'Копируемое содержимое недействительно или слишком длинное.', es: 'El contenido para copiar no es válido o es demasiado largo.' },
  '版本号无效。': { en: 'Invalid version number.', ja: 'バージョン番号が無効です。', ru: 'Недопустимый номер версии.', es: 'Número de versión no válido.' },
  '更新链接无效。': { en: 'Invalid update link.', ja: '更新リンクが無効です。', ru: 'Недопустимая ссылка обновления.', es: 'Enlace de actualización no válido.' },
  'PDF 密码凭据标识无效。': { en: 'The PDF password credential identifier is invalid.', ja: 'PDF パスワード資格情報の識別子が無効です。', ru: 'Идентификатор учётных данных пароля PDF недействителен.', es: 'El identificador de credenciales de contraseña PDF no es válido.' },
  'PDF 密码为空或过长。': { en: 'The PDF password is empty or too long.', ja: 'PDF パスワードが空か長すぎます。', ru: 'Пароль PDF пустой или слишком длинный.', es: 'La contraseña PDF está vacía o es demasiado larga.' },
  '请先填写接口地址。': { en: 'Enter the API endpoint first.', ja: '先に API エンドポイントを入力してください。', ru: 'Сначала укажите конечную точку API.', es: 'Introduzca primero el punto de conexión API.' },
  '接口地址无效，请填写完整的 http:// 或 https:// 地址。': { en: 'The API endpoint is invalid. Enter a complete http:// or https:// address.', ja: 'API エンドポイントが無効です。完全な http:// または https:// アドレスを入力してください。', ru: 'Конечная точка API недействительна. Укажите полный адрес http:// или https://.', es: 'El punto de conexión API no es válido. Introduzca una dirección http:// o https:// completa.' },
  '请先在模型设置中填写 API Key。': { en: 'Enter an API key in Model Settings first.', ja: '先にモデル設定で API キーを入力してください。', ru: 'Сначала укажите API-ключ в настройках модели.', es: 'Introduzca primero una clave API en Configuración del modelo.' },
  '请先选择或填写模型名称。': { en: 'Select or enter a model name first.', ja: '先にモデル名を選択または入力してください。', ru: 'Сначала выберите или введите имя модели.', es: 'Seleccione o introduzca primero un nombre de modelo.' },
  '无法连接模型服务，请检查接口地址、网络或证书。': { en: 'Cannot connect to the model service. Check the API endpoint, network, or certificate.', ja: 'モデルサービスに接続できません。API エンドポイント、ネットワーク、または証明書を確認してください。', ru: 'Не удалось подключиться к сервису модели. Проверьте конечную точку API, сеть или сертификат.', es: 'No se puede conectar al servicio de modelo. Revise el punto de conexión API, la red o el certificado.' },
  '模型未返回可显示的内容，请检查模型、额度或接口兼容性。': { en: 'The model returned no displayable content. Check the model, quota, or API compatibility.', ja: 'モデルから表示可能な内容が返されませんでした。モデル、利用枠、API 互換性を確認してください。', ru: 'Модель не вернула отображаемое содержимое. Проверьте модель, квоту или совместимость API.', es: 'El modelo no devolvió contenido visible. Revise el modelo, la cuota o la compatibilidad de la API.' },
  '页面图像编码失败。': { en: 'Page image encoding failed.', ja: 'ページ画像のエンコードに失敗しました。', ru: 'Не удалось закодировать изображение страницы.', es: 'Falló la codificación de la imagen de página.' },
  '无法读取页面像素。': { en: 'Cannot read page pixels.', ja: 'ページのピクセルを読み取れません。', ru: 'Не удалось прочитать пиксели страницы.', es: 'No se pueden leer los píxeles de la página.' },
  '请至少选择一个要导出的页面。': { en: 'Select at least one page to export.', ja: 'エクスポートするページを少なくとも 1 つ選択してください。', ru: 'Выберите хотя бы одну страницу для экспорта.', es: 'Seleccione al menos una página para exportar.' },
  '选择的页码超出了文档范围。': { en: 'The selected page is outside the document range.', ja: '選択したページ番号が文書の範囲外です。', ru: 'Выбранный номер страницы выходит за пределы документа.', es: 'La página seleccionada está fuera del intervalo del documento.' },
  '无法创建页面画布。': { en: 'Cannot create the page canvas.', ja: 'ページキャンバスを作成できません。', ru: 'Не удалось создать холст страницы.', es: 'No se puede crear el lienzo de página.' },
  '页面坐标矩阵不可逆。': { en: 'The page coordinate matrix is not invertible.', ja: 'ページ座標行列は逆行列を持ちません。', ru: 'Матрица координат страницы необратима.', es: 'La matriz de coordenadas de página no es invertible.' },
  '页面旋转角度必须是 90 度的倍数。': { en: 'The page rotation angle must be a multiple of 90 degrees.', ja: 'ページの回転角度は 90 度の倍数である必要があります。', ru: 'Угол поворота страницы должен быть кратен 90 градусам.', es: 'El ángulo de rotación de página debe ser múltiplo de 90 grados.' },
  '请至少选择一个页面。': { en: 'Select at least one page.', ja: '少なくとも 1 ページを選択してください。', ru: 'Выберите хотя бы одну страницу.', es: 'Seleccione al menos una página.' },
  '不能删除文档中的最后一页。': { en: 'You cannot delete the last page of the document.', ja: '文書の最後のページは削除できません。', ru: 'Нельзя удалить последнюю страницу документа.', es: 'No puede eliminar la última página del documento.' },
  '请至少选择一个要删除的页面。': { en: 'Select at least one page to delete.', ja: '削除するページを少なくとも 1 つ選択してください。', ru: 'Выберите хотя бы одну страницу для удаления.', es: 'Seleccione al menos una página para eliminar.' },
  '不能删除文档中的全部页面。': { en: 'You cannot delete every page in the document.', ja: '文書内のすべてのページは削除できません。', ru: 'Нельзя удалить все страницы документа.', es: 'No puede eliminar todas las páginas del documento.' },
  '找不到要编辑的页面文字区域。': { en: 'Cannot find the page text area to edit.', ja: '編集するページ文字領域が見つかりません。', ru: 'Не удалось найти область текста страницы для редактирования.', es: 'No se encuentra el área de texto de página que se debe editar.' },
  '找不到这段文字，它可能已经被删除。': { en: 'Cannot find this text; it may already have been deleted.', ja: 'この文字が見つかりません。すでに削除された可能性があります。', ru: 'Не удалось найти этот текст; возможно, он уже удалён.', es: 'No se encuentra este texto; puede que ya se haya eliminado.' },
  '找不到这条批注，它可能已经被删除。': { en: 'Cannot find this annotation; it may already have been deleted.', ja: 'この注釈が見つかりません。すでに削除された可能性があります。', ru: 'Не удалось найти эту аннотацию; возможно, она уже удалена.', es: 'No se encuentra esta anotación; puede que ya se haya eliminado.' },
  '请先选择文字或页面位置。': { en: 'Select text or a page position first.', ja: '先に文字またはページ上の位置を選択してください。', ru: 'Сначала выделите текст или место на странице.', es: 'Seleccione primero texto o una posición de página.' },
  '请至少选择一个要打印的页面。': { en: 'Select at least one page to print.', ja: '印刷するページを少なくとも 1 つ選択してください。', ru: 'Выберите хотя бы одну страницу для печати.', es: 'Seleccione al menos una página para imprimir.' },
  '打印页码超出了文档范围。': { en: 'The print page number is outside the document range.', ja: '印刷ページ番号が文書の範囲外です。', ru: 'Номер страницы для печати выходит за пределы документа.', es: 'El número de página para imprimir está fuera del intervalo del documento.' },
  '从文件合并 PDF…': { en: 'Merge PDF from Files…', ja: 'ファイルから PDF を結合…', ru: 'Объединить PDF из файлов…', es: 'Combinar PDF desde archivos…' },
  '支持 PDF、PNG、JPG、JPEG 和 EPS；导入后可调整页面顺序。': { en: 'Supports PDF, PNG, JPG, JPEG, and EPS; you can reorder pages after import.', ja: 'PDF、PNG、JPG、JPEG、EPS に対応し、インポート後にページ順を変更できます。', ru: 'Поддерживаются PDF, PNG, JPG, JPEG и EPS; после импорта порядок страниц можно изменить.', es: 'Admite PDF, PNG, JPG, JPEG y EPS; puede reordenar las páginas después de importarlas.' },
  '调整合并后的页面顺序': { en: 'Set the Merged Page Order', ja: '結合後のページ順を調整', ru: 'Настройка порядка объединённых страниц', es: 'Ajustar el orden de páginas combinadas' },
  '导入的页面已追加到文档末尾。使用上下按钮调整顺序，确认后写入 PDF。': { en: 'Imported pages were added to the end of the document. Use the up and down buttons to reorder them, then confirm to write the PDF.', ja: 'インポートしたページは文書末尾に追加されました。上下ボタンで並べ替え、確定すると PDF に反映されます。', ru: 'Импортированные страницы добавлены в конец документа. Измените порядок кнопками вверх и вниз, затем подтвердите запись в PDF.', es: 'Las páginas importadas se añadieron al final del documento. Use los botones arriba y abajo para reordenarlas y confirme para escribir el PDF.' },
  '导入页面': { en: 'Imported Page', ja: 'インポートしたページ', ru: 'Импортированная страница', es: 'Página importada' },
  '原文页面': { en: 'Original Page', ja: '元のページ', ru: 'Исходная страница', es: 'Página original' },
  '上移页面': { en: 'Move Page Up', ja: 'ページを上へ移動', ru: 'Переместить страницу вверх', es: 'Subir página' },
  '上移': { en: 'Move Up', ja: '上へ移動', ru: 'Переместить вверх', es: 'Subir' },
  '下移页面': { en: 'Move Page Down', ja: 'ページを下へ移動', ru: 'Переместить страницу вниз', es: 'Bajar página' },
  '下移': { en: 'Move Down', ja: '下へ移動', ru: 'Переместить вниз', es: 'Bajar' },
  '确认顺序': { en: 'Confirm Order', ja: '順序を確定', ru: 'Подтвердить порядок', es: 'Confirmar orden' },
  '导入 EPS 需要本机 Ghostscript。请安装 Ghostscript 后重试。': { en: 'Importing EPS requires Ghostscript on this computer. Install Ghostscript and try again.', ja: 'EPS のインポートにはこのコンピューター上の Ghostscript が必要です。Ghostscript をインストールして再試行してください。', ru: 'Для импорта EPS требуется Ghostscript на этом компьютере. Установите Ghostscript и повторите попытку.', es: 'La importación de EPS requiere Ghostscript en este equipo. Instale Ghostscript e inténtelo de nuevo.' },
  '无法转换 EPS 文件。请确认该文件有效且 Ghostscript 可用。': { en: 'Cannot convert the EPS file. Confirm that the file is valid and Ghostscript is available.', ja: 'EPS ファイルを変換できません。ファイルが有効で Ghostscript を利用できることを確認してください。', ru: 'Не удалось преобразовать файл EPS. Убедитесь, что файл действителен и Ghostscript доступен.', es: 'No se puede convertir el archivo EPS. Confirme que el archivo sea válido y Ghostscript esté disponible.' },
  '仅支持导入 PDF、PNG、JPG、JPEG 或 EPS 文件。': { en: 'Only PDF, PNG, JPG, JPEG, or EPS files can be imported.', ja: 'PDF、PNG、JPG、JPEG、EPS ファイルのみインポートできます。', ru: 'Можно импортировать только PDF, PNG, JPG, JPEG или EPS.', es: 'Solo se pueden importar archivos PDF, PNG, JPG, JPEG o EPS.' },
  '请至少选择一个要导入的文件。': { en: 'Select at least one file to import.', ja: 'インポートするファイルを少なくとも 1 つ選択してください。', ru: 'Выберите хотя бы один файл для импорта.', es: 'Seleccione al menos un archivo para importar.' },
  '页面排序无效。': { en: 'The page order is invalid.', ja: 'ページ順が無効です。', ru: 'Порядок страниц недействителен.', es: 'El orden de páginas no es válido.' },
  '已合并 {count} 个文件；请确认页面顺序': { en: 'Merged {count} file(s); confirm the page order.', ja: '{count} 件のファイルを結合しました。ページ順を確定してください。', ru: 'Объединено файлов: {count}. Подтвердите порядок страниц.', es: 'Se combinaron {count} archivo(s); confirme el orden de páginas.' },
  '页面顺序已更新': { en: 'Page order updated', ja: 'ページ順を更新しました', ru: 'Порядок страниц обновлён', es: 'El orden de páginas se actualizó' },
  '无需先打开 PDF；支持 PDF、PNG、JPG、JPEG 和 EPS，导入后可批量调整页面顺序。': { en: 'No PDF needs to be open. Supports PDF, PNG, JPG, JPEG, and EPS with batch page ordering after import.', ja: 'PDF を開いていなくても使えます。PDF、PNG、JPG、JPEG、EPS に対応し、インポート後はページ順を一括調整できます。', ru: 'Не нужно сначала открывать PDF. Поддерживаются PDF, PNG, JPG, JPEG и EPS; после импорта порядок страниц можно изменить массово.', es: 'No necesita abrir un PDF primero. Admite PDF, PNG, JPG, JPEG y EPS con ordenación masiva tras la importación.' },
  '合并文档.pdf': { en: 'Merged Document.pdf', ja: '結合文書.pdf', ru: 'Объединённый документ.pdf', es: 'Documento combinado.pdf' },
  '打开 PDF': { en: 'Open PDF', ja: 'PDF を開く', ru: 'Открыть PDF', es: 'Abrir PDF' },
  '从最近打开的文件继续工作，或浏览本机文件。': { en: 'Continue with a recent file, or browse files on this computer.', ja: '最近開いたファイルから続けるか、このコンピューターのファイルを参照します。', ru: 'Продолжите работу с недавним файлом или выберите файл на этом компьютере.', es: 'Continúe con un archivo reciente o explore archivos en este equipo.' },
  '还没有最近打开的 PDF': { en: 'No recently opened PDFs yet', ja: '最近開いた PDF はまだありません', ru: 'Недавно открытых PDF пока нет', es: 'Aún no hay PDF abiertos recientemente' },
  '浏览 PDF 文件…': { en: 'Browse PDF Files…', ja: 'PDF ファイルを参照…', ru: 'Выбрать PDF-файл…', es: 'Examinar archivos PDF…' },
  '批量调整页面顺序': { en: 'Batch Page Ordering', ja: 'ページ順を一括調整', ru: 'Массовая сортировка страниц', es: 'Ordenación masiva de páginas' },
  '适合大量页面：用页码范围选择一组页面，再把整组移到开头、末尾或指定页位。导入页面已默认选中。': { en: 'Built for large documents: select a page range, then move the whole group to the beginning, end, or a specified position. Imported pages are selected by default.', ja: '大量ページ向け：ページ範囲でグループを選び、先頭・末尾・指定位置へまとめて移動します。インポートしたページは初期状態で選択されています。', ru: 'Для больших документов: выберите диапазон страниц и переместите всю группу в начало, конец или указанную позицию. Импортированные страницы выбраны по умолчанию.', es: 'Pensado para documentos grandes: seleccione un intervalo y mueva todo el grupo al inicio, al final o a una posición concreta. Las páginas importadas se seleccionan de forma predeterminada.' },
  '要移动的页面': { en: 'Pages to Move', ja: '移動するページ', ru: 'Перемещаемые страницы', es: 'Páginas que mover' },
  '已选择 {count} 页 · {pages}': { en: 'Selected {count} pages · {pages}', ja: '{count} ページを選択・{pages}', ru: 'Выбрано страниц: {count} · {pages}', es: '{count} páginas seleccionadas · {pages}' },
  '选择导入页面': { en: 'Select Imported Pages', ja: 'インポートしたページを選択', ru: 'Выбрать импортированные страницы', es: 'Seleccionar páginas importadas' },
  '选择全部': { en: 'Select All', ja: 'すべて選択', ru: 'Выбрать все', es: 'Seleccionar todo' },
  '清空选择': { en: 'Clear Selection', ja: '選択を解除', ru: 'Очистить выбор', es: 'Borrar selección' },
  '恢复导入前顺序': { en: 'Restore Pre-import Order', ja: 'インポート前の順序に戻す', ru: 'Восстановить порядок до импорта', es: 'Restaurar el orden previo a la importación' },
  '移动到': { en: 'Move To', ja: '移動先', ru: 'Переместить в', es: 'Mover a' },
  '开头': { en: 'Beginning', ja: '先頭', ru: 'Начало', es: 'Inicio' },
  '末尾': { en: 'End', ja: '末尾', ru: 'Конец', es: 'Final' },
  '指定页位': { en: 'Page Position', ja: 'ページ位置を指定', ru: 'Указать позицию', es: 'Posición de página' },
  '目标页位': { en: 'Target Position', ja: '移動先の位置', ru: 'Целевая позиция', es: 'Posición de destino' },
  '将移动 {count} 页': { en: 'Move {count} pages', ja: '{count} ページを移動', ru: 'Переместить страниц: {count}', es: 'Mover {count} páginas' },
  '请选择有效的页码范围': { en: 'Choose a valid page range', ja: '有効なページ範囲を選択してください', ru: 'Выберите допустимый диапазон страниц', es: 'Elija un intervalo de páginas válido' },
  '当前文档共 {count} 页；可重复移动多组页面，再确认写入。': { en: 'This document has {count} pages. Move more groups as needed, then confirm.', ja: 'この文書は {count} ページです。必要に応じて複数のグループを移動してから確定してください。', ru: 'В документе {count} страниц. При необходимости переместите другие группы и затем подтвердите.', es: 'Este documento tiene {count} páginas. Mueva más grupos según necesite y después confirme.' },
  '页码范围不能为空。': { en: 'The page range cannot be empty.', ja: 'ページ範囲は空にできません。', ru: 'Диапазон страниц не может быть пустым.', es: 'El intervalo de páginas no puede estar vacío.' },
  '应用移动': { en: 'Apply Move', ja: '移動を適用', ru: 'Применить перемещение', es: 'Aplicar movimiento' },
  '已新建合并文档并导入 {count} 个文件；请确认页面顺序': { en: 'Created a new merged document and imported {count} file(s); confirm the page order.', ja: '新しい結合文書を作成し、{count} 件のファイルをインポートしました。ページ順を確定してください。', ru: 'Создан новый объединённый документ и импортировано файлов: {count}. Подтвердите порядок страниц.', es: 'Se creó un documento combinado nuevo y se importaron {count} archivo(s); confirme el orden de páginas.' },
  '从文件合并 PDF': { en: 'Merge PDF from Files', ja: 'ファイルから PDF を結合', ru: 'Объединить PDF из файлов', es: 'Combinar PDF desde archivos' },
  '调整导入文件的顺序后，即可创建新的合并 PDF。': { en: 'Arrange imported files, then create a new merged PDF.', ja: 'インポートするファイルの順序を調整してから、新しい結合 PDF を作成します。', ru: 'Настройте порядок импортируемых файлов, затем создайте новый объединённый PDF.', es: 'Ordene los archivos importados y cree un PDF combinado nuevo.' },
  '先选择插入位置，再调整导入文件的顺序。': { en: 'Choose the insertion point first, then arrange imported files.', ja: '最初に挿入位置を選び、次にインポートするファイルの順序を調整します。', ru: 'Сначала выберите место вставки, затем настройте порядок импортируемых файлов.', es: 'Primero elija el punto de inserción y después ordene los archivos importados.' },
  '插入位置': { en: 'Insertion Point', ja: '挿入位置', ru: 'Место вставки', es: 'Punto de inserción' },
  '共 {count} 页': { en: '{count} pages', ja: '全 {count} ページ', ru: 'Всего страниц: {count}', es: '{count} páginas en total' },
  '文档开头': { en: 'Beginning of Document', ja: '文書の先頭', ru: 'Начало документа', es: 'Inicio del documento' },
  '文档末尾': { en: 'End of Document', ja: '文書の末尾', ru: 'Конец документа', es: 'Final del documento' },
  '某页之前': { en: 'Before a Page', ja: '指定ページの前', ru: 'Перед страницей', es: 'Antes de una página' },
  '某页之后': { en: 'After a Page', ja: '指定ページの後', ru: 'После страницы', es: 'Después de una página' },
  '插入到第几页之前': { en: 'Insert Before Which Page', ja: '何ページ目の前に挿入', ru: 'Перед какой страницей вставить', es: 'Insertar antes de qué página' },
  '插入到第几页之后': { en: 'Insert After Which Page', ja: '何ページ目の後に挿入', ru: 'После какой страницы вставить', es: 'Insertar después de qué página' },
  '可输入 1 到 {count}。': { en: 'Enter a number from 1 to {count}.', ja: '1 ～ {count} の番号を入力してください。', ru: 'Введите число от 1 до {count}.', es: 'Introduzca un número del 1 al {count}.' },
  '请输入 1 到 {count} 之间的页码。': { en: 'Enter a page number from 1 to {count}.', ja: '1 ～ {count} のページ番号を入力してください。', ru: 'Введите номер страницы от 1 до {count}.', es: 'Introduzca un número de página del 1 al {count}.' },
  '导入文件顺序': { en: 'Imported File Order', ja: 'インポートするファイルの順序', ru: 'Порядок импортируемых файлов', es: 'Orden de archivos importados' },
  '拖动卡片或使用上下按钮排序；每个文件内部页面保持原有顺序。': { en: 'Drag cards or use the arrow buttons. Pages within each file keep their original order.', ja: 'カードをドラッグするか矢印ボタンで並べ替えます。各ファイル内のページ順は保持されます。', ru: 'Перетаскивайте карточки или используйте стрелки. Порядок страниц внутри каждого файла сохраняется.', es: 'Arrastre las tarjetas o use las flechas. Se conserva el orden de las páginas dentro de cada archivo.' },
  '保持原文件页序': { en: 'Keep the source page order', ja: '元ファイルのページ順を保持', ru: 'Сохранить порядок страниц исходного файла', es: 'Conservar el orden de páginas de origen' },
  '上移文件': { en: 'Move File Up', ja: 'ファイルを上へ移動', ru: 'Переместить файл вверх', es: 'Subir archivo' },
  '下移文件': { en: 'Move File Down', ja: 'ファイルを下へ移動', ru: 'Переместить файл вниз', es: 'Bajar archivo' },
  '将创建一个新的合并 PDF。': { en: 'A new merged PDF will be created.', ja: '新しい結合 PDF を作成します。', ru: 'Будет создан новый объединённый PDF.', es: 'Se creará un PDF combinado nuevo.' },
  '将插入到文档开头。': { en: 'Files will be inserted at the beginning of the document.', ja: 'ファイルは文書の先頭に挿入されます。', ru: 'Файлы будут вставлены в начало документа.', es: 'Los archivos se insertarán al inicio del documento.' },
  '将插入到文档末尾。': { en: 'Files will be inserted at the end of the document.', ja: 'ファイルは文書の末尾に挿入されます。', ru: 'Файлы будут вставлены в конец документа.', es: 'Los archivos se insertarán al final del documento.' },
  '将插入到第 {page} 页之前。': { en: 'Files will be inserted before page {page}.', ja: 'ファイルは {page} ページ目の前に挿入されます。', ru: 'Файлы будут вставлены перед страницей {page}.', es: 'Los archivos se insertarán antes de la página {page}.' },
  '将插入到第 {page} 页之后。': { en: 'Files will be inserted after page {page}.', ja: 'ファイルは {page} ページ目の後に挿入されます。', ru: 'Файлы будут вставлены после страницы {page}.', es: 'Los archivos se insertarán después de la página {page}.' },
  '请输入有效的目标页码。': { en: 'Enter a valid target page number.', ja: '有効な対象ページ番号を入力してください。', ru: 'Введите допустимый номер целевой страницы.', es: 'Introduzca un número de página de destino válido.' },
  '确认后将按上列顺序一次性写入。': { en: 'After confirmation, files will be inserted together in the order above.', ja: '確定すると、上の順序でまとめて挿入されます。', ru: 'После подтверждения файлы будут вставлены вместе в указанном выше порядке.', es: 'Tras confirmar, los archivos se insertarán juntos en el orden anterior.' },
  '{count} 个文件': { en: '{count} files', ja: '{count} 件のファイル', ru: 'Файлов: {count}', es: '{count} archivos' },
  '创建合并 PDF': { en: 'Create Merged PDF', ja: '結合 PDF を作成', ru: 'Создать объединённый PDF', es: 'Crear PDF combinado' },
  '确认并合并': { en: 'Confirm & Merge', ja: '確定して結合', ru: 'Подтвердить и объединить', es: 'Confirmar y combinar' },
  '插入位置无效。': { en: 'The insertion position is invalid.', ja: '挿入位置が無効です。', ru: 'Недопустимое место вставки.', es: 'La posición de inserción no es válida.' },
  '已创建合并文档，已导入 {count} 个文件': { en: 'Created a merged document and imported {count} file(s)', ja: '結合文書を作成し、{count} 件のファイルをインポートしました', ru: 'Создан объединённый документ и импортировано файлов: {count}', es: 'Se creó un documento combinado y se importaron {count} archivo(s)' },
  '已合并 {count} 个文件': { en: 'Merged {count} file(s)', ja: '{count} 件のファイルを結合しました', ru: 'Объединено файлов: {count}', es: 'Se combinaron {count} archivo(s)' },
  '无需先打开 PDF；选择插入位置并调整导入文件顺序。': { en: 'No PDF needs to be open. Choose an insertion point and arrange imported files.', ja: 'PDF を開いていなくても使えます。挿入位置を選び、インポートするファイルを並べ替えます。', ru: 'Не нужно сначала открывать PDF. Выберите место вставки и упорядочьте импортируемые файлы.', es: 'No necesita abrir un PDF primero. Elija un punto de inserción y ordene los archivos importados.' },
  '一次选择多个页面并统一删除。': { en: 'Select multiple pages and remove them together.', ja: '複数のページを選択してまとめて削除します。', ru: 'Выберите несколько страниц и удалите их вместе.', es: 'Seleccione varias páginas y elimínelas juntas.' },
  '将当前所有修改写回此文件。': { en: 'Write all current changes back to this file.', ja: '現在のすべての変更をこのファイルに保存します。', ru: 'Записать все текущие изменения в этот файл.', es: 'Guarde todos los cambios actuales en este archivo.' },
  '选择新位置保存，原文件保持不变。': { en: 'Choose a new location and keep the original file unchanged.', ja: '新しい保存先を選び、元のファイルは変更しません。', ru: 'Выберите новое место и сохраните исходный файл без изменений.', es: 'Elija una nueva ubicación y mantenga el archivo original sin cambios.' },
  '无需先打开 PDF；先选择插入位置，再调整导入文件顺序。支持 PDF、PNG、JPG、JPEG 和 EPS。': { en: 'No PDF needs to be open. Choose the insertion point, then arrange imported files. Supports PDF, PNG, JPG, JPEG, and EPS.', ja: 'PDF を開いていなくても使えます。挿入位置を選び、インポートするファイルを並べ替えます。PDF、PNG、JPG、JPEG、EPS に対応しています。', ru: 'Не нужно сначала открывать PDF. Выберите место вставки, затем упорядочьте импортируемые файлы. Поддерживаются PDF, PNG, JPG, JPEG и EPS.', es: 'No necesita abrir un PDF primero. Elija el punto de inserción y ordene los archivos importados. Admite PDF, PNG, JPG, JPEG y EPS.' }
  , '明快': { en: 'Bright', ja: '明るい', ru: 'Яркая', es: 'Brillante' }
  , '目标页码': { en: 'Target Page', ja: '対象ページ', ru: 'Целевая страница', es: 'Página de destino' }
  , '在此页之前插入': { en: 'Insert before this page', ja: 'このページの前に挿入', ru: 'Вставить перед этой страницей', es: 'Insertar antes de esta página' }
  , '在此页之后插入': { en: 'Insert after this page', ja: 'このページの後に挿入', ru: 'Вставить после этой страницы', es: 'Insertar después de esta página' }
  , '直接调整页面或添加带格式的文字和图片内容。': { en: 'Adjust pages directly or add formatted text and images.', ja: 'ページを直接調整し、書式付きの文字や画像を追加します。', ru: 'Настраивайте страницы и добавляйте форматированный текст и изображения.', es: 'Ajuste páginas directamente o añada texto e imágenes con formato.' }
  , '导入 PNG 或 JPG；在当前页调整位置、大小和旋转后再确认。': { en: 'Import PNG or JPG, then position, resize, rotate, and confirm it on this page.', ja: 'PNG または JPG を読み込み、このページで位置・サイズ・回転を調整して確定します。', ru: 'Импортируйте PNG или JPG, затем настройте положение, размер и поворот на этой странице и подтвердите.', es: 'Importe PNG o JPG y ajuste la posición, el tamaño y la rotación en esta página antes de confirmar.' }
  , '在页面上添加图片…': { en: 'Add Image to Page…', ja: 'ページに画像を追加…', ru: 'Добавить изображение на страницу…', es: 'Añadir imagen a la página…' }
  , '拖动图片调整位置': { en: 'Drag image to reposition', ja: '画像をドラッグして位置を調整', ru: 'Перетащите изображение, чтобы изменить положение', es: 'Arrastre la imagen para cambiar su posición' }
  , '待添加图片': { en: 'Image Preview', ja: '画像プレビュー', ru: 'Предпросмотр изображения', es: 'Vista previa de imagen' }
  , '拖动旋转控制点调整图片角度': { en: 'Drag rotation handle to rotate image', ja: '回転ハンドルをドラッグして画像を回転', ru: 'Перетащите маркер поворота, чтобы повернуть изображение', es: 'Arrastre el control de rotación para girar la imagen' }
  , '拖动控制点调整图片大小': { en: 'Drag handle to resize image', ja: 'ハンドルをドラッグして画像サイズを変更', ru: 'Перетащите маркер, чтобы изменить размер изображения', es: 'Arrastre el control para cambiar el tamaño de la imagen' }
  , '拖动、缩放、旋转或切换比例锁后确认': { en: 'Move, resize, rotate, or change the aspect lock, then confirm', ja: '移動・サイズ変更・回転・縦横比ロックの切替後に確定', ru: 'Переместите, измените размер, поверните или измените блокировку пропорций, затем подтвердите', es: 'Mueva, cambie el tamaño, gire o cambie el bloqueo de proporciones y luego confirme' }
  , '已锁定原始比例': { en: 'Original aspect ratio locked', ja: '元の縦横比を固定中', ru: 'Исходные пропорции заблокированы', es: 'Proporción original bloqueada' }
  , '未锁定原始比例': { en: 'Original aspect ratio unlocked', ja: '元の縦横比は固定されていません', ru: 'Исходные пропорции не заблокированы', es: 'Proporción original desbloqueada' }
  , '比例已锁定': { en: 'Ratio Locked', ja: '比率を固定', ru: 'Пропорции заблокированы', es: 'Proporción bloqueada' }
  , '比例未锁定': { en: 'Ratio Unlocked', ja: '比率を解除', ru: 'Пропорции не заблокированы', es: 'Proporción desbloqueada' }
  , '确认添加图片': { en: 'Confirm Add Image', ja: '画像の追加を確定', ru: 'Подтвердить добавление изображения', es: 'Confirmar añadir imagen' }
  , '无法读取所选图片。请确认文件未损坏。': { en: 'Unable to read the selected image. Check that the file is not corrupted.', ja: '選択した画像を読み取れません。ファイルが破損していないか確認してください。', ru: 'Не удалось прочитать выбранное изображение. Проверьте, не повреждён ли файл.', es: 'No se puede leer la imagen seleccionada. Compruebe que el archivo no esté dañado.' }
  , '所选图片没有可用尺寸。': { en: 'The selected image has no usable dimensions.', ja: '選択した画像に使用可能なサイズがありません。', ru: 'У выбранного изображения нет допустимых размеров.', es: 'La imagen seleccionada no tiene dimensiones utilizables.' }
  , '图片已导入当前页；可按需切换比例锁，再拖动、缩放或旋转后点击确认添加': { en: 'Image imported to the current page. Toggle the aspect lock as needed, then move, resize, or rotate it before confirming.', ja: '画像を現在のページに読み込みました。必要に応じて縦横比ロックを切り替え、移動・サイズ変更・回転後に確定してください。', ru: 'Изображение импортировано на текущую страницу. При необходимости переключите блокировку пропорций, затем переместите, измените размер или поверните его перед подтверждением.', es: 'La imagen se importó a la página actual. Cambie el bloqueo de proporciones según sea necesario y luego muévala, cambie su tamaño o gírela antes de confirmar.' }
  , '图片已添加到当前页面；可保存 PDF 以保留修改': { en: 'Image added to the current page. Save the PDF to keep the change.', ja: '画像を現在のページに追加しました。変更を保持するには PDF を保存してください。', ru: 'Изображение добавлено на текущую страницу. Сохраните PDF, чтобы сохранить изменения.', es: 'La imagen se añadió a la página actual. Guarde el PDF para conservar el cambio.' }
  , '已取消添加图片': { en: 'Image insertion canceled', ja: '画像の追加をキャンセルしました', ru: 'Добавление изображения отменено', es: 'Se canceló la inserción de la imagen' }
  , '仅支持导入 PNG、JPG 或 JPEG 图片。': { en: 'Only PNG, JPG, or JPEG images can be imported.', ja: 'PNG、JPG、JPEG の画像のみインポートできます。', ru: 'Можно импортировать только изображения PNG, JPG или JPEG.', es: 'Solo se pueden importar imágenes PNG, JPG o JPEG.' }
  , '所选文件不是有效的 PNG 或 JPEG 图片。': { en: 'The selected file is not a valid PNG or JPEG image.', ja: '選択したファイルは有効な PNG または JPEG 画像ではありません。', ru: 'Выбранный файл не является допустимым изображением PNG или JPEG.', es: 'El archivo seleccionado no es una imagen PNG o JPEG válida.' }
  , '导入的图片没有可用内容。': { en: 'The imported image has no usable content.', ja: 'インポートした画像に使用可能な内容がありません。', ru: 'В импортированном изображении нет доступного содержимого.', es: 'La imagen importada no tiene contenido utilizable.' }
  , '要添加图片的页面不存在。': { en: 'The page selected for the image no longer exists.', ja: '画像を追加するページが存在しません。', ru: 'Страница для добавления изображения больше не существует.', es: 'La página seleccionada para la imagen ya no existe.' }
  , '图片位置或尺寸无效。': { en: 'The image position or size is invalid.', ja: '画像の位置またはサイズが無効です。', ru: 'Недопустимое положение или размер изображения.', es: 'La posición o el tamaño de la imagen no son válidos.' }
  , '管理页面…': { en: 'Manage Pages…', ja: 'ページを管理…', ru: 'Управление страницами…', es: 'Gestionar páginas…' }
  , '预览、调整顺序并批量删除页面。': { en: 'Preview, reorder, and remove pages in a batch.', ja: 'ページをプレビューし、並べ替えと一括削除を行います。', ru: 'Просматривайте, меняйте порядок и удаляйте страницы пакетно.', es: 'Previsualice, reordene y elimine páginas en lote.' }
  , '页面管理': { en: 'Manage Pages', ja: 'ページを管理', ru: 'Управление страницами', es: 'Gestionar páginas' }
  , '拖动缩略图调整顺序；勾选后可批量删除页面。': { en: 'Drag thumbnails to reorder pages; select pages to remove them in one batch.', ja: 'サムネイルをドラッグして並べ替え、選択したページをまとめて削除できます。', ru: 'Перетаскивайте миниатюры для сортировки и отмечайте страницы для пакетного удаления.', es: 'Arrastre miniaturas para reordenar y seleccione páginas para eliminarlas en lote.' }
  , '保留': { en: 'Keep', ja: '保持', ru: 'Оставить', es: 'Conservar' }
  , '标记当前页删除': { en: 'Mark Current Page for Removal', ja: '現在のページを削除対象にする', ru: 'Пометить текущую страницу для удаления', es: 'Marcar la página actual para eliminar' }
  , '清除删除标记': { en: 'Clear Removal Marks', ja: '削除マークをクリア', ru: 'Снять пометки удаления', es: 'Borrar marcas de eliminación' }
  , '拖动卡片可调整最终页面顺序': { en: 'Drag a card to set the final page order', ja: 'カードをドラッグして最終ページ順を設定', ru: 'Перетащите карточку, чтобы задать итоговый порядок страниц', es: 'Arrastre una tarjeta para establecer el orden final de las páginas' }
  , '页面预览与排序': { en: 'Page previews and order', ja: 'ページのプレビューと順序', ru: 'Предпросмотр и порядок страниц', es: 'Vistas previas y orden de páginas' }
  , '顺序': { en: 'Order', ja: '順序', ru: 'Порядок', es: 'Orden' }
  , '取消删除此页': { en: 'Keep this page', ja: 'このページを残す', ru: 'Оставить эту страницу', es: 'Conservar esta página' }
  , '标记删除此页': { en: 'Mark this page for removal', ja: 'このページを削除対象にする', ru: 'Пометить эту страницу для удаления', es: 'Marcar esta página para eliminar' }
  , '删除': { en: 'Remove', ja: '削除', ru: 'Удалить', es: 'Eliminar' }
  , '正在生成预览…': { en: 'Generating preview…', ja: 'プレビューを生成中…', ru: 'Создание предпросмотра…', es: 'Generando vista previa…' }
  , '原页面': { en: 'Original', ja: '元のページ', ru: 'Исходная', es: 'Original' }
  , '不能删除全部页面，请至少保留一页。': { en: 'You cannot remove every page. Keep at least one page.', ja: 'すべてのページを削除することはできません。少なくとも 1 ページ残してください。', ru: 'Нельзя удалить все страницы. Оставьте хотя бы одну страницу.', es: 'No puede eliminar todas las páginas. Conserve al menos una página.' }
  , '应用页面调整': { en: 'Apply Page Changes', ja: 'ページ変更を適用', ru: 'Применить изменения страниц', es: 'Aplicar cambios de páginas' }
  , '点击已添加图片重新编辑': { en: 'Click an added image to edit it again', ja: '追加した画像をクリックして再編集', ru: 'Щёлкните добавленное изображение, чтобы снова его изменить', es: 'Haga clic en una imagen añadida para editarla de nuevo' }
  , '正在编辑已添加图片': { en: 'Editing Added Image', ja: '追加した画像を編集中', ru: 'Редактирование добавленного изображения', es: 'Editando imagen añadida' }
  , '正在编辑已添加图片；可调整位置、尺寸、旋转和比例锁后确认': { en: 'Editing an added image. Adjust its position, size, rotation, and aspect lock, then confirm.', ja: '追加した画像を編集中です。位置・サイズ・回転・縦横比ロックを調整して確定してください。', ru: 'Редактирование добавленного изображения. Настройте положение, размер, поворот и блокировку пропорций, затем подтвердите.', es: 'Editando una imagen añadida. Ajuste la posición, el tamaño, la rotación y el bloqueo de proporciones, y luego confirme.' }
  , '编辑图片': { en: 'Edit Image', ja: '画像を編集', ru: 'Редактировать изображение', es: 'Editar imagen' }
  , '删除图片': { en: 'Delete Image', ja: '画像を削除', ru: 'Удалить изображение', es: 'Eliminar imagen' }
  , '确认更新图片': { en: 'Confirm Image Changes', ja: '画像の変更を確定', ru: 'Подтвердить изменения изображения', es: 'Confirmar cambios de imagen' }
  , '图片已更新；可保存 PDF 以保留修改': { en: 'Image updated. Save the PDF to keep the change.', ja: '画像を更新しました。変更を保持するには PDF を保存してください。', ru: 'Изображение обновлено. Сохраните PDF, чтобы сохранить изменения.', es: 'La imagen se actualizó. Guarde el PDF para conservar el cambio.' }
  , '图片已删除；可按 Ctrl/⌘Z 撤销': { en: 'Image deleted. Press Ctrl/⌘Z to undo.', ja: '画像を削除しました。Ctrl/⌘Z で元に戻せます。', ru: 'Изображение удалено. Нажмите Ctrl/⌘Z, чтобы отменить.', es: 'La imagen se eliminó. Pulse Ctrl/⌘Z para deshacer.' }
  , '页面已调整；可保存 PDF 以保留修改': { en: 'Pages updated. Save the PDF to keep the changes.', ja: 'ページを更新しました。変更を保持するには PDF を保存してください。', ru: 'Страницы обновлены. Сохраните PDF, чтобы сохранить изменения.', es: 'Las páginas se actualizaron. Guarde el PDF para conservar los cambios.' }
  , '找不到这张图片，它可能已经被删除。': { en: 'This image could not be found; it may already have been deleted.', ja: 'この画像が見つかりません。すでに削除された可能性があります。', ru: 'Не удалось найти это изображение: возможно, оно уже удалено.', es: 'No se encontró esta imagen; es posible que ya se haya eliminado.' }
  , '图片的可编辑数据已损坏。': { en: 'The image’s editable data is damaged.', ja: '画像の編集可能データが破損しています。', ru: 'Редактируемые данные изображения повреждены.', es: 'Los datos editables de la imagen están dañados.' }
  , '双倍': { en: 'Double', ja: '2 倍', ru: 'Двойной', es: 'Doble' }
  , '应用': { en: 'Apply', ja: '適用', ru: 'Применить', es: 'Aplicar' }
  , '段落': { en: 'Paragraph', ja: '段落', ru: 'Абзац', es: 'Párrafo' }
  , '段前': { en: 'Before', ja: '前', ru: 'Перед', es: 'Antes' }
  , '段后': { en: 'After', ja: '後', ru: 'После', es: 'Después' }
  , '字符': { en: 'Character', ja: '文字', ru: 'Символы', es: 'Carácter' }
  , '间距': { en: 'Spacing', ja: '間隔', ru: 'Интервал', es: 'Espaciado' }
  , '宽度': { en: 'Width', ja: '幅', ru: 'Ширина', es: 'Ancho' }
  , '可能是只读文件、正被其他程序占用，或所在文件夹禁止写入。': { en: 'The file may be read-only, in use by another application, or stored in a folder that does not allow writing.', ja: 'ファイルが読み取り専用、別のアプリで使用中、または保存先フォルダーへの書き込みが許可されていない可能性があります。', ru: 'Файл может быть доступен только для чтения, использоваться другой программой или находиться в папке без разрешения на запись.', es: 'Es posible que el archivo sea de solo lectura, que otra aplicación lo esté usando o que la carpeta no permita escribir.' }
  , '请选择其他位置另存，原文件不会被改动。': { en: 'Save to another location; the original file will not be changed.', ja: '別の場所に保存してください。元のファイルは変更されません。', ru: 'Сохраните в другом месте; исходный файл не будет изменён.', es: 'Guarde en otra ubicación; el archivo original no se modificará.' }
  , '查看引文：': { en: 'View citation: ', ja: '引用を表示: ', ru: 'Просмотреть цитату: ', es: 'Ver cita: ' }
  , '查看参考文献：': { en: 'View reference: ', ja: '参考文献を表示: ', ru: 'Просмотреть источник: ', es: 'Ver referencia: ' }
  , '确认关闭': { en: 'Close Anyway', ja: '閉じる', ru: 'Всё равно закрыть', es: 'Cerrar de todos modos' }
  , '未保存的修改': { en: 'Unsaved Changes', ja: '未保存の変更', ru: 'Несохранённые изменения', es: 'Cambios sin guardar' }
  , '显示语言': { en: 'Display Language', ja: '表示言語', ru: 'Язык отображения', es: 'Idioma de visualización' }
  , '选择 PDFuck 的显示语言。': { en: 'Choose the language PDFuck uses for its interface.', ja: 'PDFuck の表示言語を選択します。', ru: 'Выберите язык интерфейса PDFuck.', es: 'Elige el idioma de visualización de PDFuck.' }
  , '当前配色': { en: 'Current Palette', ja: 'ライト', ru: 'Светлая', es: 'Claro' }
  , '疑似表格': { en: 'Possible Table', ja: '表の可能性', ru: 'Возможная таблица', es: 'Posible tabla' }
  , '重复单词': { en: 'Repeated Word', ja: '単語の重複', ru: 'Повтор слова', es: 'Palabra repetida' }
  , '主谓一致': { en: 'Subject–Verb Agreement', ja: '主語と動詞の一致', ru: 'Согласование подлежащего и сказуемого', es: 'Concordancia entre sujeto y verbo' }
  , '微软雅黑': { en: 'Microsoft YaHei', ja: 'Microsoft YaHei', ru: 'Microsoft YaHei', es: 'Microsoft YaHei' }
  , '黑体': { en: 'SimHei', ja: 'SimHei', ru: 'SimHei', es: 'SimHei' }
  , '宋体': { en: 'SimSun', ja: 'SimSun', ru: 'SimSun', es: 'SimSun' }
  , '楷体': { en: 'KaiTi', ja: 'KaiTi', ru: 'KaiTi', es: 'KaiTi' }
  , '仿宋': { en: 'FangSong', ja: 'FangSong', ru: 'FangSong', es: 'FangSong' }
  , '系统打印失败。': { en: 'System printing failed.', ja: 'システム印刷に失敗しました。', ru: 'Не удалось выполнить системную печать.', es: 'Error de impresión del sistema.' }
  , '服务未返回详细原因': { en: 'The service did not provide details', ja: 'サービスから詳細な理由が返されませんでした', ru: 'Сервис не предоставил подробностей', es: 'El servicio no proporcionó detalles' }
  , '未命名.pdf': { en: 'Untitled.pdf', ja: '無題.pdf', ru: 'Без имени.pdf', es: 'Sin título.pdf' }
  , '[加密] ': { en: '[Encrypted] ', ja: '[暗号化] ', ru: '[Зашифровано] ', es: '[Cifrado] ' }
  , 'PDF 文件': { en: 'PDF Files', ja: 'PDF ファイル', ru: 'PDF-файлы', es: 'Archivos PDF' }
  , '可导入的文件': { en: 'Importable Files', ja: 'インポート可能なファイル', ru: 'Импортируемые файлы', es: 'Archivos importables' }
  , '选择要添加的图片': { en: 'Choose an Image to Add', ja: '追加する画像を選択', ru: 'Добавить изображение', es: 'Elegir imagen para añadir' }
  , '图片文件': { en: 'Image Files', ja: '画像ファイル', ru: 'Файлы изображений', es: 'Archivos de imagen' }
  , '导出': { en: 'Export', ja: 'エクスポート', ru: 'Экспорт', es: 'Exportar' }
  , '适合屏幕': { en: 'Fit Page', ja: 'ページ全体を表示', ru: 'Вписать страницу', es: 'Ajustar página' }
  , '在页面上增加页码': { en: 'Add Page Numbers', ja: 'ページ番号を追加', ru: 'Добавить номера страниц', es: 'Añadir números de página' }
  , '使用相对页边距，自动适配横向、纵向和不同尺寸的页面。': { en: 'Relative margins adapt automatically to portrait, landscape, and mixed page sizes.', ja: '相対余白により、縦向き・横向き・異なるページサイズに自動対応します。', ru: 'Относительные поля автоматически подстраиваются под книжные, альбомные страницы и разные размеры.', es: 'Los márgenes relativos se adaptan automáticamente a páginas verticales, horizontales y de distintos tamaños.' }
  , '已检测到页码': { en: 'Existing Page Numbers Found', ja: '既存のページ番号があります', ru: 'Обнаружены номера страниц', es: 'Se detectaron números de página' }
  , '页码内容': { en: 'Page Number Content', ja: 'ページ番号の内容', ru: 'Содержимое номера', es: 'Contenido del número' }
  , '仅页码': { en: 'Page Only', ja: 'ページ番号のみ', ru: 'Только номер', es: 'Solo página' }
  , '页码 + 总页数': { en: 'Page + Total', ja: 'ページ + 総ページ数', ru: 'Страница + всего', es: 'Página + total' }
  , '自定义模板': { en: 'Custom Template', ja: 'カスタムテンプレート', ru: 'Свой шаблон', es: 'Plantilla personalizada' }
  , '第 {page} 页，共 {total} 页': { en: 'Page {page} of {total}', ja: '{page} / {total} ページ', ru: 'Страница {page} из {total}', es: 'Página {page} de {total}' }
  , '页码与总页数分隔符': { en: 'Page/total separator', ja: 'ページと総数の区切り', ru: 'Разделитель страницы и итога', es: 'Separador de página y total' }
  , '模板': { en: 'Template', ja: 'テンプレート', ru: 'Шаблон', es: 'Plantilla' }
  , '可用占位符：{page} 当前页，{total} 总页数': { en: 'Tokens: {page} current page, {total} total pages', ja: '使用可能: {page} 現在のページ、{total} 総ページ数', ru: 'Метки: {page} текущая страница, {total} всего страниц', es: 'Campos: {page} página actual, {total} total de páginas' }
  , '页码模板不能为空。': { en: 'The page-number template cannot be empty.', ja: 'ページ番号テンプレートは空にできません。', ru: 'Шаблон номера страницы не может быть пустым.', es: 'La plantilla del número de página no puede estar vacía.' }
  , '页码模板必须包含 {page}。': { en: 'The template must contain {page}.', ja: 'テンプレートには {page} が必要です。', ru: 'Шаблон должен содержать {page}.', es: 'La plantilla debe contener {page}.' }
  , '页码模板不能超过 120 个字符。': { en: 'The template cannot exceed 120 characters.', ja: 'テンプレートは 120 文字以内にしてください。', ru: 'Шаблон не может быть длиннее 120 символов.', es: 'La plantilla no puede superar 120 caracteres.' }
  , '页码模板只能使用单行文字。': { en: 'The template must be a single line.', ja: 'テンプレートは 1 行にしてください。', ru: 'Шаблон должен состоять из одной строки.', es: 'La plantilla debe tener una sola línea.' }
  , '仅支持 {page} 和 {total} 两个占位符。': { en: 'Only the {page} and {total} tokens are supported.', ja: '{page} と {total} のみ使用できます。', ru: 'Поддерживаются только метки {page} и {total}.', es: 'Solo se admiten los campos {page} y {total}.' }
  , '字体与样式': { en: 'Font & Style', ja: 'フォントとスタイル', ru: 'Шрифт и стиль', es: 'Fuente y estilo' }
  , '原文字体': { en: 'Original font', ja: '元のフォント', ru: 'Исходный шрифт', es: 'Fuente original' }
  , '位置': { en: 'Position', ja: '位置', ru: 'Положение', es: 'Posición' }
  , '水平对齐': { en: 'Horizontal Alignment', ja: '横位置', ru: 'Горизонтальное выравнивание', es: 'Alineación horizontal' }
  , '居左': { en: 'Left', ja: '左', ru: 'Слева', es: 'Izquierda' }
  , '居右': { en: 'Right', ja: '右', ru: 'Справа', es: 'Derecha' }
  , '垂直位置': { en: 'Vertical Position', ja: '縦位置', ru: 'Вертикальное положение', es: 'Posición vertical' }
  , '页面顶部': { en: 'Page Top', ja: 'ページ上部', ru: 'Вверху страницы', es: 'Parte superior' }
  , '页面底部': { en: 'Page Bottom', ja: 'ページ下部', ru: 'Внизу страницы', es: 'Parte inferior' }
  , '距页面边缘': { en: 'Distance from Edge', ja: '端からの距離', ru: 'Отступ от края', es: 'Distancia al borde' }
  , '左右安全边距': { en: 'Side Safe Margin', ja: '左右の安全余白', ru: 'Боковые безопасные поля', es: 'Margen lateral seguro' }
  , '实时预览': { en: 'Live Preview', ja: 'ライブプレビュー', ru: 'Предпросмотр', es: 'Vista previa' }
  , '删除已添加的页码': { en: 'Remove Existing Page Numbers', ja: '追加済みページ番号を削除', ru: 'Удалить добавленные номера', es: 'Eliminar números añadidos' }
  , '更新页码': { en: 'Update Page Numbers', ja: 'ページ番号を更新', ru: 'Обновить номера', es: 'Actualizar números' }
  , '添加页码': { en: 'Add Page Numbers', ja: 'ページ番号を追加', ru: 'Добавить номера', es: 'Añadir números' }
  , '在全部页面添加可自定义、可删除的页码。': { en: 'Add customizable, removable page numbers to every page.', ja: '全ページにカスタマイズ可能で削除できるページ番号を追加します。', ru: 'Добавить на все страницы настраиваемые номера, которые можно удалить.', es: 'Añade a todas las páginas números personalizables que se pueden eliminar.' }
  , '文档没有可添加页码的页面。': { en: 'The document has no pages to number.', ja: '番号を付けるページがありません。', ru: 'В документе нет страниц для нумерации.', es: 'El documento no tiene páginas que numerar.' }
  , '页码已添加到全部页面，可按 Ctrl/⌘Z 撤销': { en: 'Page numbers added to every page. Press Ctrl/⌘Z to undo.', ja: '全ページに番号を追加しました。Ctrl/⌘Z で元に戻せます。', ru: 'Номера добавлены на все страницы. Ctrl/⌘Z — отменить.', es: 'Se añadieron números a todas las páginas. Ctrl/⌘Z para deshacer.' }
  , '已删除添加的页码，可按 Ctrl/⌘Z 撤销': { en: 'Added page numbers removed. Press Ctrl/⌘Z to undo.', ja: '追加したページ番号を削除しました。Ctrl/⌘Z で元に戻せます。', ru: 'Добавленные номера удалены. Ctrl/⌘Z — отменить.', es: 'Se eliminaron los números añadidos. Ctrl/⌘Z para deshacer.' }
  , '打印设置与预览': { en: 'Print Settings & Preview', ja: '印刷設定とプレビュー', ru: 'Настройки и предпросмотр печати', es: 'Configuración y vista previa de impresión' }
  , '自动': { en: 'Auto', ja: '自動', ru: 'Авто', es: 'Automático' }
  , '自动适应': { en: 'Auto Fit', ja: '自動調整', ru: 'Автовыбор', es: 'Adaptación automática' }
  , '每张纸会根据其中的页面自动选择方向': { en: 'Each sheet chooses its orientation from the pages it contains.', ja: '各用紙の内容に合わせて方向を自動選択します。', ru: 'Ориентация каждого листа выбирается по размещённым на нём страницам.', es: 'Cada hoja elige la orientación según las páginas que contiene.' }
  , '方向已按当前纸张内容自动适配': { en: 'Orientation is adapted to the current sheet contents.', ja: '現在の用紙内容に合わせて方向を自動調整しました。', ru: 'Ориентация адаптирована к содержимому текущего листа.', es: 'La orientación se adapta al contenido de la hoja actual.' }
  , '预览生成失败': { en: 'Preview unavailable', ja: 'プレビューを生成できません', ru: 'Предпросмотр недоступен', es: 'Vista previa no disponible' }
  , '系统未找到可用打印机。': { en: 'No available printer was found.', ja: '利用可能なプリンターが見つかりません。', ru: 'Доступные принтеры не найдены.', es: 'No se encontró ninguna impresora disponible.' }
  , '打印机': { en: 'Printer', ja: 'プリンター', ru: 'Принтер', es: 'Impresora' }
  , '刷新打印机': { en: 'Refresh printers', ja: 'プリンターを更新', ru: 'Обновить список принтеров', es: 'Actualizar impresoras' }
  , '正在查找打印机…': { en: 'Finding printers…', ja: 'プリンターを検索しています…', ru: 'Поиск принтеров…', es: 'Buscando impresoras…' }
  , '未找到可用打印机': { en: 'No available printers found', ja: '利用可能なプリンターがありません', ru: 'Доступные принтеры не найдены', es: 'No se encontraron impresoras disponibles' }
  , '默认打印机': { en: 'Default', ja: '既定', ru: 'По умолчанию', es: 'Predeterminada' }
  , 'PDFuck 将把当前设置直接发送到所选打印机': { en: 'PDFuck sends these settings directly to the selected printer.', ja: 'PDFuck はこの設定を選択したプリンターへ直接送信します。', ru: 'PDFuck отправит эти настройки непосредственно на выбранный принтер.', es: 'PDFuck envía estos ajustes directamente a la impresora seleccionada.' }
  , '长边翻页适合书本装订，短边翻页适合日历装订': { en: 'Long edge is for book binding; short edge is for calendar binding.', ja: '長辺とじは本、短辺とじはカレンダー向けです。', ru: 'Переворот по длинному краю — для книг, по короткому — для календарей.', es: 'El borde largo es para libros; el corto, para calendarios.' }
  , '发送到打印机': { en: 'Send to Printer', ja: 'プリンターへ送信', ru: 'Отправить на принтер', es: 'Enviar a la impresora' }
  , '打印机列表加载失败，请重试。': { en: 'Could not load the printer list. Please try again.', ja: 'プリンター一覧を読み込めませんでした。もう一度お試しください。', ru: 'Не удалось загрузить список принтеров. Повторите попытку.', es: 'No se pudo cargar la lista de impresoras. Inténtalo de nuevo.' }
  , '打印设置无效。': { en: 'The print settings are invalid.', ja: '印刷設定が無効です。', ru: 'Недопустимые настройки печати.', es: 'Los ajustes de impresión no son válidos.' }
  , '请选择可用的打印机。': { en: 'Select an available printer.', ja: '利用可能なプリンターを選択してください。', ru: 'Выберите доступный принтер.', es: 'Selecciona una impresora disponible.' }
  , '已有打印任务正在派发，请稍候。': { en: 'A print job is already being dispatched. Please wait.', ja: '印刷ジョブを送信中です。しばらくお待ちください。', ru: 'Задание печати уже отправляется. Подождите.', es: 'Ya se está enviando un trabajo de impresión. Espera.' }
  , '所选打印机不可用，请刷新后重试。': { en: 'The selected printer is unavailable. Refresh the list and try again.', ja: '選択したプリンターは利用できません。一覧を更新して再試行してください。', ru: 'Выбранный принтер недоступен. Обновите список и повторите попытку.', es: 'La impresora seleccionada no está disponible. Actualiza la lista e inténtalo de nuevo.' }
  , '打印内容加载失败，请重试。': { en: 'The print content could not be loaded. Please try again.', ja: '印刷内容を読み込めませんでした。もう一度お試しください。', ru: 'Не удалось загрузить содержимое для печати. Повторите попытку.', es: 'No se pudo cargar el contenido de impresión. Inténtalo de nuevo.' }
  , '打印机未能接收任务，请检查连接和纸张设置。': { en: 'The printer could not receive the job. Check its connection and paper settings.', ja: 'プリンターがジョブを受信できませんでした。接続と用紙設定を確認してください。', ru: 'Принтер не смог принять задание. Проверьте подключение и настройки бумаги.', es: 'La impresora no pudo recibir el trabajo. Comprueba la conexión y los ajustes de papel.' }
  , '所选打印机不支持双面打印。': { en: 'The selected printer does not support duplex printing.', ja: '選択したプリンターは両面印刷に対応していません。', ru: 'Выбранный принтер не поддерживает двустороннюю печать.', es: 'La impresora seleccionada no admite impresión a doble cara.' }
  , '原生打印任务派发失败，请检查打印机连接、纸张与双面打印设置。': { en: 'The native print job could not be dispatched. Check the printer connection, paper, and duplex settings.', ja: 'ネイティブ印刷ジョブを送信できませんでした。プリンターの接続、用紙、両面印刷設定を確認してください。', ru: 'Не удалось отправить нативное задание печати. Проверьте подключение, бумагу и настройки двусторонней печати.', es: 'No se pudo enviar el trabajo de impresión nativo. Comprueba la conexión, el papel y la configuración dúplex.' }
  , '此打印机未报告双面打印能力': { en: 'This printer does not report duplex capability.', ja: 'このプリンターは両面印刷機能を報告していません。', ru: 'Этот принтер не сообщает о поддержке двусторонней печати.', es: 'Esta impresora no informa de capacidad dúplex.' }
  , '打印机未提供双面能力信息；仍会按所选方式提交': { en: 'Duplex capability is unknown; the selected mode will still be submitted.', ja: '両面印刷機能は不明ですが、選択した方式で送信します。', ru: 'Поддержка двусторонней печати неизвестна; будет отправлен выбранный режим.', es: 'Se desconoce la capacidad dúplex; se enviará el modo seleccionado.' }
  , '打印缩放比例': { en: 'Print Scale', ja: '印刷倍率', ru: 'Масштаб печати', es: 'Escala de impresión' }
  , '打印缩放滑块': { en: 'Print scale slider', ja: '印刷倍率スライダー', ru: 'Ползунок масштаба печати', es: 'Control de escala de impresión' }
  , '100% 为适合纸张；放大时页面边缘可能被裁切': { en: '100% fits the paper; enlarging may crop page edges.', ja: '100% は用紙に合わせます。拡大するとページ端が切れる場合があります。', ru: '100% вписывает страницу в лист; при увеличении края могут обрезаться.', es: '100% ajusta al papel; al ampliar pueden recortarse los bordes.' }
  , '最终打印作业预览': { en: 'Final print job preview', ja: '最終印刷ジョブのプレビュー', ru: 'Предпросмотр итогового задания печати', es: 'Vista previa del trabajo de impresión final' }
  , '正在生成高清预览': { en: 'Generating high-resolution preview', ja: '高解像度プレビューを生成中', ru: 'Создание предпросмотра высокого разрешения', es: 'Generando vista previa de alta resolución' }
}

for (const [phrase, translations] of Object.entries(phraseTranslations)) {
  localePhrases.ja[phrase] = translations.ja
  localePhrases.ru[phrase] = translations.ru
  localePhrases.es[phrase] = translations.es
  englishPhrases[phrase] = translations.en
}

export function translateCataloguePhrase(language: InterfaceLanguage, source: string): string {
  if (language === 'zh') return source
  if (language === 'en') {
    const translated = englishPhrases[source]
    if (translated) return translated
  } else {
    const translated = localePhrases[language][source]
    if (translated) return translated
  }
  throw new Error(`Missing ${language} interface translation: ${source}`)
}

export function hasCataloguePhrase(source: string): boolean {
  return Object.prototype.hasOwnProperty.call(englishPhrases, source)
}

interface StatusTemplates {
  failed: string
  saved: string
  copied: string
  preparingPrint: string
  sentPrint: string
  preparingExport: string
  exportedPdf: string
  exportedPdfs: string
  exportedFiles: string
  exporting: string
  selected: string
  deletedPages: string
  annotationAdded: string
  annotationsAdded: string
  annotationsDeleted: string
  replied: string
  requestFailed: string
}

const statusTemplates: Record<Exclude<InterfaceLanguage, 'zh'>, StatusTemplates> = {
  en: {
    failed: 'Action failed: ', saved: 'Saved · ', copied: 'Copied $1 characters · line breaks removed', preparingPrint: 'Preparing to print $1 pages…', sentPrint: 'Sent $1 pages to the printer', preparingExport: 'Preparing to export $1 pages…', exportedPdf: 'Exported $1 PDF pages as one file · ', exportedPdfs: 'Exported $1 PDF files · ', exportedFiles: 'Exported $1 files · ', exporting: 'Exporting $1/$2 · original page $3…', selected: 'Selected: ', deletedPages: 'Deleted $1 pages', annotationAdded: '$1 added', annotationsAdded: 'Added $2 on $1 pages', annotationsDeleted: 'Deleted $1 annotations. Press Ctrl/⌘Z to undo.', replied: 'Replied: ', requestFailed: 'Request failed ($1): '
  },
  ja: {
    failed: '操作に失敗しました: ', saved: '保存済み · ', copied: '$1 文字をコピーし、改行を削除しました', preparingPrint: '$1 ページを印刷用に準備中…', sentPrint: '$1 ページをプリンターに送信しました', preparingExport: '$1 ページをエクスポート用に準備中…', exportedPdf: '$1 ページを 1 つの PDF としてエクスポートしました · ', exportedPdfs: '$1 個の PDF ファイルをエクスポートしました · ', exportedFiles: '$1 個のファイルをエクスポートしました · ', exporting: '$1/$2 をエクスポート中・元の文書の $3 ページ…', selected: '選択: ', deletedPages: '$1 ページを削除しました', annotationAdded: '$1を追加しました', annotationsAdded: '$1 ページに $2 を追加しました', annotationsDeleted: '$1 件の注釈を削除しました。Ctrl/⌘Z で元に戻せます。', replied: '返信: ', requestFailed: 'リクエストに失敗しました（$1）：'
  },
  ru: {
    failed: 'Сбой операции: ', saved: 'Сохранено · ', copied: 'Скопировано символов: $1 · переносы строк удалены', preparingPrint: 'Подготовка к печати: $1 стр.…', sentPrint: 'На принтер отправлено страниц: $1', preparingExport: 'Подготовка к экспорту: $1 стр.…', exportedPdf: 'Экспортировано $1 страниц в один PDF · ', exportedPdfs: 'Экспортировано PDF-файлов: $1 · ', exportedFiles: 'Экспортировано файлов: $1 · ', exporting: 'Экспорт $1/$2 · исходная страница $3…', selected: 'Выбрано: ', deletedPages: 'Удалено страниц: $1', annotationAdded: '$1 добавлено', annotationsAdded: 'Добавлено $2 на $1 стр.', annotationsDeleted: 'Удалено аннотаций: $1. Нажмите Ctrl/⌘Z, чтобы отменить.', replied: 'Ответ: ', requestFailed: 'Ошибка запроса ($1): '
  },
  es: {
    failed: 'Error de operación: ', saved: 'Guardado · ', copied: '$1 caracteres copiados · saltos de línea eliminados', preparingPrint: 'Preparando impresión de $1 páginas…', sentPrint: 'Se enviaron $1 páginas a la impresora', preparingExport: 'Preparando exportación de $1 páginas…', exportedPdf: 'Se exportaron $1 páginas en un PDF · ', exportedPdfs: 'Se exportaron $1 archivos PDF · ', exportedFiles: 'Se exportaron $1 archivos · ', exporting: 'Exportando $1/$2 · página original $3…', selected: 'Seleccionado: ', deletedPages: 'Se eliminaron $1 páginas', annotationAdded: 'Se añadió $1', annotationsAdded: 'Se añadió $2 en $1 páginas', annotationsDeleted: 'Se eliminaron $1 anotaciones. Pulse Ctrl/⌘Z para deshacer.', replied: 'Respondido: ', requestFailed: 'La solicitud falló ($1): '
  }
}

/** Translate status strings kept in document session state without touching user or PDF text. */
export function translateStoredUiText(language: InterfaceLanguage, value: string): string {
  if (language === 'zh') return value
  const translate = (source: string) => translateCataloguePhrase(language, source)
  if (hasCataloguePhrase(value)) return translate(value)
  const status = statusTemplates[language]
  const failed = value.match(/^操作失败：([\s\S]+)$/u)
  if (failed) return `${status.failed}${translateStoredUiText(language, failed[1] || '')}`
  const requestFailed = value.match(/^请求失败（([^）]+)）：([\s\S]+)$/u)
  if (requestFailed) return `${status.requestFailed.replace('$1', requestFailed[1] || '')}${translateStoredUiText(language, requestFailed[2] || '')}`
  const annotationsAdded = value.match(/^已在 (\d+) 页添加(.+)$/u)
  if (annotationsAdded) return status.annotationsAdded.replace('$1', annotationsAdded[1] || '').replace('$2', translateStoredUiText(language, annotationsAdded[2] || ''))
  const filesMerged = value.match(/^已合并 (\d+) 个文件；请确认页面顺序$/u)
  if (filesMerged) return translate('已合并 {count} 个文件；请确认页面顺序').replace('{count}', filesMerged[1] || '')
  const newMergedDocument = value.match(/^已新建合并文档并导入 (\d+) 个文件；请确认页面顺序$/u)
  if (newMergedDocument) return translate('已新建合并文档并导入 {count} 个文件；请确认页面顺序').replace('{count}', newMergedDocument[1] || '')
  const createdMergedDocument = value.match(/^已创建合并文档，已导入 (\d+) 个文件$/u)
  if (createdMergedDocument) return translate('已创建合并文档，已导入 {count} 个文件').replace('{count}', createdMergedDocument[1] || '')
  const mergeComplete = value.match(/^已合并 (\d+) 个文件$/u)
  if (mergeComplete) return translate('已合并 {count} 个文件').replace('{count}', mergeComplete[1] || '')
  const annotationAdded = value.match(/^(.+)已添加$/u)
  if (annotationAdded) return status.annotationAdded.replace('$1', translateStoredUiText(language, annotationAdded[1] || ''))
  const annotationsDeleted = value.match(/^已删除 (\d+) 条批注，可按 Ctrl\/⌘Z 撤销$/u)
  if (annotationsDeleted) return status.annotationsDeleted.replace('$1', annotationsDeleted[1] || '')
  const replied = value.match(/^已回复：([\s\S]+)$/u)
  if (replied) return `${status.replied}${translateStoredUiText(language, replied[1] || '')}`
  if (value.includes(' · ')) {
    const chunks = value.split(' · ')
    const localized = chunks.map((chunk) => hasCataloguePhrase(chunk) ? translate(chunk) : chunk)
    if (localized.some((chunk, index) => chunk !== chunks[index])) return localized.join(' · ')
  }
  return value
    .replace(/^操作失败：/, status.failed)
    .replace(/^已保存 · /, status.saved)
    .replace(/^已复制 (\d+) 个字符 · 已自动去除回行$/, status.copied)
    .replace(/^正在准备打印 (\d+) 页…$/, status.preparingPrint)
    .replace(/^已发送 (\d+) 页到打印机$/, status.sentPrint)
    .replace(/^正在准备导出 (\d+) 页…$/, status.preparingExport)
    .replace(/^已合并导出 (\d+) 页 PDF · /, status.exportedPdf)
    .replace(/^已导出 (\d+) 个 PDF 文件 · /, status.exportedPdfs)
    .replace(/^已导出 (\d+) 个文件 · /, status.exportedFiles)
    .replace(/^正在导出 (\d+)\/(\d+) · 原文档第 (\d+) 页…$/, status.exporting)
    .replace(/^已选择：/, status.selected)
    .replace(/^已删除 (\d+) 个页面$/, status.deletedPages)
}

export const parameterMessages = {
  zh: {
    'page.selected': '已选择 {count} 页', 'page.count': '{count} 页', 'page.action': '{action}所选 {count} 页', 'page.print': '打印', 'page.export': '导出',
    'print.overview': '{pages} 个文档页面 · {sheets} 张纸', 'print.layout': '{pages} 页将使用 {sheets} 张纸', 'print.perSheet': '{count} 页/张', 'print.onePerSheet': '1 页/张', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': '已选 {count}', 'annotation.current': '当前批注',
    'crop.label': '裁切区域', 'crop.confirm': '确认范围', 'crop.confirmMessage': '将当前页面裁切为框选区域？',
    'theme.set': '设置{label}', 'theme.dialog': '{label}颜色面板', 'theme.close': '关闭{label}颜色面板', 'theme.hex': '{label} HEX 色值',
    'close.app': '有 {count} 个文档包含未保存的修改，确定关闭 PDFuck 吗？', 'close.document': '{name} 有未保存的修改，确定关闭这个文档标签吗？',
    'page.deleteSummary': '将删除 {remove} 页，保留 {keep} 页。', 'page.rangeInvalid': '无法识别：{value}', 'page.selectForAction': '请至少选择一页进行{action}', 'page.preview': '第 {page} 页预览', 'page.managerSummary': '将保留 {count} 页，页面顺序和删除操作将一次性应用。', 'page.managerDisplay': '显示方式', 'page.managerThumbnails': '缩略图', 'page.managerCompact': '紧凑列表', 'page.managerPreviousGroup': '上一组页面', 'page.managerNextGroup': '下一组页面', 'page.managerRange': '显示第 {start}-{end} 页，共 {count} 页', 'page.managerJump': '跳至原页', 'page.managerJumpPlaceholder': '原页码', 'page.managerJumpAction': '跳转', 'page.managerPerformanceHint': '大文档默认使用紧凑列表；缩略图仅为当前组按需生成。', 'page.managerDragHandle': '拖动第 {position} 位页面以调整顺序', 'page.managerOriginal': '原页面 {page}',
    'page.managerTitle': '页面管理', 'page.managerDescription': '拖动页面调整顺序，选择页面批量删除；所有更改将在确认后一起应用。', 'page.managerStatus': '页面调整概况', 'page.managerTotal': '总页数', 'page.managerRemoveCount': '待删除', 'page.managerRemaining': '将保留', 'page.managerClose': '关闭页面管理',
    'page.managerMarkCurrent': '标记当前页删除', 'page.managerClearRemoval': '清除删除标记', 'page.managerReset': '重置全部调整', 'page.managerGroup': '第 {current}/{count} 组', 'page.managerStoryboard': '页面故事板', 'page.managerOnDemandHint': '每组按需生成 {count} 页预览，切换组时自动释放上一组。', 'page.managerDragHint': '拖动排序 · 点击查看大图', 'page.managerPosition': '位置 {position}',
    'page.managerRestorePage': '取消删除此页', 'page.managerRemovePage': '删除此页', 'page.managerGeneratingPreview': '正在生成预览…', 'page.managerOriginalShort': '原 {page}', 'page.managerCurrentBadge': '当前页', 'page.managerMarkedForRemoval': '待删除', 'page.managerInspector': '页面详情', 'page.managerFocusedPage': '第 {position} 位',
    'page.managerFinalPosition': '最终位置', 'page.managerOriginalPage': '原始页码', 'page.managerMoveTo': '移至指定位置', 'page.managerMoveAction': '移动', 'page.managerMoveHint': '输入 1 到 {count} 之间的位置，可跨组移动。', 'page.managerKeyboardHint': '聚焦拖动条后，可使用方向键逐页移动。', 'page.managerDraggingPage': '正在移动原页面 {page}',
    'page.managerInvalid': '不能删除全部页面', 'page.managerInvalidHint': '请至少保留一页后再应用。', 'page.managerSummaryChanged': '将保留 {keep} 页，删除 {remove} 页', 'page.managerSummaryClean': '尚未进行页面调整', 'page.managerReordered': '页面顺序已调整；删除与排序会同时应用。', 'page.managerReady': '拖动页面排序，或选择不需要的页面。', 'page.managerCancel': '取消', 'page.managerApply': '应用页面调整',
    'search.results': '找到 {count} 个结果', 'search.page': '第 {page} 页', 'insight.items': '{count} 项', 'insight.page': '第 {page} 页 · {label}', 'footer.page': '{pages} 页 · 第 {page} 页',
    'annotation.count': '{count} 条批注', 'annotation.pageLabel': '第 {page} 页批注', 'annotation.settings': '设置第 {page} 页批注', 'annotation.jumpToFirst': '跳转到第一条{status}批注', 'annotation.noneForStatus': '没有{status}批注', 'annotation.delete': '删除批注', 'annotation.deleteMany': '删除 {count} 条批注', 'annotation.replyTitle': '{label}：{content}'
    , 'update.availableTitle': '发现新版本 {version}', 'update.description': '你正在使用 {current}。新版安装包已经发布，可前往 GitHub Releases 下载。', 'update.current': '当前版本 {version}', 'update.latest': '最新版本 {version}', 'pageNumbers.existing': '文档中已有 {count} 个由 PDFuck 添加的页码对象；应用新设置会整体替换。'
  },
  en: {
    'page.selected': '{count} pages selected', 'page.count': '{count} pages', 'page.action': '{action} Selected {count} Pages', 'page.print': 'Print', 'page.export': 'Export',
    'print.overview': '{pages} document pages · {sheets} sheets', 'print.layout': '{pages} pages will use {sheets} sheets', 'print.perSheet': '{count} pages/sheet', 'print.onePerSheet': '1 page/sheet', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': '{count} selected', 'annotation.current': 'Current Annotation',
    'crop.label': 'Crop Area', 'crop.confirm': 'Confirm Area', 'crop.confirmMessage': 'Crop the current page to the selected area?',
    'theme.set': 'Set {label}', 'theme.dialog': '{label} Color Picker', 'theme.close': 'Close {label} Color Picker', 'theme.hex': '{label} HEX value',
    'close.app': '{count} document(s) have unsaved changes. Close PDFuck?', 'close.document': '{name} has unsaved changes. Close this document tab?',
    'page.deleteSummary': 'Delete {remove} pages and keep {keep} pages.', 'page.rangeInvalid': 'Unrecognized: {value}', 'page.selectForAction': 'Select at least one page to {action}', 'page.preview': 'Preview of page {page}', 'page.managerSummary': 'Will keep {count} page(s); reordering and removal are applied together.', 'page.managerDisplay': 'Display', 'page.managerThumbnails': 'Thumbnails', 'page.managerCompact': 'Compact List', 'page.managerPreviousGroup': 'Previous Page Group', 'page.managerNextGroup': 'Next Page Group', 'page.managerRange': 'Showing pages {start}-{end} of {count}', 'page.managerJump': 'Go to Original', 'page.managerJumpPlaceholder': 'Original page', 'page.managerJumpAction': 'Go', 'page.managerPerformanceHint': 'Large documents open in Compact List; thumbnails are generated only for the current group.', 'page.managerDragHandle': 'Drag page at position {position} to reorder', 'page.managerOriginal': 'Original page {page}',
    'page.managerTitle': 'Manage Pages', 'page.managerDescription': 'Drag pages to reorder them or select several to remove. All changes are applied together after confirmation.', 'page.managerStatus': 'Page change summary', 'page.managerTotal': 'Total', 'page.managerRemoveCount': 'Remove', 'page.managerRemaining': 'Remaining', 'page.managerClose': 'Close page manager',
    'page.managerMarkCurrent': 'Remove Current Page', 'page.managerClearRemoval': 'Clear Removal Marks', 'page.managerReset': 'Reset All Changes', 'page.managerGroup': 'Group {current} of {count}', 'page.managerStoryboard': 'Page Storyboard', 'page.managerOnDemandHint': 'Previews are generated for {count} pages at a time and the previous group is released.', 'page.managerDragHint': 'Drag to reorder · Click for large preview', 'page.managerPosition': 'Position {position}',
    'page.managerRestorePage': 'Keep This Page', 'page.managerRemovePage': 'Remove This Page', 'page.managerGeneratingPreview': 'Generating preview…', 'page.managerOriginalShort': 'Original {page}', 'page.managerCurrentBadge': 'Current Page', 'page.managerMarkedForRemoval': 'Will be removed', 'page.managerInspector': 'Page Details', 'page.managerFocusedPage': 'Position {position}',
    'page.managerFinalPosition': 'Final position', 'page.managerOriginalPage': 'Original page', 'page.managerMoveTo': 'Move to position', 'page.managerMoveAction': 'Move', 'page.managerMoveHint': 'Enter a position from 1 to {count} to move across groups.', 'page.managerKeyboardHint': 'Focus a drag bar and use the arrow keys to move one page at a time.', 'page.managerDraggingPage': 'Moving original page {page}',
    'page.managerInvalid': 'Every page cannot be removed', 'page.managerInvalidHint': 'Keep at least one page before applying changes.', 'page.managerSummaryChanged': 'Keep {keep} pages and remove {remove}', 'page.managerSummaryClean': 'No page changes yet', 'page.managerReordered': 'Page order changed; reordering and removal will be applied together.', 'page.managerReady': 'Drag pages to reorder, or select pages you no longer need.', 'page.managerCancel': 'Cancel', 'page.managerApply': 'Apply Page Changes',
    'search.results': '{count} results found', 'search.page': 'Page {page}', 'insight.items': '{count} items', 'insight.page': 'Page {page} · {label}', 'footer.page': '{pages} pages · Page {page}',
    'annotation.count': '{count} annotations', 'annotation.pageLabel': 'Annotation on page {page}', 'annotation.settings': 'Configure annotation on page {page}', 'annotation.jumpToFirst': 'Jump to the first {status} annotation', 'annotation.noneForStatus': 'No {status} annotations', 'annotation.delete': 'Delete Annotation', 'annotation.deleteMany': 'Delete {count} Annotations', 'annotation.replyTitle': '{label}: {content}'
    , 'update.availableTitle': 'Version {version} is available', 'update.description': 'You are using {current}. The new installer is available on GitHub Releases.', 'update.current': 'Current version {version}', 'update.latest': 'Latest version {version}', 'pageNumbers.existing': '{count} page-number objects added by PDFuck already exist; applying new settings replaces the full set.'
  },
  ja: {
    'page.selected': '{count} ページを選択', 'page.count': '{count} ページ', 'page.action': '選択した {count} ページを{action}', 'page.print': '印刷', 'page.export': 'エクスポート',
    'print.overview': '文書 {pages} ページ・用紙 {sheets} 枚', 'print.layout': '{pages} ページを {sheets} 枚の用紙に印刷', 'print.perSheet': '1 枚に {count} ページ', 'print.onePerSheet': '1 枚に 1 ページ', 'print.summary': '{size}・{orientation}・{duplex}',
    'annotation.selected': '{count} 件を選択', 'annotation.current': '現在の注釈', 'crop.label': 'トリミング範囲', 'crop.confirm': '範囲を確定', 'crop.confirmMessage': '現在のページを選択範囲にトリミングしますか？',
    'theme.set': '{label}を設定', 'theme.dialog': '{label}のカラーピッカー', 'theme.close': '{label}のカラーピッカーを閉じる', 'theme.hex': '{label} の HEX 値',
    'close.app': '未保存の変更がある文書が {count} 件あります。PDFuck を閉じますか？', 'close.document': '{name} には未保存の変更があります。この文書タブを閉じますか？',
    'page.deleteSummary': '{remove} ページを削除し、{keep} ページを保持します。', 'page.rangeInvalid': '認識できません: {value}', 'page.selectForAction': '{action}するには少なくとも 1 ページを選択してください', 'page.preview': '{page} ページのプレビュー', 'page.managerSummary': '{count} ページを保持します。並べ替えと削除はまとめて適用されます。', 'page.managerDisplay': '表示', 'page.managerThumbnails': 'サムネイル', 'page.managerCompact': 'コンパクト一覧', 'page.managerPreviousGroup': '前のページ群', 'page.managerNextGroup': '次のページ群', 'page.managerRange': '{count} ページ中 {start}-{end} ページを表示', 'page.managerJump': '元のページへ', 'page.managerJumpPlaceholder': '元のページ番号', 'page.managerJumpAction': '移動', 'page.managerPerformanceHint': '大きな文書はコンパクト一覧で開きます。サムネイルは現在のグループだけ生成されます。', 'page.managerDragHandle': '{position} 番目のページをドラッグして並べ替え', 'page.managerOriginal': '元のページ {page}',
    'page.managerTitle': 'ページを管理', 'page.managerDescription': 'ページをドラッグして並べ替え、複数選択して削除できます。変更は確定後にまとめて適用されます。', 'page.managerStatus': 'ページ変更の概要', 'page.managerTotal': '総数', 'page.managerRemoveCount': '削除予定', 'page.managerRemaining': '保持', 'page.managerClose': 'ページ管理を閉じる',
    'page.managerMarkCurrent': '現在のページを削除', 'page.managerClearRemoval': '削除マークを解除', 'page.managerReset': 'すべてリセット', 'page.managerGroup': '{current}/{count} グループ', 'page.managerStoryboard': 'ページストーリーボード', 'page.managerOnDemandHint': '{count} ページずつプレビューを生成し、前のグループは解放します。', 'page.managerDragHint': 'ドラッグで並べ替え・クリックで拡大', 'page.managerPosition': '位置 {position}',
    'page.managerRestorePage': 'このページを保持', 'page.managerRemovePage': 'このページを削除', 'page.managerGeneratingPreview': 'プレビューを生成中…', 'page.managerOriginalShort': '元 {page}', 'page.managerCurrentBadge': '現在のページ', 'page.managerMarkedForRemoval': '削除予定', 'page.managerInspector': 'ページ詳細', 'page.managerFocusedPage': '{position} 番目',
    'page.managerFinalPosition': '最終位置', 'page.managerOriginalPage': '元のページ番号', 'page.managerMoveTo': '指定位置へ移動', 'page.managerMoveAction': '移動', 'page.managerMoveHint': '1 から {count} の位置を入力するとグループをまたいで移動できます。', 'page.managerKeyboardHint': 'ドラッグバーにフォーカスし、矢印キーで 1 ページずつ移動できます。', 'page.managerDraggingPage': '元のページ {page} を移動中',
    'page.managerInvalid': 'すべてのページは削除できません', 'page.managerInvalidHint': '適用する前に少なくとも 1 ページ残してください。', 'page.managerSummaryChanged': '{keep} ページを保持し、{remove} ページを削除', 'page.managerSummaryClean': 'ページ変更はまだありません', 'page.managerReordered': 'ページ順を変更しました。並べ替えと削除をまとめて適用します。', 'page.managerReady': 'ページをドラッグして並べ替えるか、不要なページを選択してください。', 'page.managerCancel': 'キャンセル', 'page.managerApply': 'ページ変更を適用',
    'search.results': '{count} 件の結果', 'search.page': '{page} ページ', 'insight.items': '{count} 件', 'insight.page': '{page} ページ・{label}', 'footer.page': '{pages} ページ・{page} ページ目',
    'annotation.count': '{count} 件の注釈', 'annotation.pageLabel': '{page} ページの注釈', 'annotation.settings': '{page} ページの注釈を設定', 'annotation.jumpToFirst': '最初の「{status}」注釈へ移動', 'annotation.noneForStatus': '「{status}」の注釈はありません', 'annotation.delete': '注釈を削除', 'annotation.deleteMany': '{count} 件の注釈を削除', 'annotation.replyTitle': '{label}：{content}'
    , 'update.availableTitle': '新しいバージョン {version}', 'update.description': '現在のバージョンは {current} です。新しいインストーラーは GitHub Releases からダウンロードできます。', 'update.current': '現在のバージョン {version}', 'update.latest': '最新バージョン {version}', 'pageNumbers.existing': 'PDFuck が追加したページ番号が {count} 個あります。新しい設定を適用するとすべて置き換わります。'
  },
  ru: {
    'page.selected': 'Выбрано страниц: {count}', 'page.count': '{count} стр.', 'page.action': '{action} выбранные страницы ({count})', 'page.print': 'Печать', 'page.export': 'Экспорт',
    'print.overview': 'Страниц документа: {pages} · листов: {sheets}', 'print.layout': '{pages} страниц будет напечатано на {sheets} листах', 'print.perSheet': '{count} стр./лист', 'print.onePerSheet': '1 стр./лист', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': 'Выбрано: {count}', 'annotation.current': 'Текущая аннотация', 'crop.label': 'Область обрезки', 'crop.confirm': 'Подтвердить область', 'crop.confirmMessage': 'Обрезать текущую страницу по выбранной области?',
    'theme.set': 'Настроить {label}', 'theme.dialog': 'Выбор цвета: {label}', 'theme.close': 'Закрыть выбор цвета: {label}', 'theme.hex': 'HEX-значение: {label}',
    'close.app': '{count} документ(ов) содержит несохранённые изменения. Закрыть PDFuck?', 'close.document': 'В документе {name} есть несохранённые изменения. Закрыть эту вкладку?',
    'page.deleteSummary': 'Удалить страниц: {remove}; оставить: {keep}.', 'page.rangeInvalid': 'Не распознано: {value}', 'page.selectForAction': 'Выберите хотя бы одну страницу, чтобы {action}', 'page.preview': 'Предпросмотр страницы {page}', 'page.managerSummary': 'Будет сохранено страниц: {count}; сортировка и удаление применятся вместе.', 'page.managerDisplay': 'Вид', 'page.managerThumbnails': 'Миниатюры', 'page.managerCompact': 'Компактный список', 'page.managerPreviousGroup': 'Предыдущая группа страниц', 'page.managerNextGroup': 'Следующая группа страниц', 'page.managerRange': 'Показаны страницы {start}-{end} из {count}', 'page.managerJump': 'К исходной странице', 'page.managerJumpPlaceholder': 'Исходная страница', 'page.managerJumpAction': 'Перейти', 'page.managerPerformanceHint': 'Большие документы открываются в компактном списке; миниатюры создаются только для текущей группы.', 'page.managerDragHandle': 'Перетащить страницу в позиции {position}', 'page.managerOriginal': 'Исходная страница {page}',
    'page.managerTitle': 'Управление страницами', 'page.managerDescription': 'Перетаскивайте страницы для сортировки или выбирайте несколько для удаления. Все изменения применяются после подтверждения.', 'page.managerStatus': 'Сводка изменений страниц', 'page.managerTotal': 'Всего', 'page.managerRemoveCount': 'Удалить', 'page.managerRemaining': 'Останется', 'page.managerClose': 'Закрыть управление страницами',
    'page.managerMarkCurrent': 'Удалить текущую страницу', 'page.managerClearRemoval': 'Снять метки удаления', 'page.managerReset': 'Сбросить все изменения', 'page.managerGroup': 'Группа {current} из {count}', 'page.managerStoryboard': 'Раскадровка страниц', 'page.managerOnDemandHint': 'Предпросмотр создаётся для {count} страниц за раз; предыдущая группа освобождается.', 'page.managerDragHint': 'Перетащите для сортировки · Нажмите для увеличения', 'page.managerPosition': 'Позиция {position}',
    'page.managerRestorePage': 'Оставить эту страницу', 'page.managerRemovePage': 'Удалить эту страницу', 'page.managerGeneratingPreview': 'Создание предпросмотра…', 'page.managerOriginalShort': 'Исх. {page}', 'page.managerCurrentBadge': 'Текущая страница', 'page.managerMarkedForRemoval': 'Будет удалена', 'page.managerInspector': 'Сведения о странице', 'page.managerFocusedPage': 'Позиция {position}',
    'page.managerFinalPosition': 'Итоговая позиция', 'page.managerOriginalPage': 'Исходная страница', 'page.managerMoveTo': 'Переместить в позицию', 'page.managerMoveAction': 'Переместить', 'page.managerMoveHint': 'Введите позицию от 1 до {count}, чтобы переместить между группами.', 'page.managerKeyboardHint': 'Сфокусируйте панель перетаскивания и используйте стрелки для пошагового перемещения.', 'page.managerDraggingPage': 'Перемещение исходной страницы {page}',
    'page.managerInvalid': 'Нельзя удалить все страницы', 'page.managerInvalidHint': 'Перед применением оставьте хотя бы одну страницу.', 'page.managerSummaryChanged': 'Останется страниц: {keep}; удалить: {remove}', 'page.managerSummaryClean': 'Изменений страниц пока нет', 'page.managerReordered': 'Порядок страниц изменён; сортировка и удаление будут применены вместе.', 'page.managerReady': 'Перетаскивайте страницы или выберите ненужные страницы.', 'page.managerCancel': 'Отмена', 'page.managerApply': 'Применить изменения',
    'search.results': 'Найдено результатов: {count}', 'search.page': 'Страница {page}', 'insight.items': 'Элементов: {count}', 'insight.page': 'Страница {page} · {label}', 'footer.page': 'Страниц: {pages} · Страница {page}',
    'annotation.count': 'Аннотаций: {count}', 'annotation.pageLabel': 'Аннотация на странице {page}', 'annotation.settings': 'Настроить аннотацию на странице {page}', 'annotation.jumpToFirst': 'Перейти к первой аннотации «{status}»', 'annotation.noneForStatus': 'Нет аннотаций «{status}»', 'annotation.delete': 'Удалить аннотацию', 'annotation.deleteMany': 'Удалить {count} аннотаций', 'annotation.replyTitle': '{label}: {content}'
    , 'update.availableTitle': 'Доступна версия {version}', 'update.description': 'Установлена версия {current}. Новый установщик доступен на GitHub Releases.', 'update.current': 'Текущая версия {version}', 'update.latest': 'Последняя версия {version}', 'pageNumbers.existing': 'В документе уже есть объектов нумерации PDFuck: {count}; новые настройки заменят весь набор.'
  },
  es: {
    'page.selected': '{count} páginas seleccionadas', 'page.count': '{count} pág.', 'page.action': '{action} las {count} páginas seleccionadas', 'page.print': 'Imprimir', 'page.export': 'Exportar',
    'print.overview': '{pages} páginas del documento · {sheets} hojas', 'print.layout': '{pages} páginas usarán {sheets} hojas', 'print.perSheet': '{count} pág./hoja', 'print.onePerSheet': '1 pág./hoja', 'print.summary': '{size} · {orientation} · {duplex}',
    'annotation.selected': '{count} seleccionadas', 'annotation.current': 'Anotación actual', 'crop.label': 'Área de recorte', 'crop.confirm': 'Confirmar área', 'crop.confirmMessage': '¿Recortar la página actual al área seleccionada?',
    'theme.set': 'Configurar {label}', 'theme.dialog': 'Selector de color: {label}', 'theme.close': 'Cerrar selector de color: {label}', 'theme.hex': 'Valor HEX de {label}',
    'close.app': '{count} documento(s) tiene(n) cambios sin guardar. ¿Cerrar PDFuck?', 'close.document': '{name} tiene cambios sin guardar. ¿Cerrar esta pestaña de documento?',
    'page.deleteSummary': 'Se eliminarán {remove} páginas y se conservarán {keep}.', 'page.rangeInvalid': 'No reconocido: {value}', 'page.selectForAction': 'Seleccione al menos una página para {action}', 'page.preview': 'Vista previa de la página {page}', 'page.managerSummary': 'Se conservarán {count} página(s); el orden y las eliminaciones se aplicarán juntos.', 'page.managerDisplay': 'Vista', 'page.managerThumbnails': 'Miniaturas', 'page.managerCompact': 'Lista compacta', 'page.managerPreviousGroup': 'Grupo de páginas anterior', 'page.managerNextGroup': 'Siguiente grupo de páginas', 'page.managerRange': 'Mostrando páginas {start}-{end} de {count}', 'page.managerJump': 'Ir al original', 'page.managerJumpPlaceholder': 'Página original', 'page.managerJumpAction': 'Ir', 'page.managerPerformanceHint': 'Los documentos grandes se abren en Lista compacta; las miniaturas se generan solo para el grupo actual.', 'page.managerDragHandle': 'Arrastre la página en la posición {position}', 'page.managerOriginal': 'Página original {page}',
    'page.managerTitle': 'Gestionar páginas', 'page.managerDescription': 'Arrastre páginas para reordenarlas o seleccione varias para eliminarlas. Todos los cambios se aplican tras confirmar.', 'page.managerStatus': 'Resumen de cambios de página', 'page.managerTotal': 'Total', 'page.managerRemoveCount': 'Eliminar', 'page.managerRemaining': 'Restantes', 'page.managerClose': 'Cerrar gestión de páginas',
    'page.managerMarkCurrent': 'Eliminar página actual', 'page.managerClearRemoval': 'Borrar marcas de eliminación', 'page.managerReset': 'Restablecer cambios', 'page.managerGroup': 'Grupo {current} de {count}', 'page.managerStoryboard': 'Guion gráfico de páginas', 'page.managerOnDemandHint': 'Las vistas previas se generan para {count} páginas cada vez y se libera el grupo anterior.', 'page.managerDragHint': 'Arrastre para ordenar · Pulse para ampliar', 'page.managerPosition': 'Posición {position}',
    'page.managerRestorePage': 'Conservar esta página', 'page.managerRemovePage': 'Eliminar esta página', 'page.managerGeneratingPreview': 'Generando vista previa…', 'page.managerOriginalShort': 'Original {page}', 'page.managerCurrentBadge': 'Página actual', 'page.managerMarkedForRemoval': 'Se eliminará', 'page.managerInspector': 'Detalles de página', 'page.managerFocusedPage': 'Posición {position}',
    'page.managerFinalPosition': 'Posición final', 'page.managerOriginalPage': 'Página original', 'page.managerMoveTo': 'Mover a la posición', 'page.managerMoveAction': 'Mover', 'page.managerMoveHint': 'Introduzca una posición entre 1 y {count} para mover entre grupos.', 'page.managerKeyboardHint': 'Enfoque la barra de arrastre y use las flechas para mover una página cada vez.', 'page.managerDraggingPage': 'Moviendo la página original {page}',
    'page.managerInvalid': 'No se pueden eliminar todas las páginas', 'page.managerInvalidHint': 'Conserve al menos una página antes de aplicar los cambios.', 'page.managerSummaryChanged': 'Conservar {keep} páginas y eliminar {remove}', 'page.managerSummaryClean': 'Aún no hay cambios de página', 'page.managerReordered': 'El orden cambió; la reordenación y eliminación se aplicarán juntas.', 'page.managerReady': 'Arrastre páginas para ordenar o seleccione las que ya no necesita.', 'page.managerCancel': 'Cancelar', 'page.managerApply': 'Aplicar cambios',
    'search.results': 'Se encontraron {count} resultados', 'search.page': 'Página {page}', 'insight.items': '{count} elementos', 'insight.page': 'Página {page} · {label}', 'footer.page': '{pages} páginas · Página {page}',
    'annotation.count': '{count} anotaciones', 'annotation.pageLabel': 'Anotación de la página {page}', 'annotation.settings': 'Configurar anotación de la página {page}', 'annotation.jumpToFirst': 'Ir a la primera anotación «{status}»', 'annotation.noneForStatus': 'No hay anotaciones «{status}»', 'annotation.delete': 'Eliminar anotación', 'annotation.deleteMany': 'Eliminar {count} anotaciones', 'annotation.replyTitle': '{label}: {content}'
    , 'update.availableTitle': 'Versión {version} disponible', 'update.description': 'Está usando la versión {current}. El nuevo instalador está disponible en GitHub Releases.', 'update.current': 'Versión actual {version}', 'update.latest': 'Última versión {version}', 'pageNumbers.existing': 'Ya existen {count} objetos de numeración añadidos por PDFuck; la nueva configuración sustituirá todo el conjunto.'
  }
} as const
export type TranslationKey = keyof typeof parameterMessages.zh

export function translateMessage(language: InterfaceLanguage, key: TranslationKey, values: Record<string, string | number> = {}): string {
  return parameterMessages[language][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
}
