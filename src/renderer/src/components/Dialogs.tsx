import { useEffect, useRef, useState } from 'react'
import type { AnnotationKind, TextStyle } from '../types'
import { fontOptionsFor, normalizeFontFamily } from '../lib/text-fonts'
import type { UpdateCheckResult } from '../../../shared/contracts'
import { allPageIndices, compactPageSelection, parsePageSelection } from '../lib/page-selection'

export interface AnnotationDialogState { kind: AnnotationKind; initial?: string; optional?: boolean; edit?: boolean }

function useDeferredTextareaFocus() {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }))
    const timer = window.setTimeout(() => ref.current?.focus({ preventScroll: true }), 40)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer) }
  }, [])
  return ref
}

export function AnnotationDialog({ state, onCancel, onSubmit }: { state: AnnotationDialogState; onCancel(): void; onSubmit(value: string): void }) {
  const [value, setValue] = useState(state.initial || '')
  const textareaRef = useDeferredTextareaFocus()
  const labels: Record<AnnotationKind, string> = { highlight: '高亮说明', note: '批注内容', replace: '替换为', insert: '插入文字', delete: '删除标记', underline: '下划线说明' }
  return <div className="modal-backdrop"><div className="modal"><h2>{state.edit ? '编辑批注' : labels[state.kind]}</h2><p>{state.optional ? '可以为这条批注添加说明，也可以留空。' : '请输入要写入这条批注的内容。'}</p>
    <textarea ref={textareaRef} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { event.stopPropagation(); if (event.ctrlKey && event.key === 'Enter' && (state.optional || value.trim())) onSubmit(value.trim()) }} />
    <div className="modal-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" className="primary" disabled={!state.optional && !value.trim()} onClick={() => onSubmit(value.trim())}>确定</button></div></div></div>
}

export interface TextDialogValue { text: string; style: TextStyle }

export function TextDialog({ initial, edit = false, onCancel, onSubmit }: { initial?: TextDialogValue; edit?: boolean; onCancel(): void; onSubmit(value: TextDialogValue): void }) {
  const [text, setText] = useState(initial?.text || '')
  const [style, setStyle] = useState<TextStyle>(initial?.style || { font: 'Arial', size: 16, color: '#182033', bold: false, italic: false, align: 'left', lineHeight: 1.25 })
  const textareaRef = useDeferredTextareaFocus()
  return <div className="modal-backdrop"><div className="modal text-dialog"><h2>{edit ? '编辑文字' : '添加文字'}</h2><p>设置文字内容和显示格式。添加后可在页面上拖动，双击可再次编辑。</p><textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.stopPropagation()} />
    <div className="format-grid"><label>字体<select value={normalizeFontFamily(style.font)} onChange={(event) => setStyle({ ...style, font: event.target.value })}>{fontOptionsFor(style.font).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>字号<input type="number" min="6" max="144" value={style.size} onChange={(event) => setStyle({ ...style, size: Number(event.target.value) })} /></label>
      <label>颜色<input type="color" value={style.color} onChange={(event) => setStyle({ ...style, color: event.target.value })} /></label>
      <label>对齐<select value={style.align} onChange={(event) => setStyle({ ...style, align: event.target.value as TextStyle['align'] })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
      <label>行距<select value={style.lineHeight || 1.25} onChange={(event) => setStyle({ ...style, lineHeight: Number(event.target.value) as TextStyle['lineHeight'] })}><option value="1">紧凑</option><option value="1.25">正文</option><option value="1.5">宽松</option><option value="2">双倍</option></select></label></div>
    <div className="format-toggles"><button type="button" className={style.bold ? 'active' : ''} onClick={() => setStyle({ ...style, bold: !style.bold })}><b>B</b> 粗体</button><button type="button" className={style.italic ? 'active' : ''} onClick={() => setStyle({ ...style, italic: !style.italic })}><i>I</i> 斜体</button></div>
    <div className="modal-actions"><button type="button" onClick={onCancel}>取消</button><button type="button" className="primary" disabled={!text.trim()} onClick={() => onSubmit({ text, style })}>{edit ? '保存修改' : '添加'}</button></div></div></div>
}

export function PageDeleteDialog({ pageCount, currentPage, onCancel, onSubmit }: { pageCount: number; currentPage: number; onCancel(): void; onSubmit(pages: number[]): void }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set([currentPage]))
  const replace = (pages: number[]) => setSelected(new Set(pages))
  const toggle = (page: number) => setSelected((current) => { const next = new Set(current); next.has(page) ? next.delete(page) : next.add(page); return next })
  const allSelected = selected.size === pageCount
  return <div className="modal-backdrop"><div className="modal page-delete-dialog"><h2>批量删除页面</h2><p>选择要删除的页码。删除后至少需要保留一页。</p>
    <div className="page-delete-shortcuts"><button onClick={() => replace([currentPage])}>当前页</button><button onClick={() => replace(Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 0))}>奇数页</button><button onClick={() => replace(Array.from({ length: pageCount }, (_, index) => index).filter((index) => index % 2 === 1))}>偶数页</button><button onClick={() => replace([])}>清空</button></div>
    <div className="page-delete-grid">{Array.from({ length: pageCount }, (_, page) => <button key={page} className={selected.has(page) ? 'selected' : ''} onClick={() => toggle(page)} aria-pressed={selected.has(page)}><span>{page + 1}</span><small>{selected.has(page) ? '删除' : '保留'}</small></button>)}</div>
    <div className={`page-delete-summary${allSelected ? ' invalid' : ''}`}>{allSelected ? '不能删除全部页面，请至少取消选择一页。' : `将删除 ${selected.size} 页，保留 ${pageCount - selected.size} 页。`}</div>
    <div className="modal-actions"><button onClick={onCancel}>取消</button><button className="danger" disabled={!selected.size || allSelected} onClick={() => onSubmit([...selected].sort((a, b) => a - b))}>删除所选页面</button></div></div></div>
}

export function PageSelectionDialog({ purpose, pageCount, currentPage, onCancel, onSubmit }: { purpose: 'print' | 'export'; pageCount: number; currentPage: number; onCancel(): void; onSubmit(pages: number[]): void }) {
  const allPages = allPageIndices(pageCount)
  const [selected, setSelected] = useState<Set<number>>(() => new Set(allPages))
  const [manual, setManual] = useState(() => compactPageSelection(allPages))
  const parsed = parsePageSelection(manual, pageCount)
  const invalid = parsed.invalid
  const replace = (pages: number[]) => { const normalized = [...new Set(pages)].sort((a, b) => a - b); setSelected(new Set(normalized)); setManual(compactPageSelection(normalized)) }
  const toggle = (page: number) => replace(selected.has(page) ? [...selected].filter((value) => value !== page) : [...selected, page])
  const changeManual = (value: string) => {
    setManual(value)
    const result = parsePageSelection(value, pageCount)
    if (!result.invalid.length) setSelected(new Set(result.pages))
  }
  const isAll = selected.size === pageCount
  const title = purpose === 'print' ? '选择要打印的页面' : '选择要导出的页面'
  const action = purpose === 'print' ? '打印' : '导出'
  const valid = selected.size > 0 && invalid.length === 0
  return <div className="modal-backdrop"><div className="modal page-selection-dialog">
    <div className="page-selection-heading"><span className={`page-selection-icon ${purpose}`} aria-hidden="true">{purpose === 'print' ? '▣' : '⇩'}</span><div><h2>{title}</h2><p>可直接点选页面，也可输入不连续页码和范围。</p></div></div>
    <label className={`page-range-input${invalid.length ? ' invalid' : ''}`}><span>页码范围</span><div><input autoFocus value={manual} placeholder="例如：1-3, 5, 8-10" onChange={(event) => changeManual(event.target.value)} onBlur={() => { if (!invalid.length) setManual(compactPageSelection([...selected])) }} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Enter' && valid) onSubmit([...selected].sort((a, b) => a - b)) }} /><small>{invalid.length ? `无法识别：${invalid.join('、')}` : '支持逗号、空格和短横线；页码可不连续'}</small></div></label>
    <div className="page-selection-shortcuts"><button className={isAll ? 'active' : ''} onClick={() => replace(allPages)}>全部</button><button className={selected.size === 1 && selected.has(currentPage) ? 'active' : ''} onClick={() => replace([currentPage])}>当前页</button><button onClick={() => replace(allPages.filter((page) => page % 2 === 0))}>奇数页</button><button onClick={() => replace(allPages.filter((page) => page % 2 === 1))}>偶数页</button><button onClick={() => replace(allPages.filter((page) => !selected.has(page)))}>反选</button><button onClick={() => replace([])}>清空</button></div>
    <div className="page-selection-grid">{allPages.map((page) => <button key={page} className={selected.has(page) ? 'selected' : ''} onClick={() => toggle(page)} aria-pressed={selected.has(page)}><span>{page + 1}</span><small>{page === currentPage ? '当前页' : selected.has(page) ? '已选择' : '未选择'}</small></button>)}</div>
    <div className={`page-selection-summary${!valid ? ' invalid' : ''}`}><b>{selected.size ? `已选择 ${selected.size} 页` : '尚未选择页面'}</b><span>{invalid.length ? '请修正页码范围后继续' : selected.size ? compactPageSelection([...selected]) : `请至少选择一页进行${action}`}</span></div>
    <div className="modal-actions"><button onClick={onCancel}>取消</button><button className="primary" disabled={!valid} onClick={() => onSubmit([...selected].sort((a, b) => a - b))}>{action}所选 {selected.size || ''} 页</button></div>
  </div></div>
}

export function UpdateDialog({ update, onLater, onSkip, onDownload }: { update: UpdateCheckResult & { status: 'available' }; onLater(): void; onSkip(): void; onDownload(): void }) {
  return <div className="modal-backdrop update-backdrop"><div className="modal update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
    <div className="update-symbol" aria-hidden="true"><span>↑</span></div>
    <div className="update-copy"><small>PDFuck 更新检测</small><h2 id="update-title">发现新版本 {update.latestVersion}</h2><p>你正在使用 {update.currentVersion}。新版安装包已经发布，可前往 GitHub Releases 下载。</p></div>
    <div className="update-version"><span>当前版本 <b>{update.currentVersion}</b></span><i>→</i><span>最新版本 <b>{update.latestVersion}</b></span></div>
    <div className="update-actions"><button type="button" onClick={onSkip}>不再提示此版本</button><span /><button type="button" onClick={onLater}>稍后提醒</button><button type="button" className="primary" onClick={onDownload}>前往下载</button></div>
  </div></div>
}

export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => { setVisible(true); const timer = window.setTimeout(() => setVisible(false), 4500); return () => window.clearTimeout(timer) }, [message])
  return visible && message ? <div className="toast">{message}</div> : null
}
