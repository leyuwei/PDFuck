import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import type { PDFDocumentProxy } from '../lib/pdfjs'
import { findTextMatches } from '../lib/document-search'
import { pdfSearchMatches, searchRectVisible, searchResult, type SearchMatch } from '../lib/pdf-search'
import { positionedTextWords } from '../lib/text-layout'
import type { Matrix } from '../lib/page-coordinates'
import type { PdfRect } from '../types'
import { clampFloatingPosition, floatingTop, useFloatingWindow } from '../lib/floating-window'
import { isImeCompositionKey } from '../lib/keyboard-input'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import './search-panel.css'

const RESULTS_PER_LIST = 200
const OUTLINE_LIMIT = 500
const REGEX_PRESETS = [
  { label: 'ui.emailAddress', value: '[\\w.+-]+@[\\w-]+\\.[A-Za-z]{2,}' },
  { label: 'ui.website', value: 'https?://[^\\s]+' },
  { label: 'ui.chineseMobileNumber', value: '1[3-9]\\d{9}' },
  { label: 'ui.date', value: '(?:19|20)\\d{2}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?' },
  { label: 'ui.number', value: '\\b\\d+(?:\\.\\d+)?%?\\b' },
  { label: 'ui.englishWord', value: '\\b[A-Za-z]{2,}\\b' },
  { label: 'ui.citationNumber', value: '\\[\\d+(?:[-,]\\d+)*\\]' },
  { label: 'ui.doi', value: '10\\.\\d{4,9}/[-._;()/:A-Z0-9]+' },
  { label: 'ui.isbn', value: 'ISBN(?:-1[03])?:?[-\\dXx ]{10,}' },
  { label: 'ui.bracketedContent', value: '[（(][^）)]{1,80}[）)]' }
] as const

export function SearchSelectionBadge({ match, zoom, reveal }: { match: SearchMatch; zoom: number; reveal(area: PdfRect): void }) {
  useInterfaceLanguage()
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const badge = ref.current
    const page = badge?.closest('.pdf-page')
    const viewport = page?.closest('.viewer')
    const rects = match.rects
    if (!badge || !page || !viewport || !rects?.length) return

    let frame = 0
    const place = () => {
      const view = viewport.getBoundingClientRect(), paper = page.getBoundingClientRect()
      const x = view.left + viewport.clientLeft, y = view.top + viewport.clientTop
      const area = { x, y, width: viewport.clientWidth, height: viewport.clientHeight }
      const visible = rects.map(rect => ({ x: paper.left + rect.x * zoom, y: paper.top + rect.y * zoom, width: rect.width * zoom, height: rect.height * zoom }))
        .find(rect => searchRectVisible(rect, area))
      if (!visible) { badge.style.visibility = 'hidden'; return }
      const margin = 6, gap = 7
      badge.style.maxWidth = `${Math.max(1, area.width - 2 * margin)}px`
      const { width, height } = badge.getBoundingClientRect()
      const right = x + area.width, bottom = y + area.height
      const center = (Math.max(visible.x, x) + Math.min(visible.x + visible.width, right)) / 2
      const left = Math.max(x + margin, Math.min(center - width / 2, right - width - margin))
      const above = visible.y - height - gap
      const below = above < y + margin
      const top = Math.max(y + margin, Math.min(below ? visible.y + visible.height + gap : above, bottom - height - margin))
      badge.style.left = `${left - paper.left}px`
      badge.style.top = `${top - paper.top}px`
      badge.style.setProperty('--search-badge-arrow', `${Math.max(margin, Math.min(center - left, width - margin))}px`)
      badge.dataset.placement = below ? 'below' : 'above'
      badge.style.visibility = 'visible'
      const protectLeft = Math.min(left, Math.max(visible.x, x))
      const protectTop = Math.min(top, Math.max(visible.y, y))
      reveal({
        x: protectLeft, y: protectTop,
        width: Math.max(left + width, Math.min(visible.x + visible.width, right)) - protectLeft,
        height: Math.max(top + height, Math.min(visible.y + visible.height, bottom)) - protectTop
      })
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place) }
    const observer = new ResizeObserver(schedule)
    observer.observe(badge); observer.observe(viewport); observer.observe(page)
    viewport.addEventListener('scroll', schedule, { passive: true })
    place()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); viewport.removeEventListener('scroll', schedule) }
  }, [match, zoom, reveal])

  return <span ref={ref} className="annotation-focus-badge pdf-search-current-badge" aria-hidden="true">{ui('search.currentSelection')}</span>
}

export interface SearchPanelHandle { avoidRegion(area: PdfRect): void }

export function SearchPanel({ ref, document: pdf, source, focusToken = 0, initialQuery = '', onClose, onFocusTarget, chooseInitialResult, onOutlinesChange }: {
  ref?: Ref<SearchPanelHandle>; document?: PDFDocumentProxy; source?: string; sourceLabel?: string; focusToken?: number; initialQuery?: string; onClose(): void; onFocusTarget(target: SearchMatch | undefined): void
  chooseInitialResult?(matches: SearchMatch[]): number; onOutlinesChange?(matches: SearchMatch[]): void
}) {
  useInterfaceLanguage()
  const [query, setQuery] = useState(initialQuery), [caseSensitive, setCaseSensitive] = useState(false), [fuzzy, setFuzzy] = useState(true), [wholeWord, setWholeWord] = useState(false), [regex, setRegex] = useState(false)
  const [results, setResults] = useState<SearchMatch[]>([]), [searched, setSearched] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [active, setActive] = useState(-1), [more, setMore] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)
  const outlineLimitExceeded = Boolean(pdf && results.length > OUTLINE_LIMIT)
  const firstListed = Math.floor(Math.max(active, 0) / RESULTS_PER_LIST) * RESULTS_PER_LIST
  const runRef = useRef(0), inputRef = useRef<HTMLInputElement>(null)
  const returnFocus = useRef(window.document.activeElement as HTMLElement | null)
  const hasResults = results.length > 0
  const floating = useFloatingWindow(true, false, { storageKey: 'pdfuck.search-window-size.v1', resizable: hasResults, minWidth: 320, minHeight: 200 })
  useImperativeHandle(ref, () => ({
    avoidRegion(area) {
      const bounds = floating.ref.current?.getBoundingClientRect()
      if (!bounds || !searchRectVisible({ x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }, area)) return
      const gap = 8, maxRight = window.innerWidth - gap, maxBottom = window.innerHeight - gap
      const minTop = floatingTop(), right = area.x + area.width + gap, bottom = area.y + area.height + gap
      const width = bounds.width, height = bounds.height
      const leftWidth = Math.min(width, area.x - 2 * gap), rightWidth = Math.min(width, maxRight - right)
      const aboveHeight = Math.min(height, area.y - gap - minTop), belowHeight = Math.min(height, maxBottom - bottom)
      const candidates = [
        { left: area.x - gap - leftWidth, top: bounds.top, width: leftWidth, height },
        { left: right, top: bounds.top, width: rightWidth, height },
        { left: bounds.left, top: area.y - gap - aboveHeight, width, height: aboveHeight },
        { left: bounds.left, top: bottom, width, height: belowHeight }
      ].filter(size => size.width >= 320 && size.height >= 200)
        .map(size => ({ ...size, ...clampFloatingPosition(size.left, size.top, size.width, size.height, window.innerWidth, window.innerHeight, minTop) }))
        .filter(size => !searchRectVisible({ x: size.left, y: size.top, width: size.width, height: size.height }, area))
      const distance = (position: { left: number; top: number }) => Math.hypot(position.left - bounds.left, position.top - bounds.top)
      candidates.sort((a, b) => b.width * b.height - a.width * a.height || distance(a) - distance(b))
      const next = candidates[0]
      if (next) floating.moveTo(next.left, next.top, { width: next.width, height: next.height })
    }
  }))
  const close = () => { if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); onClose() }
  const closeRef = useRef(close); closeRef.current = close
  const pdfCallbacks = useRef({ chooseInitialResult, onFocusTarget, onOutlinesChange })
  pdfCallbacks.current = { chooseInitialResult, onFocusTarget, onOutlinesChange }
  useEffect(() => {
    const previous = returnFocus.current, panel = floating.ref.current
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !isImeCompositionKey(event)) { event.preventDefault(); event.stopPropagation(); closeRef.current() } }
    window.addEventListener('keydown', escape, true)
    return () => { runRef.current += 1; window.removeEventListener('keydown', escape, true); if (previous?.isConnected && panel?.contains(window.document.activeElement)) previous.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); inputRef.current?.select() }, [focusToken])
  const resetResults = () => {
    runRef.current += 1; setResults([]); setSearched(false); setBusy(false); setError(''); setActive(-1); setMore(false); setShowAll(false)
    if (pdf) { onOutlinesChange?.([]); onFocusTarget(undefined) }
  }
  useEffect(resetResults, [pdf, source])
  useEffect(() => { if (initialQuery) { setQuery(initialQuery); resetResults() } }, [focusToken, initialQuery])
  const navigate = (index: number, keepInput = false) => {
    const next = (index + results.length) % results.length
    if (!results[next]) return
    setActive(next); onFocusTarget(results[next])
    if (keepInput) inputRef.current?.focus({ preventScroll: true })
  }
  useLayoutEffect(() => {
    const list = resultsRef.current
    const row = list?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!list || !row) return
    const rowBounds = row.getBoundingClientRect(), listBounds = list.getBoundingClientRect()
    const top = listBounds.top + (list.firstElementChild?.getBoundingClientRect().height ?? 0)
    if (rowBounds.top < top) list.scrollTop += rowBounds.top - top
    else if (rowBounds.bottom > listBounds.bottom) list.scrollTop += rowBounds.bottom - listBounds.bottom
  }, [active, results])
  const search = async () => {
    resetResults()
    const run = runRef.current
    if (!query.trim()) return
    setBusy(true)
    try {
      const next: SearchMatch[] = []
      // Validate before PDF extraction, including an empty/scanned document.
      if (regex) new RegExp(query)
      const options = { caseSensitive, fuzzy, wholeWord, regex }
      if (pdf) {
        for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
          const page = await pdf.getPage(pageIndex + 1)
          const content = await page.getTextContent()
          if (run !== runRef.current) return
          const words = positionedTextWords(content.items.filter(item => 'str' in item), content.styles, page.getViewport({ scale: 1 }).transform as Matrix)
          for (const match of pdfSearchMatches(words, query, options, pageIndex)) next.push(match)
          // Cached pages can resolve in the same frame as a long search.
          if (pageIndex % 8 === 7) await new Promise<void>(resolve => setTimeout(resolve, 0))
        }
        if (run !== runRef.current) return
        setResults(next)
        if (next.length) {
          const callbacks = pdfCallbacks.current
          const initial = callbacks.chooseInitialResult?.(next) ?? 0
          setActive(initial); callbacks.onFocusTarget(next[initial])
          if (next.length <= OUTLINE_LIMIT) callbacks.onOutlinesChange?.(next)
        }
      } else {
        const text = source || ''
        const matches = findTextMatches(text, query, options, RESULTS_PER_LIST + 1)
        let line = 1, lineOffset = 0
        for (const match of matches.slice(0, RESULTS_PER_LIST)) {
          for (let i = lineOffset; i < match.start; i++) if (text[i] === '\n') line++
          lineOffset = match.start
          next.push(searchResult(match, text, 0, line))
        }
        setResults(next); setMore(matches.length > RESULTS_PER_LIST)
      }
      setSearched(true)
    } catch (cause) { if (run === runRef.current) setError(cause instanceof SyntaxError ? ui('ui.invalidSearchExpression') : cause instanceof Error ? cause.message : ui('ui.invalidSearchExpression')) }
    finally { if (run === runRef.current) setBusy(false) }
  }
  return createPortal(<div ref={floating.ref} role="dialog" aria-label={ui('ui.searchDocument')} className={`pdf-search-panel${hasResults ? ' has-results' : ''}`} style={hasResults ? floating.style : { left: floating.style?.left, top: floating.style?.top }} onPointerDown={event => event.stopPropagation()} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !isImeCompositionKey(event.nativeEvent) && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopPropagation(); inputRef.current?.focus(); inputRef.current?.select() }
  }}>
    <div className="pdf-search-heading" {...floating.dragHandlers}><div><b>{ui('ui.searchDocument')}</b></div><button type="button" onClick={close} aria-label={ui('ui.closeSearch')} title={ui('ui.closeSearch')}>×</button></div>
    <div className="pdf-search-body"><div className="pdf-search-controls">
      <div className="pdf-search-input-row"><input ref={inputRef} dir="auto" value={query} aria-label={ui('ui.searchDocument')} placeholder={ui('ui.enterTextOrARegularExpression')} onChange={event => { resetResults(); setQuery(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter' && !isImeCompositionKey(event.nativeEvent)) { event.preventDefault(); if (results.length) navigate(event.shiftKey && active < 0 ? results.length - 1 : active + (event.shiftKey ? -1 : 1), true); else void search() } }} /><button type="button" className="primary" disabled={busy || !query.trim()} onClick={() => void search()}>{ui('ui.search')}</button></div>
      <div className="pdf-search-options">{([
        ['ui.matchCase', caseSensitive, setCaseSensitive, false],
        ['ui.fuzzyMatch', fuzzy, (value: boolean) => { setFuzzy(value); if (value) setWholeWord(false) }, regex],
        ['ui.wholeWordMatch', wholeWord, (value: boolean) => { setWholeWord(value); if (value) setFuzzy(false) }, regex],
        ['ui.regularExpression', regex, (value: boolean) => { setRegex(value); if (value) setWholeWord(false) }, false]
      ] as const).map(([label, checked, change, disabled]) => <label key={label} className={disabled ? 'disabled' : undefined}><input type="checkbox" checked={checked} disabled={disabled} onChange={event => { resetResults(); change(event.target.checked) }} /><span>{ui(label)}</span></label>)}</div>
      {regex && <select className="pdf-regex-presets" aria-label={ui('ui.commonRegularExpressions')} value="" onChange={event => { resetResults(); setQuery(event.target.value); inputRef.current?.focus() }}><option value="">{ui('ui.commonRegularExpressions')}</option>{REGEX_PRESETS.map(preset => <option key={preset.label} value={preset.value}>{ui(preset.label)}</option>)}</select>}
      {error && <p className="pdf-search-error" role="alert">{error}</p>}</div>
      {busy && <div className="pdf-search-state" role="status">{ui('search.searching')}</div>}
      {!busy && !error && searched && !results.length && <div className="pdf-search-state" role="status"><b>{ui('search.noResults')}</b></div>}
      {outlineLimitExceeded && <label className="pdf-search-outline-option"><input type="checkbox" checked={showAll} onChange={event => { setShowAll(event.target.checked); onOutlinesChange?.(event.target.checked ? results : []) }} /><span>{ui('search.outlineAll')}{!showAll && <small role="status">{ui('search.outlinesPaused')}</small>}</span></label>}
      {results.length > 0 && <div className="pdf-search-results" ref={resultsRef}>
        <header>
          <span role="status">{t('search.results', { count: `${results.length}${more ? '+' : ''}` })}{active >= 0 ? ` · ${active + 1}/${results.length}` : ''}</span>
          <div>
            {firstListed > 0 && <button type="button" aria-label={ui('search.previousGroup')} title={ui('search.previousGroup')} onClick={() => navigate(firstListed - 1, true)}>«</button>}
            <button type="button" aria-label={ui('search.previous')} title={ui('search.previous')} onClick={() => navigate(active < 0 ? results.length - 1 : active - 1, true)}>↑</button>
            <button type="button" aria-label={ui('search.next')} title={ui('search.next')} onClick={() => navigate(active + 1, true)}>↓</button>
            {firstListed + RESULTS_PER_LIST < results.length && <button type="button" className="pdf-search-list-next" aria-label={ui('search.nextGroup')} title={ui('search.nextGroup')} onClick={() => navigate(firstListed + RESULTS_PER_LIST, true)}>»</button>}
          </div>
        </header>
        {results.slice(firstListed, firstListed + RESULTS_PER_LIST).map((result, index) => <button className="pdf-search-result" aria-current={active === firstListed + index ? 'true' : undefined} type="button" key={firstListed + index} onClick={() => navigate(firstListed + index)}>
          <b>{t(pdf ? 'search.page' : 'search.line', { page: result.pageIndex + 1, line: result.line })}</b>
          <span dir="auto">{result.context.slice(0, result.highlightStart)}<mark>{result.context.slice(result.highlightStart, result.highlightEnd)}</mark>{result.context.slice(result.highlightEnd)}</span>
        </button>)}
      </div>}
    </div>
  </div>, window.document.querySelector('.app-shell') || window.document.body)
}
