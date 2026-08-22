import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { interfaceLanguage, translatePhrase, useInterfaceLanguage } from '../lib/i18n'
import { phraseTranslations } from '../lib/i18n-locales'

const english: Record<string, string> = {
  '未打开文档': 'No Document Open', '新标签': 'New Tab', '准备就绪': 'Ready', '打开 PDF 开始工作': 'Open a PDF to Get Started', '阅读、编辑、批注与导出，都在一个干净的窗口里完成。': 'Read, edit, annotate, and export in one focused workspace.', '选择 PDF 文件': 'Choose PDF File', '也可以把 PDF 文件直接拖到窗口中': 'You can also drag a PDF file into this window.', '最近打开': 'Recent Files', '暂无记录': 'No recent files', '最近打开的 PDF 会显示在这里': 'Recently opened PDFs appear here', '打开过的文件可以从这里一键继续阅读': 'Resume reading any previous file in one click.',
  '打开 PDF': 'Open PDF', '打开文件夹': 'Open Folder', '适合宽度': 'Fit Width', '保存': 'Save', '查看': 'View', '编辑': 'Edit', '批注': 'Annotate', '文档标签': 'Document Tabs', '加密': 'Encrypted', '未保存': 'Unsaved', '已保存': 'Saved', '未打开': 'Not Open', '目录：': 'Folder: ', '状态：': 'Status: ', '未保存到磁盘': 'Not saved to disk', '密码保护的只读文档': 'Password-protected read-only document', '有未保存修改': 'Has unsaved changes', '关闭文档标签': 'Close document tab', '在当前窗口打开另一份 PDF': 'Open another PDF in this window',
  '在 Finder 或文件管理器中显示当前 PDF 所在文件夹': 'Show the current PDF in Finder or File Explorer', '撤销': 'Undo', '撤销 (Ctrl+Z)': 'Undo (Ctrl+Z)', '重做': 'Redo', '重做 (Ctrl+Y / Ctrl+Shift+Z)': 'Redo (Ctrl+Y / Ctrl+Shift+Z)', 'PDF 文档标签管理': 'PDF document tabs', '收起查看工具': 'Collapse View tools', '打开查看工具': 'Open View tools', '收起编辑工具': 'Collapse Edit tools', '打开编辑工具': 'Open Edit tools', '收起批注工具': 'Collapse Annotate tools', '打开批注工具': 'Open Annotate tools', '收起保存工具': 'Collapse Save tools', '打开保存工具': 'Open Save tools',
  '页面': 'Page', '内容': 'Content', '框选裁切页面': 'Crop Page', '拖动框选要保留的页面区域': 'Drag to select the area to keep.', '批量删除页面…': 'Delete Pages…', '编辑页面文字': 'Edit Page Text', '显示当前页文本块，点击任意一处直接编辑': 'Show text blocks on this page and click one to edit.', '在页面上添加文字': 'Add Text to Page', '拖出文本框后设置内容和格式': 'Drag out a text box, then set its content and formatting.',
  '直接调整页面或添加带格式的文字内容。': 'Adjust pages directly or add formatted text.', '可直接按字符框选 PDF 文字，按 Ctrl+C 或右键复制': 'Select PDF text precisely by character, then press Ctrl+C or right-click to copy.',
  '文本批注': 'Text Annotations', '位置批注': 'Position Annotations', '文本高亮': 'Highlight Text', '文本替换': 'Replace Text', '文本删除': 'Delete Text', '加下划线': 'Underline Text', '自由批注': 'Note', '插入文字': 'Insert Text', '框选文字 · Delete': 'Select text · Delete', '选择文字 · Insert': 'Select text · Insert',
  '拖动框选文字；Ctrl/⌘ 加选，Shift 选择连续批注，Delete 批量删除。': 'Drag to select text; Ctrl/⌘ adds selections, Shift selects a range, and Delete removes annotations in bulk.', '框选文字 · Ctrl+H / ⌘H': 'Select text · Ctrl+H / ⌘H', '框选原文 · Ctrl+R / ⌘R': 'Select original text · Ctrl+R / ⌘R', '框选文字 · Ctrl+U / ⌘U': 'Select text · Ctrl+U / ⌘U', '选择文字 · Ctrl+N / ⌘N': 'Select text · Ctrl+N / ⌘N', '框选文字 · Ctrl+I / ⌘I': 'Select text · Ctrl+I / ⌘I', '批注模式：按字符精准框选文字；右键可复制或添加批注': 'Annotation mode: select text precisely by character; right-click to copy or add an annotation.',
  '保存 PDF': 'Save PDF', '另存为 PDF…': 'Save As PDF…', '打印': 'Print', '正在打开打印对话框…': 'Opening print dialog…', '选择页面并打印…': 'Select Pages & Print…', '可选择连续或不连续页码，包含尚未保存的修改。': 'Choose continuous or non-contiguous pages, including unsaved changes.', '指定页面导出': 'Export Selected Pages', '文件格式': 'File Format', 'PDF 输出方式': 'PDF Output', '合并为一个 PDF': 'Combine into One PDF', '每页单独 PDF': 'One PDF per Page', '输出清晰度': 'Output Resolution', '选择页面并导出…': 'Select Pages & Export…', '可选不连续页码；文件名保留原文档页码后缀。': 'Non-contiguous pages are supported; filenames keep the original page suffix.',
  '保存完整文档，或只打印、导出真正需要的页面。': 'Save the complete document, or print and export only the pages you need.',
  '批注列表': 'Annotation List', '列表字号': 'List Font Size', '单行': 'Single Line', '多行': 'Multi-line', '回复统计': 'Reply Summary', '未回复': 'Unreplied', '已处理': 'Resolved', '想一想': 'Review Later', '不做了': 'Won’t Fix', '状态': 'Status', '内容（双击编辑）': 'Content (double-click to edit)', '还没有批注': 'No annotations yet', '在页面上框选文字开始批注': 'Select text on the page to start annotating.', '删除批注': 'Delete Annotation', '批注设置': 'Annotation Settings', '颜色与回复': 'Color & Reply', '颜色': 'Color', '回复': 'Reply', '清除': 'Clear', '自定义回复…': 'Custom reply…', '自定义回复': 'Custom reply', '批注颜色：': 'Annotation color: ', '自定义颜色': 'Custom color', '调整批注列表宽度': 'Resize annotation list', '拖动调整批注列表宽度': 'Drag to resize annotation list', '收起批注列表': 'Collapse annotation list', '展开批注列表': 'Expand annotation list', '收起': 'Collapse', '展开回复统计': 'Expand reply summary', '收起回复统计': 'Collapse reply summary', '展开统计': 'Expand summary', '收起统计': 'Collapse summary',
  '实验室': 'Lab', '智能润色': 'AI Polish', '模型设置': 'Model Settings', '服务商': 'Provider', '接口地址': 'API Endpoint', '模型': 'Model', '恢复默认': 'Restore Defaults', '开始润色': 'Polish Text', '正在获取回复…': 'Getting response…', '复制回复': 'Copy Response', '添加到批注': 'Add to Annotations', '正在添加…': 'Adding…', '请先框选 PDF 文字': 'Select text in the PDF first', '润色提示词': 'Polishing instruction', '关闭模型设置': 'Close model settings', '自定义 OpenAI 兼容': 'Custom OpenAI-compatible',
  '智能润色模型设置': 'AI Polish Model Settings', '关闭临时目录提示': 'Dismiss temporary-folder notice',
  '编辑批注': 'Edit Annotation', '添加文字': 'Add Text', '编辑文字': 'Edit Text', '设置文字内容和显示格式。添加后可在页面上拖动，双击可再次编辑。': 'Set the text and its formatting. Drag it after adding; double-click to edit again.', '字体': 'Font', '字号': 'Font Size', '对齐': 'Alignment', '左对齐': 'Left', '居中': 'Center', '右对齐': 'Right', '行距': 'Line Spacing', '紧凑': 'Compact', '正文': 'Body', '宽松': 'Relaxed', '粗体': 'Bold', '斜体': 'Italic', '取消': 'Cancel', '确定': 'Confirm', '添加': 'Add', '保存修改': 'Save Changes',
  '保存需要新位置': 'A New Save Location Is Required', '无法直接保存此文件': 'This File Cannot Be Saved Here', '你的修改仍保留在当前窗口': 'Your changes remain in this window', '暂不保存': 'Don’t Save Yet', '选择位置另存…': 'Choose Another Location…', '受保护的 PDF': 'Protected PDF', '输入打开密码': 'Enter Password', '密码': 'Password', '隐藏': 'Hide', '显示': 'Show', '在此设备上保存密码': 'Save password on this device', '使用系统安全存储加密，下次打开时自动尝试': 'Encrypted with system secure storage and tried automatically next time.', '解锁并打开': 'Unlock & Open', '加密 PDF': 'Encrypted PDF', '使用本机安全存储': 'Use Local Secure Storage', '跳过并手动输入': 'Skip and Enter Manually', '继续尝试': 'Continue',
  '批量删除页面': 'Delete Pages', '当前页': 'Current Page', '奇数页': 'Odd Pages', '偶数页': 'Even Pages', '清空': 'Clear', '删除': 'Delete', '保留': 'Keep', '删除所选页面': 'Delete Selected Pages', '选择要打印的页面': 'Select Pages to Print', '选择要导出的页面': 'Select Pages to Export', '页码范围': 'Page Range', '全部': 'All', '反选': 'Invert', '已选择': 'Selected', '未选择': 'Not Selected', '尚未选择页面': 'No pages selected', '打印预览': 'Print Preview', '纸张设置': 'Paper Settings', '纸张尺寸': 'Paper Size', '页面方向': 'Orientation', '纵向': 'Portrait', '横向': 'Landscape', '印刷方式': 'Print Mode', '单面打印': 'Single-sided', '双面 · 长边翻页': 'Double-sided · Long Edge', '双面 · 短边翻页': 'Double-sided · Short Edge', '页面布局': 'Page Layout', '合并多页到一张纸': 'Print Multiple Pages per Sheet', '每张纸页数': 'Pages per Sheet', '缩放': 'Scale', '行数': 'Rows', '列数': 'Columns', '显示页面边框': 'Show Page Borders', '纸张预览': 'Paper Preview', '上一张纸': 'Previous Sheet', '下一张纸': 'Next Sheet', '正在生成预览': 'Generating preview', '打开系统打印': 'Open System Print',
  '可直接点选页面，也可输入不连续页码和范围。': 'Click pages directly, or enter non-contiguous page numbers and ranges.', '支持逗号、空格和短横线；页码可不连续': 'Commas, spaces, and hyphens are supported; pages need not be consecutive.', '所选': 'Selected',
  '搜索文档': 'Search Document', '匹配大小写': 'Match Case', '模糊匹配': 'Fuzzy Match', '正则表达式': 'Regular Expression', '常用正则表达式': 'Common Regular Expressions', '搜索': 'Search', '关联引文': 'Linked Citations', '关闭': 'Close', '复制': 'Copy', '图表定位结果': 'Figures & Tables', '引文关联结果': 'Citation Links', '语法检查结果': 'Grammar Results', '未发现可定位项目': 'No matching items found', '关闭结果': 'Close results',
  '拖动批注快捷浮窗': 'Drag annotation toolbar', '拖动浮窗': 'Drag toolbar', '关闭引文信息': 'Close citation details', '复制参考文献': 'Copy reference', '复制全部参考文献': 'Copy all references', '已复制参考文献': 'Reference copied', '编辑文字：': 'Edit text: ', '点击直接编辑这段文字': 'Click to edit this text.', '关闭提示': 'Dismiss notice',
  '当前文件可能处于临时目录，请注意另存，防止走丢！': 'This file may be in a temporary folder. Save it elsewhere to avoid losing it.', '条批注': 'annotations', '条': 'items', '页': 'Page',
  '明黄': 'Bright Yellow', '深蓝': 'Deep Blue', '亮蓝': 'Bright Blue', '珊瑚红': 'Coral Red', '墨绿': 'Deep Green', '紫色': 'Purple', '橙色': 'Orange', '墨黑': 'Ink Black'
  , '拖动色彩面板选择任意颜色，或输入精确 HEX 值': 'Drag in the color field to choose any color, or enter an exact HEX value.', '颜色浓度与明暗': 'Saturation & Brightness', '色相': 'Hue', '← 拖动调节 →': '← Drag to adjust →', '完成': 'Done', '推荐色': 'Suggested Colors', '饱和度和明度': 'Saturation and brightness', '靛蓝': 'Indigo', '蓝色': 'Blue', '青绿': 'Teal', '森林绿': 'Forest Green', '琥珀': 'Amber', '莓紫': 'Berry Purple', '石墨': 'Graphite', '暖灰': 'Warm Gray', '浅灰蓝': 'Pale Blue Gray', '白色': 'White',
  '高亮说明': 'Highlight description', '批注内容': 'Annotation content', '替换为': 'Replace with', '删除标记': 'Deletion mark', '下划线说明': 'Underline description', '可以补充说明并选择醒目的标记颜色。': 'Add an optional note and choose a visible marker color.', '填写批注内容，并选择适合的标记颜色。': 'Enter the annotation content and choose a suitable marker color.', '锁': 'Lock', '加密文档将以只读模式打开': 'The encrypted document will open read-only.', '本地保存的密码已失效，请输入当前密码。': 'The locally saved password is no longer valid. Enter the current password.', '密码不正确，请重新输入。': 'Incorrect password. Please try again.', '此文档受密码保护，请验证后继续。': 'This document is password protected. Verify it to continue.', '此文档已确认受密码保护。继续后，PDFuck 会尝试读取本机保存的打开密码；如果你选择保存新密码，也会交给系统安全存储保护。': 'This document is confirmed as password protected. Continuing lets PDFuck try the saved local password; any newly saved password is protected by system secure storage.', '你可能会看到系统安全授权': 'You may see a system security prompt', '这是 macOS 钥匙串或 Windows 系统凭据保护的正常提示，仅用于保护这个 PDF 的密码。普通未加密 PDF 不会触发此流程。': 'This is a normal macOS Keychain or Windows credential prompt used only to protect this PDF password. Ordinary unencrypted PDFs do not trigger this flow.', '选择要删除的页码。删除后至少需要保留一页。': 'Choose pages to delete. At least one page must remain.', '不能删除全部页面，请至少取消选择一页。': 'You cannot delete every page. Leave at least one page unselected.', '关闭打印设置': 'Close print settings', 'PDFuck 将按右侧预览直接生成拼版': 'PDFuck will generate the layout shown in the preview.', '打印时保留浅灰分隔线': 'Keep light-gray separators when printing.', '输出效果与下方纸张比例一致': 'Output matches the paper proportions below.', '单页铺放': 'One page per sheet', '双面': 'Double-sided', 'PDFuck 更新检测': 'PDFuck Update Check', '发现新版本 ': 'New version available: ', '你正在使用 ': 'You are using ', '。新版安装包已经发布，可前往 GitHub Releases 下载。': '. The new installer is available on GitHub Releases.', '当前版本 ': 'Current version ', '最新版本 ': 'Latest version ', '不再提示此版本': 'Do not remind me about this version', '稍后提醒': 'Remind me later', '前往下载': 'Download', '自定义批注颜色': 'Custom annotation color', '释放以打开 PDF': 'Drop to Open PDF', '将在当前窗口新增一个文档标签': 'A new document tab will open in this window.', '将在当前标签中打开': 'The document will open in this tab.', 'API Key': 'API Key', 'OpenAI / 中转': 'OpenAI / Relay', 'Claude / 中转': 'Claude / Relay'
}

Object.assign(english, Object.fromEntries(Object.entries(phraseTranslations).map(([phrase, translations]) => [phrase, translations.en])))

function translated(value: string): string {
  if (interfaceLanguage() === 'zh') return value
  const leading = value.match(/^\s*/u)?.[0] || ''
  const trailing = value.match(/\s*$/u)?.[0] || ''
  const phrase = value.trim()
  const englishPhrase = english[phrase]
  // Values without a catalogue entry are document or user content.  They must
  // remain untouched rather than being mistaken for interface copy.
  if (!englishPhrase) return value
  const translatedPhrase = translatePhrase(phrase, englishPhrase)
  if (interfaceLanguage() !== 'en') return `${leading}${translatedPhrase}${trailing}`
  const next = translatedPhrase
    .replace(/^第 (\d+) 页$/, 'Page $1')
    .replace(/^第 (\d+) 页 · /, 'Page $1 · ')
    .replace(/^(\d+) 个文件$/, '$1 files')
    .replace(/^(\d+) 条批注$/, '$1 annotations')
    .replace(/^(\d+) (?:页|Page) · 第 (\d+) (?:页|Page)$/, '$1 pages · Page $2')
    .replace(/^已选择 (\d+) 页$/, '$1 pages selected')
    .replace(/^已选择：/, 'Selected: ')
    .replace(/^已保存 · /, 'Saved · ')
    .replace(/^已复制 (\d+) 个字符 · /, 'Copied $1 characters · ')
    .replace(/^操作失败：/, 'Action failed: ')
    .replace(/^设置(.+)$/, 'Set $1')
    .replace(/^关闭\s*/, 'Close ')
    .replace(/^Close(?=[A-Z])/, 'Close ')
    .replace(/^Close(?=[\u3400-\u9fff])/, 'Close ')
    .replace(/^(.+?)(?:颜色|Color)面板$/, '$1 Color Picker')
    .replace(/^(.+)：(.+)$/, '$1: $2')
    .replace(/\n目录：/g, '\nFolder: ')
    .replace(/\n状态：/g, '\nStatus: ')
    .replace(/新标签/g, 'New Tab')
    .replace(/未保存到磁盘/g, 'Not saved to disk')
    .replace(/未打开/g, 'Not Open')
  return `${leading}${next}${trailing}`
}

/** Pure lookup for JSX renderers. It never scans, observes, or mutates the DOM. */
export function translateInterfaceText(value: string): string { return translated(value) }

/** Translate only known UI literals.  This is intentionally render-time work,
 * not a DOM observer: it cannot touch document text or user-entered content. */
export function translateStaticInterfaceText(value: string): string {
  return translated(value)
}

function localize(node: ReactNode): ReactNode {
  if (typeof node === 'string') return translateStaticInterfaceText(node)
  if (Array.isArray(node)) return node.map(localize)
  if (!isValidElement(node)) return node
  const element = node as ReactElement<Record<string, unknown>>
  const props: Record<string, unknown> = {}
  for (const key of ['title', 'aria-label', 'placeholder', 'alt']) {
    if (typeof element.props[key] === 'string') props[key] = translateStaticInterfaceText(element.props[key] as string)
  }
  if (element.type !== 'input' && element.type !== 'textarea') props.children = localize(element.props.children as ReactNode)
  return cloneElement(element, props)
}

export function LocalizedInterfaceCopy({ children }: { children: ReactNode }) {
  useInterfaceLanguage()
  return <>{localize(children)}</>
}
