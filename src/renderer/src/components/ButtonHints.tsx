import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInterfaceLanguage } from '../lib/i18n'

export function ButtonHints() {
  const language = useInterfaceLanguage()
  const [hint, setHint] = useState<{ text: string; x: number; y: number; dark: boolean }>()
  const tooltip = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (hint && tooltip.current) { const width=tooltip.current.offsetWidth; Object.assign(tooltip.current.style,{left:`${Math.max(8,Math.min(window.innerWidth-width-8,hint.x-width/2))}px`,transform:'none',top:`${Math.max(8,Math.min(window.innerHeight-tooltip.current.offsetHeight-8,hint.y))}px`}) } }, [hint])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>, current: HTMLElement | undefined, title: string | null = null
    const clear = () => { clearTimeout(timer); if (current && title !== null && !current.hasAttribute('title')) current.setAttribute('title', title); if(current){const ids=(current.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='pdfuck-button-hint');if(ids.length)current.setAttribute('aria-describedby',ids.join(' '));else current.removeAttribute('aria-describedby')} current?.removeAttribute('data-app-hint-active'); current = undefined; title = null; setHint(undefined) }
    const show = (event: Event) => {
      const button = (event.target as Element)?.closest<HTMLElement>('button, a[title], button[data-hint]')
      if (!button || button === current) return
      clear();
      if (button.closest('.annotation-row, .annotation-hover-hint, .annotation-source, .rich-editor-content')) return
      current = button; title = button.getAttribute('title'); if (title !== null) button.removeAttribute('title')
      const text = button.dataset.hint || title || button.getAttribute('aria-label') || undefined
      const visible = button.textContent?.replace(/\s+/g,' ').trim() || ''
      if (!text || text.replace(/\s+/g,' ').trim() === visible || (!button.dataset.hint && !title && !button.querySelector('svg') && !(visible.length<=3&&!/[\p{L}\p{N}]/u.test(visible)))) return
      button.dataset.appHintActive = 'true'
      timer = setTimeout(() => { if (!button.isConnected) { clear(); return }; const r = button.getBoundingClientRect(); button.setAttribute('aria-describedby',`${button.getAttribute('aria-describedby')||''} pdfuck-button-hint`.trim()); setHint({ text, x: Math.max(12, Math.min(window.innerWidth - 12, r.left + r.width / 2)), y: r.bottom + 42 < window.innerHeight ? r.bottom + 8 : Math.max(8, r.top - 40), dark: Boolean(button.closest('.theme-dark')) }) }, 1500)
    }
    const leave = (event: Event) => { const target = (event as PointerEvent).relatedTarget; if (!(target instanceof Node) || !current?.contains(target)) clear() }
    document.addEventListener('pointerover', show, true); document.addEventListener('focusin', show, true)
    document.addEventListener('pointerout', leave, true); document.addEventListener('focusout', clear, true)
    document.addEventListener('pointerdown', clear, true); document.addEventListener('scroll', clear, true); document.addEventListener('keydown', clear, true); window.addEventListener('blur', clear)
    return () => { clear(); document.removeEventListener('pointerover', show, true); document.removeEventListener('focusin', show, true); document.removeEventListener('pointerout', leave, true); document.removeEventListener('focusout', clear, true); document.removeEventListener('pointerdown', clear, true); document.removeEventListener('scroll', clear, true); document.removeEventListener('keydown', clear, true); window.removeEventListener('blur', clear) }
  }, [language])
  return hint ? createPortal(<div id="pdfuck-button-hint" ref={tooltip} className={`app-button-hint${hint.dark ? ' theme-dark' : ''}`} role="tooltip" style={{ left: hint.x, top: hint.y }}>{hint.text}</div>, document.body) : null
}
