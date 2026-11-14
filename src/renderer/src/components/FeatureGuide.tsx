import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ui, useInterfaceLanguage } from '../lib/i18n'
import type { ModuleKey, Tool } from '../types'
import { LanguagePicker } from './LanguagePicker'

const KEY = 'pdfuck.feature-guide.version'
const revision = (version: string) => `${version}:practice-1`
export function guideNeeded(version: string): boolean { try { return localStorage.getItem(KEY) !== revision(version) } catch { return true } }
export function markGuideSeen(version: string): void { try { localStorage.setItem(KEY, revision(version)) } catch { /* Profiles can disable local storage. */ } }
export const GUIDE_STEPS = [
  { id: 'workspace', module: 'view', target: '.left-dock' },
  { id: 'reading', module: 'view', page: 0, target: '.bookmark-panel, .document-area' },
  { id: 'highlight', module: 'annotate', tool: 'highlight', page: 0, target: '.pdf-page, .document-area' },
  { id: 'notes', module: 'annotate', page: 0, action: 'note', target: '.annotation-panel, .tool-panel' },
  { id: 'status', module: 'annotate', page: 0, action: 'status', target: '.annotation-panel, .tool-panel' },
  { id: 'editing', module: 'edit', tool: 'edit_text', page: 1, target: '.document-area' },
  { id: 'pages', module: 'edit', action: 'pages', target: '.tool-panel' },
  { id: 'lab', module: 'annotate', action: 'lab', target: '.annotation-lab-heading, .tool-panel' },
  { id: 'ocr', module: 'view', target: '.reading-tools, .tool-panel' },
  { id: 'writing', module: 'view', action: 'writing', target: '.new-document-button' },
  { id: 'saving', module: 'save', action: 'save', target: '.tool-panel' }
] satisfies Array<{ id: string; module: ModuleKey; tool?: Tool; page?: number; target: string; action?: string }>
export type GuideStep = typeof GUIDE_STEPS[number]
export type GuideAction = NonNullable<GuideStep['action']>

export function FeatureGuide({ onClose, onStart, onStep, onAction, ready = true }: { onClose(): void; onStart(): Promise<void>; onStep(step: GuideStep): void; onAction(action: GuideAction): Promise<void> | void; ready?: boolean }) {
  useInterfaceLanguage()
  const [index, setIndex] = useState(-1), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false)
  const [compact, setCompact] = useState(false)
  const spotlight = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null), previousFocus = useRef(document.activeElement as HTMLElement | null)
  const step = index < 0 ? undefined : GUIDE_STEPS[index]
  const stepRef = useRef(onStep); stepRef.current = onStep
  useEffect(() => { if (step) { stepRef.current(step) } }, [step])
  useEffect(() => { card.current?.focus({ preventScroll: true }); return () => { (previousFocus.current?.isConnected ? previousFocus.current : document.querySelector<HTMLElement>('.about-trigger'))?.focus({ preventScroll: true }) } }, [])
  useLayoutEffect(() => {
    if (!step || compact) return
    let frame: number, lastTarget: HTMLElement | null | undefined
    function measure() {
      const element = step!.target.split(', ').map(selector => document.querySelector<HTMLElement>(selector)).find(Boolean)
      if (element !== lastTarget) {
        if (lastTarget) observer.unobserve(lastTarget)
        if (element) {
          observer.observe(element)
          const scroll = element.closest('.window-scroll-body')
          if (scroll) scroll.scrollTop += element.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 12
        }
        lastTarget = element
      }
      const rect = element?.getBoundingClientRect()
      if (spotlight.current) Object.assign(spotlight.current.style, rect ? { left: `${rect.left + 2}px`, top: `${rect.top + 2}px`, width: `${Math.max(0, rect.width - 4)}px`, height: `${Math.max(0, rect.height - 4)}px`, visibility: 'visible' } : { visibility: 'hidden' })
    }
    const observer = new ResizeObserver(measure)
    const area = document.querySelector('.document-area')
    if (area) observer.observe(area)
    // Track translation every frame; resize callbacks also catch PDF fit/zoom before paint.
    const update = () => { measure(); frame = requestAnimationFrame(update) }
    update()
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [step, compact])
  async function start() { setBusy(true); setFailed(false); try { await onStart(); setIndex(0) } catch { setFailed(true) } finally { setBusy(false) } }
  async function action() { if (!step?.action) return; setBusy(true); setFailed(false); try { await onAction(step.action); setCompact(true) } catch { setFailed(true) } finally { setBusy(false) } }
  return <div data-step={step?.id || 'welcome'} className={`feature-guide${step ? ' practicing' : ' welcome'}${compact ? ' compact' : ''}`}>
    {step && !compact && <div ref={spotlight} className="guide-spotlight" aria-hidden="true" />}
    <div ref={card} tabIndex={-1} className="guide-card" role="dialog" aria-labelledby="guide-title" onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose() } }}>
      <header><span>{ui('guide.guide')}{step && ` · ${index + 1}/${GUIDE_STEPS.length}`}</span><button type="button" disabled={busy} onClick={onClose}>{ui('guide.skip')}</button></header>
      {!compact && <LanguagePicker/>}
      <h2 id="guide-title">{ui(step ? `tour.${step.id}` as 'tour.workspace' : 'tour.welcome')}</h2>
      {!compact && <><p>{ui(step ? `tour.${step.id}Body` as 'tour.workspaceBody' : 'tour.welcomeBody')}</p>{step && <div className="guide-progress" aria-hidden="true">{GUIDE_STEPS.map((s, i) => <i key={s.id} className={i <= index ? 'active' : ''}/>)}</div>}</>}
      {failed && <p role="alert">{ui('tour.failed')}</p>}
      {!step ? <button type="button" className="primary guide-start" disabled={busy || !ready} onClick={() => void start()}>{ui(busy ? 'tour.loading' : 'tour.start')}</button> : <>
        <div className="guide-practice-actions">{step.action && !compact && <button type="button" className="guide-tool-action" disabled={busy} onClick={() => void action()}>{ui(`tour.action.${step.action}` as 'tour.action.note')} ↗</button>}<button type="button" aria-expanded={!compact} onClick={() => setCompact(!compact)}>{ui(compact ? 'guide.guide' : 'tour.practiceAction')} {compact ? '⌃' : '⌄'}</button></div>
        <div className="guide-actions"><button type="button" disabled={!index || busy} onClick={() => { setCompact(false); setIndex(index - 1) }}>{ui('guide.back')}</button><button type="button" className="primary" disabled={busy} onClick={() => { if (index === GUIDE_STEPS.length - 1) onClose(); else { setCompact(false); setIndex(index + 1) } }}>{ui(index === GUIDE_STEPS.length - 1 ? 'tour.continue' : 'guide.next')}</button></div>
      </>}
    </div>
  </div>
}
