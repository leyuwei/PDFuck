import type { AnnotationKind, Tool } from '../types'

type IconKind = AnnotationKind | Extract<Tool, 'highlight' | 'note' | 'replace' | 'insert' | 'delete_text' | 'underline'>

export function AnnotationIcon({ kind, size = 22 }: { kind: IconKind; size?: number }) {
  const normalized = kind === 'delete_text' ? 'delete' : kind
  return <svg className={`annotation-icon ${normalized}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {normalized === 'highlight' && <><path d="m6 15 8.9-8.9 3 3L9 18H6z" /><path className="accent" d="M4 19h14" /></>}
    {normalized === 'note' && <><path d="M5 5h14v10H9l-4 4z" /><path className="detail" d="M8 9h8M8 12h5" /></>}
    {normalized === 'replace' && <><path d="M5 8h12l-3-3M19 16H7l3 3" /><path className="detail" d="M4 12h16" /></>}
    {normalized === 'insert' && <><path d="m6 17 6-10 6 10" /><path className="accent" d="M12 5v14M9.5 12h5" /></>}
    {normalized === 'delete' && <><path className="detail" d="M5 8h14M5 16h14" /><path className="accent" d="M4 12h16" /></>}
    {normalized === 'underline' && <><path d="M7 5v5a5 5 0 0 0 10 0V5" /><path className="accent" d="M5 19h14" /></>}
    {normalized === 'ai_polish' && <><path d="m12 3 1.6 5.1L19 10l-5.4 1.7L12 17l-1.6-5.3L5 10l5.4-1.9z" /><path className="accent" d="m18 15 .8 2.4L21 18l-2.2.7L18 21l-.8-2.3L15 18l2.2-.6z" /></>}
  </svg>
}
