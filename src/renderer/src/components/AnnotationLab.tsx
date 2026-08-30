import { useEffect, useRef, useState } from 'react'
import type { PageTextSelection } from '../lib/page-text-selection'
import { AnnotationIcon } from './AnnotationIcon'
import {
  AI_PRESETS, ANNOTATION_SUGGESTION_PRESETS, defaultSettings, detectAiLanguage, FULL_REVIEW_PRESETS,
  loadAiSettings, localizedPrompt, MAX_AI_TIMEOUT_SECONDS, MIN_AI_TIMEOUT_SECONDS, normalizeAiTimeoutSeconds,
  polishText, promptForLanguage, providerSettings, reviewDocument, saveAiSettings, suggestForAnnotation,
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
import './annotation-lab.css'

export const FULL_REVIEW_CONSENT_KEY = 'pdfuck.lab.full-review-consent.v1'

export interface AnnotationSuggestionRequest { token: number; annotationId: string; annotationContent: string; pageIndex: number }
export interface LabDocumentPayload extends FullReviewDocument {}

interface Props {
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
  onAdd(content: string): void | Promise<void>
  onAddFullReview?(content: string): void | Promise<void>
  onAddSuggestion?(annotationId: string, content: string): void | Promise<void>
  onCopy(content: string): void
}

type LabWindow = 'polish' | 'review' | 'suggestion'

function selectionPageIndexes(selection: PageTextSelection): number[] {
  const pages = selection.segments?.map((segment) => segment.pageIndex) || [selection.pageIndex]
  return [...new Set(pages)]
}

function contextPageLabel(context: AnnotationSuggestionContext): string {
  return message('search.page', { page: context.pageIndexes.map((page) => page + 1).join(', ') })
}

export function AnnotationLab({ selection, selectionKey, documentKey, platform = 'win32', disabled = false, annotationSuggestionsEnabled = false, suggestionRequest, onSuggestionRequestConsumed, onAnnotationSuggestionsEnabledChange, getDocument, onAdd, onAddFullReview, onAddSuggestion, onCopy }: Props) {
  const interfaceLanguage = useInterfaceLanguage() as AiLanguage
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
  const [contexts, setContexts] = useState<AnnotationSuggestionContext[]>([])
  const [persistContexts, setPersistContexts] = useState(false)
  const [suggestionResult, setSuggestionResult] = useState('')
  const [suggestionError, setSuggestionError] = useState('')
  const [suggestionBusy, setSuggestionBusy] = useState(false)
  const [suggestionAdding, setSuggestionAdding] = useState(false)
  const drag = useRef<{ x: number; y: number; origin: { x: number; y: number } } | undefined>(undefined)
  const polishRequestId = useRef(0)
  const reviewRequestId = useRef(0)
  const suggestionRequestId = useRef(0)
  const normalizedSelection = normalizeCopiedText(selection?.text || '')
  const selectedLanguage = detectAiLanguage(normalizedSelection, interfaceLanguage)
  const reviewProgress = reviewStartedAt === undefined ? undefined : aiRequestProgress(settings.timeoutSeconds, reviewStartedAt, reviewProgressNow)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isImeCompositionKey(event) && !isTextEntryEvent(event) && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i' && normalizedSelection) { event.preventDefault(); setActiveWindow('polish') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [normalizedSelection])
  useEffect(() => {
    const handler = () => { if (normalizedSelection) setActiveWindow('polish') }
    window.addEventListener('pdfuck:open-ai-polish', handler)
    return () => window.removeEventListener('pdfuck:open-ai-polish', handler)
  }, [normalizedSelection])
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
    setContexts(saved); setPersistContexts(hasAnnotationSuggestionContextStore(documentKey)); setSuggestionResult(''); setSuggestionError(''); setSuggestionBusy(false); setSuggestionAdding(false)
    setSuggestionPresetId(ANNOTATION_SUGGESTION_PRESETS[0].id)
    setSuggestionInstruction(localizedPrompt(ANNOTATION_SUGGESTION_PRESETS[0], interfaceLanguage))
    setActiveWindow('suggestion')
    onSuggestionRequestConsumed?.(suggestionRequest.token)
  }, [suggestionRequest?.token, documentKey, onSuggestionRequestConsumed])
  useEffect(() => {
    if (!reviewBusy || reviewStartedAt === undefined) return
    setReviewProgressNow(Date.now())
    const timer = window.setInterval(() => setReviewProgressNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [reviewBusy, reviewStartedAt])

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
  const requestFullReview = () => {
    if (localStorage.getItem(FULL_REVIEW_CONSENT_KEY) === 'accepted') openFullReview()
    else { setDisclaimerAccepted(false); setDisclaimerOpen(true) }
  }
  const acceptDisclaimer = () => {
    if (!disclaimerAccepted) return
    localStorage.setItem(FULL_REVIEW_CONSENT_KEY, 'accepted'); setDisclaimerOpen(false); openFullReview()
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
    if (!contexts.length) { setSuggestionError('请至少加入一段正文上下文。'); return }
    const current = ++suggestionRequestId.current
    setSuggestionBusy(true); setSuggestionError(''); setSuggestionResult('')
    try {
      const output = await suggestForAnnotation(settings, suggestionInstruction, activeSuggestionRequest.annotationContent, contexts.map((context) => context.text), interfaceLanguage)
      if (suggestionRequestId.current === current) setSuggestionResult(output)
    } catch (cause) { if (suggestionRequestId.current === current) setSuggestionError(cause instanceof Error ? cause.message : String(cause)) }
    finally { if (suggestionRequestId.current === current) setSuggestionBusy(false) }
  }
  const addSuggestionResult = async () => {
    if (!suggestionResult || suggestionAdding || !activeSuggestionRequest || !onAddSuggestion) return
    setSuggestionAdding(true); setSuggestionError('')
    try { await onAddSuggestion(activeSuggestionRequest.annotationId, suggestionResult); setActiveWindow(undefined); setActiveSuggestionRequest(undefined) } catch (cause) { setSuggestionError(cause instanceof Error ? cause.message : String(cause)); setSuggestionAdding(false) }
  }

  const windowStyle = { transform: `translate(${position.x}px, ${position.y}px)` }
  return <div className="annotation-lab">
    <div className="annotation-lab-heading"><h3>{t('实验室')}</h3><button type="button" className="annotation-lab-settings-trigger" title={t('实验室模型设置')} aria-label={t('实验室模型设置')} onClick={() => setSettingsOpen(true)}>⚙</button></div>
    <div className="annotation-lab-tools">
      <button type="button" className="tool-button with-icon has-shortcut annotation-lab-launch" disabled={disabled} onClick={() => setActiveWindow('polish')}><AnnotationIcon kind="ai_polish" /><span className="tool-button-copy"><strong>{t('智能润色')}</strong><small>{t('框选文字')}</small></span><kbd>{shortcutLabel('aiPolish', platform)}</kbd></button>
      <button type="button" className="tool-button with-icon annotation-lab-launch full-review-launch" disabled={disabled || !getDocument} onClick={requestFullReview}><AnnotationIcon kind="ai_review" /><span className="tool-button-copy"><strong>{t('全文评价')}</strong><small>{t('让 AI 审阅整个文档')}</small></span></button>
      <button type="button" className={`tool-button with-icon annotation-lab-launch annotation-suggestion-toggle${annotationSuggestionsEnabled ? ' active' : ''}`} disabled={disabled} aria-pressed={annotationSuggestionsEnabled} onClick={() => onAnnotationSuggestionsEnabledChange?.(!annotationSuggestionsEnabled)}><AnnotationIcon kind="ai_suggest" /><span className="tool-button-copy"><strong>{t('批注建议')}</strong><small>{t(annotationSuggestionsEnabled ? '已开启 · 在批注设置中使用' : '结合批注生成建议')}</small></span><span className="lab-toggle-indicator" aria-hidden="true"><i /></span></button>
    </div>

    {settingsOpen && <div className="annotation-lab-settings-backdrop" role="presentation" onPointerDown={() => setSettingsOpen(false)}><section className="annotation-lab-settings" role="dialog" aria-modal="true" aria-label={t('实验室模型设置')} onPointerDown={(event) => event.stopPropagation()}><header><b>{t('实验室模型设置')}</b><button type="button" onClick={() => setSettingsOpen(false)} aria-label={t('关闭模型设置')}>×</button></header>
      <p className="lab-settings-note">{t('智能润色、全文评价和批注建议共享此处的模型连接。')}</p>
      <label>{t('服务商')}<select value={settings.provider} onChange={(event) => setSettings(providerSettings(settings, event.target.value as AiSettings['provider']))}><option value="openai">{t('OpenAI / 中转')}</option><option value="claude">{t('Claude / 中转')}</option><option value="bigmodel">BigModel Plan</option><option value="doubao">Doubao</option><option value="deepseek">DeepSeek</option><option value="kimi">KIMI</option><option value="custom">{t('自定义 OpenAI 兼容')}</option></select></label>
      <label>{t('接口地址')}<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} /></label><label>{t('API 密钥')}<input type="password" value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} /></label><label>{t('模型')}<input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} /></label>
      <label>{t('响应超时时间')}<span className="ai-timeout-input"><input type="number" min={MIN_AI_TIMEOUT_SECONDS} max={MAX_AI_TIMEOUT_SECONDS} step={1} value={settings.timeoutSeconds} onChange={(event) => setSettings({ ...settings, timeoutSeconds: Number(event.target.value) })} /><span>{t('秒')}</span></span><small>{t('最长等待时间，默认 120 秒。')}</small></label>
      <footer><button type="button" onClick={() => setSettings(defaultSettings)}>{t('恢复默认')}</button><button type="button" className="primary" onClick={persistSettings}>{t('保存')}</button></footer>
    </section></div>}

    {disclaimerOpen && <div className="lab-modal-backdrop"><section className="lab-disclaimer" role="dialog" aria-modal="true" aria-labelledby="full-review-disclaimer-title"><header><span className="lab-warning-icon">!</span><div><h2 id="full-review-disclaimer-title">{t('全文评价隐私与数据风险提示')}</h2><p>{t('首次使用前请确认数据发送风险。')}</p></div></header><div className="lab-disclaimer-copy"><p>{t('全文评价会把当前文档的全部文字或 PDF 文件发送到你在“实验室模型设置”中配置的 AI API。')}</p><p>{t('PDFuck 无法控制 AI 提供商如何存储、使用或训练这些数据。任何数据泄露、留存、训练或其他后果均由你自行承担，与本软件及其开发者无关。')}</p><p>{t('请只处理你有权发送、且符合所在组织保密与合规要求的文档。')}</p></div><div className="lab-consent-area"><label className="lab-consent-check"><input type="checkbox" checked={disclaimerAccepted} onChange={(event) => setDisclaimerAccepted(event.target.checked)} /><span>{t('我已阅读并同意上述声明，自愿承担将整个文档发送给 AI 提供商的风险。')}</span></label></div><footer><button type="button" onClick={() => setDisclaimerOpen(false)}>{t('取消')}</button><button type="button" className="primary" disabled={!disclaimerAccepted} onClick={acceptDisclaimer}>{t('同意并继续')}</button></footer></section></div>}

    {activeWindow === 'polish' && <div className="ai-polish-window" style={windowStyle}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}><span><AnnotationIcon kind="ai_polish" />{t('智能润色')}</span><button type="button" onClick={() => setActiveWindow(undefined)} aria-label={t('关闭')}>×</button></header><p className="ai-polish-selection">{normalizedSelection || t('请先框选 PDF 文字')}</p><div className="ai-preset-grid">{AI_PRESETS.map((preset) => <button type="button" key={preset.id} className={presetId === preset.id ? 'active' : ''} onClick={() => { setPresetId(preset.id); setInstruction(promptForLanguage(preset, language)) }}>{t(preset.label)}</button>)}</div><textarea value={instruction} aria-label={t('润色提示词')} onChange={(event) => { setPresetId(''); setInstruction(event.target.value) }} placeholder={t('自定义提示词…')} /><button type="button" className="primary wide" disabled={busy} onClick={() => void submitPolish()}>{busy ? t('正在获取回复…') : t('开始润色')}</button>{error && <p className="ai-polish-error">{translateUiText(error)}</p>}{result && <><AiMarkdown content={result} /><div className="ai-polish-actions"><button type="button" onClick={() => onCopy(result)}>{t('复制回复')}</button><button type="button" className="primary" disabled={adding} onClick={() => void addPolishResult()}>{adding ? t('正在添加…') : t('添加到批注')}</button></div></>}</div>}

    {activeWindow === 'review' && <div className="ai-polish-window lab-workflow-window full-review-window" style={windowStyle}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}><span><AnnotationIcon kind="ai_review" />{t('全文评价')}</span><button type="button" onClick={() => setActiveWindow(undefined)} aria-label={t('关闭')}>×</button></header><p className="lab-workflow-intro">{t('选择发送方式和审稿提示词。AI 将接收整个文档。')}</p><div className="lab-send-mode" role="radiogroup" aria-label={t('文档发送方式')}><button type="button" role="radio" aria-checked={reviewMode === 'text'} className={reviewMode === 'text' ? 'active' : ''} onClick={() => setReviewMode('text')}><b>{t('发送转换后的文档文字')}</b><small>{t('兼容性更好，保留逐页标记')}</small></button><button type="button" role="radio" aria-checked={reviewMode === 'file'} className={reviewMode === 'file' ? 'active' : ''} onClick={() => setReviewMode('file')}><b>{t('直接发送 PDF 文件')}</b><small>{t('可保留版面，但模型必须支持 PDF 输入')}</small></button></div>{reviewMode === 'file' && <p className="lab-compatibility-note">{t('文件输入格式的兼容性由 AI 提供商或中转接口决定；若请求失败，请改用文档文字。')}</p>}<label className="lab-field-title">{t('审稿提示词')}</label><div className="ai-preset-grid lab-preset-grid">{FULL_REVIEW_PRESETS.map((preset) => <button type="button" key={preset.id} className={reviewPresetId === preset.id ? 'active' : ''} onClick={() => { setReviewPresetId(preset.id); setReviewInstruction(localizedPrompt(preset, interfaceLanguage)) }}>{t(preset.label)}</button>)}</div><textarea value={reviewInstruction} aria-label={t('审稿提示词')} onChange={(event) => { setReviewPresetId(''); setReviewInstruction(event.target.value) }} /><button type="button" className="primary wide" disabled={reviewBusy} onClick={() => void submitReview()}>{reviewBusy ? t('正在审阅整个文档…') : t('开始全文评价')}</button>{reviewBusy && reviewProgress && <div className="lab-review-progress" role="progressbar" aria-label={t('全文评价进度')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reviewProgress.elapsedPercent)}><header><b>{t('AI 正在审阅整个文档')}</b><span>{message('lab.reviewCountdown', { seconds: reviewProgress.remainingSeconds })}</span></header><div className="lab-review-progress-track"><i style={{ width: `${reviewProgress.elapsedPercent}%` }} /></div><small>{t('最长等待时间以模型设置中的响应超时为准。')}</small></div>}{reviewError && <p className="ai-polish-error">{translateUiText(reviewError)}</p>}{reviewResult && <><AiMarkdown content={reviewResult} className="lab-long-result" /><div className="ai-polish-actions"><button type="button" onClick={() => onCopy(reviewResult)}>{t('复制回复')}</button><button type="button" className="primary" disabled={reviewAdding} onClick={() => void addReviewResult()}>{reviewAdding ? t('正在添加…') : t('添加到批注')}</button></div></>}</div>}

    {activeWindow === 'suggestion' && activeSuggestionRequest && <div className="ai-polish-window lab-workflow-window annotation-suggestion-window" style={windowStyle}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}><span><AnnotationIcon kind="ai_suggest" />{t('批注建议')}</span><button type="button" onClick={() => { setActiveWindow(undefined); setActiveSuggestionRequest(undefined) }} aria-label={t('关闭')}>×</button></header><div className="suggestion-annotation"><small>{t('批注要求')}</small><b>{activeSuggestionRequest.annotationContent || t('无内容')}</b><span>{message('search.page', { page: activeSuggestionRequest.pageIndex + 1 })}</span></div><p className="lab-workflow-intro">{t('请在 PDF 中框选相关正文，每次框选后点击“加入当前选区”。可重复加入多段。')}</p><button type="button" className="capture-context-button" disabled={!normalizedSelection} onClick={captureContext}><span>＋</span>{normalizedSelection ? t('加入当前选区') : t('等待框选正文')}</button><div className={`suggestion-persist${persistContexts ? ' active' : ''}`}><label><input type="checkbox" checked={persistContexts} disabled={!documentKey} onChange={(event) => changePersistContexts(event.target.checked)} /><span><b>{t('为本文档保留这些上下文')}</b><small>{t(documentKey ? '后续批注建议会自动载入；关闭后将清除本机保存。' : '当前文档没有稳定路径，暂时无法持久化。')}</small></span></label></div><div className="suggestion-contexts"><header><b>{t('已记录的上下文')}</b><span>{contexts.length}</span></header>{contexts.length ? contexts.map((context, index) => <article key={context.key}><div><b>{contextPageLabel(context)}</b><span>{context.text}</span></div><button type="button" aria-label={t('移除这段上下文')} onClick={() => removeContext(index)}>×</button></article>) : <p>{t('尚未加入上下文。你可以跨页、多次框选。')}</p>}</div><label className="lab-field-title">{t('建议提示词')}</label><div className="ai-preset-grid lab-preset-grid">{ANNOTATION_SUGGESTION_PRESETS.map((preset) => <button type="button" key={preset.id} className={suggestionPresetId === preset.id ? 'active' : ''} onClick={() => { setSuggestionPresetId(preset.id); setSuggestionInstruction(localizedPrompt(preset, interfaceLanguage)) }}>{t(preset.label)}</button>)}</div><textarea value={suggestionInstruction} aria-label={t('建议提示词')} onChange={(event) => { setSuggestionPresetId(''); setSuggestionInstruction(event.target.value) }} /><button type="button" className="primary wide" disabled={suggestionBusy || !contexts.length} onClick={() => void submitSuggestion()}>{suggestionBusy ? t('正在生成修改建议…') : t('生成批注建议')}</button>{suggestionError && <p className="ai-polish-error">{translateUiText(suggestionError)}</p>}{suggestionResult && <><AiMarkdown content={suggestionResult} className="lab-long-result" /><div className="ai-polish-actions"><button type="button" onClick={() => onCopy(suggestionResult)}>{t('复制回复')}</button><button type="button" className="primary" disabled={suggestionAdding} onClick={() => void addSuggestionResult()}>{suggestionAdding ? t('正在添加…') : t('添加到批注')}</button></div></>}</div>}
  </div>
}
