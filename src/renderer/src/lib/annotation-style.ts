import type { AnnotationKind, AnnotationReply, AnnotationReplyStatus } from '../types'

export const DEEP_BLUE = '#173f7a'

export const ANNOTATION_PALETTE = [
  { color: '#ffd43b', label: '明黄' },
  { color: DEEP_BLUE, label: '深蓝' },
  { color: '#2f7de1', label: '亮蓝' },
  { color: '#e24b4f', label: '珊瑚红' },
  { color: '#23826b', label: '墨绿' },
  { color: '#7c4dca', label: '紫色' },
  { color: '#f08c24', label: '橙色' },
  { color: '#20283a', label: '墨黑' }
] as const

export const DEFAULT_ANNOTATION_COLOR: Record<AnnotationKind, string> = {
  highlight: '#ffd43b',
  note: '#f08c24',
  replace: DEEP_BLUE,
  insert: DEEP_BLUE,
  delete: '#e24b4f',
  underline: '#2f7de1',
  ai_polish: '#7c4dca'
}

export const QUICK_REPLIES: Array<{ status: Exclude<AnnotationReplyStatus, 'custom'>; label: string; tint: string }> = [
  { status: 'handled', label: '已处理', tint: '#e8f7ee' },
  { status: 'thinking', label: '想一想', tint: '#fff6d8' },
  { status: 'declined', label: '不做了', tint: '#fdebec' }
]

export function quickReply(status: Exclude<AnnotationReplyStatus, 'custom'>): AnnotationReply {
  return { status, content: QUICK_REPLIES.find((item) => item.status === status)?.label || '' }
}

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value!.toLowerCase() : fallback
}
