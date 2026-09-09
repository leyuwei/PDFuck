import { useEffect, useRef, useState } from 'react'
import type { DocumentTabsSnapshot } from '../../../shared/contracts'
import { deleteDocumentArchive, DOCUMENT_ARCHIVES_KEY, loadDocumentArchives, saveDocumentArchive, type DocumentArchive } from '../lib/document-archives'
import { t, ui } from '../lib/i18n'
import './document-archives.css'

export function DocumentArchives({ snapshot, onRestore }: { snapshot: DocumentTabsSnapshot; onRestore(paths: string[]): Promise<string[]> }) {
  const [open, setOpen] = useState(false), [archives, setArchives] = useState<DocumentArchive[]>([])
  const [name, setName] = useState(''), [editing, setEditing] = useState<string>(), [deleting, setDeleting] = useState<string>()
  const [error, setError] = useState(false), [busy, setBusy] = useState(false), [result, setResult] = useState<{ total: number; failed: string[] }>()
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null)
  const documents = snapshot.documents.filter(item => item.hasDocument)
  const unsaved = documents.some(item => !item.filePath)
  useEffect(() => { if (open && !busy) input.current?.focus() }, [open, busy])
  useEffect(() => {
    if (!open) return
    const refresh = () => { try { setArchives(loadDocumentArchives()); setError(false) } catch { setError(true) } }
    refresh()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const storage = (event: StorageEvent) => { if (event.key === DOCUMENT_ARCHIVES_KEY) refresh() }
    document.addEventListener('pointerdown', outside); window.addEventListener('storage', storage)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('storage', storage) }
  }, [open])
  const close = () => { setOpen(false); trigger.current?.focus() }
  const restore = async (archive: DocumentArchive) => {
    setBusy(true); setResult(undefined)
    try { setResult({ total: archive.paths.length, failed: await onRestore(archive.paths) }) }
    catch { setResult({ total: archive.paths.length, failed: archive.paths }) }
    finally { setBusy(false); setOpen(true) }
  }
  return <div className="document-archives" ref={root} onKeyDown={event => { if (open && event.key === 'Escape') { event.stopPropagation(); close() } }}>
    <button type="button" ref={trigger} className="window-manager-heading" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}><span className="windows-glyph" aria-hidden="true" />{ui('ui.documentTabs')}<em>{snapshot.documents.length}</em></button>
    {open && <div className="document-archives-popover" role="dialog" aria-labelledby="document-archives-title" aria-busy={busy}>
      <header><h2 id="document-archives-title">{ui('archives.title')}</h2><button type="button" onClick={close} aria-label={ui('ui.close')}>×</button></header>
      <div className="document-archives-body">
        <p className="archive-hint">{ui('archives.hint')}</p>
        <form onSubmit={event => { event.preventDefault(); try { setArchives(saveDocumentArchive(name, documents.map(item => item.filePath!).filter(Boolean), editing)); setName(''); setEditing(undefined); setError(false); setResult(undefined) } catch { setError(true) } }}>
          <label htmlFor="archive-name">{ui('archives.name')}</label>
          <div className="archive-name-row"><input id="archive-name" ref={input} dir="auto" value={name} maxLength={80} disabled={busy} onChange={event => setName(event.target.value)} /><button type="submit" className="primary" disabled={busy || error || !name.trim() || (!editing && (unsaved || !documents.length))}>{ui(editing ? 'ui.save' : 'archives.saveCurrent')}</button></div>
          {editing && <button type="button" disabled={busy} onClick={() => { setEditing(undefined); setName('') }}>{ui('ui.cancel')}</button>}
          {unsaved && !editing && <small>{ui('archives.unsaved')}</small>}
        </form>
        {error && <p className="archive-notice" role="alert">{ui('archives.storageError')}</p>}
        {busy && <p role="status">{ui('archives.restoring')}</p>}
        {result && <div className="archive-notice" role="status"><b>{t('archives.result', { count: result.total - result.failed.length, failed: result.failed.length })}</b>{result.failed.length > 0 && <><p>{ui('archives.unavailable')}</p><ul>{result.failed.map(path => <li key={path}><bdi>{path}</bdi></li>)}</ul></>}</div>}
        <div className="archive-list">{archives.length ? archives.map(archive => <article key={archive.id}>
          <button type="button" className="archive-restore" disabled={busy} onClick={() => void restore(archive)} title={ui('archives.restore')}><bdi>{archive.name}</bdi><small>{t('archives.files', { count: archive.paths.length })}</small><span aria-hidden="true">↗</span></button>
          <div className="archive-actions">{deleting === archive.id ? <><span>{ui('archives.deleteConfirm')}</span><button type="button" className="danger" disabled={busy} onClick={() => { try { setArchives(deleteDocumentArchive(archive.id)); setDeleting(undefined); if (editing === archive.id) { setEditing(undefined); setName('') } } catch { setError(true) } }}>{ui('archives.delete')}</button><button type="button" onClick={() => setDeleting(undefined)}>{ui('ui.cancel')}</button></> : <><button type="button" disabled={busy} onClick={() => { setEditing(archive.id); setName(archive.name); input.current?.focus() }}>{ui('archives.rename')}</button><button type="button" disabled={busy} onClick={() => setDeleting(archive.id)}>{ui('archives.delete')}</button></>}</div>
        </article>) : <p className="archive-empty">{ui('archives.empty')}</p>}</div>
      </div>
    </div>}
  </div>
}
