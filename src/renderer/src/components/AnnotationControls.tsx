import { useEffect, useState } from 'react'
import { ANNOTATION_PALETTE, QUICK_REPLIES, quickReply } from '../lib/annotation-style'
import type { AnnotationReply } from '../types'
import { ui, useInterfaceLanguage } from '../lib/i18n'

export function AnnotationColorPicker({ color, onChange, compact = false }: { color: string; onChange(color: string): void; compact?: boolean }) {
  useInterfaceLanguage()
  const t = ui
  return <div className={`annotation-color-picker${compact ? ' compact' : ''}`}><span className="annotation-control-label">{t('颜色')}</span><div className="annotation-swatches">
    {ANNOTATION_PALETTE.map((item) => <button type="button" key={item.color} className={color.toLowerCase() === item.color ? 'active' : ''} style={{ backgroundColor: item.color }} title={t(item.label)} aria-label={`${t('批注颜色：')}${t(item.label)}`} onClick={() => onChange(item.color)} />)}
    <label className="annotation-custom-color" title={t('自定义颜色')}><input type="color" aria-label={t('自定义批注颜色')} value={color} onChange={(event) => onChange(event.target.value)} /><span>＋</span></label>
  </div></div>
}

export function AnnotationReplyPicker({ reply, onChange, onQuickReply, compact = false }: { reply?: AnnotationReply; onChange(reply?: AnnotationReply): void; onQuickReply?(): void; compact?: boolean }) {
  useInterfaceLanguage()
  const t = ui
  const [custom, setCustom] = useState(reply?.status === 'custom' ? reply.content : '')
  useEffect(() => { if (reply?.status === 'custom') setCustom(reply.content) }, [reply])
  const submitCustom = () => { const content = custom.trim(); if (content) onChange({ status: 'custom', content }) }
  return <div className={`annotation-reply-picker${compact ? ' compact' : ''}`}><span className="annotation-control-label">{t('回复')}</span>
    <div className="quick-reply-row">{QUICK_REPLIES.map((item) => <button type="button" key={item.status} className={reply?.status === item.status ? `active ${item.status}` : item.status} onClick={() => { onChange(reply?.status === item.status ? undefined : quickReply(item.status)); onQuickReply?.() }}><i />{t(item.label)}</button>)}{reply && <button type="button" className="clear-reply" onClick={() => onChange(undefined)}>{t('清除')}</button>}</div>
    <div className="custom-reply-row"><input aria-label={t('自定义回复')} value={custom} placeholder={t('自定义回复…')} onChange={(event) => setCustom(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitCustom() } }} /><button type="button" disabled={!custom.trim()} onClick={submitCustom}>{t('回复')}</button></div>
  </div>
}
