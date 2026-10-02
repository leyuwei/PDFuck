import type { AnnotationRecord } from '../types'
import { AnnotationRichText } from './AnnotationRichText'
import { AiMarkdown } from './AiMarkdown'
import { ui } from '../lib/i18n'

export function AiAnnotationBadge() {
  return <span className="ai-annotation-badge" role="img" title={ui('ui.aiAnnotation')} aria-label={ui('ui.aiAnnotation')}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1 1.8 4.9L15 8l-5.2 2.1L8 15l-1.8-4.9L1 8l5.2-2.1Z" /></svg></span>
}
export function AnnotationContent({ text, marks, markdown }: { text: string; marks?: AnnotationRecord['marks']; markdown: boolean }) {
  return markdown ? <AiMarkdown content={text} className="annotation-markdown" /> : <AnnotationRichText text={text} marks={marks} />
}
