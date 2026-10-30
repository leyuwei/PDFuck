import { useEffect, useRef, type CSSProperties } from 'react'
import { AnnotationLayer } from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from '../lib/pdfjs'
import { trackFormFieldEdit, type FormFieldEdit } from '../lib/pdf-form-fields'
import { ui } from '../lib/i18n'

interface Props {
  document: PDFDocumentProxy
  page: PDFPageProxy
  zoom: number
  enabled: boolean
  editable: boolean
  onReady(ids: string[]): void
  onEdit(edit: FormFieldEdit): Promise<boolean | void>
  onDraft(id: string, value?: string): void
  onError(error: unknown): void
}

export function PdfFormFields({ document: pdf, page, zoom, enabled, editable, onReady, onEdit, onDraft, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onEdit, onDraft, onError, editable, enabled })
  callbacks.current = { onEdit, onDraft, onError, editable, enabled }
  useEffect(() => {
    let cancelled = false
    const div = ref.current!
    let layer: AnnotationLayer | undefined
    const render = async () => {
      const [annotations, fieldObjects] = await Promise.all([page.getAnnotations({ intent: 'display' }), pdf.getFieldObjects()])
      if (cancelled) return
      const fields = annotations.filter(field => field.fieldType === 'Tx' && !field.hidden && !field.noView && field.rect?.every(Number.isFinite) && field.rect[2] > field.rect[0] && field.rect[3] > field.rect[1])
      const viewport = page.getViewport({ scale: 1 }).clone({ dontFlip: true })
      layer = new AnnotationLayer({ div, page, viewport, annotationStorage: pdf.annotationStorage, linkService: null,
        accessibilityManager: null, annotationCanvasMap: null, annotationEditorUIManager: null, structTreeLayer: null, commentManager: null })
      // Cached appearance text can predate /V; controls must show the actual field value.
      await layer.render({ div, page, viewport, annotations: fields.map(field => ({ ...field, hasOwnCanvas: false, textContent: undefined })), fieldObjects,
        annotationStorage: pdf.annotationStorage, renderForms: true, enableScripting: false, linkService: null! })
      if (cancelled) { div.replaceChildren(); return }
      for (const field of fields) {
        const control = div.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-element-id="${field.id}"]`)
        if (!control) continue
        // Readonly inputs still allow native selection and copying, unlike disabled inputs.
        control.disabled = false
        control.dataset.readonly = String(Boolean(field.readOnly || field.password))
        control.readOnly = !callbacks.current.editable || field.readOnly || field.password
        control.tabIndex = callbacks.current.enabled ? 0 : -1
        control.setAttribute('aria-label', field.alternativeText || field.fieldName || ui('form.field'))
        control.title = ui(field.readOnly || field.password ? 'form.readOnly' : 'form.hint')
        let committed = control.value
        control.addEventListener('input', () => {
          if (!control.readOnly) callbacks.current.onDraft(field.id, control.value === committed ? undefined : control.value)
        })
        control.addEventListener('focus', () => { if (!control.dataset.failed) committed = control.value })
        control.addEventListener('keydown', event => {
          if (!(event instanceof KeyboardEvent)) return
          if (event.isComposing) return
          if (event.key === 'Escape') {
            control.value = committed
            delete control.dataset.failed
            control.dispatchEvent(new Event('input', { bubbles: true }))
            control.blur()
          } else if (event.key === 'Enter' && (control instanceof HTMLInputElement || event.metaKey || event.ctrlKey)) {
            event.preventDefault(); control.blur()
          }
        })
        control.addEventListener('blur', () => {
          const value = control.value
          if (control.readOnly || value === committed) return
          const previous = committed
          committed = value
          trackFormFieldEdit(callbacks.current.onEdit({ pageIndex: page.pageNumber - 1, id: field.id, value }).then(success => {
            if (success === false) { committed = previous; control.dataset.failed = 'true' }
            else delete control.dataset.failed
            return success !== false
          }).catch(error => { committed = previous; control.dataset.failed = 'true'; callbacks.current.onError(error); return false }))
        })
      }
      onReady(fields.filter(field => div.querySelector(`[data-element-id="${field.id}"]`)).map(field => field.id))
    }
    void render().catch(error => { if (!cancelled) { div.replaceChildren(); onReady([]); callbacks.current.onError(error) } })
    return () => {
      if (div.contains(window.document.activeElement)) (window.document.activeElement as HTMLElement).blur()
      cancelled = true; layer?.destroy(); onReady([])
    }
  }, [pdf, page, onReady])
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea').forEach(control => {
      control.readOnly = !editable || control.dataset.readonly === 'true'
      control.tabIndex = enabled ? 0 : -1
    })
  }, [editable, enabled])
  return <div ref={ref} className={`pdf-form-fields${enabled ? '' : ' disabled'}`} style={{ '--total-scale-factor': zoom * page.userUnit, '--scale-round-x': '1px', '--scale-round-y': '1px' } as CSSProperties}
    onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
    onDoubleClick={event => event.stopPropagation()} onContextMenu={event => event.stopPropagation()} onKeyDown={event => { if (!(event.metaKey || event.ctrlKey) || !['s', 'p'].includes(event.key.toLowerCase())) event.stopPropagation() }} />
}
