import type { AnnotationKind, AnnotationReply, AnnotationReplyStatus } from '../types'
import type { TranslationKey } from './i18n'

export const DEEP_BLUE = '#173f7a'

export const ANNOTATION_PALETTE = [
  { color: '#ffd43b', label: "ui.brightYellow" },
  { color: DEEP_BLUE, label: "ui.deepBlue" },
  { color: '#2f7de1', label: "ui.brightBlue" },
  { color: '#e24b4f', label: "ui.coralRed" },
  { color: '#23826b', label: "ui.deepGreen" },
  { color: '#7c4dca', label: "ui.purple" },
  { color: '#f08c24', label: "ui.orange" },
  { color: '#20283a', label: "ui.inkBlack" }
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

export const QUICK_REPLIES: Array<{ status: Exclude<AnnotationReplyStatus, 'custom'>; label: TranslationKey; content: string; tint: string }> = [
  { status: 'handled', label: "ui.resolved", content: '已处理', tint: '#e8f7ee' },
  { status: 'thinking', label: "ui.reviewLater", content: '想一想', tint: '#fff6d8' },
  { status: 'declined', label: "ui.wonTFix", content: '不做了', tint: '#fdebec' }
]

export function quickReply(status: Exclude<AnnotationReplyStatus, 'custom'>): AnnotationReply {
  return { status, content: QUICK_REPLIES.find((item) => item.status === status)?.content || '' }
}

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value!.toLowerCase() : fallback
}
