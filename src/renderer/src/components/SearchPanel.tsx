import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PDFDocumentProxy } from '../lib/pdfjs'
import { findTextMatches, type TextSearchMatch } from '../lib/document-search'
import { useFloatingWindow } from '../lib/floating-window'
import { isImeCompositionKey } from '../lib/keyboard-input'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import './search-panel.css'

export interface SearchMatch extends TextSearchMatch { pageIndex: number; line: number; context: string; highlightStart: number; highlightEnd: number; caseSensitive: boolean; ignoreWhitespace: boolean }
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

export function SearchPanel({ document: pdf, source, focusToken = 0, initialQuery = '', onClose, onFocusTarget }: { document?: PDFDocumentProxy; source?: string; focusToken?: number; initialQuery?: string; onClose(): void; onFocusTarget(target: SearchMatch): void }) {
  useInterfaceLanguage()
  const [query, setQuery] = useState(initialQuery), [caseSensitive, setCaseSensitive] = useState(false), [fuzzy, setFuzzy] = useState(true), [regex, setRegex] = useState(false)
  const [results, setResults] = useState<SearchMatch[]>([]), [searched, setSearched] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [active, setActive] = useState(-1), [more, setMore] = useState(false)
  const runRef = useRef(0), inputRef = useRef<HTMLInputElement>(null)
  const returnFocus = useRef(window.document.activeElement as HTMLElement | null)
  const floating = useFloatingWindow(true)
  const close = () => { if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); onClose() }
  const closeRef = useRef(close); closeRef.current = close
  useEffect(() => {
    const previous = returnFocus.current, panel = floating.ref.current
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !isImeCompositionKey(event)) { event.preventDefault(); event.stopPropagation(); closeRef.current() } }
    window.addEventListener('keydown', escape, true)
    return () => { runRef.current += 1; window.removeEventListener('keydown', escape, true); if (previous?.isConnected && panel?.contains(window.document.activeElement)) previous.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); inputRef.current?.select() }, [focusToken])
  const resetResults = () => { runRef.current += 1; setResults([]); setSearched(false); setBusy(false); setError(''); setActive(-1); setMore(false) }
  useEffect(resetResults, [pdf, source])
  const navigate = (index: number, keepInput = false) => {
    const next = (index + results.length) % results.length
    if (!results[next]) return
    setActive(next); onFocusTarget(results[next])
    floating.ref.current?.querySelectorAll<HTMLElement>('.pdf-search-result')[next]?.scrollIntoView({ block: 'nearest' })
    if (keepInput) inputRef.current?.focus({ preventScroll: true })
  }
  const search = async () => {
    const run = ++runRef.current
    if (!query.trim()) { resetResults(); return }
    setBusy(true); setError(''); setResults([]); setSearched(false); setActive(-1); setMore(false)
    try {
      const next: SearchMatch[] = []
      // Validate before PDF extraction, including an empty/scanned document.
      if (regex) new RegExp(query)
      for (let pageIndex = 0; pageIndex < (pdf?.numPages || 1) && next.length < 201; pageIndex += 1) {
        const text = pdf ? await pdf.getPage(pageIndex + 1).then(page => page.getTextContent()).then(content => content.items.flatMap(item => 'str' in item ? Array.from(item.str.matchAll(/\S+/gu), match => match[0]) : []).join(' ')) : source || ''
        if (run !== runRef.current) return
        const matches = findTextMatches(text, pdf && !regex ? query.trim().replace(/\s+/g, ' ') : query, { caseSensitive, fuzzy, regex }, 201 - next.length)
        let line = 1, lineOffset = 0
        for (const match of matches) {
          for (let i = lineOffset; i < match.start; i++) if (text[i] === '\n') line++
          lineOffset = match.start
          const from = Math.max(0, match.start - 52), to = Math.min(text.length, match.end + 84)
          next.push({ ...match, pageIndex, line, caseSensitive, ignoreWhitespace: fuzzy && !regex, context: text.slice(from, to), highlightStart: match.start - from, highlightEnd: match.end - from })
        }
      }
      if (run === runRef.current) { setResults(next.slice(0, 200)); setMore(next.length > 200); setSearched(true) }
    } catch (cause) { if (run === runRef.current) setError(cause instanceof SyntaxError ? ui('ui.invalidSearchExpression') : cause instanceof Error ? cause.message : ui('ui.invalidSearchExpression')) }
    finally { if (run === runRef.current) setBusy(false) }
  }
  return createPortal(<div ref={floating.ref} role="dialog" aria-label={`${ui('ui.searchDocument')} · ${ui(pdf ? 'md.pdf' : 'md.source')}`} className="pdf-search-panel" style={floating.style} onPointerDown={event => event.stopPropagation()} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !isImeCompositionKey(event.nativeEvent) && event.key.toLowerCase() === 'f') { event.preventDefault(); event.stopPropagation(); inputRef.current?.focus(); inputRef.current?.select() }
  }}>
    <div className="pdf-search-heading" {...floating.dragHandlers}><div><b>{ui('ui.searchDocument')}</b><small>{ui(pdf ? 'md.pdf' : 'md.source')}</small></div><button type="button" onClick={close} aria-label={ui('ui.closeSearch')} title={ui('ui.closeSearch')}>×</button></div>
    <div className="pdf-search-body">
      <div className="pdf-search-input-row"><input ref={inputRef} dir="auto" value={query} aria-label={ui('ui.searchDocument')} placeholder={ui('ui.enterTextOrARegularExpression')} onChange={event => { resetResults(); setQuery(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter' && !isImeCompositionKey(event.nativeEvent)) { event.preventDefault(); if (results.length) navigate(event.shiftKey && active < 0 ? results.length - 1 : active + (event.shiftKey ? -1 : 1), true); else void search() } }} /><button type="button" className="primary" disabled={busy || !query.trim()} onClick={() => void search()}>{ui('ui.search')}</button></div>
      <div className="pdf-search-options">{([
        ['ui.matchCase', caseSensitive, setCaseSensitive, false], ['ui.fuzzyMatch', fuzzy, setFuzzy, regex], ['ui.regularExpression', regex, setRegex, false]
      ] as const).map(([label, checked, change, disabled]) => <label key={label} className={disabled ? 'disabled' : undefined}><input type="checkbox" checked={checked} disabled={disabled} onChange={event => { resetResults(); change(event.target.checked) }} /><span>{ui(label)}</span></label>)}</div>
      {regex && <select className="pdf-regex-presets" aria-label={ui('ui.commonRegularExpressions')} value="" onChange={event => { resetResults(); setQuery(event.target.value); inputRef.current?.focus() }}><option value="">{ui('ui.commonRegularExpressions')}</option>{REGEX_PRESETS.map(preset => <option key={preset.label} value={preset.value}>{ui(preset.label)}</option>)}</select>}
      {error && <p className="pdf-search-error" role="alert">{error}</p>}
      {busy && <div className="pdf-search-state" role="status">{ui('search.searching')}</div>}
      {!busy && !error && searched && !results.length && <div className="pdf-search-state" role="status"><b>{ui('search.noResults')}</b><span>{ui('ui.tryADifferentSearchTerm')}</span></div>}
      {!busy && !searched && !error && <div className="pdf-search-state muted"><span>{ui(pdf ? 'search.startHint' : 'search.sourceHint')}</span></div>}
      {results.length > 0 && <div className="pdf-search-results"><header><span role="status">{t('search.results', { count: `${results.length}${more ? '+' : ''}` })}{active >= 0 ? ` · ${active + 1}/${results.length}` : ''}</span><div><button type="button" aria-label={ui('search.previous')} title={ui('search.previous')} onClick={() => navigate(active < 0 ? results.length - 1 : active - 1, true)}>↑</button><button type="button" aria-label={ui('search.next')} title={ui('search.next')} onClick={() => navigate(active + 1, true)}>↓</button></div></header>{results.map((result, index) => <button className="pdf-search-result" aria-current={active === index ? 'true' : undefined} type="button" key={`${result.pageIndex}-${index}`} onClick={() => navigate(index)}><b>{t(pdf ? 'search.page' : 'search.line', { page: result.pageIndex + 1, line: result.line })}</b><span dir="auto">{result.context.slice(0, result.highlightStart)}<mark>{result.context.slice(result.highlightStart, result.highlightEnd)}</mark>{result.context.slice(result.highlightEnd)}</span></button>)}</div>}
    </div>
  </div>, window.document.querySelector('.app-shell') || window.document.body)
}
