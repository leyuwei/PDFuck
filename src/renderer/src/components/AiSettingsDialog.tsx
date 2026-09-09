import { useEffect, useState } from 'react'
import {
  defaultSettings, loadAiProfiles, saveAiProfiles, providerSettings, parseAiExtraBody,
  MAX_AI_MAX_OUTPUT_TOKENS, MIN_AI_MAX_OUTPUT_TOKENS, MAX_AI_TIMEOUT_SECONDS, MIN_AI_TIMEOUT_SECONDS,
  type AiSettings, type AiProvider, type ThinkingMode, type ReasoningEffort
} from '../lib/ai-settings'
import { endpoint } from '../lib/ai-polish'
import { ui, translateUiText } from '../lib/i18n'
import { useFloatingWindow } from '../lib/floating-window'
import { ScrollWindow } from './ScrollWindow'

export function AiSettingsDialog({ minimized, onClose, onMinimize, onSaved }: { minimized: boolean; onClose(): void; onMinimize(): void; onSaved(): void }) {
  const [library, setLibrary] = useState(loadAiProfiles)
  const [selectedId, setSelectedId] = useState(library.activeId)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const floating = useFloatingWindow(!minimized)
  const selected = library.profiles.find(profile => profile.id === selectedId)!
  const [active, setActive] = useState(() => library.profiles.find(profile => profile.id === library.activeId)!)
  const settings = selected.settings
  const update = (change: Partial<AiSettings>) => { setLibrary(current => ({ ...current, profiles: current.profiles.map(profile => profile.id === selectedId ? { ...profile, settings: { ...profile.settings, ...change } } : profile) })); setError('') }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    return () => previous?.focus()
  }, [])
  const commit = (activate = false) => {
    try {
      for (const profile of library.profiles) { parseAiExtraBody(profile.settings.extraBody); if (profile.settings.baseUrl.trim()) endpoint(profile.settings) }
      if (activate && (!settings.apiKey.trim() || !settings.model.trim() || !settings.baseUrl.trim())) throw new Error('aiSettings.incomplete')
      const next = { ...library, activeId: activate ? selectedId : library.activeId }
      saveAiProfiles(next); setLibrary(next); setActive(next.profiles.find(profile => profile.id === next.activeId)!); onSaved(); setError('')
      if (!activate) onClose()
    } catch (cause) { setError(translateUiText(cause instanceof Error ? cause.message : 'aiSettings.invalid')) }
  }
  const add = () => {
    const id = crypto.randomUUID()
    setLibrary(current => ({ ...current, profiles: [...current.profiles, { id, name: ui('aiSettings.newModel'), settings: { ...defaultSettings } }] }))
    setSelectedId(id); setShowKey(false); setError('')
  }
  return <div className="annotation-lab-settings-backdrop" hidden={minimized} onPointerDown={event => { if (event.target === event.currentTarget) onClose() }} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key === 'Tab') {
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, summary')].filter(element => !element.hasAttribute('disabled') && element.getClientRects().length)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }}>
    <ScrollWindow ref={floating.ref} style={floating.style} className="annotation-lab-settings ai-model-settings" role="dialog" aria-modal="true" aria-labelledby="ai-model-settings-title">
      <header {...floating.dragHandlers}><b id="ai-model-settings-title">{ui('ui.labModelSettings')}</b><button type="button" aria-label={ui('ui.minimizeLabWindow')} onClick={onMinimize}>−</button><button type="button" onClick={onClose} aria-label={ui('ui.closeModelSettings')}>×</button></header>
      <div className="ai-settings-intro">
        <div className="ai-active-model"><span>{ui('aiSettings.activeModel')}</span><div><bdi>{active.name}</bdi><small dir="auto">{active.settings.model}</small></div></div>
        <p className="lab-settings-note">{ui('aiSettings.profilesHint')}</p>
      </div>
      <div className="ai-settings-layout">
        <nav className="ai-profile-list" aria-label={ui('aiSettings.savedModels')}>
          {library.profiles.map(profile => <button type="button" key={profile.id} className={profile.id === selectedId ? 'selected' : ''} aria-pressed={profile.id === selectedId} onClick={() => { setSelectedId(profile.id); setShowKey(false); setError('') }}><b dir="auto">{profile.name}</b><small dir="auto">{profile.settings.provider} · {profile.settings.model || '—'}</small>{profile.id === library.activeId && <span>{ui('aiSettings.active')}</span>}</button>)}
          <button type="button" className="ai-add-profile" onClick={add}>＋ {ui('aiSettings.addModel')}</button>
        </nav>
        <form className="ai-profile-form" onSubmit={event => { event.preventDefault(); commit() }}>
          <div className="ai-profile-heading"><label>{ui('aiSettings.profileName')}<input autoFocus dir="auto" value={selected.name} maxLength={80} onChange={event => setLibrary(current => ({ ...current, profiles: current.profiles.map(profile => profile.id === selectedId ? { ...profile, name: event.target.value } : profile) }))} /></label><button type="button" className="ai-activate-profile" disabled={selectedId === library.activeId} onClick={event => { if (event.currentTarget.form?.reportValidity()) commit(true) }}>{ui(selectedId === library.activeId ? 'aiSettings.active' : 'aiSettings.activate')}</button></div>
          <fieldset><legend>{ui('aiSettings.connection')}</legend>
            <label>{ui('ui.provider')}<select value={settings.provider} onChange={event => update(providerSettings(settings, event.target.value as AiProvider))}><option value="openai">OpenAI</option><option value="claude">Claude</option><option value="grok">Grok (xAI)</option><option value="bigmodel">BigModel</option><option value="doubao">Doubao</option><option value="deepseek">DeepSeek</option><option value="kimi">KIMI</option><option value="custom">{ui('ui.customOpenaiCompatible')}</option></select></label>
            <label>{ui('ui.model')}<input dir="ltr" value={settings.model} placeholder="model-id" onChange={event => update({ model: event.target.value })} /></label>
            <label className="ai-field-wide">{ui('ui.apiEndpoint')}<input dir="ltr" value={settings.baseUrl} spellCheck={false} onChange={event => update({ baseUrl: event.target.value })} /></label>
            <label className="ai-field-wide">{ui('ui.apiKey')}<span className="ai-key-field"><input dir="ltr" type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={settings.apiKey} onChange={event => update({ apiKey: event.target.value })} /><button type="button" aria-pressed={showKey} onClick={() => setShowKey(value => !value)}>{ui(showKey ? 'aiSettings.hide' : 'aiSettings.show')}</button></span></label>
          </fieldset>
          <fieldset><legend>{ui('aiSettings.generation')}</legend>
            <label>{ui('ui.maxOutputTokens')}<input type="number" min={MIN_AI_MAX_OUTPUT_TOKENS} max={MAX_AI_MAX_OUTPUT_TOKENS} step={1} value={settings.maxOutputTokens || ''} onChange={event => update({ maxOutputTokens: Number(event.target.value) })} /></label>
            <label>{ui('ui.responseTimeout')}<span className="ai-timeout-input"><input type="number" min={MIN_AI_TIMEOUT_SECONDS} max={MAX_AI_TIMEOUT_SECONDS} step={1} value={settings.timeoutSeconds || ''} onChange={event => update({ timeoutSeconds: Number(event.target.value) })} /><span>{ui('ui.sec')}</span></span></label>
            <small className="ai-field-wide">{ui('aiSettings.budgetHint')}</small>
            <label>{ui('aiSettings.temperature')}<input type="number" min={0} max={2} step="any" placeholder={ui('aiSettings.providerDefault')} value={settings.temperature ?? ''} onChange={event => update({ temperature: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
            <label>Top P<input type="number" min={0} max={1} step="any" placeholder={ui('aiSettings.providerDefault')} value={settings.topP ?? ''} onChange={event => update({ topP: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
          </fieldset>
          <fieldset><legend>{ui('aiSettings.thinking')}</legend>
            <label>{ui('aiSettings.thinkingMode')}<select value={settings.thinking} onChange={event => update({ thinking: event.target.value as ThinkingMode })}>{(['auto', 'enabled', 'disabled', 'adaptive'] as const).map(mode => <option key={mode} value={mode}>{ui(`aiSettings.mode.${mode}`)}</option>)}</select></label>
            <label>{ui('aiSettings.effort')}<select value={settings.reasoningEffort} disabled={settings.thinking === 'disabled'} onChange={event => update({ reasoningEffort: event.target.value as ReasoningEffort })}>{(['auto', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const).map(effort => <option key={effort} value={effort}>{ui(`aiSettings.effort.${effort}`)}</option>)}</select></label>
            {settings.provider === 'claude' && <label className="ai-field-wide">{ui('aiSettings.thinkingBudget')}<input type="number" min={1024} max={131072} step={1} value={settings.thinkingBudget || ''} onChange={event => update({ thinkingBudget: Number(event.target.value) })} /></label>}
            <small className="ai-field-wide">{ui('aiSettings.thinkingHint')}</small>
            <label className="ai-field-wide ai-checkbox"><input type="checkbox" checked={settings.allowThinkingFallback !== false} onChange={event => update({ allowThinkingFallback: event.target.checked })} /><span>{ui('aiSettings.fallback')}</span></label>
          </fieldset>
          <details className="ai-advanced"><summary>{ui('aiSettings.advanced')}</summary><div className="ai-advanced-body">
            <label>{ui('aiSettings.frequencyPenalty')}<input type="number" min={-2} max={2} step="any" value={settings.frequencyPenalty ?? ''} placeholder={ui('aiSettings.providerDefault')} onChange={event => update({ frequencyPenalty: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
            <label>{ui('aiSettings.presencePenalty')}<input type="number" min={-2} max={2} step="any" value={settings.presencePenalty ?? ''} placeholder={ui('aiSettings.providerDefault')} onChange={event => update({ presencePenalty: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
            <label>{ui('aiSettings.seed')}<input type="number" min={-2147483648} max={2147483647} step={1} value={settings.seed ?? ''} placeholder={ui('aiSettings.providerDefault')} onChange={event => update({ seed: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
            <label className="ai-field-wide">{ui('aiSettings.extraBody')}<textarea dir="ltr" spellCheck={false} value={settings.extraBody || ''} maxLength={16000} placeholder={'{"verbosity":"low"}'} onChange={event => update({ extraBody: event.target.value })} /><small>{ui('aiSettings.extraHint')}</small></label>
          </div></details>
          {error && <p className="ai-polish-error" role="alert">{error}</p>}
          <footer><button type="button" disabled={selectedId === library.activeId} onClick={() => { setLibrary(current => ({ ...current, profiles: current.profiles.filter(profile => profile.id !== selectedId) })); setSelectedId(library.activeId); setError('') }}>{ui('aiSettings.remove')}</button><button type="button" onClick={() => update({ ...defaultSettings, provider: settings.provider, baseUrl: settings.baseUrl, model: settings.model, apiKey: settings.apiKey, temperature: undefined, topP: undefined, frequencyPenalty: undefined, presencePenalty: undefined, seed: undefined, extraBody: '' })}>{ui('ui.restoreDefaults')}</button><button type="button" onClick={onClose}>{ui('ui.cancel')}</button><button type="submit" className="primary">{ui('ui.save')}</button></footer>
        </form>
      </div>
    </ScrollWindow>
  </div>
}
