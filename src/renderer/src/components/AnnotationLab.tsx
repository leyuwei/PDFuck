import { useEffect, useRef, useState } from 'react'
import type { PageTextSelection } from '../lib/page-text-selection'
import { AnnotationIcon } from './AnnotationIcon'
import {
  AI_PRESETS, ANNOTATION_SUGGESTION_PRESETS, defaultSettings, detectAiLanguage, FULL_REVIEW_PRESETS,
  loadAiSettings, localizedPrompt, MAX_AI_TIMEOUT_SECONDS, MIN_AI_TIMEOUT_SECONDS, normalizeAiTimeoutSeconds,
  autoAnnotatePage, polishText, promptForLanguage, providerSettings, reviewDocument, saveAiSettings, suggestForAnnotation,
  type AiLanguage, type AiSettings, type FullReviewDocument, type FullReviewSendMode
} from '../lib/ai-polish'
import { normalizeCopiedText } from '../lib/clipboard-text'
import { t as message, translateUiText, ui, useInterfaceLanguage } from '../lib/i18n'
import { shortcutLabel } from '../lib/platform-shortcuts'
import { isImeCompositionKey, isTextEntryEvent } from '../lib/keyboard-input'
import { aiRequestProgress } from '../lib/ai-request-progress'
import {
  clearAnnotationSuggestionContexts, hasAnnotationSuggestionContextStore, loadAnnotationSuggestionContexts,
  saveAnnotationSuggestionContexts, selectionContextKey, type AnnotationSuggestionContext
} from '../lib/annotation-suggestion-contexts'
import { AiMarkdown } from './AiMarkdown'
import { DrawingBoard, DrawingBoardIcon } from './DrawingBoard'
import {
  DEFAULT_AUTOMATIC_CONTEXT_LEVEL, MAX_AUTOMATIC_CONTEXT_LEVEL, MIN_AUTOMATIC_CONTEXT_LEVEL,
  type AutomaticAnnotationContext, type AutomaticAnnotationContextIssue, type AutomaticAnnotationContextRequest,
  type AutomaticAnnotationContextResult
} from '../lib/automatic-annotation-context'
import {
  buildAutomaticAnnotationPages, draftAutomaticAnnotations,
  MAX_AUTOMATIC_ANNOTATION_CONTEXT_CHARS,
  type AutomaticAnnotationDetail, type AutomaticAnnotationDraft, type AutomaticAnnotationPage,
  type AutomaticAnnotationSourcePage
} from '../lib/automatic-annotation'
import './annotation-lab.css'

export const FULL_REVIEW_CONSENT_KEY = 'pdfuck.lab.full-review-consent.v1'
export const AUTOMATIC_ANNOTATION_DETAIL_KEY = 'pdfuck.lab.auto-annotation-detail.v1'

export interface AnnotationSuggestionRequest extends AutomaticAnnotationContextRequest { token: number; annotationId: string; annotationContent: string; pageIndex: number }
export interface LabDocumentPayload extends FullReviewDocument {}

interface Props {
  visible?: boolean
  selection?: PageTextSelection
  selectionKey?: string
  documentKey?: string
  platform?: string
  disabled?: boolean
  annotationSuggestionsEnabled?: boolean
  suggestionRequest?: AnnotationSuggestionRequest
  onSuggestionRequestConsumed?(token: number): void
  onAnnotationSuggestionsEnabledChange?(enabled: boolean): void
  getDocument?(mode: FullReviewSendMode): Promise<LabDocumentPayload>
  getAutomaticContext?(request: AutomaticAnnotationContextRequest, level: number): Promise<AutomaticAnnotationContextResult>
  getAutomaticAnnotationPages?(): Promise<AutomaticAnnotationSourcePage[]>
  onAdd(content: string): void | Promise<void>
  onAddFullReview?(content: string): void | Promise<void>
  onAddSuggestion?(annotationId: string, content: string): void | Promise<void>
  onAddAutomaticAnnotations?(annotations: AutomaticAnnotationDraft[]): void | Promise<void>
  onAddDrawing?(data: Uint8Array): void | Promise<void>
  onExportDrawing?(data: Uint8Array): void | Promise<void>
  onCopy(content: string): void
}

type LabWindow = 'polish' | 'review' | 'automatic' | 'suggestion' | 'drawing'
type AutomaticAnnotationScope = 'document' | 'selection'
type AutomaticAnnotationStatus = 'idle' | 'extracting' | 'running' | 'pausing' | 'paused' | 'error' | 'complete' | 'stopped'
type AutomaticAnnotationDecision = 'retry' | 'skip' | 'end'

interface AutomaticAnnotationProgress {
  page: number
  pages: number
  completed: number
  total: number
  annotations: number
  skipped: number
}

function loadAutomaticAnnotationDetail(): AutomaticAnnotationDetail {
  const value = localStorage.getItem(AUTOMATIC_ANNOTATION_DETAIL_KEY)
  return value === 'revision' || value === 'detailed' ? value : 'brief'
}

function characters(value: string): string[] { return Array.from(value) }
function clipStart(value: string, limit: number): string { return characters(value).slice(0, limit).join('') }
function clipEnd(value: string, limit: number): string { return characters(value).slice(-limit).join('') }
function pageText(page?: AutomaticAnnotationPage): string { return page?.blocks.map((block) => block.text).join('\n') || '' }
function intersects(left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}

function pageSelection(selection: PageTextSelection | undefined, pageIndex: number): PageTextSelection | undefined {
  if (!selection) return undefined
  const segment = selection.segments?.find((candidate) => candidate.pageIndex === pageIndex)
  if (segment) return { pageIndex, text: segment.text, rects: segment.rects }
  return selection.pageIndex === pageIndex ? { pageIndex, text: selection.text, rects: selection.rects } : undefined
}

function copySelection(selection: PageTextSelection): PageTextSelection {
  return {
    pageIndex: selection.pageIndex,
    text: selection.text,
    rects: selection.rects.map((rect) => ({ ...rect })),
    segments: selection.segments?.map((segment) => ({ ...segment, rects: segment.rects.map((rect) => ({ ...rect })) }))
  }
}

function localSelectionContext(page: AutomaticAnnotationPage | undefined, selection: PageTextSelection | undefined): string {
  if (!page || !selection) return ''
  const indexes = page.blocks.flatMap((block, index) => block.words.some((word) => selection.rects.some((rect) => intersects(word.rect, rect))) ? [index] : [])
  if (!indexes.length) return ''
  const start = Math.max(0, indexes[0] - 2)
  const end = Math.min(page.blocks.length, indexes.at(-1)! + 3)
  return clipStart(page.blocks.slice(start, end).map((block) => block.text).join('\n'), 1_500)
}

function selectionPageIndexes(selection: PageTextSelection): number[] {
  const pages = selection.segments?.map((segment) => segment.pageIndex) || [selection.pageIndex]
  return [...new Set(pages)]
}

function contextPageLabel(context: AnnotationSuggestionContext): string {
  return message('search.page', { page: context.pageIndexes.map((page) => page + 1).join(', ') })
}

export function AnnotationLab({ visible = true, selection, selectionKey, documentKey, platform = 'win32', disabled = false, annotationSuggestionsEnabled = false, suggestionRequest, onSuggestionRequestConsumed, onAnnotationSuggestionsEnabledChange, getDocument, getAutomaticContext, getAutomaticAnnotationPages, onAdd, onAddFullReview, onAddSuggestion, onAddAutomaticAnnotations, onAddDrawing, onExportDrawing, onCopy }: Props) {
  const interfaceLanguage = useInterfaceLanguage()
  const t = ui
  const [activeWindow, setActiveWindow] = useState<LabWindow>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings)
  const [language, setLanguage] = useState<AiLanguage>('zh')
  const [presetId, setPresetId] = useState(AI_PRESETS[0].id)
  const [instruction, setInstruction] = useState(AI_PRESETS[0].prompt)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [disclaimerOpen, setDisclaimerOpen] = useState(false)
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
  const [pendingConsentAction, setPendingConsentAction] = useState<'review' | 'automatic'>('review')
  const [reviewMode, setReviewMode] = useState<FullReviewSendMode>('text')
  const [reviewPresetId, setReviewPresetId] = useState(FULL_REVIEW_PRESETS[0].id)
  const [reviewInstruction, setReviewInstruction] = useState(() => localizedPrompt(FULL_REVIEW_PRESETS[0], interfaceLanguage))
  const [reviewResult, setReviewResult] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewAdding, setReviewAdding] = useState(false)
  const [reviewStartedAt, setReviewStartedAt] = useState<number>()
  const [reviewProgressNow, setReviewProgressNow] = useState(() => Date.now())
  const [suggestionPresetId, setSuggestionPresetId] = useState(ANNOTATION_SUGGESTION_PRESETS[0].id)
  const [suggestionInstruction, setSuggestionInstruction] = useState(() => localizedPrompt(ANNOTATION_SUGGESTION_PRESETS[0], interfaceLanguage))
  const [activeSuggestionRequest, setActiveSuggestionRequest] = useState<AnnotationSuggestionRequest>()
  const [automaticContextEnabled, setAutomaticContextEnabled] = useState(true)
  const [automaticContextLevel, setAutomaticContextLevel] = useState(DEFAULT_AUTOMATIC_CONTEXT_LEVEL)
  const [automaticContext, setAutomaticContext] = useState<AutomaticAnnotationContext>()
  const [automaticContextIssue, setAutomaticContextIssue] = useState<AutomaticAnnotationContextIssue>()
  const [automaticContextLoading, setAutomaticContextLoading] = useState(false)
  const [contexts, setContexts] = useState<AnnotationSuggestionContext[]>([])
  const [persistContexts, setPersistContexts] = useState(false)
  const [suggestionResult, setSuggestionResult] = useState('')
  const [suggestionError, setSuggestionError] = useState('')
  const [suggestionBusy, setSuggestionBusy] = useState(false)
  const [suggestionAdding, setSuggestionAdding] = useState(false)
  const [automaticScope, setAutomaticScope] = useState<AutomaticAnnotationScope>('document')
  const [automaticDetail, setAutomaticDetail] = useState<AutomaticAnnotationDetail>(loadAutomaticAnnotationDetail)
  const [automaticStatus, setAutomaticStatus] = useState<AutomaticAnnotationStatus>('idle')
  const [automaticError, setAutomaticError] = useState('')
  const [automaticProgress, setAutomaticProgress] = useState<AutomaticAnnotationProgress>({ page: 0, pages: 0, completed: 0, total: 0, annotations: 0, skipped: 0 })
  const drag = useRef<{ x: number; y: number; origin: { x: number; y: number } } | undefined>(undefined)
  const polishRequestId = useRef(0)
  const reviewRequestId = useRef(0)
  const suggestionRequestId = useRef(0)
  const automaticRunId = useRef(0)
  const automaticAiRequestId = useRef<string | undefined>(undefined)
  const automaticPauseRequested = useRef(false)
  const automaticResume = useRef<(() => void) | undefined>(undefined)
  const automaticDecision = useRef<((decision: AutomaticAnnotationDecision) => void) | undefined>(undefined)
  const normalizedSelection = normalizeCopiedText(selection?.text || '')
  const selectedLanguage = detectAiLanguage(normalizedSelection, interfaceLanguage)
  const reviewProgress = reviewStartedAt === undefined ? undefined : aiRequestProgress(settings.timeoutSeconds, reviewStartedAt, reviewProgressNow)
  const automaticActive = automaticStatus === 'extracting' || automaticStatus === 'running' || automaticStatus === 'pausing' || automaticStatus === 'paused' || automaticStatus === 'error'

  useEffect(() => {
    if (!visible) return
    const handler = (event: KeyboardEvent) => {
      if (!isImeCompositionKey(event) && !isTextEntryEvent(event) && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i' && normalizedSelection) { event.preventDefault(); setActiveWindow('polish') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [normalizedSelection, visible])
  useEffect(() => {
    if (!visible) return
    const handler = () => { if (normalizedSelection) setActiveWindow('polish') }
    window.addEventListener('pdfuck:open-ai-polish', handler)
    return () => window.removeEventListener('pdfuck:open-ai-polish', handler)
  }, [normalizedSelection, visible])
  useEffect(() => {
    if (visible && !busy && !reviewBusy && !suggestionBusy && !automaticActive) setSettings(loadAiSettings())
  }, [visible])
  useEffect(() => {
    if (!visible && activeWindow === 'drawing') setActiveWindow(undefined)
  }, [activeWindow, visible])
  useEffect(() => {
    polishRequestId.current += 1
    setResult(''); setError(''); setBusy(false); setAdding(false)
  }, [selectionKey, normalizedSelection])
  useEffect(() => {
    setLanguage(selectedLanguage)
    setPresetId(AI_PRESETS[0].id)
    setInstruction(promptForLanguage(AI_PRESETS[0], selectedLanguage))
  }, [selectedLanguage, selectionKey])
  useEffect(() => {
    if (reviewPresetId) setReviewInstruction(localizedPrompt(FULL_REVIEW_PRESETS.find((preset) => preset.id === reviewPresetId) || FULL_REVIEW_PRESETS[0], interfaceLanguage))
    if (suggestionPresetId) setSuggestionInstruction(localizedPrompt(ANNOTATION_SUGGESTION_PRESETS.find((preset) => preset.id === suggestionPresetId) || ANNOTATION_SUGGESTION_PRESETS[0], interfaceLanguage))
  }, [interfaceLanguage, reviewPresetId, suggestionPresetId])
  useEffect(() => {
    if (!suggestionRequest) return
    suggestionRequestId.current += 1
    setActiveSuggestionRequest(suggestionRequest)
    const saved = loadAnnotationSuggestionContexts(documentKey)
    setContexts(saved); setPersistContexts(hasAnnotationSuggestionContextStore(documentKey)); setAutomaticContext(undefined); setAutomaticContextIssue(undefined); setAutomaticContextLoading(false); setSuggestionResult(''); setSuggestionError(''); setSuggestionBusy(false); setSuggestionAdding(false)
    setSuggestionPresetId(ANNOTATION_SUGGESTION_PRESETS[0].id)
    setSuggestionInstruction(localizedPrompt(ANNOTATION_SUGGESTION_PRESETS[0], interfaceLanguage))
    setActiveWindow('suggestion')
    onSuggestionRequestConsumed?.(suggestionRequest.token)
  }, [suggestionRequest?.token, documentKey, onSuggestionRequestConsumed])
  useEffect(() => {
    let active = true
    if (!activeSuggestionRequest || !automaticContextEnabled || !getAutomaticContext) {
      setAutomaticContext(undefined); setAutomaticContextIssue(undefined); setAutomaticContextLoading(false)
      return () => { active = false }
    }
    setAutomaticContextLoading(true); setAutomaticContextIssue(undefined)
    const timer = window.setTimeout(() => {
      void getAutomaticContext(activeSuggestionRequest, automaticContextLevel).then((result) => {
        if (!active) return
        setAutomaticContext(result.context); setAutomaticContextIssue(result.issue); setAutomaticContextLoading(false)
      }).catch(() => {
        if (!active) return
        setAutomaticContext(undefined); setAutomaticContextIssue('no-text'); setAutomaticContextLoading(false)
      })
    }, 120)
    return () => { active = false; window.clearTimeout(timer) }
  }, [activeSuggestionRequest, automaticContextEnabled, automaticContextLevel, getAutomaticContext])
  useEffect(() => {
    if (!reviewBusy || reviewStartedAt === undefined) return
    setReviewProgressNow(Date.now())
    const timer = window.setInterval(() => setReviewProgressNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [reviewBusy, reviewStartedAt])
  useEffect(() => () => {
    automaticRunId.current += 1
    automaticPauseRequested.current = false
    automaticResume.current?.()
    automaticDecision.current?.('end')
    if (automaticAiRequestId.current) window.desktop?.cancelAiRequest?.(automaticAiRequestId.current)
  }, [])

  const beginDrag = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    drag.current = { x: event.clientX, y: event.clientY, origin: position }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: React.PointerEvent) => { if (drag.current) setPosition({ x: drag.current.origin.x + event.clientX - drag.current.x, y: drag.current.origin.y + event.clientY - drag.current.y }) }
  const endDrag = () => { drag.current = undefined }
  const persistSettings = () => {
    const normalized = { ...settings, timeoutSeconds: normalizeAiTimeoutSeconds(settings.timeoutSeconds) }
    setSettings(normalized); saveAiSettings(normalized); setSettingsOpen(false)
  }
  const openFullReview = () => {
    setReviewMode('text'); setReviewResult(''); setReviewError(''); setReviewBusy(false); setReviewAdding(false); setReviewStartedAt(undefined)
    setReviewPresetId(FULL_REVIEW_PRESETS[0].id); setReviewInstruction(localizedPrompt(FULL_REVIEW_PRESETS[0], interfaceLanguage))
    setActiveWindow('review')
  }
  const openAutomaticAnnotation = () => {
    if (!automaticActive) setAutomaticScope('document')
    setActiveWindow('automatic')
  }
  const requestDocumentAi = (action: 'review' | 'automatic') => {
    if (localStorage.getItem(FULL_REVIEW_CONSENT_KEY) === 'accepted') {
      if (action === 'review') openFullReview(); else openAutomaticAnnotation()
      return
    }
    setPendingConsentAction(action); setDisclaimerAccepted(false); setDisclaimerOpen(true)
  }
  const requestFullReview = () => requestDocumentAi('review')
  const requestAutomaticAnnotation = () => requestDocumentAi('automatic')
  const acceptDisclaimer = () => {
    if (!disclaimerAccepted) return
    localStorage.setItem(FULL_REVIEW_CONSENT_KEY, 'accepted'); setDisclaimerOpen(false)
    if (pendingConsentAction === 'review') openFullReview(); else openAutomaticAnnotation()
  }

  const submitPolish = async () => {
    if (!normalizedSelection) { setError('请先在 PDF 页面框选需要润色的文字。'); return }
    const current = ++polishRequestId.current
    setBusy(true); setError(''); setResult('')
    try { const output = await polishText(settings, instruction, normalizedSelection); if (polishRequestId.current === current) setResult(output) }
    catch (cause) { if (polishRequestId.current === current) setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (polishRequestId.current === current) setBusy(false) }
  }
  const addPolishResult = async () => {
    if (!result || adding) return
    setAdding(true); setError('')
    try { await onAdd(result); setActiveWindow(undefined) } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setAdding(false) }
  }
  const submitReview = async () => {
    if (!getDocument) return
    const current = ++reviewRequestId.current
    const startedAt = Date.now()
    setReviewStartedAt(startedAt); setReviewProgressNow(startedAt)
    setReviewBusy(true); setReviewError(''); setReviewResult('')
    try {
      const document = await getDocument(reviewMode)
      const output = await reviewDocument(settings, reviewInstruction, document, reviewMode, interfaceLanguage)
      if (reviewRequestId.current === current) setReviewResult(output)
    } catch (cause) { if (reviewRequestId.current === current) setReviewError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (reviewRequestId.current === current) setReviewBusy(false) }
  }
  const addReviewResult = async () => {
    if (!reviewResult || reviewAdding || !onAddFullReview) return
    setReviewAdding(true); setReviewError('')
    try { await onAddFullReview(reviewResult); setActiveWindow(undefined) } catch (cause) { setReviewError(cause instanceof Error ? cause.message : String(cause)); setReviewAdding(false) }
  }
  const automaticFailureText = (cause: unknown) => {
    const value = cause instanceof Error ? cause.message : String(cause)
    return translateUiText(value)
  }
  const waitForAutomaticDecision = (cause: unknown) => new Promise<AutomaticAnnotationDecision>((resolve) => {
    setAutomaticError(automaticFailureText(cause)); setAutomaticStatus('error'); automaticDecision.current = resolve
  })
  const decideAutomaticAnnotation = (decision: AutomaticAnnotationDecision) => {
    const resolve = automaticDecision.current
    if (!resolve) return
    automaticDecision.current = undefined; setAutomaticError('')
    resolve(decision)
  }
  const startAutomaticAnnotation = async () => {
    if (automaticActive || !getAutomaticAnnotationPages || !onAddAutomaticAnnotations) return
    const scopedSelection = automaticScope === 'selection' && selection ? copySelection(selection) : undefined
    if (automaticScope === 'selection' && (!scopedSelection || !normalizeCopiedText(scopedSelection.text))) {
      setAutomaticError(t("ui.selectTextInThePdfFirst")); return
    }
    const runId = ++automaticRunId.current
    const settingsSnapshot = settings
    const detailSnapshot = automaticDetail
    automaticPauseRequested.current = false
    automaticResume.current = undefined
    automaticDecision.current = undefined
    setAutomaticError(''); setAutomaticStatus('extracting')
    setAutomaticProgress({ page: 0, pages: 0, completed: 0, total: 0, annotations: 0, skipped: 0 })
    try {
      const sourcePages = await getAutomaticAnnotationPages()
      if (automaticRunId.current !== runId) return
      const fullPages = buildAutomaticAnnotationPages(sourcePages).filter((page) => page.blocks.length)
      const targetPages = (scopedSelection ? buildAutomaticAnnotationPages(sourcePages, scopedSelection) : fullPages).filter((page) => page.blocks.length)
      if (!targetPages.length) throw new Error(t("ui.noExtractableTextForAutomaticAnnotation"))
      const fullPageByIndex = new Map(fullPages.map((page) => [page.pageIndex, page]))
      const opening = clipStart(fullPages.map(pageText).join('\n'), MAX_AUTOMATIC_ANNOTATION_CONTEXT_CHARS)
      const total = targetPages.reduce((count, page) => count + page.blocks.length, 0)
      let completed = 0, annotations = 0, skipped = 0, contextSummary = ''
      setAutomaticProgress({ page: 1, pages: targetPages.length, completed, total, annotations, skipped })

      for (let index = 0; index < targetPages.length;) {
        if (automaticRunId.current !== runId) return
        if (automaticPauseRequested.current) {
          setAutomaticStatus('paused')
          await new Promise<void>((resolve) => { automaticResume.current = resolve })
          automaticResume.current = undefined
          if (automaticRunId.current !== runId) return
        }
        const page = targetPages[index]
        const fullPage = fullPageByIndex.get(page.pageIndex)
        const nearby = scopedSelection ? localSelectionContext(fullPage, pageSelection(scopedSelection, page.pageIndex)) : ''
        const previousPage = fullPageByIndex.get(page.pageIndex - 1)
        const nextPage = fullPageByIndex.get(page.pageIndex + 1)
        const previous = clipStart([nearby, clipEnd(pageText(previousPage), 900)].filter(Boolean).join('\n'), MAX_AUTOMATIC_ANNOTATION_CONTEXT_CHARS)
        const next = clipStart(pageText(nextPage), 1_200)
        setAutomaticStatus('running')
        setAutomaticProgress({ page: index + 1, pages: targetPages.length, completed, total, annotations, skipped })

        let response: Awaited<ReturnType<typeof autoAnnotatePage>> | undefined
        let skipPage = false
        while (!response && !skipPage) {
          const requestId = crypto.randomUUID()
          automaticAiRequestId.current = requestId
          try {
            response = await autoAnnotatePage(settingsSnapshot, { pageIndex: page.pageIndex, blocks: page.blocks, opening, previous, next, contextSummary, detail: detailSnapshot, language: interfaceLanguage }, requestId)
          } catch (cause) {
            if (automaticRunId.current !== runId) return
            const decision = await waitForAutomaticDecision(cause)
            if (automaticRunId.current !== runId || decision === 'end') return
            if (decision === 'skip') skipPage = true
            else setAutomaticStatus('running')
          } finally {
            if (automaticAiRequestId.current === requestId) automaticAiRequestId.current = undefined
          }
        }
        if (automaticRunId.current !== runId) return
        if (skipPage || !response) {
          completed += page.blocks.length; index += 1
          setAutomaticProgress({ page: Math.min(index + 1, targetPages.length), pages: targetPages.length, completed, total, annotations, skipped })
          continue
        }

        const resolved = draftAutomaticAnnotations(response, page.blocks, scopedSelection)
        let writeSkipped = false
        if (resolved.drafts.length) {
          for (;;) {
            try { await onAddAutomaticAnnotations(resolved.drafts); break }
            catch (cause) {
              if (automaticRunId.current !== runId) return
              const decision = await waitForAutomaticDecision(cause)
              if (automaticRunId.current !== runId || decision === 'end') return
              if (decision === 'skip') { writeSkipped = true; break }
              setAutomaticStatus('running')
            }
          }
        }
        if (automaticRunId.current !== runId) return
        completed += page.blocks.length
        skipped += resolved.rejected.length + (writeSkipped ? resolved.drafts.length : 0)
        if (!writeSkipped) annotations += resolved.drafts.length
        contextSummary = response.contextSummary
        index += 1
        setAutomaticProgress({ page: Math.min(index + 1, targetPages.length), pages: targetPages.length, completed, total, annotations, skipped })
      }
      if (automaticRunId.current === runId) { setAutomaticStatus('complete'); setAutomaticError('') }
    } catch (cause) {
      if (automaticRunId.current === runId) { setAutomaticStatus('idle'); setAutomaticError(automaticFailureText(cause)) }
    }
  }
  const pauseAutomaticAnnotation = () => {
    automaticPauseRequested.current = true
    if (automaticStatus === 'running') setAutomaticStatus('pausing')
  }
  const resumeAutomaticAnnotation = () => {
    automaticPauseRequested.current = false
    automaticResume.current?.(); automaticResume.current = undefined
    if (automaticStatus === 'paused' || automaticStatus === 'pausing') setAutomaticStatus('running')
  }
  const stopAutomaticAnnotation = () => {
    automaticRunId.current += 1
    automaticPauseRequested.current = false
    automaticResume.current?.(); automaticResume.current = undefined
    automaticDecision.current?.('end'); automaticDecision.current = undefined
    if (automaticAiRequestId.current) window.desktop?.cancelAiRequest?.(automaticAiRequestId.current)
    automaticAiRequestId.current = undefined
    setAutomaticError(''); setAutomaticStatus('stopped')
  }
  const captureContext = () => {
    if (!selection || !normalizedSelection) { setSuggestionError('请先在 PDF 页面框选一段正文，再点击“加入当前选区”。'); return }
    const key = selectionContextKey({ ...selection, text: normalizedSelection })
    if (contexts.some((context) => context.key === key)) { setSuggestionError('当前选区已经加入，请继续框选其他上下文。'); return }
    const next = [...contexts, { key, text: normalizedSelection, pageIndexes: selectionPageIndexes(selection) }]
    setContexts(next)
    if (persistContexts) saveAnnotationSuggestionContexts(documentKey, next)
    setSuggestionError(''); setSuggestionResult('')
  }
  const removeContext = (index: number) => {
    const next = contexts.filter((_, candidate) => candidate !== index)
    setContexts(next)
    if (persistContexts) saveAnnotationSuggestionContexts(documentKey, next)
  }
  const changePersistContexts = (enabled: boolean) => {
    setPersistContexts(enabled)
    if (enabled) saveAnnotationSuggestionContexts(documentKey, contexts)
    else clearAnnotationSuggestionContexts(documentKey)
  }
  const submitSuggestion = async () => {
    if (!activeSuggestionRequest) return
    const requestContexts = [...(automaticContextEnabled && automaticContext ? [automaticContext.text] : []), ...contexts.map((context) => context.text)]
    if (!requestContexts.length) { setSuggestionError('请至少加入一段正文上下文。'); return }
    const current = ++suggestionRequestId.current
    setSuggestionBusy(true); setSuggestionError(''); setSuggestionResult('')
    try {
      const output = await suggestForAnnotation(settings, suggestionInstruction, activeSuggestionRequest.annotationContent, requestContexts, interfaceLanguage)
      if (suggestionRequestId.current === current) setSuggestionResult(output)
    } catch (cause) { if (suggestionRequestId.current === current) setSuggestionError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (suggestionRequestId.current === current) setSuggestionBusy(false) }
  }
  const addSuggestionResult = async () => {
    if (!suggestionResult || suggestionAdding || !activeSuggestionRequest || !onAddSuggestion) return
    setSuggestionAdding(true); setSuggestionError('')
    try { await onAddSuggestion(activeSuggestionRequest.annotationId, suggestionResult); setActiveWindow(undefined); setActiveSuggestionRequest(undefined) } catch (cause) { setSuggestionError(cause instanceof Error ? cause.message : String(cause)); setSuggestionAdding(false) }
  }

  if (!visible) return null
  const windowStyle = { transform: `translate(${position.x}px, ${position.y}px)` }
  const hasSuggestionContext = Boolean(automaticContextEnabled && automaticContext?.text) || contexts.length > 0
  const automaticPercent = automaticProgress.total ? Math.round(automaticProgress.completed / automaticProgress.total * 100) : 0
  const automaticStateLabel = automaticStatus === 'extracting' ? t("ui.extractingDocumentText")
    : automaticStatus === 'pausing' ? t("ui.automaticAnnotationPausing")
      : automaticStatus === 'paused' ? t("ui.automaticAnnotationPaused")
        : automaticStatus === 'complete' ? t("ui.automaticAnnotationComplete")
          : automaticStatus === 'stopped' ? t("ui.automaticAnnotationStopped")
            : t("ui.analyzingAndAddingAnnotations")
  return <div className="annotation-lab">
    <div className="annotation-lab-heading"><h3>{t("ui.lab")}</h3><button type="button" className="annotation-lab-settings-trigger" title={t("ui.labModelSettings")} aria-label={t("ui.labModelSettings")} onClick={() => setSettingsOpen(true)}>⚙</button></div>
    <div className="annotation-lab-tools">
      <button type="button" className="tool-button with-icon has-shortcut annotation-lab-launch" disabled={disabled} onClick={() => setActiveWindow('polish')}><AnnotationIcon kind="ai_polish" /><span className="tool-button-copy"><strong>{t("ui.aiPolish")}</strong><small>{t("ui.selectText")}</small></span><kbd>{shortcutLabel('aiPolish', platform)}</kbd></button>
      <button type="button" className="tool-button with-icon annotation-lab-launch full-review-launch" disabled={disabled || !getDocument} onClick={requestFullReview}><AnnotationIcon kind="ai_review" /><span className="tool-button-copy"><strong>{t("ui.fullDocumentReview")}</strong><small>{t("ui.askAiToReviewTheEntireDocument")}</small></span></button>
      <button type="button" className="tool-button with-icon annotation-lab-launch automatic-annotation-launch" disabled={disabled || !getAutomaticAnnotationPages || !onAddAutomaticAnnotations} onClick={requestAutomaticAnnotation}><AnnotationIcon kind="ai_annotate" /><span className="tool-button-copy"><strong>{t("ui.automaticAnnotation")}</strong><small>{t("ui.reviewEachPageAndAddAnnotations")}</small></span></button>
      <button type="button" className={`tool-button with-icon annotation-lab-launch annotation-suggestion-toggle${annotationSuggestionsEnabled ? ' active' : ''}`} disabled={disabled} aria-pressed={annotationSuggestionsEnabled} onClick={() => onAnnotationSuggestionsEnabledChange?.(!annotationSuggestionsEnabled)}><AnnotationIcon kind="ai_suggest" /><span className="tool-button-copy"><strong>{t("ui.annotationSuggestions")}</strong><small>{t(annotationSuggestionsEnabled ? "ui.onUseFromAnnotationSettings" : "ui.generateAdviceFromAnnotations")}</small></span><span className="lab-toggle-indicator" aria-hidden="true"><i /></span></button>
      <button type="button" className="tool-button with-icon annotation-lab-launch drawing-board-launch" disabled={disabled || !onAddDrawing || !onExportDrawing} onClick={() => setActiveWindow('drawing')}><DrawingBoardIcon /><span className="tool-button-copy"><strong>{t("ui.freeDrawingBoard")}</strong><small>{t("ui.drawFreelyOnAResizableCanvasThenExportOrAddToCurrentPage")}</small></span></button>
    </div>

    {settingsOpen && <div className="annotation-lab-settings-backdrop" role="presentation" onPointerDown={() => setSettingsOpen(false)}><section className="annotation-lab-settings" role="dialog" aria-modal="true" aria-label={t("ui.labModelSettings")} onPointerDown={(event) => event.stopPropagation()}><header><b>{t("ui.labModelSettings")}</b><button type="button" onClick={() => setSettingsOpen(false)} aria-label={t("ui.closeModelSettings")}>×</button></header>
      <p className="lab-settings-note">{t("ui.aiPolishFullDocumentReviewAndAnnotationSuggestionsShareThis")}</p>
      <label>{t("ui.provider")}<select value={settings.provider} onChange={(event) => setSettings(providerSettings(settings, event.target.value as AiSettings['provider']))}><option value="openai">{t("ui.openaiRelay")}</option><option value="claude">{t("ui.claudeRelay")}</option><option value="bigmodel">BigModel Plan</option><option value="doubao">Doubao</option><option value="deepseek">DeepSeek</option><option value="kimi">KIMI</option><option value="custom">{t("ui.customOpenaiCompatible")}</option></select></label>
      <label>{t("ui.apiEndpoint")}<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} /></label><label>{t("ui.apiKey")}<input type="password" value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} /></label><label>{t("ui.model")}<input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} /></label>
      <label>{t("ui.responseTimeout")}<span className="ai-timeout-input"><input type="number" min={MIN_AI_TIMEOUT_SECONDS} max={MAX_AI_TIMEOUT_SECONDS} step={1} value={settings.timeoutSeconds} onChange={(event) => setSettings({ ...settings, timeoutSeconds: Number(event.target.value) })} /><span>{t("ui.sec")}</span></span><small>{t("ui.maximumWaitTimeTheDefaultIs120Seconds")}</small></label>
      <footer><button type="button" onClick={() => setSettings(defaultSettings)}>{t("ui.restoreDefaults")}</button><button type="button" className="primary" onClick={persistSettings}>{t("ui.save")}</button></footer>
    </section></div>}

    {disclaimerOpen && <div className="lab-modal-backdrop"><section className="lab-disclaimer" role="dialog" aria-modal="true" aria-labelledby="full-review-disclaimer-title"><header><span className="lab-warning-icon">!</span><div><h2 id="full-review-disclaimer-title">{t("ui.fullDocumentReviewPrivacyAndDataRiskNotice")}</h2><p>{t("ui.confirmTheDataTransferRisksBeforeFirstUse")}</p></div></header><div className="lab-disclaimer-copy"><p>{t("ui.fullDocumentReviewSendsAllTextInTheCurrentDocument")}</p><p>{t("ui.pdfuckCannotControlHowTheAiProviderStoresUsesOr")}</p><p>{t("ui.onlyProcessDocumentsYouAreAuthorizedToSendAndThat")}</p></div><div className="lab-consent-area"><label className="lab-consent-check"><input type="checkbox" checked={disclaimerAccepted} onChange={(event) => setDisclaimerAccepted(event.target.checked)} /><span>{t("ui.iHaveReadAndAcceptThisNoticeAndVoluntarilyAssume")}</span></label></div><footer><button type="button" onClick={() => setDisclaimerOpen(false)}>{t("ui.cancel")}</button><button type="button" className="primary" disabled={!disclaimerAccepted} onClick={acceptDisclaimer}>{t("ui.agreeAndContinue")}</button></footer></section></div>}

    {activeWindow === 'polish' && <div className="ai-polish-window" style={windowStyle}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}><span><AnnotationIcon kind="ai_polish" />{t("ui.aiPolish")}</span><button type="button" onClick={() => setActiveWindow(undefined)} aria-label={t("ui.close")}>×</button></header><p className="ai-polish-selection">{normalizedSelection || t("ui.selectTextInThePdfFirst")}</p><div className="ai-preset-grid">{AI_PRESETS.map((preset) => <button type="button" key={preset.id} className={presetId === preset.id ? 'active' : ''} onClick={() => { setPresetId(preset.id); setInstruction(promptForLanguage(preset, language)) }}>{t(preset.label)}</button>)}</div><textarea value={instruction} aria-label={t("ui.polishingInstruction")} onChange={(event) => { setPresetId(''); setInstruction(event.target.value) }} placeholder={t("ui.customInstruction")} /><button type="button" className="primary wide" disabled={busy} onClick={() => void submitPolish()}>{busy ? t("ui.gettingResponse") : t("ui.polishText")}</button>{error && <p className="ai-polish-error">{translateUiText(error)}</p>}{result && <><AiMarkdown content={result} /><div className="ai-polish-actions"><button type="button" onClick={() => onCopy(result)}>{t("ui.copyResponse")}</button><button type="button" className="primary" disabled={adding} onClick={() => void addPolishResult()}>{adding ? t("ui.adding") : t("ui.addToAnnotations")}</button></div></>}</div>}

    {activeWindow === 'review' && <div className="ai-polish-window lab-workflow-window full-review-window" style={windowStyle}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}><span><AnnotationIcon kind="ai_review" />{t("ui.fullDocumentReview")}</span><button type="button" onClick={() => setActiveWindow(undefined)} aria-label={t("ui.close")}>×</button></header><p className="lab-workflow-intro">{t("ui.chooseASendModeAndReviewPromptTheAiWill")}</p><div className="lab-send-mode" role="radiogroup" aria-label={t("ui.documentSendMode")}><button type="button" role="radio" aria-checked={reviewMode === 'text'} className={reviewMode === 'text' ? 'active' : ''} onClick={() => setReviewMode('text')}><b>{t("ui.sendConvertedDocumentText")}</b><small>{t("ui.moreCompatibleWithPageByPageMarkers")}</small></button><button type="button" role="radio" aria-checked={reviewMode === 'file'} className={reviewMode === 'file' ? 'active' : ''} onClick={() => setReviewMode('file')}><b>{t("ui.sendThePdfFileDirectly")}</b><small>{t("ui.preservesLayoutButTheModelMustSupportPdfInput")}</small></button></div>{reviewMode === 'file' && <p className="lab-compatibility-note">{t("ui.fileInputCompatibilityDependsOnTheAiProviderOrRelay")}</p>}<label className="lab-field-title">{t("ui.reviewPrompt")}</label><div className="ai-preset-grid lab-preset-grid">{FULL_REVIEW_PRESETS.map((preset) => <button type="button" key={preset.id} className={reviewPresetId === preset.id ? 'active' : ''} onClick={() => { setReviewPresetId(preset.id); setReviewInstruction(localizedPrompt(preset, interfaceLanguage)) }}>{t(preset.label)}</button>)}</div><textarea value={reviewInstruction} aria-label={t("ui.reviewPrompt")} onChange={(event) => { setReviewPresetId(''); setReviewInstruction(event.target.value) }} /><button type="button" className="primary wide" disabled={reviewBusy} onClick={() => void submitReview()}>{reviewBusy ? t("ui.reviewingTheEntireDocument") : t("ui.startFullDocumentReview")}</button>{reviewBusy && reviewProgress && <div className="lab-review-progress" role="progressbar" aria-label={t("ui.fullDocumentReviewProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reviewProgress.elapsedPercent)}><header><b>{t("ui.aiIsReviewingTheEntireDocument")}</b><span>{message('lab.reviewCountdown', { seconds: reviewProgress.remainingSeconds })}</span></header><div className="lab-review-progress-track"><i style={{ width: `${reviewProgress.elapsedPercent}%` }} /></div><small>{t("ui.theMaximumWaitUsesTheResponseTimeoutInModelSettings")}</small></div>}{reviewError && <p className="ai-polish-error">{translateUiText(reviewError)}</p>}{reviewResult && <><AiMarkdown content={reviewResult} className="lab-long-result" /><div className="ai-polish-actions"><button type="button" onClick={() => onCopy(reviewResult)}>{t("ui.copyResponse")}</button><button type="button" className="primary" disabled={reviewAdding} onClick={() => void addReviewResult()}>{reviewAdding ? t("ui.adding") : t("ui.addToAnnotations")}</button></div></>}</div>}

    {activeWindow === 'automatic' && <div className="ai-polish-window lab-workflow-window automatic-annotation-window" style={windowStyle}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}><span><AnnotationIcon kind="ai_annotate" />{t("ui.automaticAnnotation")}</span><button type="button" onClick={() => setActiveWindow(undefined)} aria-label={t("ui.close")}>×</button></header><p className="lab-workflow-intro">{t("ui.automaticAnnotationIntro")}</p>
      <fieldset className="automatic-annotation-options" disabled={automaticActive}><legend>{t("ui.annotationScope")}</legend><div className="automatic-option-grid"><label className={automaticScope === 'document' ? 'active' : ''}><input type="radio" name="automatic-annotation-scope" value="document" checked={automaticScope === 'document'} onChange={() => setAutomaticScope('document')} /><span><b>{t("ui.fullDocument")}</b><small>{t("ui.reviewEachPageAndAddAnnotations")}</small></span></label><label className={automaticScope === 'selection' ? 'active' : ''}><input type="radio" name="automatic-annotation-scope" value="selection" checked={automaticScope === 'selection'} disabled={!normalizedSelection} onChange={() => setAutomaticScope('selection')} /><span><b>{t("ui.currentSelection")}</b><small>{normalizedSelection ? clipStart(normalizedSelection, 90) : t("ui.selectTextInThePdfFirst")}</small></span></label></div>{automaticScope === 'selection' && <p className="automatic-context-disclosure">{t("ui.selectionAnnotationContextNotice")}</p>}</fieldset>
      <fieldset className="automatic-annotation-options" disabled={automaticActive}><legend>{t("ui.annotationExplanation")}</legend><div className="automatic-option-grid three"><label className={automaticDetail === 'revision' ? 'active' : ''}><input type="radio" name="automatic-annotation-detail" value="revision" checked={automaticDetail === 'revision'} onChange={() => { setAutomaticDetail('revision'); localStorage.setItem(AUTOMATIC_ANNOTATION_DETAIL_KEY, 'revision') }} /><span><b>{t("ui.revisionOnly")}</b><small>{t("ui.revisionOnlyHint")}</small></span></label><label className={automaticDetail === 'brief' ? 'active' : ''}><input type="radio" name="automatic-annotation-detail" value="brief" checked={automaticDetail === 'brief'} onChange={() => { setAutomaticDetail('brief'); localStorage.setItem(AUTOMATIC_ANNOTATION_DETAIL_KEY, 'brief') }} /><span><b>{t("ui.briefReason")}</b><small>{t("ui.briefReasonHint")}</small></span></label><label className={automaticDetail === 'detailed' ? 'active' : ''}><input type="radio" name="automatic-annotation-detail" value="detailed" checked={automaticDetail === 'detailed'} onChange={() => { setAutomaticDetail('detailed'); localStorage.setItem(AUTOMATIC_ANNOTATION_DETAIL_KEY, 'detailed') }} /><span><b>{t("ui.detailedReason")}</b><small>{t("ui.detailedReasonHint")}</small></span></label></div></fieldset>
      {!automaticActive && <button type="button" className="primary wide automatic-start" disabled={!getAutomaticAnnotationPages || !onAddAutomaticAnnotations} onClick={() => void startAutomaticAnnotation()}>{t("ui.startAutomaticAnnotation")}</button>}
      {automaticStatus !== 'idle' && <section className={`automatic-annotation-progress ${automaticStatus}`} role="progressbar" aria-label={t("ui.automaticAnnotationProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={automaticStatus === 'extracting' ? undefined : automaticPercent}><header><b>{automaticStatus === 'error' ? t("ui.actionFailed") : automaticStateLabel}</b><span>{automaticStatus === 'extracting' ? '' : `${automaticPercent}%`}</span></header><div className="lab-review-progress-track"><i style={{ width: automaticStatus === 'extracting' ? '35%' : `${automaticPercent}%` }} /></div>{automaticStatus !== 'extracting' && <p aria-live="polite">{automaticStatus === 'complete' ? message('autoAnnotation.complete', { total: automaticProgress.total, annotations: automaticProgress.annotations, skipped: automaticProgress.skipped }) : message('autoAnnotation.progress', { page: automaticProgress.page, pages: automaticProgress.pages, completed: automaticProgress.completed, total: automaticProgress.total, annotations: automaticProgress.annotations, skipped: automaticProgress.skipped })}</p>}</section>}
      {automaticError && <p className="ai-polish-error" role="alert">{automaticError}</p>}
      {automaticActive && <div className="automatic-annotation-controls">{automaticStatus === 'error' ? <><button type="button" onClick={() => decideAutomaticAnnotation('retry')}>{t("ui.retryCurrentPage")}</button><button type="button" onClick={() => decideAutomaticAnnotation('skip')}>{t("ui.skipCurrentPage")}</button></> : automaticStatus === 'running' ? <button type="button" onClick={pauseAutomaticAnnotation}>{t("ui.pause")}</button> : (automaticStatus === 'paused' || automaticStatus === 'pausing') ? <button type="button" onClick={resumeAutomaticAnnotation}>{t("ui.resume")}</button> : null}<button type="button" className="danger" onClick={stopAutomaticAnnotation}>{t("ui.endAutomaticAnnotation")}</button></div>}
      {automaticActive && <p className="automatic-control-note">{t("ui.pauseAndStopBehavior")}</p>}
    </div>}

    {activeWindow === 'suggestion' && activeSuggestionRequest && <div className="ai-polish-window lab-workflow-window annotation-suggestion-window" style={windowStyle}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}><span><AnnotationIcon kind="ai_suggest" />{t("ui.annotationSuggestions")}</span><button type="button" onClick={() => { setActiveWindow(undefined); setActiveSuggestionRequest(undefined) }} aria-label={t("ui.close")}>×</button></header><div className="suggestion-annotation"><small>{t("ui.annotationRequest")}</small><b>{activeSuggestionRequest.annotationContent || t("ui.noContent")}</b><span>{message('search.page', { page: activeSuggestionRequest.pageIndex + 1 })}</span></div><section className={`suggestion-auto-context${automaticContextEnabled ? ' active' : ''}`}><header><div><b>{t("ui.automaticContext")}</b><small>{t("ui.selectNearbyDocumentTextFromTheAnnotationPosition")}</small></div><button type="button" role="switch" aria-checked={automaticContextEnabled} aria-label={t("ui.automaticContext")} onClick={() => setAutomaticContextEnabled((value) => !value)}><i aria-hidden="true" /></button></header><label className="automatic-context-level"><span><b>{t("ui.contextAmount")}</b><output>{automaticContextLevel} / {MAX_AUTOMATIC_CONTEXT_LEVEL}</output></span><input type="range" min={MIN_AUTOMATIC_CONTEXT_LEVEL} max={MAX_AUTOMATIC_CONTEXT_LEVEL} step={1} value={automaticContextLevel} disabled={!automaticContextEnabled} aria-label={t("ui.contextAmount")} onChange={(event) => setAutomaticContextLevel(Number(event.target.value))} /><small>{t("ui.expandTheNearbyTextInBothDirectionsAHigherValue")}</small></label>{activeSuggestionRequest.kind === 'note' && <p className="automatic-context-note">{t("ui.aFreePositionNoteIsSelectedAutomaticallyOnlyWhenIt")}</p>}{!automaticContextEnabled ? <p className="automatic-context-state">{t("ui.automaticContextIsOffYouCanStillAddSelectionsManually")}</p> : automaticContextLoading ? <p className="automatic-context-state loading">{t("ui.selectingContextNearTheAnnotation")}</p> : automaticContext ? <article><b>{contextPageLabel({ key: 'automatic', ...automaticContext })}</b><span>{automaticContext.text}</span></article> : <p className="automatic-context-state warning">{t(automaticContextIssue === 'detached-note' ? "ui.thisFreePositionNoteIsNotCloseToRecognizableText" : "ui.noRecognizableTextWasFoundNearTheAnnotationSelectThe")}</p>}</section><p className="lab-workflow-intro">{t("ui.automaticContextIsAddedImmediatelyToSupplementItMakeAnd")}</p><button type="button" className="capture-context-button" disabled={!normalizedSelection} onClick={captureContext}><span>＋</span>{normalizedSelection ? t("ui.addCurrentSelection") : t("ui.waitingForATextSelection")}</button><div className={`suggestion-persist${persistContexts ? ' active' : ''}`}><label><input type="checkbox" checked={persistContexts} disabled={!documentKey} onChange={(event) => changePersistContexts(event.target.checked)} /><span><b>{t("ui.keepTheseContextsForThisDocument")}</b><small>{t(documentKey ? "ui.futureSuggestionsLoadThemAutomaticallyTurningThisOffClearsThe" : "ui.thisDocumentHasNoStablePathSoContextsCannotBe")}</small></span></label></div><div className="suggestion-contexts"><header><b>{t("ui.recordedContext")}</b><span>{contexts.length}</span></header>{contexts.length ? contexts.map((context, index) => <article key={context.key}><div><b>{contextPageLabel(context)}</b><span>{context.text}</span></div><button type="button" aria-label={t("ui.removeThisContextPassage")} onClick={() => removeContext(index)}>×</button></article>) : <p>{t("ui.noContextHasBeenAddedManuallyYouCanMakeMultiple")}</p>}</div><label className="lab-field-title">{t("ui.suggestionPrompt")}</label><div className="ai-preset-grid lab-preset-grid">{ANNOTATION_SUGGESTION_PRESETS.map((preset) => <button type="button" key={preset.id} className={suggestionPresetId === preset.id ? 'active' : ''} onClick={() => { setSuggestionPresetId(preset.id); setSuggestionInstruction(localizedPrompt(preset, interfaceLanguage)) }}>{t(preset.label)}</button>)}</div><textarea value={suggestionInstruction} aria-label={t("ui.suggestionPrompt")} onChange={(event) => { setSuggestionPresetId(''); setSuggestionInstruction(event.target.value) }} /><button type="button" className="primary wide" disabled={suggestionBusy || !hasSuggestionContext} onClick={() => void submitSuggestion()}>{suggestionBusy ? t("ui.generatingRevisionAdvice") : t("ui.generateAnnotationSuggestion")}</button>{suggestionError && <p className="ai-polish-error">{translateUiText(suggestionError)}</p>}{suggestionResult && <><AiMarkdown content={suggestionResult} className="lab-long-result" /><div className="ai-polish-actions"><button type="button" onClick={() => onCopy(suggestionResult)}>{t("ui.copyResponse")}</button><button type="button" className="primary" disabled={suggestionAdding} onClick={() => void addSuggestionResult()}>{suggestionAdding ? t("ui.writingReply") : t("ui.addToReply")}</button></div></>}</div>}
    {activeWindow === 'drawing' && onAddDrawing && onExportDrawing && <DrawingBoard labels={{ title: t("ui.freeDrawingBoard"), description: t("ui.drawFreelyOnAResizableCanvasThenExportOrAddToCurrentPage"), brushSize: t("ui.brushSize"), color: t("ui.color"), canvasActions: t("ui.canvasActions"), clearCanvas: t("ui.clearCanvas"), drawingArea: t("ui.drawingArea"), moveResizeHint: t("ui.dragTheTitleBarToMoveTheBoardAndACornerToResizeIt"), startDrawingHere: t("ui.startDrawingHere"), drawingHint: t("ui.pressAndDragWithAMouseOrStylusToDraw"), exportPng: t("ui.exportPng"), addToPage: t("ui.addToCurrentPage"), close: t("ui.close"), encodingFailed: t("ui.unableToEncodeDrawing"), actionFailed: t("ui.actionFailed") }} onClose={() => setActiveWindow(undefined)} onAddPng={onAddDrawing} onExportPng={onExportDrawing} />}
  </div>
}
