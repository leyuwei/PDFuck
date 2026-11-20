import { useLayoutEffect, useRef } from 'react'
import { ui } from '../lib/i18n'
import './new-document.css'

export function NewDocumentIcon({ plus = true }: { plus?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path strokeWidth="1.75" d="M6.1 3h7.8l4.9 4.9v10.9a2.1 2.1 0 0 1-2.1 2.1H6.1A2.1 2.1 0 0 1 4 18.8V5.1A2.1 2.1 0 0 1 6.1 3Zm7.8 0v3.7a1.2 1.2 0 0 0 1.2 1.2h3.7"/>
    {plus && <path className="new-document-plus" strokeWidth="2" d="M7.9 14.4h7M11.4 10.9v7"/>}
  </svg>
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
