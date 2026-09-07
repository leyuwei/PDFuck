import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { normalizeMarks, richTextHtml, type TextMark } from '../lib/annotation-rich-text'
import { ui, useInterfaceLanguage } from '../lib/i18n'

export function AnnotationRichText({ text, marks, className }: { text: string; marks?: TextMark[]; className?: string }) {
  const html = richTextHtml(text, marks)
  // Keep text nodes intact between the two clicks that select and open a row.
  const markup = useMemo(() => ({ __html: html }), [html])
  return <span className={`annotation-rich-text${className ? ` ${className}` : ''}`} dangerouslySetInnerHTML={markup} />
}

function readEditor(root: HTMLElement) {
  let text = ''
  const marks: TextMark[] = []
  const visit = (node: Node, flags: Partial<TextMark> = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const start = text.length
      text += node.textContent || ''
      if (text.length > start) marks.push({ start, end: text.length, ...flags })
      return
    }
    if (!(node instanceof HTMLElement) || /^(SCRIPT|STYLE|IFRAME|OBJECT|SVG)$/u.test(node.tagName)) return
    if (node.tagName === 'BR') { text += '\n'; return }
    const block = /^(DIV|P|LI)$/u.test(node.tagName)
    if (block && text && !text.endsWith('\n')) text += '\n'
    const style = node.style
    const next = { ...flags, bold: flags.bold || /^(B|STRONG)$/u.test(node.tagName) || /bold|[6-9]00/u.test(style.fontWeight), italic: flags.italic || /^(I|EM)$/u.test(node.tagName) || style.fontStyle === 'italic', underline: flags.underline || node.tagName === 'U' || style.textDecoration.includes('underline'), highlight: flags.highlight || node.tagName === 'MARK' || Boolean(style.backgroundColor && style.backgroundColor !== 'transparent') }
    node.childNodes.forEach((child) => visit(child, next))
  }
  root.childNodes.forEach((node) => visit(node))
  return { text, marks: normalizeMarks(text, marks) }
}

export function AnnotationRichEditor({ text, marks = [], label, autoFocus, tools, onChange, onSubmit }: { text: string; marks?: TextMark[]; label: string; autoFocus?: boolean; tools?: ReactNode; onChange(text: string, marks: TextMark[]): void; onSubmit?(): void }) {
  useInterfaceLanguage()
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef('')
  const [active, setActive] = useState<string[]>([])
  const mac = /Mac/i.test(navigator.platform), modifier = mac ? '⌘' : 'Ctrl'
  const controls = [{ name: 'bold', key: 'B', label: ui('ui.bold'), icon: 'B' }, { name: 'italic', key: 'I', label: ui('ui.italic'), icon: 'I' }, { name: 'underline', key: 'U', label: ui('ui.underlineText'), icon: 'U' }, { name: 'hiliteColor', key: 'Shift+H', label: ui('ui.highlightText'), icon: '▰' }]
  useLayoutEffect(() => {
    const value = JSON.stringify([text, marks])
    if (ref.current && last.current !== value) { ref.current.innerHTML = richTextHtml(text, marks); last.current = value }
  }, [text, marks])
  useLayoutEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }) }, [autoFocus])
  const sync = () => {
    if (!ref.current) return
    const value = readEditor(ref.current)
    last.current = JSON.stringify([value.text, value.marks])
    onChange(value.text, value.marks)
    setActive(controls.filter((control) => control.name === 'hiliteColor' ? /255, 242, 154|#fff29a/i.test(document.queryCommandValue('hiliteColor')) : document.queryCommandState(control.name)).map((control) => control.name))
  }
  const format = (name: string) => {
    const selection = window.getSelection()
    if (!selection?.anchorNode || !ref.current?.contains(selection.anchorNode) || !selection.focusNode || !ref.current.contains(selection.focusNode)) return
    document.execCommand(name, false, name === 'hiliteColor' ? (active.includes(name) ? 'transparent' : '#fff29a') : undefined)
    sync()
  }
  return <div className="annotation-rich-editor"><div className="rich-editor-toolbar" role="toolbar" aria-label={label}><b>{label}</b>{controls.map((control) => <button type="button" key={control.name} className={`rich-format-${control.name}`} title={`${control.label} (${modifier}+${control.key})`} aria-label={control.label} aria-pressed={active.includes(control.name)} onMouseDown={(event) => event.preventDefault()} onClick={() => format(control.name)}>{control.icon}</button>)}{tools}<small>{ui('ui.richTextHint')}</small></div><div ref={ref} className="rich-editor-content" role="textbox" aria-label={label} aria-multiline="true" contentEditable suppressContentEditableWarning dir="auto" onInput={sync} onMouseUp={sync} onKeyUp={sync} onPaste={(event) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); sync() }} onDrop={(event) => event.preventDefault()} onKeyDown={(event) => {
    event.stopPropagation()
    if (event.nativeEvent.isComposing) return
    if (event.ctrlKey || event.metaKey) {
      const control = controls.find((item) => item.key.toLowerCase() === `${event.shiftKey ? 'shift+' : ''}${event.key.toLowerCase()}`)
      if (control) { event.preventDefault(); format(control.name) }
      if (event.key === 'Enter') { event.preventDefault(); onSubmit?.() }
    }
  }} /></div>
}
