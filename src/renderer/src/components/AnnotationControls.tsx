import { AnnotationRichEditor } from './AnnotationRichText'
import { ANNOTATION_PALETTE, QUICK_REPLIES, quickReply } from '../lib/annotation-style'
import type { AnnotationReply } from '../types'
import { ui, useInterfaceLanguage } from '../lib/i18n'

export function AnnotationColorPicker({ color, onChange, compact = false }: { color: string; onChange(color: string): void; compact?: boolean }) {
  useInterfaceLanguage()
  const t = ui
  return <div className={`annotation-color-picker${compact ? ' compact' : ''}`}><span className="annotation-control-label">{t("ui.color")}</span><div className="annotation-swatches">
    {ANNOTATION_PALETTE.map((item) => <button type="button" key={item.color} className={color.toLowerCase() === item.color ? 'active' : ''} style={{ backgroundColor: item.color }} title={t(item.label)} aria-label={`${t("ui.annotationColor")}${t(item.label)}`} onClick={() => onChange(item.color)} />)}
    <label className="annotation-custom-color" title={t("ui.customColor")}><input type="color" aria-label={t("ui.customAnnotationColor")} value={color} onChange={(event) => onChange(event.target.value)} /><span>＋</span></label>
  </div></div>
}

export function AnnotationReplyPicker({ reply, onChange }: { reply?: AnnotationReply; onChange(reply?: AnnotationReply): void }) {
  useInterfaceLanguage()
  const t = ui
  return <div className="annotation-reply-picker"><span className="annotation-control-label">{t("ui.reply")}</span>
    <div className="quick-reply-row">{QUICK_REPLIES.map((item) => <button type="button" key={item.status} className={reply?.status === item.status ? `active ${item.status}` : item.status} onClick={() => onChange(reply?.status === item.status ? undefined : quickReply(item.status))}><i />{t(item.label)}</button>)}{reply && <button type="button" className="clear-reply" onClick={() => onChange(undefined)}>{t("ui.clear")}</button>}</div>
    <AnnotationRichEditor label={t("ui.customReply")} text={reply?.status === 'custom' ? reply.content : ''} marks={reply?.status === 'custom' ? reply.marks : []} onChange={(content, marks) => onChange(content ? { status: 'custom', content, marks } : undefined)} />
  </div>
}
