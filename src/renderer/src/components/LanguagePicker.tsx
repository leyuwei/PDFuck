import { useEffect, useRef, useState } from 'react'
import { INTERFACE_LANGUAGES, setInterfaceLanguage, ui, useInterfaceLanguage, type InterfaceLanguage } from '../lib/i18n'
export const LANGUAGE_LABELS = { zh: '简体中文', en: 'English', ja: '日本語', ru: 'Русский', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', ko: '한국어', ar: 'العربية' } as const
// SVG flags also render on Windows systems without flag emoji fonts.
export function LanguageFlag({ language }: { language: InterfaceLanguage }) {
  const stripes = (colors: string[], vertical = false) => colors.map((fill, i) => <rect key={i} fill={fill} x={vertical ? i * 30 / colors.length : 0} y={vertical ? 0 : i * 20 / colors.length} width={vertical ? 30 / colors.length : 30} height={vertical ? 20 : 20 / colors.length} />)
  return <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true">
    {language === 'zh' && <><path fill="#de2910" d="M0 0h30v20H0z"/><text x="4" y="10" fill="#ffde00" fontSize="10">★</text><circle cx="12" cy="4" r="1" fill="#ffde00"/><circle cx="14" cy="7" r="1" fill="#ffde00"/><circle cx="14" cy="11" r="1" fill="#ffde00"/><circle cx="11" cy="13" r="1" fill="#ffde00"/></>}
    {language === 'en' && <><path fill="#21468b" d="M0 0h30v20H0z"/><path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20"/><path stroke="#c8102e" strokeWidth="2" d="m0 0 30 20M30 0 0 20"/><path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30"/><path stroke="#c8102e" strokeWidth="4" d="M15 0v20M0 10h30"/></>}
    {language === 'ja' && <><path fill="#fff" d="M0 0h30v20H0z"/><circle cx="15" cy="10" r="6" fill="#bc002d"/></>}
    {language === 'ru' && stripes(['#fff','#0039a6','#d52b1e'])}
    {language === 'fr' && stripes(['#002395','#fff','#ed2939'], true)}
    {language === 'de' && stripes(['#151515','#d00','#ffce00'])}
    {language === 'es' && <>{stripes(['#aa151b','#f1bf00','#f1bf00','#aa151b'])}<rect x="8" y="8" width="3" height="5" rx="1" fill="#aa151b"/></>}
    {language === 'pt' && <><path fill="#009b3a" d="M0 0h30v20H0z"/><path fill="#ffdf00" d="m15 2 12 8-12 8L3 10z"/><circle fill="#002776" cx="15" cy="10" r="4"/><path stroke="#fff" strokeWidth="1" d="m11 9 8 2"/></>}
    {language === 'ko' && <><path fill="#fff" d="M0 0h30v20H0z"/><circle cx="15" cy="10" r="5" fill="#cd2e3a"/><path fill="#0047a0" d="M10 10a5 5 0 0 0 10 0c-3 4-7-4-10 0"/><path stroke="#111" strokeWidth="1" d="m4 4 3 3m-4-1 3 3m17-5 3 3m-4-1 3 3M4 13l3 3m-4-1 3 3m17-5 3 3m-4-1 3 3"/></>}
    {language === 'ar' && <><path fill="#006c35" d="M0 0h30v20H0z"/><text x="15" y="11" textAnchor="middle" fill="#fff" fontSize="7">العربية</text><path stroke="#fff" strokeWidth="1" d="M7 15h16"/></>}
  </svg>
}
export function LanguagePicker() {
  const language = useInterfaceLanguage(), [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!open) return; const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close) }, [open])
  return <div ref={ref} className="language-picker" dir="ltr" onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); ref.current?.querySelector('button')?.focus() } }}>
    <button type="button" className="language-picker-trigger" aria-label={`${ui('ui.interfaceLanguage')} · Language`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}><svg className="language-globe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/></svg><LanguageFlag language={language}/><span lang={language}>{LANGUAGE_LABELS[language]}</span><span aria-hidden="true">⌄</span></button>
    {open && <div className="language-picker-options" role="group" aria-label="Language">{INTERFACE_LANGUAGES.map(code => <button key={code} type="button" lang={code} aria-pressed={code === language} onClick={() => { setInterfaceLanguage(code); setOpen(false); ref.current?.querySelector('button')?.focus() }}><LanguageFlag language={code}/><span>{LANGUAGE_LABELS[code]}</span>{code === language && <span aria-hidden="true">✓</span>}</button>)}</div>}
  </div>
}
