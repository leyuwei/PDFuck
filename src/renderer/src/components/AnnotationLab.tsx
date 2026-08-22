import { useEffect, useRef, useState } from 'react'
import { AnnotationIcon } from './AnnotationIcon'
import { AI_PRESETS, defaultSettings, detectAiLanguage, loadAiSettings, polishText, promptForLanguage, providerSettings, saveAiSettings, type AiLanguage, type AiSettings } from '../lib/ai-polish'
import { normalizeCopiedText } from '../lib/clipboard-text'
import { ui, useInterfaceLanguage } from '../lib/i18n'
import { translateInterfaceText } from './InterfaceLanguageBridge'
import './annotation-lab.css'

interface Props { selection?: string; selectionKey?: string; onAdd(content: string): void | Promise<void>; onCopy(content: string): void }

export function AnnotationLab({ selection, selectionKey, onAdd, onCopy }: Props) {
  useInterfaceLanguage()
  const t = translateInterfaceText
  const [open, setOpen] = useState(false)
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
  const drag = useRef<{ x: number; y: number; origin: { x: number; y: number } } | undefined>(undefined)
  const requestId = useRef(0)
  const normalizedSelection = normalizeCopiedText(selection || '')
  const selectedLanguage = detectAiLanguage(normalizedSelection)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i' && normalizedSelection) { event.preventDefault(); setOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [normalizedSelection])
  useEffect(() => {
    const handler = () => { if (normalizedSelection) setOpen(true) }
    window.addEventListener('pdfuck:open-ai-polish', handler)
    return () => window.removeEventListener('pdfuck:open-ai-polish', handler)
  }, [normalizedSelection])
  useEffect(() => {
    requestId.current += 1
    setResult(''); setError(''); setBusy(false); setAdding(false)
  }, [selectionKey, normalizedSelection])
  useEffect(() => {
    setLanguage(selectedLanguage)
    setPresetId(AI_PRESETS[0].id)
    setInstruction(promptForLanguage(AI_PRESETS[0], selectedLanguage))
  }, [selectedLanguage, selectionKey])

  const submit = async () => {
    if (!normalizedSelection) { setError('请先在 PDF 页面框选需要润色的文字。'); return }
    const current = ++requestId.current
    setBusy(true); setError(''); setResult('')
    try {
      const output = await polishText(settings, instruction, normalizedSelection)
      if (requestId.current === current) setResult(output)
    } catch (cause) {
      if (requestId.current === current) setError(cause instanceof Error ? cause.message : String(cause))
    } finally { if (requestId.current === current) setBusy(false) }
  }
  const addResult = async () => {
    if (!result || adding) return
    setAdding(true); setError('')
    try { await onAdd(result); setOpen(false) } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setAdding(false) }
  }
  const beginDrag = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    drag.current = { x: event.clientX, y: event.clientY, origin: position }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: React.PointerEvent) => { if (drag.current) setPosition({ x: drag.current.origin.x + event.clientX - drag.current.x, y: drag.current.origin.y + event.clientY - drag.current.y }) }
  const endDrag = () => { drag.current = undefined }

  return <>
    <h3>{t('实验室')}</h3>
    <div className="annotation-lab-tool-row"><button type="button" className="tool-button with-icon annotation-lab-launch" onClick={() => setOpen(true)}><AnnotationIcon kind="ai_polish" /><span className="tool-button-copy"><strong>{t('智能润色')}</strong><small>{t('框选文字 · Ctrl+I / ⌘I')}</small></span></button><button type="button" className="annotation-lab-settings-trigger" title={ui('模型设置', 'Model Settings')} aria-label={ui('模型设置', 'Model Settings')} onClick={() => setSettingsOpen(true)}>⚙</button></div>
    {settingsOpen && <div className="annotation-lab-settings-backdrop" role="presentation" onPointerDown={() => setSettingsOpen(false)}><section className="annotation-lab-settings" role="dialog" aria-modal="true" aria-label={ui('智能润色模型设置', 'AI Polish Model Settings')} onPointerDown={(event) => event.stopPropagation()}><header><b>{t('模型设置')}</b><button type="button" onClick={() => setSettingsOpen(false)} aria-label={ui('关闭模型设置', 'Close model settings')}>×</button></header>
      <label>{t('服务商')}<select value={settings.provider} onChange={(event) => setSettings(providerSettings(settings, event.target.value as AiSettings['provider']))}><option value="openai">{t('OpenAI / 中转')}</option><option value="claude">{t('Claude / 中转')}</option><option value="bigmodel">BigModel Plan</option><option value="doubao">Doubao</option><option value="deepseek">DeepSeek</option><option value="kimi">KIMI</option><option value="custom">{t('自定义 OpenAI 兼容')}</option></select></label>
      <label>{t('接口地址')}<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} /></label><label>{ui('API 密钥', 'API Key')}<input type="password" value={settings.apiKey} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} /></label><label>{t('模型')}<input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} /></label>
      <footer><button type="button" onClick={() => setSettings(defaultSettings)}>{t('恢复默认')}</button><button type="button" className="primary" onClick={() => { saveAiSettings(settings); setSettingsOpen(false) }}>{t('保存')}</button></footer>
    </section></div>}
    {open && <div className="ai-polish-window" style={{ transform: `translate(${position.x}px, ${position.y}px)` }}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}><span><AnnotationIcon kind="ai_polish" />{t('智能润色')}</span><button type="button" onClick={() => setOpen(false)} aria-label={t('关闭')}>×</button></header><p className="ai-polish-selection">{normalizedSelection || t('请先框选 PDF 文字')}</p><div className="ai-preset-grid">{AI_PRESETS.map((preset) => <button type="button" key={preset.id} className={presetId === preset.id ? 'active' : ''} onClick={() => { setPresetId(preset.id); setInstruction(promptForLanguage(preset, language)) }}>{preset.label}</button>)}</div><textarea value={instruction} aria-label={t('润色提示词')} onChange={(event) => { setPresetId(''); setInstruction(event.target.value) }} placeholder={t('自定义提示词…')} /><button type="button" className="primary wide" disabled={busy} onClick={() => void submit()}>{busy ? t('正在获取回复…') : t('开始润色')}</button>{error && <p className="ai-polish-error">{t(error)}</p>}{result && <><article className="ai-polish-result">{result}</article><div className="ai-polish-actions"><button type="button" onClick={() => onCopy(result)}>{t('复制回复')}</button><button type="button" className="primary" disabled={adding} onClick={() => void addResult()}>{adding ? t('正在添加…') : t('添加到批注')}</button></div></>}</div>}
  </>
}
