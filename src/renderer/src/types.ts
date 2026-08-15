export type ModuleKey = 'view' | 'edit' | 'annotate' | 'save'
export type ViewMode = 'continuous' | 'single'
export type Tool = 'none' | 'text_select' | 'crop' | 'add_text' | 'edit_text' | 'highlight' | 'note' | 'replace' | 'insert' | 'delete_text' | 'underline'
export type AnnotationKind = 'highlight' | 'note' | 'replace' | 'insert' | 'delete' | 'underline'

export interface PdfRect { x: number; y: number; width: number; height: number }
export interface PdfPoint { x: number; y: number }

export interface TextSelection {
  text: string
  rects: PdfRect[]
}

export interface AnnotationRecord {
  id: string
  pageIndex: number
  kind: AnnotationKind
  author: string
  content: string
  rects: PdfRect[]
  createdAt?: string
}

export interface TextStyle {
  font: 'sans' | 'serif' | 'mono'
  size: number
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
}

export interface TextObjectRecord {
  id: string
  pageIndex: number
  rect: PdfRect
  text: string
  style: TextStyle
}

export interface CanvasAction {
  pageIndex: number
  tool: Tool
  rect?: PdfRect
  point?: PdfPoint
  selection?: TextSelection
}
