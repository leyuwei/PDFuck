import { useLayoutEffect, useRef } from 'react'
import { ui } from '../lib/i18n'
import './new-document.css'

export function NewDocumentIcon({ plus = true }: { plus?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3H5v18h14V9l-6-6Zm0 0v6h6" />{plus && <path d="M8 15h8m-4-4v8" />}</svg>
}

export function NewDocumentDialog({ busy, onCancel, onCreate }: { busy: boolean; onCancel(): void; onCreate(type: 'md' | 'txt'): void }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { ref.current?.querySelector<HTMLButtonElement>('.new-document-choice')?.focus() }, [])
  return <div className="modal-backdrop new-document-backdrop" onPointerDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape' && !busy) onCancel()
    if (event.key === 'Tab') {
      const buttons = [...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const index = buttons.indexOf(window.document.activeElement as HTMLButtonElement)
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
    }
  }}><div ref={ref} className="new-document-dialog" role="dialog" aria-modal="true" aria-label={ui('text.new')} aria-busy={busy}>
    <button type="button" className="new-document-close" disabled={busy} onClick={onCancel} aria-label={ui('ui.close')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    <div className="new-document-choices">{(['md', 'txt'] as const).map(type => <button type="button" key={type} className="new-document-choice" disabled={busy} onClick={() => onCreate(type)}>
      <span className={`new-document-file new-document-file-${type}`} aria-hidden="true"><NewDocumentIcon plus={false} /><b dir="ltr">{type === 'md' ? 'M↓' : 'Aa'}</b></span>
      <b>{type === 'md' ? 'Markdown' : 'TXT'}</b><small>{ui(type === 'md' ? 'text.newMarkdownHint' : 'text.newTxtHint')}</small><em dir="ltr">.{type}</em>
    </button>)}</div>
  </div></div>
}
