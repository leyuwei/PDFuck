import type { AnnotationRecord } from '../types'

export type AnnotationSummaryStatus = 'unreplied' | 'handled' | 'thinking' | 'declined'

export function annotationSummaryStatus(annotation: AnnotationRecord): AnnotationSummaryStatus {
  if (!annotation.reply) return 'unreplied'
  if (annotation.reply.status === 'thinking') return 'thinking'
  if (annotation.reply.status === 'declined') return 'declined'
  return 'handled'
}

export function annotationSummary(annotations: AnnotationRecord[]): Record<AnnotationSummaryStatus, number> {
  const result: Record<AnnotationSummaryStatus, number> = { unreplied: 0, handled: 0, thinking: 0, declined: 0 }
  annotations.forEach((annotation) => { result[annotationSummaryStatus(annotation)] += 1 })
  return result
}
