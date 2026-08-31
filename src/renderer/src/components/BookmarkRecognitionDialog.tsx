import { useEffect, useMemo, useState } from 'react'
import { bookmarkTreeFromCandidates, DEFAULT_BOOKMARK_RULES, removeRecognizedCandidate, type BookmarkRecognitionOptions, type BookmarkRuleId, type RecognizedBookmark } from '../lib/bookmark-recognition'
import type { PdfBookmark } from '../types'
import { t as message, translateUiText, ui, useInterfaceLanguage } from '../lib/i18n'
import './bookmark-recognition-dialog.css'

export type BookmarkWriteMode = 'append' | 'replace'

interface Props {
  existingCount: number
  onPreview(options: BookmarkRecognitionOptions): Promise<RecognizedBookmark[]>
  onCancel(): void
  onApply(bookmarks: PdfBookmark[], mode: BookmarkWriteMode): void | Promise<void>
  onDeleteAll(): void | Promise<void>
}

const RULES: Array<{ id: BookmarkRuleId; title: string; description: string; sample: string }> = [
  { id: 'decimal', title: '多级数字与罗马数字', description: '识别阿拉伯数字、各地数字字符和多级小数编号。', sample: '1. · 1.2 · 1.2.3 · IV.' },
  { id: 'localized', title: '各国文字数字', description: '识别中文大写数字、括号序号、日文、韩文和泰文编号。', sample: '二、 ·（贰）· 제2장 · บทที่ ๓' },
  { id: 'chapters', title: '章节、分部与附录', description: '覆盖中英日韩俄西法德意葡阿等常见章节写法。', sample: '第三章 · Chapter 2 · Глава IV · Capítulo 5' },
  { id: 'headings', title: '典型标题词', description: '识别摘要、引言、方法、结论、参考文献等多语言标题。', sample: '摘要 · Introduction · 結論 · Заключение' },
  { id: 'typography', title: '标题排版辅助', description: '谨慎识别明显大于正文、长度较短且不像句子的标题。', sample: '大字号短标题' }
]

export function BookmarkRecognitionDialog({ existingCount, onPreview, onCancel, onApply, onDeleteAll }: Props) {
  useInterfaceLanguage()
  const [rules, setRules] = useState<BookmarkRuleId[]>(DEFAULT_BOOKMARK_RULES)
  const [maxDepth, setMaxDepth] = useState(3)
  const [customKeywords, setCustomKeywords] = useState('')
  const [mode, setMode] = useState<BookmarkWriteMode>(existingCount ? 'append' : 'replace')
  const [candidates, setCandidates] = useState<RecognizedBookmark[]>()
  const [scannedCandidates, setScannedCandidates] = useState<RecognizedBookmark[]>()
  const [scanning, setScanning] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const options = useMemo<BookmarkRecognitionOptions>(() => ({ rules, maxDepth, customKeywords }), [customKeywords, maxDepth, rules])
  const markStale = () => { setCandidates(undefined); setScannedCandidates(undefined); setError('') }
  const scan = async () => {
    if (!rules.length && !customKeywords.trim()) { setCandidates([]); return }
    setScanning(true); setError('')
    try { const found = await onPreview(options); setScannedCandidates(found); setCandidates(found) } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setCandidates(undefined); setScannedCandidates(undefined) } finally { setScanning(false) }
  }
  useEffect(() => { void scan() }, []) // Scan once with safe defaults; later changes are applied explicitly.
  const toggleRule = (id: BookmarkRuleId) => { setRules((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); markStale() }
  const commit = async (action: () => void | Promise<void>) => {
    if (committing) return
    setCommitting(true)
    try { await action() } finally { setCommitting(false) }
  }
  return <div className="modal-backdrop bookmark-recognition-backdrop"><div className="modal bookmark-recognition-dialog" role="dialog" aria-modal="true" aria-labelledby="bookmark-recognition-title">
    <header className="bookmark-recognition-heading"><div><span className="bookmark-recognition-icon" aria-hidden="true">⌑</span><div><h2 id="bookmark-recognition-title">{ui('识别书签')}</h2><p>{ui('按标题文字和排版识别层级，并写入标准 PDF 书签。')}</p></div></div><button type="button" onClick={onCancel} aria-label={ui('关闭识别书签')}>×</button></header>
    <div className="bookmark-recognition-body"><section className="bookmark-rule-settings"><div className="bookmark-section-title"><b>{ui('识别规则')}</b><small>{ui('可组合使用；关闭不适合本文档的规则可减少误识别。')}</small></div><div className="bookmark-rule-grid">{RULES.map((rule) => <button type="button" key={rule.id} className={rules.includes(rule.id) ? 'active' : ''} role="switch" aria-checked={rules.includes(rule.id)} onClick={() => toggleRule(rule.id)}><i aria-hidden="true"><span /></i><span><b>{ui(rule.title)}</b><small>{ui(rule.description)}</small><em>{ui(rule.sample)}</em></span></button>)}</div>
      <label className="bookmark-depth-control"><span><b>{ui('最大书签识别深度')}</b><small>{ui('超过所选层级的编号不会写入')}</small></span><input type="range" min={1} max={6} step={1} value={maxDepth} aria-label={ui('最大书签识别深度')} onChange={(event) => { setMaxDepth(Number(event.target.value)); markStale() }} /><output>{message('bookmark.depth', { depth: maxDepth })}</output></label>
      <label className="bookmark-custom-keywords"><span><b>{ui('额外标题词')}</b><small>{ui('每行一个；用于补充专业文档中的固定标题')}</small></span><textarea value={customKeywords} placeholder={ui('例如：数据可用性\n伦理声明\n术语定义')} onChange={(event) => { setCustomKeywords(event.target.value); markStale() }} /></label>
      {existingCount > 0 && <div className="bookmark-write-mode"><span><b>{ui('已有书签处理')}</b><small>{message('bookmark.existing', { count: existingCount })}</small></span><div className="segmented"><button type="button" className={mode === 'append' ? 'active' : ''} onClick={() => setMode('append')}>{ui('保留并追加')}</button><button type="button" className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>{ui('覆盖已有书签')}</button></div></div>}
    </section><section className="bookmark-recognition-preview"><header><div><b>{ui('识别预览')}</b><small>{candidates ? message('bookmark.recognized', { count: candidates.length }) : ui('规则已更改，请重新识别')}</small></div><span className="bookmark-preview-actions">{candidates && scannedCandidates && candidates.length < scannedCandidates.length && <button type="button" onClick={() => setCandidates(scannedCandidates)}>{ui('恢复已移除项')}</button>}<button type="button" disabled={scanning} onClick={() => void scan()}>{scanning ? ui('正在识别…') : ui('重新识别')}</button></span></header>
      <div className="bookmark-preview-list">{scanning ? <div className="bookmark-scanning"><i /><b>{ui('正在逐页分析标题…')}</b><small>{ui('大文档可能需要一点时间')}</small></div> : error ? <div className="bookmark-preview-empty error">{ui('识别失败')}<small>{translateUiText(error)}</small></div> : candidates?.length ? candidates.map((item) => <div key={item.id} className="bookmark-preview-row" style={{ '--preview-indent': `${Math.max(0, item.level - 1) * 12}px` } as React.CSSProperties}><i>{item.level}</i><span><b>{item.title}</b><small>{message('bookmark.previewPage', { page: item.pageIndex + 1 })}</small></span><button type="button" className="bookmark-preview-remove" onClick={() => setCandidates((current) => removeRecognizedCandidate(current || [], item.id))} aria-label={`${ui('从识别预览中移除')}“${item.title}”`} title={ui('从预览中移除此项')}>×</button></div>) : <div className="bookmark-preview-empty"><b>{candidates ? ui('没有找到符合规则的标题') : ui('等待重新识别')}</b><small>{ui('可启用更多规则、增加识别深度或补充标题词。')}</small></div>}</div>
    </section></div>
    <footer className="bookmark-recognition-actions"><div>{existingCount > 0 && (deleteArmed ? <span className="bookmark-delete-confirm"><b>{ui('确定删除文档中的全部书签？')}</b><button type="button" disabled={committing} onClick={() => setDeleteArmed(false)}>{ui('取消')}</button><button type="button" className="danger" disabled={committing} onClick={() => void commit(onDeleteAll)}>{ui('确认删除')}</button></span> : <button type="button" className="bookmark-delete-all" disabled={committing} onClick={() => setDeleteArmed(true)}>{ui('删除所有书签')}</button>)}</div><div><button type="button" disabled={committing} onClick={onCancel}>{ui('取消')}</button><button type="button" className="primary" disabled={!candidates?.length || scanning || committing} onClick={() => void commit(() => onApply(bookmarkTreeFromCandidates(candidates || []), mode))}>{committing ? '…' : candidates?.length ? message('bookmark.write', { count: candidates.length }) : ui('写入书签')}</button></div></footer>
  </div></div>
}
