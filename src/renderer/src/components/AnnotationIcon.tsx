import type { AnnotationKind, Tool } from '../types'

type IconKind = AnnotationKind | Extract<Tool, 'highlight' | 'note' | 'replace' | 'insert' | 'delete_text' | 'underline'> | 'ai_review' | 'ai_suggest' | 'ai_annotate'

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
    {normalized === 'ai_review' && <><path d="M6 3.5h9l3 3V20H6z" /><path className="detail" d="M15 3.5V7h3M9 11h6M9 14h4" /><path className="accent" d="m15.5 15.2.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>}
    {normalized === 'ai_annotate' && <><path d="M5 4h11l3 3v13H5z" /><path className="detail" d="M16 4v4h3M8 11h5M8 15h4" /><path className="accent" d="m14.5 14.5 1.2 1.2 2.8-3M8 18h4" /></>}
    {normalized === 'ai_suggest' && <><path d="M5 5h14v10H9l-4 4z" /><path className="detail" d="M8 9h5M8 12h4" /><path className="accent" d="m17 8 .7 1.8 1.8.7-1.8.7L17 13l-.7-1.8-1.8-.7 1.8-.7z" /></>}
  </svg>
}
