import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnnotationMode, getDocument, OPS, PDFJS_CMAP_URL, PDFJS_STANDARD_FONTS_URL, PDFJS_WASM_URL, type PDFDocumentProxy, type PDFPageProxy } from '../lib/pdfjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { AnnotationRecord, AnnotationReply, CanvasAction, EditableTextRegion, ImageDraft, ImageObjectRecord, PdfPoint, PdfRect, TextObjectRecord, TextSelection, TextStyle, Tool, ViewMode } from '../types'
import { normalizeRect, pointInRect, rectUnion } from '../lib/geometry'
import { adjustCropRect, type CropHandle } from '../lib/crop-geometry'
import { imageRotationForPointer, moveImageRect, resizeImageRect, rotateImageVector, rotatedImageBounds, type ImageResizeHandle } from '../lib/image-geometry'
import { caretForTextPosition, insertionPointAt, moveTextPosition, textCaretAtPoint, textItemsToEditableRegions, textItemsToWordBoxes, textSelectionBetween, textSelectionForQuery, type PdfFontDetails, type TextCaret, type TextPosition, type WordBox } from '../lib/text-layout'
import { canvasOutputScale, singlePageWheelDirection, wheelZoom } from '../lib/rendering'
import { AnnotationIcon } from './AnnotationIcon'
import { sampleCanvasRegionColors } from '../lib/page-text-color'
import { fontCssFamily, fontOptionsFor, normalizeFontFamily } from '../lib/text-fonts'
import { AnnotationColorPicker, AnnotationReplyPicker } from './AnnotationControls'
import { citationLinks, grammarIssues, visualHits, type CitationLink, type GrammarIssue, type InsightHit, type PageTextSnapshot } from '../lib/document-insights'
import { readingOffsetForPage, scrollTopForReadingPosition } from '../lib/reading-position'
import { pageToolUsesPointerCapture } from '../lib/pointer-capture'
import type { ReadingPosition } from '../../../shared/contracts'
import { bindTextSelectionToPage, mergePageTextSelections, type CrossPageSelection, type PageTextSelection } from '../lib/page-text-selection'
import { t, translateUiText, ui, useInterfaceLanguage } from '../lib/i18n'

export interface ViewerHandle { fitWidth(): void; fitPage(): void; goToPage(pageIndex: number): void; focusAnnotation(id: string, pageIndex: number): void; focusText(pageIndex: number, text: string, occurrence?: number): void; focusVisual(pageIndex: number, rects?: PdfRect[]): void; openSearch(): void; showVisuals(): void; linkCitations(): void; clearCitations(): void; checkGrammar(): void }

interface ViewerProps {
  data?: Uint8Array
  password?: string
  mode: ViewMode
  activeTool: Tool
  annotations: AnnotationRecord[]
  focusedAnnotationId?: string
  annotationFocusToken: number
  textObjects: TextObjectRecord[]
  imageObjects: ImageObjectRecord[]
  imageDraft?: ImageDraft
  editableTextObjects: boolean
  annotationMode: boolean
  zoom: number
  fitWidthRequest: number
  fitPageRequest: number
  currentPage: number
  initialReadingPosition?: ReadingPosition
  onZoomChange(zoom: number): void
  onPageChange(pageIndex: number): void
  onReadingPositionChange(position: ReadingPosition): void
  onDocumentReady(pageCount: number): void
  onAction(action: CanvasAction): void
  onSelectionChange(pageIndex: number, selection?: TextSelection): void
  onCopyText(text: string): void
  onAnnotationMove(id: string, dx: number, dy: number): void
  onAnnotationSelect(annotation: AnnotationRecord, options?: { additive?: boolean; range?: boolean }): void
  onAnnotationEdit(annotation: AnnotationRecord): void
  onAnnotationColor(annotation: AnnotationRecord, color: string): void
  onAnnotationReply(annotation: AnnotationRecord, reply?: AnnotationReply): void
  onAnnotationDelete(annotation: AnnotationRecord): void
  onTextObjectMove(id: string, dx: number, dy: number): void
  onTextObjectEdit(textObject: TextObjectRecord): void
  onImageEdit(image: ImageObjectRecord): void
  onImageDraftChange(draft: ImageDraft): void
  onImageDraftConfirm(): void
  onImageDraftCancel(): void
  onImageDraftDelete(): void
  onError(error: Error): void
  onInsight(kind: 'visual' | 'citation' | 'grammar', hits: InsightHit[] | CitationLink[] | GrammarIssue[]): void
}

interface PageProps {
  document: PDFDocumentProxy
  pageIndex: number
  zoom: number
  renderZoom: number
  tool: Tool
  annotations: AnnotationRecord[]
  focusedAnnotationId?: string
  annotationFocusToken: number
  textObjects: TextObjectRecord[]
  imageObjects: ImageObjectRecord[]
  imageDraft?: ImageDraft
  editableTextObjects: boolean
  activePage: boolean
  annotationMode: boolean
  onAction(action: CanvasAction): void
  onSelectionChange(selection?: TextSelection): void
  onTextMap(pageIndex: number, words: WordBox[]): void
  onCrossSelectionStart(pageIndex: number, position?: TextPosition, extend?: boolean): void
  onCrossSelectionMove(pageIndex: number, clientX: number, clientY: number): void
  onCrossSelectionEnd(pageIndex: number, clientX: number, clientY: number, cancel?: boolean): void
  externalSelection?: TextSelection
  crossSelection?: CrossPageSelection
  showSelectionToolbar: boolean
  selectionCancelToken: number
  onCopyText(text: string): void
  onAnnotationMove(id: string, dx: number, dy: number): void
  onAnnotationSelect(annotation: AnnotationRecord, options?: { additive?: boolean; range?: boolean }): void
  onAnnotationEdit(annotation: AnnotationRecord): void
  onAnnotationColor(annotation: AnnotationRecord, color: string): void
  onAnnotationReply(annotation: AnnotationRecord, reply?: AnnotationReply): void
  onAnnotationDelete(annotation: AnnotationRecord): void
  onTextObjectMove(id: string, dx: number, dy: number): void
  onTextObjectEdit(textObject: TextObjectRecord): void
  onImageEdit(image: ImageObjectRecord): void
  onImageDraftChange(draft: ImageDraft): void
  onImageDraftConfirm(): void
  onImageDraftCancel(): void
  onImageDraftDelete(): void
  onSize(pageIndex: number, size: { width: number; height: number }): void
  onError(error: Error): void
  grammarTerms: string[]
  citationHits: CitationLink[]
  searchFocusPage?: number
  textFocus?: { text: string; occurrence: number; caseSensitive: boolean; ignoreWhitespace: boolean; token: number }
  visualFocus?: { rects?: PdfRect[]; token: number }
}

function nearestWord(words: WordBox[], point: PdfPoint): number {
  let best = -1, distance = Number.POSITIVE_INFINITY
  words.forEach((word, index) => {
    const dx = Math.max(word.rect.x - point.x, 0, point.x - word.rect.x - word.rect.width)
    const dy = Math.max(word.rect.y - point.y, 0, point.y - word.rect.y - word.rect.height)
    const value = dx * dx + dy * dy
    if (value < distance) { distance = value; best = index }
  })
  return best
}

function insertionPoint(words: WordBox[], point: PdfPoint): PdfPoint {
  return insertionPointAt(words, point)
}

function selectionFromRange(words: WordBox[], first: number, last: number): TextSelection | undefined {
  if (first < 0 || last < 0) return undefined
  const start = Math.min(first, last), end = Math.max(first, last)
  const lastWord = words[end]
  if (!words[start] || !lastWord) return undefined
  return textSelectionBetween(words, { wordIndex: start, offset: 0 }, { wordIndex: end, offset: Array.from(lastWord.text).length })
}

function SelectionAnnotationToolbar({ selection, zoom, pageSize, onChoose }: { selection: TextSelection; zoom: number; pageSize: { width: number; height: number }; onChoose(tool: Tool): void }) {
  useInterfaceLanguage()
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; offset: { x: number; y: number } } | undefined>(undefined)
  const bounds = rectUnion(selection.rects)
  useEffect(() => { setOffset({ x: 0, y: 0 }) }, [selection.text, bounds.x, bounds.y, bounds.width, bounds.height])
  const width = 272, height = 40
  const baseLeft = Math.max(5, Math.min(pageSize.width * zoom - width - 5, (bounds.x + bounds.width / 2) * zoom - width / 2))
  const baseTop = bounds.y * zoom >= height + 8 ? bounds.y * zoom - height - 7 : Math.min(pageSize.height * zoom - height - 5, (bounds.y + bounds.height) * zoom + 7)
  const beginDrag = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation(); drag.current = { x: event.clientX, y: event.clientY, offset }; event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: React.PointerEvent) => {
    if (!drag.current) return
    event.preventDefault(); event.stopPropagation()
    const nextX = event.clientX - drag.current.x + drag.current.offset.x, nextY = event.clientY - drag.current.y + drag.current.offset.y
    setOffset({ x: Math.max(5 - baseLeft, Math.min(pageSize.width * zoom - width - 5 - baseLeft, nextX)), y: Math.max(5 - baseTop, Math.min(pageSize.height * zoom - height - 5 - baseTop, nextY)) })
  }
  const finishDrag = (event: React.PointerEvent) => {
    if (!drag.current) return
    event.stopPropagation(); drag.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const tools: Array<{ tool: Tool; label: string; kind: 'highlight' | 'replace' | 'delete_text' | 'underline' | 'note' | 'insert' }> = [
    { tool: 'highlight', label: ui('文本高亮'), kind: 'highlight' }, { tool: 'replace', label: ui('文本替换'), kind: 'replace' }, { tool: 'delete_text', label: ui('文本删除'), kind: 'delete_text' }, { tool: 'underline', label: ui('加下划线'), kind: 'underline' }, { tool: 'note', label: ui('自由批注'), kind: 'note' }, { tool: 'insert', label: ui('插入文字'), kind: 'insert' }
  ]
  return <div className="selection-annotation-toolbar" style={{ left: baseLeft + offset.x, top: baseTop + offset.y }} onPointerDown={(event) => event.stopPropagation()} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
    <button type="button" className="selection-toolbar-grip" aria-label={ui('拖动批注快捷浮窗')} title={ui('拖动浮窗')} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}>⠿</button>
    {tools.map((item) => <button type="button" key={item.tool} className="selection-toolbar-button" aria-label={item.label} title={item.label} onClick={(event) => { event.stopPropagation(); onChoose(item.tool) }}><AnnotationIcon kind={item.kind} size={18} /></button>)}
    <button type="button" className="selection-toolbar-button" aria-label={ui('智能润色')} title={ui('智能润色 (Ctrl/⌘I)')} onClick={(event) => { event.stopPropagation(); window.dispatchEvent(new Event('pdfuck:open-ai-polish')) }}><AnnotationIcon kind="ai_polish" size={18} /></button>
  </div>
}

interface SearchMatch { pageIndex: number; context: string; match: string; occurrence: number; caseSensitive: boolean; ignoreWhitespace: boolean }
interface SearchFocusTarget { pageIndex: number; text: string; occurrence?: number; caseSensitive?: boolean; ignoreWhitespace?: boolean }

type PdfMatrix = [number, number, number, number, number, number]
function multiplyPdfMatrix(left: PdfMatrix, right: PdfMatrix): PdfMatrix {
  return [left[0] * right[0] + left[2] * right[1], left[1] * right[0] + left[3] * right[1], left[0] * right[2] + left[2] * right[3], left[1] * right[2] + left[3] * right[3], left[0] * right[4] + left[2] * right[5] + left[4], left[1] * right[4] + left[3] * right[5] + left[5]]
}
function imageRectsForPage(page: PDFPageProxy, viewportTransform: PdfMatrix, operators: Awaited<ReturnType<PDFPageProxy['getOperatorList']>>): PdfRect[] {
  const images = new Set<number>([OPS.paintImageMaskXObject, OPS.paintImageMaskXObjectRepeat, OPS.paintImageXObject, OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObject, OPS.paintInlineImageXObjectGroup, OPS.paintSolidColorImageMask])
  const stack: PdfMatrix[] = [], rects: PdfRect[] = []
  let current: PdfMatrix = [1, 0, 0, 1, 0, 0]
  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const operation = operators.fnArray[index]
    if (operation === OPS.save) stack.push(current)
    else if (operation === OPS.restore) current = stack.pop() || [1, 0, 0, 1, 0, 0]
    else if (operation === OPS.transform) current = multiplyPdfMatrix(current, operators.argsArray[index] as PdfMatrix)
    else if (images.has(operation)) {
      const matrix = multiplyPdfMatrix(viewportTransform, current)
      const points = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }].map((point) => ({ x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] }))
      const xs = points.map((point) => point.x), ys = points.map((point) => point.y), x = Math.min(...xs), y = Math.min(...ys)
      const width = Math.max(...xs) - x, height = Math.max(...ys) - y
      if (width > 2 && height > 2) rects.push({ x, y, width, height })
    }
  }
  return rects
}

const REGEX_PRESETS = [
  { label: '邮箱', value: '[\\w.+-]+@[\\w-]+\\.[A-Za-z]{2,}' },
  { label: '网址', value: 'https?://[^\\s]+' },
  { label: '中文手机号', value: '1[3-9]\\d{9}' },
  { label: '日期', value: '(?:19|20)\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?' },
  { label: '数字', value: '\\b\\d+(?:\\.\\d+)?%?\\b' },
  { label: '英文单词', value: '\\b[A-Za-z]{2,}\\b' },
  { label: '引用编号', value: '\\[\\d+(?:[-,]\\d+)*\\]' },
  { label: 'DOI', value: '10\\.\\d{4,9}/[-._;()/:A-Z0-9]+' },
  { label: 'ISBN', value: 'ISBN(?:-1[03])?:?[-\\dXx ]{10,}' },
  { label: '括号内容', value: '[（(][^）)]{1,80}[）)]' }
]

function SearchPanel({ document, onClose, onJump, onFocusTarget }: { document: PDFDocumentProxy; onClose(): void; onJump(pageIndex: number): void; onFocusTarget(target: SearchFocusTarget): void }) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [fuzzy, setFuzzy] = useState(true)
  const [regex, setRegex] = useState(false)
  const [results, setResults] = useState<SearchMatch[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [position, setPosition] = useState(() => ({ x: Math.max(12, (typeof window === 'undefined' ? 1200 : window.innerWidth) - 378), y: 108 }))
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | undefined>(undefined)
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const maxX = Math.max(12, window.innerWidth - 372)
      const maxY = Math.max(12, window.innerHeight - 120)
      setPosition({ x: Math.max(12, Math.min(maxX, drag.x + event.clientX - drag.startX)), y: Math.max(12, Math.min(maxY, drag.y + event.clientY - drag.startY)) })
    }
    const stop = () => { dragRef.current = undefined }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop) }
  }, [])
  const search = async () => {
    if (!query.trim()) { setResults([]); return }
    setBusy(true); setError('')
    try {
      const flags = caseSensitive ? 'g' : 'gi'
      const pattern = regex ? new RegExp(query, flags) : undefined
      const next: SearchMatch[] = []
      for (let pageIndex = 0; pageIndex < document.numPages; pageIndex += 1) {
        const content = await document.getPage(pageIndex + 1).then((page) => page.getTextContent())
        const text = content.items.filter((item): item is TextItem => 'str' in item).flatMap((item) => Array.from(item.str.matchAll(/\S+/gu), (match) => match[0])).join(' ')
        const normalizedQuery = query.trim().replace(/\s+/g, ' ')
        const ignoreWhitespace = fuzzy && !regex
        const source = ignoreWhitespace ? text.replace(/\s+/g, '') : text
        const rawNeedle = fuzzy && !regex ? normalizedQuery.replace(/\s+/g, '') : normalizedQuery
        const needle = caseSensitive ? rawNeedle : rawNeedle.toLowerCase()
        if (regex) {
          pattern!.lastIndex = 0
          const occurrences = new Map<string, number>()
          let match: RegExpExecArray | null
          while ((match = pattern!.exec(text))) {
            const matchedText = match[0].trim().replace(/\s+/g, ' ')
            if (matchedText) {
              const key = caseSensitive ? matchedText : matchedText.toLocaleLowerCase()
              const occurrence = occurrences.get(key) || 0
              occurrences.set(key, occurrence + 1)
              next.push({ pageIndex, match: matchedText, occurrence, caseSensitive, ignoreWhitespace: false, context: text.slice(Math.max(0, match.index - 46), Math.min(text.length, match.index + match[0].length + 72)) })
            }
            if (!match[0]) pattern!.lastIndex += 1
          }
        } else {
          const haystack = caseSensitive ? source : source.toLowerCase()
          const compactOffsets = ignoreWhitespace ? Array.from(text).flatMap((char, index) => /\s/u.test(char) ? [] : [index]) : []
          let occurrence = 0
          let offset = haystack.indexOf(needle)
          while (offset >= 0) {
            const contextOffset = ignoreWhitespace ? compactOffsets[offset] ?? 0 : offset
            const raw = text.slice(Math.max(0, contextOffset - 46), Math.min(text.length, contextOffset + normalizedQuery.length + 72))
            next.push({ pageIndex, match: normalizedQuery, occurrence: occurrence++, caseSensitive, ignoreWhitespace, context: raw })
            offset = haystack.indexOf(needle, offset + Math.max(1, needle.length))
          }
        }
      }
      setResults(next.slice(0, 200))
    } catch (cause) { setError(cause instanceof Error ? cause.message : ui("搜索表达式无效")) }
    finally { setBusy(false) }
  }
  return <div className={`pdf-search-panel${results.length ? ' expanded' : ''}`} style={{ left: position.x, top: position.y }} onPointerDown={(event) => event.stopPropagation()}>
    <div className="pdf-search-heading" onPointerDown={(event) => { if ((event.target as HTMLElement).closest('button')) return; dragRef.current = { startX: event.clientX, startY: event.clientY, x: position.x, y: position.y }; event.preventDefault() }}><b>{ui("搜索文档")}</b><button type="button" onClick={onClose} aria-label={ui("关闭搜索")} title={ui("关闭搜索")}>×</button></div>
    <div className="pdf-search-input-row"><input ref={inputRef} value={query} placeholder={ui("输入文字或正则表达式")} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search() } if (event.key === 'Escape') onClose() }} /><button type="button" className="primary" onClick={() => void search()}>{busy ? '…' : ui("搜索")}</button></div>
    <div className="pdf-search-options"><label><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />{ui("匹配大小写")}</label><label><input type="checkbox" checked={fuzzy} onChange={(event) => setFuzzy(event.target.checked)} disabled={regex} />{ui("模糊匹配")}</label><label><input type="checkbox" checked={regex} onChange={(event) => setRegex(event.target.checked)} />{ui("正则表达式")}</label></div>
    {regex && <select className="pdf-regex-presets" value="" onChange={(event) => setQuery(event.target.value)}><option value="">{ui("常用正则表达式")}</option>{REGEX_PRESETS.map((preset) => <option key={preset.label} value={preset.value}>{ui(preset.label)}</option>)}</select>}
    {error && <p className="pdf-search-error">{error}</p>}
    {results.length > 0 && <div className="pdf-search-results"><header><span>{t('search.results', { count: `${results.length}${results.length >= 200 ? '+' : ''}` })}</span></header>{results.map((result, index) => <button type="button" key={`${result.pageIndex}-${index}`} onClick={() => { onJump(result.pageIndex); onFocusTarget({ pageIndex: result.pageIndex, text: result.match, occurrence: result.occurrence, caseSensitive: result.caseSensitive, ignoreWhitespace: result.ignoreWhitespace }) }}><b>{t('search.page', { page: result.pageIndex + 1 })}</b><span>{result.context}</span></button>)}</div>}
  </div>
}

function AnnotationOverlay({ annotation, zoom, focused, focusToken, onMove, onSelect, onEdit, onContext }: { annotation: AnnotationRecord; zoom: number; focused: boolean; focusToken: number; onMove(id: string, dx: number, dy: number): void; onSelect(annotation: AnnotationRecord, options?: { additive?: boolean; range?: boolean }): void; onEdit(annotation: AnnotationRecord): void; onContext(annotation: AnnotationRecord, clientX: number, clientY: number): void }) {
  const bounds = rectUnion(annotation.rects)
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const markup = !['note', 'insert'].includes(annotation.kind)
  const style = { left: bounds.x * zoom, top: bounds.y * zoom, width: Math.max(8, bounds.width * zoom), height: Math.max(8, bounds.height * zoom), '--annotation-color': annotation.color } as CSSProperties
  return <div
    className={`annotation-hit ${markup ? 'markup' : 'point'} annotation-${annotation.kind}${focused ? ' focused' : ''}`}
    style={style}
    data-annotation-id={annotation.id}
    title={annotation.content || annotation.kind}
    onPointerDown={(event) => { if (event.button !== 0) return; event.stopPropagation(); drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }; onSelect(annotation, { additive: event.metaKey || event.ctrlKey, range: event.shiftKey }); event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerUp={(event) => {
      event.stopPropagation()
      if (!drag.current || drag.current.pointerId !== event.pointerId) return
      const dx = (event.clientX - drag.current.x) / zoom, dy = (event.clientY - drag.current.y) / zoom
      drag.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      if (Math.hypot(dx, dy) > 2) onMove(annotation.id, dx, dy)
    }}
    onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = null }}
    onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = null }}
    onDoubleClick={(event) => { event.stopPropagation(); onSelect(annotation); onEdit(annotation) }}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(annotation); onContext(annotation, event.clientX, event.clientY) }}
  >
    {annotation.rects.map((rect, index) => <span key={index} className="annotation-segment" style={{ left: (rect.x - bounds.x) * zoom, top: (rect.y - bounds.y) * zoom, width: rect.width * zoom, height: rect.height * zoom }} />)}
    {annotation.kind === 'note' && <span className="note-pin">●</span>}
    {annotation.kind === 'insert' && <span className="insert-caret" aria-hidden="true" />}
    {focused && <>{annotation.rects.map((rect, index) => <span key={`${focusToken}-${index}`} className="annotation-focus-ring" style={{ left: (rect.x - bounds.x) * zoom - 2, top: (rect.y - bounds.y) * zoom - 2, width: Math.max(6, rect.width * zoom + 4), height: Math.max(6, rect.height * zoom + 4) }} />)}<span key={`badge-${focusToken}`} className="annotation-focus-badge" style={{ left: (annotation.rects[0].x - bounds.x + annotation.rects[0].width / 2) * zoom, top: (annotation.rects[0].y - bounds.y) * zoom - 25 }}>{t('annotation.current')}</span></>}
  </div>
}

function TextObjectOverlay({ textObject, zoom, editable, onMove, onEdit }: { textObject: TextObjectRecord; zoom: number; editable: boolean; onMove(id: string, dx: number, dy: number): void; onEdit(textObject: TextObjectRecord): void }) {
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState(false)
  useEffect(() => { if (!editable) setSelected(false) }, [editable])
  const { rect, style } = textObject
  const fontFamily = fontCssFamily(style.font)
  return <div className={`text-object${editable ? ' editable' : ''}${selected && editable ? ' selected' : ''}`} style={{
    left: rect.x * zoom + offset.x, top: rect.y * zoom + offset.y, width: rect.width * zoom, height: rect.height * zoom,
    color: style.color, fontFamily, fontSize: style.size * zoom, fontWeight: style.bold ? 700 : 400, fontStyle: style.italic ? 'italic' : 'normal', fontStretch: `${style.horizontalScale || 100}%`, letterSpacing: (style.letterSpacing || 0) * zoom, textAlign: style.align,
    lineHeight: style.lineHeight || 1.25, paddingTop: (style.paragraphBefore || 0) * zoom, paddingBottom: (style.paragraphAfter || 0) * zoom
  }} title={editable ? ui("拖动调整位置，双击编辑文字和格式") : textObject.text}
    onPointerDown={(event) => {
      if (!editable || event.button !== 0) return
      event.stopPropagation(); setSelected(true); drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={(event) => { if (drag.current) setOffset({ x: event.clientX - drag.current.x, y: event.clientY - drag.current.y }) }}
    onPointerUp={(event) => {
      if (!drag.current) return
      event.stopPropagation()
      const dx = (event.clientX - drag.current.x) / zoom, dy = (event.clientY - drag.current.y) / zoom
      drag.current = null; setOffset({ x: 0, y: 0 })
      if (Math.hypot(dx, dy) > 1) onMove(textObject.id, dx, dy)
    }}
    onPointerCancel={(event) => { drag.current = null; setOffset({ x: 0, y: 0 }); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onLostPointerCapture={() => { drag.current = null; setOffset({ x: 0, y: 0 }) }}
    onDoubleClick={(event) => { if (editable) { event.stopPropagation(); onEdit(textObject) } }}
  >{textObject.text}</div>
}

function SavedImageOverlay({ image, zoom, editable, onEdit }: { image: ImageObjectRecord; zoom: number; editable: boolean; onEdit(image: ImageObjectRecord): void }) {
  useInterfaceLanguage()
  const [source, setSource] = useState('')
  useEffect(() => {
    const bytes = new Uint8Array(image.data.length); bytes.set(image.data)
    const url = URL.createObjectURL(new Blob([bytes.buffer], { type: image.format === 'png' ? 'image/png' : 'image/jpeg' }))
    setSource(url)
    return () => URL.revokeObjectURL(url)
  }, [image.data, image.format, image.id])
  return <div className={`saved-image${editable ? ' editable' : ''}`} style={{ left: image.rect.x * zoom, top: image.rect.y * zoom, width: image.rect.width * zoom, height: image.rect.height * zoom, transform: `rotate(${image.rotation}deg)` }} title={editable ? ui('点击已添加图片重新编辑') : image.name}
    onPointerDown={(event) => { if (editable) event.stopPropagation() }} onClick={(event) => { if (!editable) return; event.stopPropagation(); onEdit(image) }}>
    {source && <img src={source} alt={image.name} draggable={false} />}
  </div>
}

function ImageDraftOverlay({ draft, zoom, bounds, onChange, onConfirm, onCancel, onDelete }: { draft: ImageDraft; zoom: number; bounds: { width: number; height: number }; onChange(draft: ImageDraft): void; onConfirm(): void; onCancel(): void; onDelete(): void }) {
  useInterfaceLanguage()
  const interaction = useRef<{ kind: 'move' | 'resize' | 'rotate'; handle?: ImageResizeHandle; x: number; y: number; initial: ImageDraft } | undefined>(undefined)
  const begin = (kind: 'move' | 'resize' | 'rotate', event: React.PointerEvent, handle?: ImageResizeHandle) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    interaction.current = { kind, handle, x: event.clientX, y: event.clientY, initial: draft }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent) => {
    const active = interaction.current
    if (!active) return
    event.preventDefault(); event.stopPropagation()
    const delta = { x: (event.clientX - active.x) / zoom, y: (event.clientY - active.y) / zoom }
    if (active.kind === 'move') onChange({ ...active.initial, rect: moveImageRect(active.initial.rect, delta, active.initial.rotation, bounds) })
    else if (active.kind === 'resize' && active.handle) onChange({ ...active.initial, rect: resizeImageRect(active.initial.rect, active.handle, delta, active.initial.rotation, bounds, { lockAspectRatio: active.initial.lockAspectRatio, aspectRatio: active.initial.aspectRatio }) })
    else {
      const center = { x: active.initial.rect.x + active.initial.rect.width / 2, y: active.initial.rect.y + active.initial.rect.height / 2 }
      const knobOffset = rotateImageVector({ x: 0, y: -active.initial.rect.height / 2 - 27 / zoom }, active.initial.rotation)
      const pagePointer = { x: center.x + knobOffset.x + delta.x, y: center.y + knobOffset.y + delta.y }
      onChange({ ...active.initial, rotation: imageRotationForPointer(center, pagePointer, event.shiftKey) })
    }
  }
  const finish = (event: React.PointerEvent) => {
    if (!interaction.current) return
    event.preventDefault(); event.stopPropagation(); interaction.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const displayed = rotatedImageBounds(draft.rect, draft.rotation)
  const actionWidth = draft.id ? 432 : 318
  const actionLeft = Math.max(4, Math.min(bounds.width * zoom - actionWidth - 4, (displayed.x + displayed.width / 2) * zoom - actionWidth / 2))
  const actionBelow = displayed.y + displayed.height + 44 / zoom <= bounds.height
  const actionTop = actionBelow ? (displayed.y + displayed.height) * zoom + 8 : Math.max(4, displayed.y * zoom - 42)
  const handles: ImageResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  return <>
    <div className="image-draft" style={{ left: draft.rect.x * zoom, top: draft.rect.y * zoom, width: draft.rect.width * zoom, height: draft.rect.height * zoom, transform: `rotate(${draft.rotation}deg)` }} title={ui('拖动图片调整位置')}
      onPointerDown={(event) => begin('move', event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <img src={draft.source} alt={draft.name} draggable={false} />
      <span className="image-draft-label">{draft.id ? ui('正在编辑已添加图片') : ui('待添加图片')}</span>
      <span className="image-rotate-stem" aria-hidden />
      <span className="image-rotate-handle" aria-label={ui('拖动旋转控制点调整图片角度')} title={ui('拖动旋转控制点调整图片角度')} onPointerDown={(event) => begin('rotate', event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />
      {handles.map((handle) => <span key={handle} className={`image-resize-handle image-resize-handle-${handle}`} aria-label={ui('拖动控制点调整图片大小')} title={ui('拖动控制点调整图片大小')} onPointerDown={(event) => begin('resize', event, handle)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />)}
    </div>
    <div className={`image-draft-actions${draft.id ? ' has-delete' : ''}`} style={{ left: actionLeft, top: actionTop, minWidth: actionWidth }} onPointerDown={(event) => event.stopPropagation()}>
      <span>{ui('拖动、缩放、旋转或切换比例锁后确认')}</span>
      <button type="button" className={`image-aspect-lock${draft.lockAspectRatio ? ' active' : ''}`} aria-pressed={draft.lockAspectRatio} title={draft.lockAspectRatio ? ui('已锁定原始比例') : ui('未锁定原始比例')} onClick={(event) => { event.stopPropagation(); onChange({ ...draft, lockAspectRatio: !draft.lockAspectRatio }) }}>{draft.lockAspectRatio ? ui('比例已锁定') : ui('比例未锁定')}</button>
      <button type="button" onClick={(event) => { event.stopPropagation(); onCancel() }}>{ui('取消')}</button>
      {draft.id && <button type="button" className="danger" onClick={(event) => { event.stopPropagation(); onDelete() }}>{ui('删除图片')}</button>}
      <button type="button" className="primary" onClick={(event) => { event.stopPropagation(); onConfirm() }}>{draft.id ? ui('确认更新图片') : ui('确认添加图片')}</button>
    </div>
  </>
}

function PageTextEditor({ region, zoom, pageSize, initialColor, backgroundColor, onCancel, onSave }: { region: EditableTextRegion; zoom: number; pageSize: { width: number; height: number }; initialColor: string; backgroundColor: string; onCancel(): void; onSave(text: string, style: TextStyle): void }) {
  const [text, setText] = useState(region.text)
  const [style, setStyle] = useState<TextStyle>({ ...region.style, color: initialColor })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { textareaRef.current?.focus(); textareaRef.current?.select() }, [])
  const lineHeight = style.lineHeight || 1.25
  const paragraphBefore = Math.max(0, style.paragraphBefore || 0), paragraphAfter = Math.max(0, style.paragraphAfter || 0)
  const fontFamily = fontCssFamily(style.font)
  const fontOptions = fontOptionsFor(style.font)
  const editorWidth = Math.max(100, Math.min(pageSize.width * zoom - region.rect.x * zoom, region.rect.width * zoom + 12))
  const editorHeight = Math.max(30, region.rect.height * zoom + 8, (style.size * lineHeight + paragraphBefore + paragraphAfter) * zoom + 8)
  const toolbarWidth = 550
  const toolbarLeft = Math.max(6, Math.min(pageSize.width * zoom - toolbarWidth - 6, region.rect.x * zoom))
  const toolbarHeight = 78
  const toolbarTop = region.rect.y * zoom >= toolbarHeight + 8 ? region.rect.y * zoom - toolbarHeight - 6 : Math.min(pageSize.height * zoom - toolbarHeight, region.rect.y * zoom + editorHeight + 7)
  const submit = () => onSave(text, style)
  return <>
    <textarea ref={textareaRef} className="page-text-inline-editor" value={text} aria-label={ui("编辑页面文字内容")} style={{ left: region.rect.x * zoom, top: region.rect.y * zoom, width: editorWidth, height: editorHeight, paddingTop: 3 + paragraphBefore * zoom, paddingBottom: 3 + paragraphAfter * zoom, color: style.color, backgroundColor, fontFamily, fontSize: style.size * zoom, fontWeight: style.bold ? 700 : 400, fontStyle: style.italic ? 'italic' : 'normal', fontStretch: `${style.horizontalScale || 100}%`, letterSpacing: (style.letterSpacing || 0) * zoom, textAlign: style.align, lineHeight }} onChange={(event) => setText(event.target.value)} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') onCancel(); else if ((event.ctrlKey || event.metaKey) && (event.key === 'Enter' || event.key.toLowerCase() === 's')) { event.preventDefault(); submit() } }} />
    <div className="page-text-format-toolbar" style={{ left: toolbarLeft, top: toolbarTop }} onPointerDown={(event) => event.stopPropagation()}>
      <div className="format-toolbar-row"><span className="format-toolbar-grip" aria-hidden="true">Aa</span>
        <label title={ui("字体")}><select aria-label={ui("字体")} value={normalizeFontFamily(style.font)} onChange={(event) => setStyle({ ...style, font: event.target.value })}>{fontOptions.map((option) => <option key={option.value} value={option.value}>{option.label.endsWith('（原文字体）') ? `${option.label.slice(0, -6)} (${ui('原文字体')})` : translateUiText(option.label)}</option>)}</select></label>
        <label className="format-size" title={ui("字号")}><input aria-label={ui("字号")} type="number" min="6" max="144" step=".5" value={style.size} onChange={(event) => setStyle({ ...style, size: Math.max(6, Math.min(144, Number(event.target.value) || 6)) })} /></label>
        <button type="button" className={style.bold ? 'active' : ''} aria-label={ui("粗体")} title={ui("粗体")} onClick={() => setStyle({ ...style, bold: !style.bold })}><b>B</b></button>
        <button type="button" className={style.italic ? 'active' : ''} aria-label={ui("斜体")} title={ui("斜体")} onClick={() => setStyle({ ...style, italic: !style.italic })}><i>I</i></button>
        <label className="format-color" title={ui("文字颜色")}><input aria-label={ui("文字颜色")} type="color" value={style.color} onChange={(event) => setStyle({ ...style, color: event.target.value })} /></label>
        <span className="toolbar-spacer" /><button type="button" className="toolbar-cancel" onClick={onCancel}>{ui("取消")}</button><button type="button" className="primary toolbar-apply" onClick={submit}>{ui("应用")}</button>
      </div>
      <div className="format-toolbar-row secondary"><span className="format-group-label">{ui("段落")}</span>
        {(['left', 'center', 'right'] as const).map((align) => <button type="button" key={align} className={style.align === align ? 'active' : ''} aria-label={align === 'left' ? ui("左对齐") : align === 'center' ? ui("居中") : ui("右对齐")} title={align === 'left' ? ui("左对齐") : align === 'center' ? ui("居中") : ui("右对齐")} onClick={() => setStyle({ ...style, align })}><span className={`align-glyph ${align}`} /></button>)}
        <label className="format-line-height" title={ui("段落行距")}><select aria-label={ui("段落行距")} value={lineHeight} onChange={(event) => setStyle({ ...style, lineHeight: Number(event.target.value) as TextStyle['lineHeight'] })}><option value="1">{ui("紧凑")}</option><option value="1.25">{ui("正文")}</option><option value="1.5">{ui("宽松")}</option><option value="2">{ui("双倍")}</option></select></label>
        <label className="format-number" title={ui("段前距")}><span>{ui("段前")}</span><input aria-label={ui("段前距")} type="number" min="0" max="144" step=".5" value={paragraphBefore} onChange={(event) => setStyle({ ...style, paragraphBefore: Math.max(0, Math.min(144, Number(event.target.value) || 0)) })} /></label>
        <label className="format-number" title={ui("段后距")}><span>{ui("段后")}</span><input aria-label={ui("段后距")} type="number" min="0" max="144" step=".5" value={paragraphAfter} onChange={(event) => setStyle({ ...style, paragraphAfter: Math.max(0, Math.min(144, Number(event.target.value) || 0)) })} /></label>
        <span className="toolbar-divider" /><span className="format-group-label">{ui("字符")}</span>
        <label className="format-number" title={ui("字符间距")}><span>{ui("间距")}</span><input aria-label={ui("字符间距")} type="number" min="-5" max="20" step=".1" value={style.letterSpacing || 0} onChange={(event) => setStyle({ ...style, letterSpacing: Math.max(-5, Math.min(20, Number(event.target.value) || 0)) })} /></label>
        <label className="format-number format-width" title={ui("文字宽度比例")}><span>{ui("宽度")}</span><input aria-label={ui("文字宽度")} type="number" min="50" max="200" step="1" value={style.horizontalScale || 100} onChange={(event) => setStyle({ ...style, horizontalScale: Math.max(50, Math.min(200, Number(event.target.value) || 100)) })} /><em>%</em></label>
      </div>
    </div>
  </>
}

function CropDraftOverlay({ rect, zoom, bounds, onChange, onConfirm, onCancel }: { rect: PdfRect; zoom: number; bounds: { width: number; height: number }; onChange(rect: PdfRect): void; onConfirm(): void; onCancel(): void }) {
  const interaction = useRef<{ handle: CropHandle; x: number; y: number; initial: PdfRect } | undefined>(undefined)
  const begin = (handle: CropHandle, event: React.PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    interaction.current = { handle, x: event.clientX, y: event.clientY, initial: rect }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent) => {
    const active = interaction.current
    if (!active) return
    event.preventDefault(); event.stopPropagation()
    onChange(adjustCropRect(active.initial, active.handle, (event.clientX - active.x) / zoom, (event.clientY - active.y) / zoom, bounds))
  }
  const finish = (event: React.PointerEvent) => {
    if (!interaction.current) return
    event.preventDefault(); event.stopPropagation(); interaction.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const actionBelow = rect.y + rect.height + 42 / zoom <= bounds.height
  const actionLeft = Math.max(4, Math.min(bounds.width * zoom - 154, rect.x * zoom))
  const actionTop = actionBelow ? (rect.y + rect.height) * zoom + 7 : Math.max(4, rect.y * zoom - 37)
  const handles: Exclude<CropHandle, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  return <>
    <div className="crop-draft" style={{ left: rect.x * zoom, top: rect.y * zoom, width: rect.width * zoom, height: rect.height * zoom }}
      onPointerDown={(event) => begin('move', event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <span className="crop-draft-label">{t('crop.label')}</span>
      {handles.map((handle) => <span key={handle} className={`crop-handle crop-handle-${handle}`} onPointerDown={(event) => begin(handle, event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} />)}
    </div>
    <div className="crop-actions" style={{ left: actionLeft, top: actionTop }} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={(event) => { event.stopPropagation(); onCancel() }}>{ui("取消")}</button>
      <button type="button" className="primary" onClick={(event) => { event.stopPropagation(); onConfirm() }}>{t('crop.confirm')}</button>
    </div>
  </>
}

interface PageDrag { start: PdfPoint; current: PdfPoint; anchor?: TextPosition; focus?: TextPosition; moved: boolean }

function PdfPage({ document, pageIndex, zoom, renderZoom, tool, annotations, focusedAnnotationId, annotationFocusToken, textObjects, imageObjects, imageDraft, editableTextObjects, activePage, annotationMode, onAction, onSelectionChange, onTextMap, onCrossSelectionStart, onCrossSelectionMove, onCrossSelectionEnd, externalSelection, crossSelection, showSelectionToolbar, selectionCancelToken, onCopyText, onAnnotationMove, onAnnotationSelect, onAnnotationEdit, onAnnotationColor, onAnnotationReply, onAnnotationDelete, onTextObjectMove, onTextObjectEdit, onImageEdit, onImageDraftChange, onImageDraftConfirm, onImageDraftCancel, onImageDraftDelete, onSize, onError, grammarTerms, citationHits, searchFocusPage, textFocus, visualFocus }: PageProps) {
  useInterfaceLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const preciseFocusRef = useRef<HTMLDivElement>(null)
  const visualFocusRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState<PDFPageProxy>()
  const [size, setSize] = useState({ width: 612, height: 792 })
  const [words, setWords] = useState<WordBox[]>([])
  const [textRegions, setTextRegions] = useState<EditableTextRegion[]>([])
  const [pageTextEditor, setPageTextEditor] = useState<{ region: EditableTextRegion; foreground: string; background: string }>()
  const [selection, setSelection] = useState<TextSelection>()
  const [textCaret, setTextCaret] = useState<TextCaret>()
  const [selectionAnchor, setSelectionAnchor] = useState<TextPosition>()
  const [drag, setDrag] = useState<PageDrag>()
  const dragRef = useRef<PageDrag | undefined>(undefined)
  const [cropDraft, setCropDraft] = useState<PdfRect>()
  const [menu, setMenu] = useState<{ x: number; y: number; point: PdfPoint; annotation?: AnnotationRecord }>()
  const [hoverInsert, setHoverInsert] = useState<PdfPoint>()
  const [citationPopup, setCitationPopup] = useState<{ key: string; hits: CitationLink[]; rect: PdfRect }>()
  const [copiedCitation, setCopiedCitation] = useState(false)
  const [renderEligible, setRenderEligible] = useState(pageIndex < 2)
  const [textRequested, setTextRequested] = useState(pageIndex < 2)
  const textLoadedRef = useRef(false)
  const editableRegions = useMemo(() => textRegions.filter((region) => {
    const center = { x: region.rect.x + region.rect.width / 2, y: region.rect.y + region.rect.height / 2 }
    return !textObjects.some((textObject) => pointInRect(center, textObject.rect, 1))
  }), [textObjects, textRegions])
  const crossPageSelection = crossSelection?.segments.find((segment) => segment.pageIndex === pageIndex)
  // During a cross-page drag, the live cross-page state is authoritative. Do
  // not fall back to a stale page-local selection while the pointer is down.
  const activeSelection = crossSelection ? crossPageSelection : selection || externalSelection
  const actionSelection = crossSelection || activeSelection

  useEffect(() => {
    const element = pageRef.current
    if (!element || typeof IntersectionObserver === 'undefined') { setRenderEligible(true); return }
    const root = element.closest('.viewer')
    const observer = new IntersectionObserver(([entry]) => { setRenderEligible(entry.isIntersecting); if (entry.isIntersecting) setTextRequested(true) }, { root, rootMargin: '800px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    document.getPage(pageIndex + 1).then((value) => {
      if (cancelled) return
      setPage(value)
      const viewport = value.getViewport({ scale: 1 })
      const next = { width: viewport.width, height: viewport.height }
      setSize(next); onSize(pageIndex, next)
    }).catch((error) => onError(error instanceof Error ? error : new Error(String(error))))
    return () => { cancelled = true }
  }, [document, pageIndex, onError, onSize])

  useEffect(() => {
    if (!page || !textRequested || textLoadedRef.current) return
    textLoadedRef.current = true
    let cancelled = false
    const viewport = page.getViewport({ scale: 1 })
    Promise.all([page.getTextContent(), page.getOperatorList()]).then(([content]) => {
      if (cancelled) return
      const items = content.items.filter((item): item is TextItem => 'str' in item)
      const fontDetails: Record<string, PdfFontDetails> = {}
      for (const fontName of new Set(items.map((item) => item.fontName))) {
        try {
          const font = page.commonObjs.get(fontName) as PdfFontDetails | undefined
          if (font) fontDetails[fontName] = { name: font.name, bold: font.bold, italic: font.italic }
        } catch { /* PDF.js can defer an uncommon font object; family/size still remain available. */ }
      }
      const nextWords = textItemsToWordBoxes(items, content.styles, viewport.transform as [number, number, number, number, number, number], fontDetails)
      setWords(nextWords); onTextMap(pageIndex, nextWords)
      setTextRegions(textItemsToEditableRegions(items, content.styles, viewport.transform as [number, number, number, number, number, number], fontDetails))
    }).catch((error) => { textLoadedRef.current = false; onError(error instanceof Error ? error : new Error(String(error))) })
    return () => { cancelled = true }
  }, [page, pageIndex, textRequested, onError, onTextMap])

  useEffect(() => {
    if (externalSelection) setSelection(externalSelection)
    else if (selectionCancelToken) setSelection(undefined)
  }, [externalSelection, selectionCancelToken])

  // Search and insight results can target a page that was not previously
  // visible. Request its text map immediately so the precise highlight does
  // not depend on the intersection observer or the scroll animation timing.
  useEffect(() => {
    if (textFocus || citationHits.length) setTextRequested(true)
  }, [textFocus, citationHits.length])

  useEffect(() => {
    if (!page || !canvasRef.current || !renderEligible) return
    let cancelled = false
    const viewport = page.getViewport({ scale: renderZoom })
    const outputScale = canvasOutputScale(viewport.width, viewport.height, window.devicePixelRatio || 1)
    const buffer = window.document.createElement('canvas')
    buffer.width = Math.max(1, Math.floor(viewport.width * outputScale))
    buffer.height = Math.max(1, Math.floor(viewport.height * outputScale))
    const context = buffer.getContext('2d', { alpha: false })
    if (!context) return
    // PDFuck renders its own annotation overlays from PdfDocumentModel. Letting
    // PDF.js paint the same PDF annotations into the canvas creates a second,
    // non-interactive copy that remains visible after the overlay is deleted.
    const task = page.render({ canvas: buffer, canvasContext: context, viewport, transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0], annotationMode: AnnotationMode.DISABLE })
    task.promise.then(() => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      canvas.width = buffer.width; canvas.height = buffer.height
      canvas.getContext('2d', { alpha: false })?.drawImage(buffer, 0, 0)
    }).catch((error) => { if (error?.name !== 'RenderingCancelledException') onError(error) })
    return () => { cancelled = true; task.cancel() }
  }, [page, renderEligible, renderZoom, onError])

  useEffect(() => { setMenu(undefined); setTextCaret(undefined); setSelection(undefined); setSelectionAnchor(undefined); setCropDraft(undefined); setPageTextEditor(undefined); setCitationPopup(undefined) }, [tool])
  useEffect(() => { if (!activePage) setPageTextEditor(undefined) }, [activePage])

  const pointFor = (event: React.PointerEvent | React.MouseEvent): PdfPoint => {
    const bounds = pageRef.current!.getBoundingClientRect()
    return { x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom }
  }
  const canSelectText = !['crop', 'add_text', 'note', 'insert'].includes(tool)

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    pageRef.current?.focus({ preventScroll: true })
    setMenu(undefined)
    setCitationPopup(undefined)
    const point = pointFor(event)
    if (canSelectText) {
      const caret = textCaretAtPoint(words, point)
      const position = caret ? { wordIndex: caret.wordIndex, offset: caret.offset } : undefined
      const next: PageDrag = { start: point, current: point, anchor: position, focus: position, moved: false }
      dragRef.current = next; setDrag(next)
      onCrossSelectionStart(pageIndex, position, event.shiftKey)
      setSelection(undefined); setTextCaret(undefined); setSelectionAnchor(undefined); onSelectionChange(undefined)
    } else if (tool === 'crop' || tool === 'add_text') {
      const next: PageDrag = { start: point, current: point, moved: false }
      dragRef.current = next; setDrag(next)
    }
    else if (tool === 'note' || tool === 'insert') {
      const target = tool === 'insert' ? insertionPoint(words, point) : point
      onAction({ pageIndex, tool, point: target })
    }
    // Note and insert open a dialog immediately. Capturing that pointer can
    // leave the PDF page owning later clicks if the dialog interrupts pointerup.
    if (pageToolUsesPointerCapture(tool)) event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handlePointerMove = (event: React.PointerEvent) => {
    const point = pointFor(event)
    if (tool === 'insert') setHoverInsert(insertionPoint(words, point))
    const activeDrag = dragRef.current
    if (!activeDrag) return
    if (canSelectText) {
      const moved = activeDrag.moved || Math.hypot(point.x - activeDrag.start.x, point.y - activeDrag.start.y) * zoom >= 4
      const caret = textCaretAtPoint(words, point)
      const focus = caret ? { wordIndex: caret.wordIndex, offset: caret.offset } : activeDrag.focus
      const next = { ...activeDrag, current: point, focus, moved }
      dragRef.current = next; setDrag(next)
      onCrossSelectionMove(pageIndex, event.clientX, event.clientY)
      if (moved && next.anchor && next.focus) setSelection(textSelectionBetween(words, next.anchor, next.focus))
    } else {
      const next = { ...activeDrag, current: point, moved: true }
      dragRef.current = next; setDrag(next)
    }
  }
  const handlePointerUp = (event: React.PointerEvent) => {
    const completed = dragRef.current
    if (!completed) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = undefined
    setDrag(undefined)
    if (canSelectText) {
      if (!completed.moved) {
        setSelection(undefined); onSelectionChange(undefined)
        const caret = textCaretAtPoint(words, completed.current)
        setTextCaret(caret); setSelectionAnchor(caret ? { wordIndex: caret.wordIndex, offset: caret.offset } : undefined)
        onCrossSelectionEnd(pageIndex, event.clientX, event.clientY, true)
        return
      }
      const selected = completed.anchor && completed.focus ? textSelectionBetween(words, completed.anchor, completed.focus) : undefined
      setTextCaret(undefined); setSelectionAnchor(undefined); setSelection(selected); onSelectionChange(selected)
      onCrossSelectionEnd(pageIndex, event.clientX, event.clientY)
    } else {
      const rect = normalizeRect(completed.start, completed.current)
      if (rect.width > 4 && rect.height > 4) {
        if (tool === 'crop') setCropDraft(rect)
        else onAction({ pageIndex, tool, rect })
      }
    }
  }
  const handlePointerCancel = (event: React.PointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = undefined
    setDrag(undefined)
    onCrossSelectionEnd(pageIndex, event.clientX, event.clientY, true)
  }
  const handleContext = (event: React.MouseEvent) => {
    event.preventDefault()
    const point = pointFor(event)
    if (!activeSelection?.text && !annotationMode) { setMenu(undefined); return }
    if (activeSelection?.text) { setTextCaret(undefined); setSelectionAnchor(undefined) }
    const bounds = pageRef.current!.getBoundingClientRect()
    setMenu({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, point })
  }
  const handleDoubleClick = (event: React.MouseEvent) => {
    if (!canSelectText) return
    event.preventDefault(); event.stopPropagation()
    const index = nearestWord(words, pointFor(event))
    const selected = selectionFromRange(words, index, index)
    setTextCaret(undefined); setSelectionAnchor(undefined); setSelection(selected); onSelectionChange(selected)
  }
  const openAnnotationMenu = (annotation: AnnotationRecord, clientX: number, clientY: number) => {
    const bounds = pageRef.current!.getBoundingClientRect()
    setSelection(undefined); setTextCaret(undefined); setSelectionAnchor(undefined); onSelectionChange(undefined)
    setMenu({ x: clientX - bounds.left, y: clientY - bounds.top, point: { x: annotation.rects[0]?.x || 0, y: annotation.rects[0]?.y || 0 }, annotation })
  }
  const runMenu = (selectedTool: Tool) => {
    if (!menu) return
    if (['highlight', 'replace', 'delete_text', 'underline'].includes(selectedTool) && selection) {
      onAction({ pageIndex, tool: selectedTool, selection }); setSelection(undefined); onSelectionChange(undefined)
    } else onAction({ pageIndex, tool: selectedTool, point: selectedTool === 'insert' ? insertionPoint(words, menu.point) : menu.point })
    setMenu(undefined)
  }
  const editMenuAnnotation = () => { if (menu?.annotation) onAnnotationEdit(menu.annotation); setMenu(undefined) }
  const deleteMenuAnnotation = () => { if (menu?.annotation) onAnnotationDelete(menu.annotation); setMenu(undefined) }
  const colorMenuAnnotation = (color: string) => {
    if (!menu?.annotation) return
    onAnnotationColor(menu.annotation, color)
    setMenu((current) => current?.annotation ? { ...current, annotation: { ...current.annotation, color } } : current)
  }
  const replyMenuAnnotation = (reply?: AnnotationReply) => {
    if (!menu?.annotation) return
    onAnnotationReply(menu.annotation, reply)
    setMenu((current) => current?.annotation ? { ...current, annotation: { ...current.annotation, reply } } : current)
  }
  const copyMenuSelection = () => { if (activeSelection?.text) onCopyText(activeSelection.text); setMenu(undefined) }
  const chooseQuickAnnotation = (selectedTool: Tool) => {
    if (!actionSelection) return
    if (['highlight', 'replace', 'delete_text', 'underline'].includes(selectedTool)) onAction({ pageIndex, tool: selectedTool, selection: actionSelection })
    else {
      const last = actionSelection.rects.at(-1)
      const point = last ? (selectedTool === 'insert' ? { x: last.x + last.width, y: last.y + last.height / 2 } : { x: last.x + last.width / 2, y: last.y + last.height / 2 }) : { x: size.width / 2, y: size.height / 2 }
      onAction({ pageIndex, tool: selectedTool, point })
    }
    setSelection(undefined); onSelectionChange(undefined); setTextCaret(undefined); setSelectionAnchor(undefined)
  }
  const openPageTextEditor = (region: EditableTextRegion) => {
    const colors = sampleCanvasRegionColors(canvasRef.current, region.rect, size)
    setSelection(undefined); setTextCaret(undefined); setSelectionAnchor(undefined); onSelectionChange(undefined); setMenu(undefined)
    setPageTextEditor({ region, foreground: colors.foreground, background: colors.background })
  }
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!canSelectText || !textCaret) return
    if (event.key === 'Escape') {
      event.preventDefault(); setSelection(undefined); onSelectionChange(undefined)
      setSelectionAnchor({ wordIndex: textCaret.wordIndex, offset: textCaret.offset }); return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault(); event.stopPropagation()
    const current = { wordIndex: textCaret.wordIndex, offset: textCaret.offset }
    const next = moveTextPosition(words, current, event.key === 'ArrowLeft' ? -1 : 1)
    const caret = caretForTextPosition(words, next)
    if (!caret) return
    setTextCaret(caret)
    if (event.shiftKey) {
      const anchor = selectionAnchor || current
      const selected = textSelectionBetween(words, anchor, next)
      setSelectionAnchor(anchor); setSelection(selected); onSelectionChange(selected)
    } else {
      setSelectionAnchor(next); setSelection(undefined); onSelectionChange(undefined)
    }
  }

  const grammarMatches = grammarTerms.length ? words.filter((word) => grammarTerms.some((term) => term && word.text.toLowerCase().includes(term.toLowerCase()))) : []
  const citationGroups = new Map<string, CitationLink[]>()
  citationHits.forEach((hit) => {
    if (!hit.anchor) return
    const key = `${hit.anchor.toLocaleLowerCase()}-${hit.anchorOccurrence || 0}`
    citationGroups.set(key, [...(citationGroups.get(key) || []), hit])
  })
  const citationMatches = [...citationGroups].flatMap(([key, hits]) => {
    const first = hits[0]
    const match = textSelectionForQuery(words, first.anchor!, { occurrence: first.anchorOccurrence || 0 })
    return match ? [{ hits, rects: match.rects, key }] : []
  })
  const preciseFocus = textFocus && textFocus.text ? textSelectionForQuery(words, textFocus.text, textFocus) : undefined
  useEffect(() => {
    const target = preciseFocusRef.current || visualFocusRef.current
    if (!target) return
    const frame = requestAnimationFrame(() => target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }))
    return () => cancelAnimationFrame(frame)
  }, [textFocus?.token, visualFocus?.token, words.length])
  return <div className={`pdf-page tool-${tool}${searchFocusPage === pageIndex ? ' search-focused' : ''}`} ref={pageRef} data-page={pageIndex} tabIndex={-1} style={{ width: size.width * zoom, height: size.height * zoom, zIndex: menu ? 100 : undefined }}
    onKeyDown={handleKeyDown}
    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onLostPointerCapture={handlePointerCancel} onPointerLeave={() => setHoverInsert(undefined)} onDoubleClick={handleDoubleClick} onContextMenu={handleContext}>
    <canvas ref={canvasRef} />
    <div className="text-map" aria-hidden>{words.map((word) => <span key={word.order} style={{ left: word.rect.x * zoom, top: word.rect.y * zoom, width: word.rect.width * zoom, height: word.rect.height * zoom }}>{word.text}</span>)}</div>
    {citationMatches.flatMap((match) => match.rects.map((rect, index) => { const labels = [...new Set(match.hits.map((hit) => hit.citation))].join(', '); return <button type="button" key={`${match.key}-${index}`} className={`citation-link-mark${citationPopup?.key === match.key ? ' active' : ''}`} style={{ left: rect.x * zoom, top: rect.y * zoom, width: Math.max(5, rect.width * zoom), height: Math.max(8, rect.height * zoom) }} aria-label={`${ui("查看引文：")}${labels}`} title={`${ui("查看参考文献：")}${labels}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setCopiedCitation(false); setCitationPopup({ key: match.key, hits: match.hits, rect }) }} /> }))}
    {grammarMatches.map((word) => <span key={`grammar-${word.order}`} className="grammar-mark" style={{ left: word.rect.x * zoom, top: (word.rect.y + word.rect.height - 2) * zoom, width: Math.max(4, word.rect.width * zoom) }} title={ui("语法或拼写检查结果")} />)}
    {tool === 'edit_text' && activePage && editableRegions.map((region) => <button type="button" key={region.id} className={`page-text-region${pageTextEditor?.region.id === region.id ? ' active' : ''}`} aria-label={`${ui("编辑文字：")}${region.text.slice(0, 40)}`} title={ui("点击直接编辑这段文字")} style={{ left: region.rect.x * zoom - 2, top: region.rect.y * zoom - 2, width: Math.max(8, region.rect.width * zoom + 4), height: Math.max(8, region.rect.height * zoom + 4) }} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openPageTextEditor(region) }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); openPageTextEditor(region) }} />)}
    {tool === 'edit_text' && activePage && pageTextEditor && <PageTextEditor region={pageTextEditor.region} zoom={zoom} pageSize={size} initialColor={pageTextEditor.foreground} backgroundColor={pageTextEditor.background} onCancel={() => setPageTextEditor(undefined)} onSave={(text, style) => { onAction({ pageIndex, tool: 'edit_text', pageTextEdit: { region: pageTextEditor.region, text, style, backgroundColor: pageTextEditor.background } }); setPageTextEditor(undefined) }} />}
    {activeSelection?.rects.map((rect, index) => <div key={index} className="text-selection" style={{ left: rect.x * zoom, top: rect.y * zoom, width: rect.width * zoom, height: rect.height * zoom }} />)}
    {textFocus?.text && textFocus.token > 0 && textFocus.text && preciseFocus?.rects.map((rect, index) => <div ref={index === 0 ? preciseFocusRef : undefined} key={`precise-focus-${textFocus.token}-${index}`} className="annotation-focus-ring insight-focus-ring" style={{ left: rect.x * zoom - 2, top: rect.y * zoom - 2, width: Math.max(6, rect.width * zoom + 4), height: Math.max(6, rect.height * zoom + 4) }} />)}
    {visualFocus?.rects?.map((rect, index) => <div ref={index === 0 ? visualFocusRef : undefined} key={`visual-focus-${visualFocus.token}-${index}`} className="annotation-focus-ring insight-focus-ring" style={{ left: rect.x * zoom - 2, top: rect.y * zoom - 2, width: Math.max(6, rect.width * zoom + 4), height: Math.max(6, rect.height * zoom + 4) }} />)}
    {visualFocus && !visualFocus.rects?.length && <div ref={visualFocusRef} key={`visual-page-focus-${visualFocus.token}`} className="annotation-focus-ring insight-focus-ring insight-page-focus-ring" style={{ left: 10, top: 10, width: Math.max(6, size.width * zoom - 20), height: Math.max(6, size.height * zoom - 20) }} />}
    {citationPopup && <aside className="citation-popover" style={{ left: Math.max(8, Math.min(size.width * zoom - 306, (citationPopup.rect.x + citationPopup.rect.width) * zoom + 9)), top: Math.max(8, Math.min(size.height * zoom - 170, citationPopup.rect.y * zoom - 8)) }} onPointerDown={(event) => event.stopPropagation()}>
      <header><div><small>{ui("关联引文")}</small><b>{[...new Set(citationPopup.hits.map((hit) => hit.citation))].map((value) => `[${value}]`).join(' ')}</b></div><button type="button" aria-label={ui("关闭引文信息")} title={ui("关闭")} onClick={() => setCitationPopup(undefined)}>×</button></header>
      <div className="citation-reference-list">{citationPopup.hits.map((hit, index) => <p key={`${hit.citation}-${index}`}>{hit.reference}</p>)}</div>
      <button type="button" className="citation-copy" onClick={() => { onCopyText(citationPopup.hits.map((hit) => hit.reference).join('\n')); setCopiedCitation(true) }}><span aria-hidden="true">▣</span>{copiedCitation ? ui("已复制参考文献") : citationPopup.hits.length > 1 ? ui("复制全部参考文献") : ui("复制参考文献")}</button>
    </aside>}
    {textCaret && <div className="text-caret" style={{ left: textCaret.x * zoom, top: textCaret.y * zoom, height: Math.max(8, textCaret.height * zoom) }} />}
    {drag && !canSelectText && <div className="area-selection" style={{ left: Math.min(drag.start.x, drag.current.x) * zoom, top: Math.min(drag.start.y, drag.current.y) * zoom, width: Math.abs(drag.current.x - drag.start.x) * zoom, height: Math.abs(drag.current.y - drag.start.y) * zoom }} />}
    {tool === 'crop' && cropDraft && <CropDraftOverlay rect={cropDraft} zoom={zoom} bounds={size} onChange={setCropDraft} onCancel={() => setCropDraft(undefined)} onConfirm={() => { onAction({ pageIndex, tool: 'crop', rect: cropDraft }); setCropDraft(undefined) }} />}
    {imageObjects.filter((image) => image.id !== imageDraft?.id).map((image) => <SavedImageOverlay key={image.id} image={image} zoom={zoom} editable={editableTextObjects && tool !== 'crop'} onEdit={onImageEdit} />)}
    {imageDraft && <ImageDraftOverlay draft={imageDraft} zoom={zoom} bounds={size} onChange={onImageDraftChange} onConfirm={onImageDraftConfirm} onCancel={onImageDraftCancel} onDelete={onImageDraftDelete} />}
    {tool === 'insert' && hoverInsert && <div className="insert-preview" style={{ left: hoverInsert.x * zoom - 7, top: hoverInsert.y * zoom }} />}
    {annotationMode && showSelectionToolbar && activeSelection?.text && !menu && <SelectionAnnotationToolbar selection={activeSelection} zoom={zoom} pageSize={size} onChoose={chooseQuickAnnotation} />}
    {annotations.map((annotation) => { const focused = annotation.id === focusedAnnotationId; return <AnnotationOverlay key={annotation.id} annotation={annotation} zoom={zoom} focused={focused} focusToken={annotationFocusToken} onMove={onAnnotationMove} onSelect={onAnnotationSelect} onEdit={onAnnotationEdit} onContext={openAnnotationMenu} /> })}
    {textObjects.map((textObject) => <TextObjectOverlay key={textObject.id} textObject={textObject} zoom={zoom} editable={!textObject.locked && editableTextObjects && tool !== 'crop'} onMove={onTextObjectMove} onEdit={onTextObjectEdit} />)}
    {menu && <div className="context-menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}>
      {menu.annotation ? <>
        <button onClick={editMenuAnnotation}><AnnotationIcon kind={menu.annotation.kind} size={18} /><span>{ui('编辑批注内容…')}</span></button>
        <div className="annotation-context-controls"><AnnotationColorPicker compact color={menu.annotation.color} onChange={colorMenuAnnotation} /><AnnotationReplyPicker compact reply={menu.annotation.reply} onChange={replyMenuAnnotation} onQuickReply={() => setMenu(undefined)} /></div>
        <i /><button className="danger-item" onClick={deleteMenuAnnotation}><span className="menu-delete-icon">×</span><span>{ui('删除这条批注')}</span></button>
      </> : <>
        {selection?.text && <button className="copy-item" onClick={copyMenuSelection}><span className="menu-copy-icon" aria-hidden="true">▣</span><span>{ui('复制')}</span><kbd>Ctrl+C</kbd></button>}
        {annotationMode && <>{selection?.text && <><i /><button onClick={() => runMenu('highlight')}><AnnotationIcon kind="highlight" size={18} /><span>{ui('文本高亮')}</span></button><button onClick={() => runMenu('replace')}><AnnotationIcon kind="replace" size={18} /><span>{ui('文本替换')}</span></button>
          <button onClick={() => runMenu('delete_text')}><AnnotationIcon kind="delete_text" size={18} /><span>{ui('文本删除')}</span></button><button onClick={() => runMenu('underline')}><AnnotationIcon kind="underline" size={18} /><span>{ui('加下划线')}</span></button></>}
          {selection?.text && <i />}<button onClick={() => runMenu('note')}><AnnotationIcon kind="note" size={18} /><span>{ui('自由批注')}</span></button><button onClick={() => runMenu('insert')}><AnnotationIcon kind="insert" size={18} /><span>{ui('插入文字')}</span></button></>}
      </>}
    </div>}
  </div>
}

export const PdfViewer = forwardRef<ViewerHandle, ViewerProps>(function PdfViewer(props, ref) {
  const { data, password, mode, activeTool, annotations, focusedAnnotationId, annotationFocusToken, textObjects, imageObjects, imageDraft, editableTextObjects, annotationMode, zoom, fitWidthRequest, fitPageRequest, currentPage, initialReadingPosition, onZoomChange, onPageChange, onReadingPositionChange, onDocumentReady, onAction, onSelectionChange, onCopyText, onAnnotationMove, onAnnotationSelect, onAnnotationEdit, onAnnotationColor, onAnnotationReply, onAnnotationDelete, onTextObjectMove, onTextObjectEdit, onImageEdit, onImageDraftChange, onImageDraftConfirm, onImageDraftCancel, onImageDraftDelete, onError, onInsight } = props
  const viewportRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [sizes, setSizes] = useState<Record<number, { width: number; height: number }>>({})
  const [renderZoom, setRenderZoom] = useState(zoom)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchFocusPage, setSearchFocusPage] = useState<number>()
  const [textFocus, setTextFocus] = useState<{ pageIndex: number; text: string; occurrence: number; caseSensitive: boolean; ignoreWhitespace: boolean; token: number }>()
  const [visualFocus, setVisualFocus] = useState<{ pageIndex: number; rects?: PdfRect[]; token: number }>()
  const [grammarTerms, setGrammarTerms] = useState<string[]>([])
  const [citationHits, setCitationHits] = useState<CitationLink[]>([])
  const [pageSelections, setPageSelections] = useState<PageTextSelection[]>([])
  const [dragPageSelections, setDragPageSelections] = useState<PageTextSelection[]>([])
  const [crossSelecting, setCrossSelecting] = useState(false)
  const crossSelection = useMemo(() => mergePageTextSelections(crossSelecting ? dragPageSelections : pageSelections), [crossSelecting, dragPageSelections, pageSelections])
  const selectionAnchorRef = useRef<{ pageIndex: number; position: TextPosition } | undefined>(undefined)
  const [selectionCancelToken, setSelectionCancelToken] = useState(0)
  const wordMapsRef = useRef(new Map<number, WordBox[]>())
  const insightFocusTimerRef = useRef<number | undefined>(undefined)
  const insightFocusSequenceRef = useRef(0)
  const restoredDocumentRef = useRef<string | undefined>(undefined)
  const restoringPositionRef = useRef(true)
  const wheelZoomRef = useRef(zoom)
  const handledFitWidthRequestRef = useRef(0)
  const handledFitPageRequestRef = useRef(0)
  const wheelFrameRef = useRef<number | undefined>(undefined)
  const singlePageWheelResetRef = useRef<number | undefined>(undefined)
  const singlePageWheelLatchedRef = useRef(false)
  const singlePageWheelDeltaRef = useRef(0)
  const wheelAnchorRef = useRef<{ pageIndex?: number; x?: number; y?: number; clientX: number; clientY: number; baseZoom: number; viewportX: number; viewportY: number; scrollLeft: number; scrollTop: number } | undefined>(undefined)
  const handleSize = useCallback((index: number, size: { width: number; height: number }) => {
    setSizes((current) => {
      const previous = current[index]
      if (previous?.width === size.width && previous.height === size.height) return current
      return { ...current, [index]: size }
    })
  }, [])
  const updateSelection = useCallback((values: PageTextSelection[]) => {
    const merged = mergePageTextSelections(values)
    setPageSelections(values)
    if (!values.length) setSelectionCancelToken((token) => token + 1)
    onSelectionChange(values[0]?.pageIndex || 0, merged)
  }, [onSelectionChange])
  const onTextMap = useCallback((pageIndex: number, words: WordBox[]) => { wordMapsRef.current.set(pageIndex, words) }, [])
  const beginCrossSelection = useCallback((pageIndex: number, position?: TextPosition, extend = false) => {
    if (!position) return
    if (extend && selectionAnchorRef.current) return
    const next = { pageIndex, position }
    selectionAnchorRef.current = next
    setCrossSelecting(true)
    setDragPageSelections([])
    if (!extend) updateSelection([])
  }, [updateSelection])
  const calculateCrossSelection = useCallback((originPageIndex: number, clientX: number, clientY: number): PageTextSelection[] => {
    const anchor = selectionAnchorRef.current
    const target = window.document.elementsFromPoint(clientX, clientY).find((element) => element instanceof HTMLElement && element.classList.contains('pdf-page')) as HTMLElement | undefined
    const targetPageIndex = target ? Number(target.dataset.page) : originPageIndex
    const targetWords = wordMapsRef.current.get(targetPageIndex)
    if (!anchor || !targetWords || !Number.isInteger(targetPageIndex)) return []
    const bounds = target?.getBoundingClientRect()
    const focus = bounds ? textCaretAtPoint(targetWords, { x: (clientX - bounds.left) / zoom, y: (clientY - bounds.top) / zoom }) : undefined
    if (!focus) return []
    const first = Math.min(anchor.pageIndex, targetPageIndex), last = Math.max(anchor.pageIndex, targetPageIndex)
    const values: PageTextSelection[] = []
    for (let pageIndex = first; pageIndex <= last; pageIndex += 1) {
      const words = wordMapsRef.current.get(pageIndex)
      if (!words?.length) continue
      const start = pageIndex === anchor.pageIndex ? anchor.position : { wordIndex: 0, offset: 0 }
      const end = pageIndex === targetPageIndex ? focus : { wordIndex: words.length - 1, offset: Array.from(words.at(-1)!.text).length }
      const selected = textSelectionBetween(words, start, end)
      if (selected) values.push(bindTextSelectionToPage(pageIndex, selected))
    }
    return values
  }, [zoom])
  const moveCrossSelection = useCallback((originPageIndex: number, clientX: number, clientY: number) => {
    const values = calculateCrossSelection(originPageIndex, clientX, clientY)
    setDragPageSelections(values)
  }, [calculateCrossSelection])
  const endCrossSelection = useCallback((originPageIndex: number, clientX: number, clientY: number, cancel = false) => {
    if (cancel) {
      setCrossSelecting(false)
      setDragPageSelections([])
      return
    }
    const values = calculateCrossSelection(originPageIndex, clientX, clientY)
    setCrossSelecting(false)
    setDragPageSelections([])
    if (values.length) updateSelection(values)
  }, [calculateCrossSelection, updateSelection])

  useLayoutEffect(() => {
    const anchor = wheelAnchorRef.current
    const viewport = viewportRef.current
    const page = anchor?.pageIndex === undefined ? undefined : viewport?.querySelector<HTMLElement>(`[data-page="${anchor.pageIndex}"]`)
    if (anchor && viewport && page && anchor.x !== undefined && anchor.y !== undefined) {
      const pageBounds = page.getBoundingClientRect()
      viewport.scrollLeft += pageBounds.left - (anchor.clientX - anchor.x * zoom)
      viewport.scrollTop += pageBounds.top - (anchor.clientY - anchor.y * zoom)
      wheelAnchorRef.current = undefined
    } else if (anchor && viewport) {
      const scale = zoom / anchor.baseZoom
      viewport.scrollLeft = (anchor.scrollLeft + anchor.viewportX) * scale - anchor.viewportX
      viewport.scrollTop = (anchor.scrollTop + anchor.viewportY) * scale - anchor.viewportY
      wheelAnchorRef.current = undefined
    }
    if (wheelFrameRef.current === undefined && wheelAnchorRef.current === undefined) wheelZoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    const timer = window.setTimeout(() => setRenderZoom(zoom), 140)
    return () => window.clearTimeout(timer)
  }, [zoom])

  useEffect(() => () => {
    if (wheelFrameRef.current !== undefined) cancelAnimationFrame(wheelFrameRef.current)
    if (singlePageWheelResetRef.current !== undefined) window.clearTimeout(singlePageWheelResetRef.current)
    if (insightFocusTimerRef.current !== undefined) window.clearTimeout(insightFocusTimerRef.current)
  }, [])

  useEffect(() => {
    setTextFocus(undefined); setVisualFocus(undefined); setCitationHits([])
    restoredDocumentRef.current = undefined
    restoringPositionRef.current = true
    if (!data?.length) { setDocument(undefined); return }
    // Fully unmount old pages while a replacement byte stream is loading.
    // This prevents PDF.js from retaining a previously painted canvas when a
    // user confirms a new image on the same page.
    setDocument(undefined); setSizes({})
    let active = true
    const task = getDocument({ data: data.slice(), wasmUrl: PDFJS_WASM_URL, cMapUrl: PDFJS_CMAP_URL, cMapPacked: true, standardFontDataUrl: PDFJS_STANDARD_FONTS_URL, useWasm: false, ...(password === undefined ? {} : { password }) })
    task.promise.then((value) => { if (active) { setDocument(value); setSizes({}); onDocumentReady(value.numPages) } }).catch((error) => onError(error instanceof Error ? error : new Error(String(error))))
    return () => { active = false; task.destroy().catch(() => undefined) }
  }, [data, password, onDocumentReady, onError])

  useLayoutEffect(() => {
    if (!document) return
    const documentKey = document.fingerprints[0] || String(document.numPages)
    if (restoredDocumentRef.current === documentKey) return
    const pageIndex = Math.max(0, Math.min(document.numPages - 1, initialReadingPosition?.page ?? currentPage))
    if (mode === 'single') {
      restoredDocumentRef.current = documentKey
      restoringPositionRef.current = false
      onPageChange(pageIndex)
      onReadingPositionChange({ page: pageIndex, zoom, offset: 0 })
      return
    }
    if (!sizes[pageIndex]) return
    const viewport = viewportRef.current
    const target = viewport?.querySelector<HTMLElement>(`[data-page="${pageIndex}"]`)
    if (!viewport || !target) return
    const restore = () => {
      const viewportBounds = viewport.getBoundingClientRect()
      const pageBounds = target.getBoundingClientRect()
      viewport.scrollTop = scrollTopForReadingPosition(viewport.scrollTop, viewportBounds.top, pageBounds.top, pageBounds.height, initialReadingPosition?.offset)
      restoredDocumentRef.current = documentKey
      restoringPositionRef.current = false
      onPageChange(pageIndex)
      onReadingPositionChange({ page: pageIndex, zoom, offset: initialReadingPosition?.offset || 0 })
    }
    let settleTimer: number | undefined
    const frame = requestAnimationFrame(() => {
      restore()
      settleTimer = window.setTimeout(restore, 80)
    })
    return () => {
      cancelAnimationFrame(frame)
      if (settleTimer !== undefined) window.clearTimeout(settleTimer)
    }
  }, [currentPage, document, initialReadingPosition, mode, onPageChange, onReadingPositionChange, sizes, zoom])

  const fitWidth = useCallback(() => {
    const size = sizes[currentPage] || sizes[0]
    const viewport = viewportRef.current
    if (size && viewport) onZoomChange(Math.max(0.25, Math.min(4, (viewport.clientWidth - 56) / size.width)))
  }, [currentPage, onZoomChange, sizes])
  const fitPage = useCallback(() => {
    const size = sizes[currentPage] || sizes[0]
    const viewport = viewportRef.current
    if (size && viewport) {
      const widthScale = (viewport.clientWidth - 56) / size.width
      const heightScale = (viewport.clientHeight - 72) / size.height
      onZoomChange(Math.max(0.25, Math.min(4, widthScale, heightScale)))
    }
  }, [currentPage, onZoomChange, sizes])
  useEffect(() => {
    if (!fitWidthRequest || handledFitWidthRequestRef.current === fitWidthRequest || !document || !(sizes[currentPage] || sizes[0]) || !viewportRef.current) return
    handledFitWidthRequestRef.current = fitWidthRequest
    fitWidth()
  }, [currentPage, document, fitWidth, fitWidthRequest, sizes])
  useEffect(() => {
    if (!fitPageRequest || handledFitPageRequestRef.current === fitPageRequest || !document || !(sizes[currentPage] || sizes[0]) || !viewportRef.current) return
    handledFitPageRequestRef.current = fitPageRequest
    fitPage()
  }, [currentPage, document, fitPage, fitPageRequest, sizes])
  const goToPage = (pageIndex: number) => {
    const viewport = viewportRef.current
    const target = viewport?.querySelector(`[data-page="${pageIndex}"]`)
    if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' })
    else if (viewport && document && document.numPages > 80) viewport.scrollTo({ top: 24 + pageIndex * 812 * zoom, behavior: 'smooth' })
  }
  const focusAnnotation = (id: string, pageIndex: number) => {
    const reveal = () => {
      const target = viewportRef.current?.querySelector<HTMLElement>(`[data-annotation-id="${CSS.escape(id)}"]`)
      if (target) target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      else viewportRef.current?.querySelector(`[data-page="${pageIndex}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    requestAnimationFrame(() => { reveal(); window.setTimeout(reveal, 90) })
  }
  const focusSearchPage = (pageIndex: number) => {
    goToPage(pageIndex); setSearchFocusPage(pageIndex); window.setTimeout(() => setSearchFocusPage((current) => current === pageIndex ? undefined : current), 1050)
  }
  const focusText = (pageIndex: number, text: string, occurrence = 0, caseSensitive = false, ignoreWhitespace = false) => {
    onPageChange(pageIndex)
    const token = ++insightFocusSequenceRef.current
    if (insightFocusTimerRef.current !== undefined) window.clearTimeout(insightFocusTimerRef.current)
    setVisualFocus(undefined)
    setTextFocus({ pageIndex, text, occurrence, caseSensitive, ignoreWhitespace, token })
    requestAnimationFrame(() => { goToPage(pageIndex); window.setTimeout(() => goToPage(pageIndex), 80) })
    insightFocusTimerRef.current = window.setTimeout(() => { setTextFocus((current) => current?.token === token ? undefined : current); insightFocusTimerRef.current = undefined }, 1000)
  }
  const focusVisual = (pageIndex: number, rects?: PdfRect[]) => {
    onPageChange(pageIndex)
    const token = ++insightFocusSequenceRef.current
    if (insightFocusTimerRef.current !== undefined) window.clearTimeout(insightFocusTimerRef.current)
    setTextFocus(undefined)
    setVisualFocus({ pageIndex, rects, token })
    requestAnimationFrame(() => { goToPage(pageIndex); window.setTimeout(() => goToPage(pageIndex), 80) })
    insightFocusTimerRef.current = window.setTimeout(() => { setVisualFocus((current) => current?.token === token ? undefined : current); insightFocusTimerRef.current = undefined }, 1000)
  }
  const pageSnapshots = useCallback(async (includeImages = false): Promise<Array<PageTextSnapshot & { imageCount?: number }>> => {
    if (!document) return []
    const pages: Array<PageTextSnapshot & { imageCount?: number }> = []
    for (let pageIndex = 0; pageIndex < document.numPages; pageIndex += 1) {
      const page = await document.getPage(pageIndex + 1)
      const content = await page.getTextContent()
      // PDF.js text items frequently carry leading/trailing whitespace. Trim
      // item boundaries before joining so insight rules do not report layout
      // artifacts as document grammar errors.
      const text = content.items.filter((item): item is TextItem => 'str' in item).map((item) => item.str.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')
      let imageCount = 0
      let visualRects: PdfRect[] | undefined
      if (includeImages) {
        const operators = await page.getOperatorList()
        const imageOps = new Set<number>([OPS.paintImageMaskXObject, OPS.paintImageMaskXObjectRepeat, OPS.paintImageXObject, OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObject, OPS.paintInlineImageXObjectGroup, OPS.paintSolidColorImageMask])
        imageCount = operators.fnArray.filter((operation: number) => imageOps.has(operation)).length
        visualRects = imageRectsForPage(page, page.getViewport({ scale: 1 }).transform as PdfMatrix, operators)
      }
      pages.push({ pageIndex, text, imageCount, visualRects })
    }
    return pages
  }, [document])
  const showVisuals = async () => { onInsight('visual', visualHits(await pageSnapshots(true))) }
  const linkCitations = async () => {
    const hits = citationLinks(await pageSnapshots())
    setCitationHits(hits)
    onInsight('citation', hits)
  }
  const clearCitations = () => setCitationHits([])
  const checkGrammar = async () => {
    const hits = grammarIssues(await pageSnapshots()); setGrammarTerms([]); onInsight('grammar', hits)
  }
  useImperativeHandle(ref, () => ({ fitWidth, fitPage, goToPage, focusAnnotation, focusText, focusVisual, openSearch: () => setSearchOpen(true), showVisuals, linkCitations, clearCitations, checkGrammar }))

  useEffect(() => { if (mode === 'single') return; const viewport = viewportRef.current; if (!viewport) return
    let frame: number | undefined
    const update = () => { if (frame !== undefined) return; frame = requestAnimationFrame(() => {
      frame = undefined
      const top = viewport.getBoundingClientRect().top
      if (restoringPositionRef.current) return
      let best = currentPage, bestPage: HTMLElement | undefined, distance = Number.POSITIVE_INFINITY
      viewport.querySelectorAll<HTMLElement>('.pdf-page').forEach((page) => { const value = Math.abs(page.getBoundingClientRect().top - top - 18); if (value < distance) { distance = value; best = Number(page.dataset.page); bestPage = page } })
      if (best !== currentPage) onPageChange(best)
      if (bestPage) {
        const bounds = bestPage.getBoundingClientRect()
        onReadingPositionChange({ page: best, zoom, offset: readingOffsetForPage(top, bounds.top, bounds.height) })
      }
    }) }
    viewport.addEventListener('scroll', update, { passive: true }); return () => { viewport.removeEventListener('scroll', update); if (frame !== undefined) cancelAnimationFrame(frame) }
  }, [mode, currentPage, onPageChange, onReadingPositionChange, zoom])

  useEffect(() => {
    if (!document || restoringPositionRef.current) return
    if (mode === 'single') onReadingPositionChange({ page: currentPage, zoom, offset: 0 })
  }, [currentPage, document, mode, onReadingPositionChange, zoom])

  useEffect(() => {
    if (!document || mode === 'single' || restoringPositionRef.current) return
    const timer = window.setTimeout(() => viewportRef.current?.dispatchEvent(new Event('scroll')), 120)
    return () => window.clearTimeout(timer)
  }, [document, mode, zoom])

  const virtualized = Boolean(document && mode !== 'single' && document.numPages > 80)
  const pages = useMemo(() => document ? (mode === 'single' ? [Math.min(currentPage, document.numPages - 1)] : virtualized ? [] : Array.from({ length: document.numPages }, (_, index) => index)) : [], [document, mode, currentPage, virtualized])
  const visiblePages = useMemo(() => {
    if (!virtualized || !document) return pages
    const start = Math.max(0, currentPage - 7)
    const end = Math.min(document.numPages, currentPage + 9)
    return Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index)
  }, [currentPage, document, pages, virtualized])
  const handleWheel = (event: React.WheelEvent) => {
    if (mode === 'single' && !event.ctrlKey) {
      event.preventDefault()
      if (singlePageWheelResetRef.current !== undefined) window.clearTimeout(singlePageWheelResetRef.current)
      singlePageWheelResetRef.current = window.setTimeout(() => { singlePageWheelLatchedRef.current = false; singlePageWheelDeltaRef.current = 0; singlePageWheelResetRef.current = undefined }, 180)
      if (singlePageWheelLatchedRef.current || !document) return
      singlePageWheelDeltaRef.current += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1)
      const direction = singlePageWheelDirection(singlePageWheelDeltaRef.current, 0)
      if (!direction) return
      singlePageWheelLatchedRef.current = true
      singlePageWheelDeltaRef.current = 0
      const nextPage = Math.max(0, Math.min(document.numPages - 1, currentPage + direction))
      if (nextPage !== currentPage) onPageChange(nextPage)
      return
    }
    if (!event.ctrlKey) return
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) return
    const viewportBounds = viewport.getBoundingClientRect()
    const target = (event.target as HTMLElement).closest<HTMLElement>('.pdf-page')
    const pageBounds = target?.getBoundingClientRect()
    wheelAnchorRef.current = {
      pageIndex: target ? Number(target.dataset.page) : undefined,
      x: pageBounds ? (event.clientX - pageBounds.left) / zoom : undefined,
      y: pageBounds ? (event.clientY - pageBounds.top) / zoom : undefined,
      clientX: event.clientX,
      clientY: event.clientY,
      baseZoom: zoom,
      viewportX: event.clientX - viewportBounds.left,
      viewportY: event.clientY - viewportBounds.top,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    }
    wheelZoomRef.current = wheelZoom(wheelZoomRef.current, event.deltaY)
    if (wheelFrameRef.current !== undefined) return
    wheelFrameRef.current = requestAnimationFrame(() => {
      wheelFrameRef.current = undefined
      onZoomChange(wheelZoomRef.current)
    })
  }
  return <div className="viewer" ref={viewportRef} onWheel={handleWheel}>
      <div className={`page-stack ${mode}`}>{document && virtualized && visiblePages[0] > 0 && <div className="pdf-page-virtual-spacer" style={{ height: visiblePages[0] * 812 * zoom }} aria-hidden />}{document && (virtualized ? visiblePages : pages).map((pageIndex) => <PdfPage key={`${document.fingerprints[0]}-${pageIndex}`} document={document} pageIndex={pageIndex} zoom={zoom} renderZoom={renderZoom} tool={activeTool}
      annotations={annotations.filter((annotation) => annotation.pageIndex === pageIndex)} focusedAnnotationId={focusedAnnotationId} annotationFocusToken={annotationFocusToken} onAction={onAction} onSelectionChange={(selection) => updateSelection(selection ? [bindTextSelectionToPage(pageIndex, selection)] : [])} onTextMap={onTextMap} onCrossSelectionStart={beginCrossSelection} onCrossSelectionMove={moveCrossSelection} onCrossSelectionEnd={endCrossSelection} externalSelection={pageSelections.find((selection) => selection.pageIndex === pageIndex)} crossSelection={crossSelection} showSelectionToolbar={crossSelection?.segments?.[0]?.pageIndex === pageIndex} selectionCancelToken={selectionCancelToken} onCopyText={onCopyText}
      textObjects={textObjects.filter((textObject) => textObject.pageIndex === pageIndex)} imageObjects={imageObjects.filter((image) => image.pageIndex === pageIndex)} imageDraft={imageDraft?.pageIndex === pageIndex ? imageDraft : undefined} editableTextObjects={editableTextObjects} activePage={pageIndex === currentPage} annotationMode={annotationMode}
      onAnnotationMove={onAnnotationMove} onAnnotationSelect={onAnnotationSelect} onAnnotationEdit={onAnnotationEdit} onAnnotationColor={onAnnotationColor} onAnnotationReply={onAnnotationReply} onAnnotationDelete={onAnnotationDelete} onTextObjectMove={onTextObjectMove} onTextObjectEdit={onTextObjectEdit} onImageEdit={onImageEdit} onImageDraftChange={onImageDraftChange} onImageDraftConfirm={onImageDraftConfirm} onImageDraftCancel={onImageDraftCancel} onImageDraftDelete={onImageDraftDelete} onSize={handleSize} onError={onError} grammarTerms={grammarTerms} citationHits={citationHits.filter((hit) => hit.pageIndex === pageIndex)} searchFocusPage={searchFocusPage} textFocus={textFocus?.pageIndex === pageIndex ? textFocus : undefined} visualFocus={visualFocus?.pageIndex === pageIndex ? visualFocus : undefined} />)}{document && virtualized && visiblePages.at(-1)! < document.numPages - 1 && <div className="pdf-page-virtual-spacer" style={{ height: (document.numPages - visiblePages.at(-1)! - 1) * 812 * zoom }} aria-hidden />}</div>
    {document && searchOpen && <SearchPanel document={document} onClose={() => setSearchOpen(false)} onJump={goToPage} onFocusTarget={(target) => focusText(target.pageIndex, target.text, target.occurrence, target.caseSensitive, target.ignoreWhitespace)} />}
  </div>
})
