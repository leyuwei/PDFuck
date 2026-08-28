import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { annotationAuthorColors, MAX_ANNOTATION_AUTHOR_LENGTH, normalizeAnnotationAuthor } from '../lib/annotation-author'
import { ui, useInterfaceLanguage } from '../lib/i18n'

function AuthorGlyph({ size = 15 }: { size?: number }) {
  return <svg className="annotation-author-glyph" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6.5" r="3" /><path d="M4.5 16c.5-3.2 2.4-5 5.5-5s5 1.8 5.5 5" /></svg>
}

interface Props {
  author: string
  showAuthors: boolean
  theme: 'light' | 'dark'
  accent: string
  onSave(author: string, showAuthors: boolean): void
}

export function AnnotationAuthorSettings({ author, showAuthors, theme, accent, onSave }: Props) {
  useInterfaceLanguage()
  const trigger = useRef<HTMLButtonElement>(null)
  const windowRef = useRef<HTMLElement>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(author)
  const [show, setShow] = useState(showAuthors)
  const [position, setPosition] = useState({ left: 24, top: 80 })
  const normalized = normalizeAnnotationAuthor(name)
  const valid = Boolean(name.trim())
  const colors = annotationAuthorColors(normalized)
  const badgeStyle = { '--author-bg': colors.background, '--author-border': colors.border, '--author-text': colors.text } as CSSProperties

  useEffect(() => {
    if (!open) return
    setName(author); setShow(showAuthors)
    const rect = trigger.current?.getBoundingClientRect()
    const bounds = windowRef.current?.getBoundingClientRect()
    const width = bounds?.width || 330, height = bounds?.height || 320
    setPosition({
      left: Math.max(10, Math.min(window.innerWidth - width - 10, (rect?.right || window.innerWidth - 20) - width)),
      top: Math.max(10, Math.min(window.innerHeight - height - 10, (rect?.bottom || 70) + 8))
    })
  }, [author, open, showAuthors])

  useEffect(() => {
    const cancelDrag = () => { drag.current = undefined }
    window.addEventListener('blur', cancelDrag)
    return () => window.removeEventListener('blur', cancelDrag)
  }, [])

  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, ...position }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const bounds = windowRef.current?.getBoundingClientRect()
    const width = bounds?.width || 330, height = bounds?.height || 320
    setPosition({ left: Math.max(8, Math.min(window.innerWidth - width - 8, drag.current.left + event.clientX - drag.current.x)), top: Math.max(8, Math.min(window.innerHeight - height - 8, drag.current.top + event.clientY - drag.current.y)) })
  }
  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const save = () => {
    if (!valid) return
    onSave(normalized, show)
    setOpen(false)
  }

  return <>
    <button ref={trigger} type="button" className="annotation-author-button" aria-expanded={open} aria-haspopup="dialog" title={ui('设置批注人')} onClick={() => setOpen((value) => !value)}><AuthorGlyph /><span>{ui('批注人')}</span></button>
    {open && createPortal(<section ref={windowRef} className={`annotation-author-window${theme === 'dark' ? ' theme-dark' : ''}`} style={{ ...position, '--app-accent': accent } as CSSProperties} role="dialog" aria-modal="false" aria-label={ui('批注人设置')}>
      <header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} title={ui('拖动批注人设置浮窗')}><div><span><AuthorGlyph size={18} /></span><div><b>{ui('批注人设置')}</b><small>{ui('用于今后新建的批注')}</small></div></div><button type="button" aria-label={ui('关闭批注人设置')} title={ui('关闭')} onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)}>×</button></header>
      <div className="annotation-author-body">
        <label className={`annotation-author-name${valid ? '' : ' invalid'}`}><span>{ui('批注人名称')}</span><input autoFocus value={name} maxLength={MAX_ANNOTATION_AUTHOR_LENGTH} placeholder={ui('请输入批注人名称')} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); save() } }} /><small>{ui('名称将保存在此设备，并写入今后新建的批注。')}</small></label>
        <div className={`annotation-author-visible${show ? ' active' : ''}`}><span><b>{ui('在列表中显示批注人')}</b><small>{ui('不增加新列，以紧凑彩色标签显示。')}</small></span><button type="button" className="annotation-author-switch" role="switch" aria-checked={show} aria-label={ui('在列表中显示批注人')} onClick={() => setShow((value) => !value)}><i aria-hidden="true" /></button></div>
        <div className="annotation-author-preview"><span>{ui('列表预览')}</span><b className="annotation-author-badge" style={badgeStyle} title={normalized}><i />{normalized}</b><small>{ui('不同批注人会使用稳定的颜色加以区分。')}</small></div>
      </div>
      <footer><button type="button" onClick={() => setOpen(false)}>{ui('取消')}</button><button type="button" className="primary" disabled={!valid} onClick={save}>{ui('保存设置')}</button></footer>
    </section>, document.body)}
  </>
}
