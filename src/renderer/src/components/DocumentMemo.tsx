import { useEffect, useState } from 'react'
import { ui, useInterfaceLanguage } from '../lib/i18n'
import { useFloatingWindow } from '../lib/floating-window'
import { DOCUMENT_PREFERENCES_RESET_KEY } from '../lib/app-preferences'
import { EditIcon } from './EditIcon'

interface Memo { text: string; open: boolean }
const empty: Memo = { text: '', open: false }
const memoPrefix = 'pdfuck.document-memo.v1:'

export function memoStorageKey(path: string | undefined, draftId?: string) {
  if (draftId) return `${memoPrefix}draft:${draftId}`
  if (path) return `${memoPrefix}file:${window.desktop.platform === 'win32' ? path.replaceAll('\\', '/').toLowerCase() : path}`
}

function readMemo(key?: string): Memo {
  if (!key) return empty
  try {
    const memo = JSON.parse(localStorage.getItem(key) || 'null')
    if (typeof memo?.text === 'string' && typeof memo.open === 'boolean') return memo
  } catch { /* A damaged preference starts with an empty memo. */ }
  return empty
}

export function copyDocumentMemo(from: string | undefined, to: string | undefined) {
  if (!from || !to || from === to) return
  const memo = localStorage.getItem(from)
  if (memo && localStorage.getItem(to) === null) localStorage.setItem(to, memo)
}

export function resetDocumentMemoPreferences() {
  // The geometry uses the memo key with a suffix. A document's own memo has no suffix.
  const keys = Object.keys(localStorage).filter(key => key.startsWith(memoPrefix))
  for (const key of keys) {
    if (key.endsWith('.window') || key.endsWith('.window.position')) localStorage.removeItem(key)
    else {
      const memo = readMemo(key)
      if (memo.open) localStorage.setItem(key, JSON.stringify({ ...memo, open: false }))
    }
  }
}

export function useDocumentMemo(key: string | undefined, onError: (error: Error) => void) {
  const [snapshot, setSnapshot] = useState(() => ({ key, memo: readMemo(key) }))
  if (snapshot.key !== key) setSnapshot({ key, memo: readMemo(key) })
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === DOCUMENT_PREFERENCES_RESET_KEY) setSnapshot({ key, memo: readMemo(key) })
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])
  return [snapshot.memo, (change: Partial<Memo>) => {
    if (!key) return
    const memo = { ...readMemo(key), ...change }
    try {
      localStorage.setItem(key, JSON.stringify(memo))
      setSnapshot({ key, memo })
    } catch { onError(new Error('memo.saveFailed')) }
  }] as const
}

export function DocumentMemo({ storageKey, text, onChange, onClose }: { storageKey: string; text: string; onChange(text: string): void; onClose(): void }) {
  const language = useInterfaceLanguage()
  const floating = useFloatingWindow(language, 'end', { storageKey: `${storageKey}.window`, resizable: true, minWidth: 220, minHeight: 145 })
  return <div ref={floating.ref} style={floating.style} className="document-memo" role="dialog" aria-labelledby="document-memo-title"
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !event.nativeEvent.isComposing) onClose() }}>
    <header data-floating-heading {...floating.dragHandlers}>
      <EditIcon kind="memo" size={16} /><h2 id="document-memo-title">{ui('memo.title')}</h2>
      <button type="button" aria-label={ui('ui.close')} onClick={onClose}>×</button>
    </header>
    <textarea dir="auto" wrap="soft" aria-labelledby="document-memo-title" placeholder={ui('memo.placeholder')} value={text} onChange={event => onChange(event.target.value)} />
  </div>
}
