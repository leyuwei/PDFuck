import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { AnnotationRecord, AnnotationReply, PdfRect } from '../types'
import { rectUnion } from '../lib/geometry'
import { annotationSummary } from '../lib/annotation-summary'
import { quickReply } from '../lib/annotation-style'
import { ui } from '../lib/i18n'
import { AnnotationContent, AiAnnotationBadge } from './AnnotationContent'

const STATUSES = [
  { status: 'unreplied', label: 'ui.unprocessed', icon: '○' },
  { status: 'handled', label: 'ui.resolved', icon: '✓' },
  { status: 'thinking', label: 'ui.reviewLater', icon: '?' },
  { status: 'declined', label: 'ui.wonTFix', icon: '×' }
] as const

export function PageAnnotationSummary({ annotations }: { annotations: AnnotationRecord[] }) {
  const counts = annotationSummary(annotations)
  return <aside className="page-annotation-summary" aria-label={ui('ui.replySummary')} onPointerDown={event => event.stopPropagation()}>{STATUSES.map(item => <span key={item.status} className={item.status} title={ui(item.label)}><i aria-hidden="true">{item.icon}</i><b>{counts[item.status]}</b><small>{ui(item.label)}</small></span>)}</aside>
}

// Anchor to the complete annotation, never to a pointer position or a clamped overlap.
export function inlineAnnotationPosition(anchor: PdfRect, view: PdfRect, width: number, height: number) {
  const right = view.x + view.width, bottom = view.y + view.height, gap = 12
  const spaces = [
    { x: Math.max(view.x, anchor.x + anchor.width + gap), y: view.y, width: right - Math.max(view.x, anchor.x + anchor.width + gap), height: view.height, side: 'right' },
    { ...view, width: Math.min(right, anchor.x - gap) - view.x, side: 'left' },
    { x: view.x, y: Math.max(view.y, anchor.y + anchor.height + gap), width: view.width, height: bottom - Math.max(view.y, anchor.y + anchor.height + gap), side: 'below' },
    { ...view, height: Math.min(bottom, anchor.y - gap) - view.y, side: 'above' }
  ].filter(space => space.width > 0 && space.height > 0)
  const usable = spaces.filter(space => space.width >= Math.min(240, width) && space.height >= Math.min(160, height))
  const options = usable.length ? usable : spaces.filter(space => space.width >= Math.min(180, width))
  const space = options.find(space => space.width >= width && space.height >= height) || options.sort((a, b) => Math.min(b.width, width) * Math.min(b.height, height) - Math.min(a.width, width) * Math.min(a.height, height))[0]
  // A selection filling the viewport has no free area: retain its anchor below it.
  if (!space) return { left: view.x, top: anchor.y + anchor.height + gap, width, maxHeight: height }
  const w = Math.min(width, space.width), h = Math.min(height, space.height)
  const clamp = (value: number, start: number, end: number) => Math.max(start, Math.min(value, end))
  return { left: space.side === 'left' ? space.x + space.width - w : clamp(anchor.x, space.x, space.x + space.width - w), top: space.side === 'above' ? space.y + space.height - h : clamp(anchor.y, space.y, space.y + space.height - h), width: w, maxHeight: h }
}

export function InlineAnnotation({ annotation, zoom, markdown, onReply, onEdit, onClose }: { annotation: AnnotationRecord; zoom: number; markdown: boolean; onReply(id: string, reply?: AnnotationReply): void; onEdit(annotation: AnnotationRecord): void; onClose(): void }) {
  const ref = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const bounds = rectUnion(annotation.rects)
  useLayoutEffect(() => {
    const card = ref.current!, paper = card.closest('.pdf-page') as HTMLElement, viewer = card.closest('.viewer') as HTMLElement
    const place = () => {
      const page = paper.getBoundingClientRect(), view = viewer.getBoundingClientRect()
      const notices = [...viewer.parentElement!.querySelectorAll('.temporary-document-warning, .document-security-banner')].map(notice => notice.getBoundingClientRect())
      const top = Math.max(view.top + 8, ...notices.filter(notice => notice.width && notice.height).map(notice => notice.bottom + 8))
      const area = { x: view.left + 8 - page.left, y: top - page.top, width: viewer.clientWidth - 16, height: Math.max(1, view.bottom - 8 - top) }
      const body = card.querySelector('.inline-annotation-body')!
      const height = Math.min(420, area.height, card.offsetHeight + body.scrollHeight - body.clientHeight)
      const next = inlineAnnotationPosition({ x: bounds.x * zoom, y: bounds.y * zoom, width: bounds.width * zoom, height: bounds.height * zoom }, area, Math.min(360, area.width), height)
      setPosition({ ...next, visibility: 'visible' })
    }
    place()
    const reveal = requestAnimationFrame(() => {
      const box = card.getBoundingClientRect(), view = viewer.getBoundingClientRect()
      if (box.top >= view.bottom || box.bottom <= view.top) card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    const observer = new ResizeObserver(place); observer.observe(viewer); observer.observe(card)
    viewer.addEventListener('scroll', place); window.addEventListener('resize', place)
    return () => { cancelAnimationFrame(reveal); observer.disconnect(); viewer.removeEventListener('scroll', place); window.removeEventListener('resize', place) }
  }, [annotation.id, annotation.content, annotation.reason, annotation.reply, markdown, zoom, bounds.x, bounds.y, bounds.width, bounds.height])
  return <aside ref={ref} className="inline-annotation" role="dialog" aria-label={ui('ui.annotationContent')} style={{ ...position, '--annotation-color': annotation.color } as CSSProperties} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onDoubleClick={event => { event.stopPropagation(); onEdit(annotation) }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onClose() }}>
    <header><span className="inline-annotation-author" dir="auto" title={annotation.author}>{annotation.author}</span>{annotation.aiGenerated && <AiAnnotationBadge />}<button type="button" aria-label={ui('ui.close')} onClick={onClose}>×</button></header>
    <div className="inline-annotation-statuses">{STATUSES.filter(item => item.status !== 'unreplied').map(item => <button key={item.status} type="button" className={item.status} aria-pressed={annotation.reply?.status === item.status || item.status === 'handled' && annotation.reply?.status === 'custom'} onDoubleClick={event => event.stopPropagation()} onClick={() => onReply(annotation.id, annotation.reply?.status === item.status ? undefined : quickReply(item.status))}><i aria-hidden="true">{item.icon}</i>{ui(item.label)}</button>)}</div>
    <div className="inline-annotation-body"><AnnotationContent text={annotation.content || ui('ui.noContent')} marks={annotation.marks} markdown={markdown} />{annotation.reason && <section><b>{ui('ui.reason')}</b><AnnotationContent text={annotation.reason} markdown={markdown} /></section>}{annotation.reply?.status === 'custom' && <section><b>{ui('ui.currentReply')}</b><AnnotationContent text={annotation.reply.content} marks={annotation.reply.marks} markdown={markdown} /></section>}</div>
    <button type="button" className="inline-annotation-edit" onClick={() => onEdit(annotation)}>{ui('ui.editAnnotation')}</button>
  </aside>
}
