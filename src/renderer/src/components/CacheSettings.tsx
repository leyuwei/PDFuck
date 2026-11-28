import { useCallback, useEffect, useRef, useState } from 'react'
import type { CacheEntry } from '../../../shared/cache'
import { OCR_LANGUAGES } from '../../../shared/ocr'
import { t, ui, useInterfaceLanguage } from '../lib/i18n'
import { ScrollWindow } from './ScrollWindow'
import { EditIcon } from './EditIcon'
import './cache-settings.css'

const groups = ['app', 'updates', 'libraries'] as const
const selectable = (entry: CacheEntry) => entry.bytes > 0 && !['restart', 'busy', 'unknown'].includes(entry.status)

export function CacheSettings({ onClose, onResetDocumentPreferences }: { onClose(): void; onResetDocumentPreferences(): Promise<void> }) {
  const language = useInterfaceLanguage()
  const [entries, setEntries] = useState<CacheEntry[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [working, setWorking] = useState(true)
  const [confirming, setConfirming] = useState<'remove' | 'reset'>()
  const [notice, setNotice] = useState<'deleted' | 'restart' | 'failed' | 'loadFailed' | 'preferencesReset' | 'preferencesResetFailed'>()
  const close = useRef<HTMLButtonElement>(null)
  const load = useCallback(async () => {
    const items = await window.desktop.cacheInventory()
    setEntries(items)
    setSelected(ids => ids.filter(id => items.some(entry => entry.id === id && selectable(entry))))
  }, [])
  const refresh = useCallback(async () => {
    setWorking(true)
    setNotice(undefined)
    try { await load() } catch { setNotice('loadFailed') }
    finally { setWorking(false) }
  }, [load])

  useEffect(() => {
    const previous = document.activeElement
    close.current?.focus()
    void refresh()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [refresh])

  const remove = async () => {
    setWorking(true)
    setConfirming(undefined)
    try {
      const result = await window.desktop.removeCachedItems(selected)
      setSelected(result.failed)
      setNotice(result.failed.length ? 'failed' : result.restart ? 'restart' : 'deleted')
      await load()
    } catch { setNotice('failed') }
    finally { setWorking(false) }
  }

  const reset = async () => {
    setConfirming(undefined)
    setWorking(true)
    setNotice(undefined)
    try {
      await onResetDocumentPreferences()
      setNotice('preferencesReset')
    } catch { setNotice('preferencesResetFailed') }
    finally { setWorking(false) }
  }

  const size = (bytes: number) => {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    const power = bytes > 0 ? Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))) : 0
    return `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(bytes / 1024 ** power)} ${units[power]}`
  }
  const total = entries.reduce((bytes, entry) => bytes + entry.bytes, 0)
  return <div className="modal-backdrop cache-settings-backdrop" onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape') { if (confirming) setConfirming(undefined); else onClose() }
  }}>
    <ScrollWindow className="modal cache-settings" role="dialog" aria-modal="true" aria-labelledby="cache-title" footer={<footer className="cache-footer">
      <div role="status">{confirming === 'reset' ? ui('cache.preferencesConfirm') : confirming === 'remove' ? t('cache.confirm', { count: selected.length }) : notice ? ui(`cache.${notice}`) : working ? ui('cache.loading') : ''}</div>
      <div className="modal-actions">
        {confirming ? <button type="button" onClick={() => setConfirming(undefined)}>{ui('ui.cancel')}</button> : <button type="button" disabled={working} onClick={() => void refresh()}>{ui('cache.refresh')}</button>}
        <button type="button" className={confirming ? 'danger' : 'primary'} disabled={working || (!selected.length && confirming !== 'reset')} onClick={() => {
          if (confirming === 'reset') void reset()
          else if (confirming === 'remove') void remove()
          else setConfirming('remove')
        }}>{ui(confirming ? 'ui.confirm' : 'cache.delete')}</button>
      </div>
    </footer>}>
      <header className="cache-heading"><EditIcon kind="cache" /><h2 id="cache-title">{ui('cache.title')}</h2><button ref={close} type="button" aria-label={ui('ui.close')} onClick={onClose}>×</button></header>
      <div className="cache-summary"><p>{ui('cache.description')}</p>{entries.length > 0 && <strong>{t('cache.total', { size: size(total) })}</strong>}</div>
      <section className="cache-group cache-document-preferences" aria-labelledby="cache-document-preferences-title">
        <h3 id="cache-document-preferences-title">{ui('cache.preferencesTitle')}</h3>
        <p>{ui('cache.preferencesDescription')}</p>
        <button type="button" disabled={working || Boolean(confirming)} onClick={() => setConfirming('reset')}>{ui('cache.preferencesAction')}</button>
      </section>
      {entries.length > 0 && groups.map(group => <section className="cache-group" key={group}>
        <h3>{ui(`cache.group.${group}`)}</h3>
        {entries.filter(entry => entry.group === group).map(entry => <label className="cache-item" key={entry.id} data-cache-id={entry.id}>
          <input type="checkbox" checked={selected.includes(entry.id)} disabled={working || Boolean(confirming) || !selectable(entry)} onChange={event => {
            const checked = event.target.checked
            setSelected(ids => checked ? [...ids, entry.id] : ids.filter(id => id !== entry.id))
          }} />
          <span className="cache-item-copy"><b>{entry.language ? t('cache.kind.model', { language: OCR_LANGUAGES[entry.language] }) : ui(`cache.kind.${entry.kind}`)}</b><small>{ui(`cache.status.${entry.status}`)}{entry.detail && <> · <bdi>{entry.detail}</bdi></>}</small></span>
          <bdi className="cache-size" dir="ltr">{entry.status === 'unknown' ? '—' : size(entry.bytes)}</bdi>
        </label>)}
      </section>)}
    </ScrollWindow>
  </div>
}
