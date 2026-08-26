export type ModuleKey = 'view' | 'edit' | 'annotate' | 'save'
export type ViewMode = 'continuous' | 'single'
export type Tool = 'none' | 'text_select' | 'crop' | 'add_text' | 'edit_text' | 'highlight' | 'note' | 'replace' | 'insert' | 'delete_text' | 'underline'
export type AnnotationKind = 'highlight' | 'note' | 'replace' | 'insert' | 'delete' | 'underline' | 'ai_polish'
export type AnnotationReplyStatus = 'handled' | 'thinking' | 'declined' | 'custom'

export interface PdfRect { x: number; y: number; width: number; height: number }
export interface PdfPoint { x: number; y: number }

export interface TextSelection {
  text: string
  rects: PdfRect[]
  /** Per-page segments for selections that cross page boundaries. */
  segments?: Array<{ pageIndex: number; text: string; rects: PdfRect[] }>
}

export interface AnnotationRecord {
  id: string
  /** Shared identifier for visual segments of one cross-page annotation. */
  groupId?: string
  pageIndex: number
  kind: AnnotationKind
  author: string
  content: string
  color: string
  reply?: AnnotationReply
  rects: PdfRect[]
  createdAt?: string
}

export interface AnnotationReply {
  status: AnnotationReplyStatus
  content: string
}

export interface TextStyle {
  font: string
  size: number
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  lineHeight?: 1 | 1.25 | 1.5 | 2
  paragraphBefore?: number
  paragraphAfter?: number
  letterSpacing?: number
  horizontalScale?: number
}

export interface EditableTextRegion {
  id: string
  text: string
  rect: PdfRect
  sourceRects: PdfRect[]
  style: TextStyle
}

export interface PageTextEdit {
  region: EditableTextRegion
  text: string
  style: TextStyle
  backgroundColor: string
}

export interface TextObjectRecord {
  id: string
  pageIndex: number
  rect: PdfRect
  text: string
  style: TextStyle
}

/** A not-yet-persisted image preview being positioned on one PDF page. */
export interface ImageDraft {
  /** Present when repositioning an image that already exists in the PDF. */
  id?: string
  pageIndex: number
  name: string
  data: Uint8Array
  format: 'png' | 'jpg'
  source: string
  rect: PdfRect
  /** The source image ratio, retained when the placement lock is enabled. */
  aspectRatio: number
  /** Keep resize operations proportional to the imported image. */
  lockAspectRatio: boolean
  /** Clockwise degrees in the page's displayed coordinate system. */
  rotation: number
}

/** A PDFuck image annotation that remains editable after saving and reopening. */
export interface ImageObjectRecord {
  id: string
  pageIndex: number
  name: string
  data: Uint8Array
  format: 'png' | 'jpg'
  rect: PdfRect
  aspectRatio: number
  lockAspectRatio: boolean
  rotation: number
}

export interface CanvasAction {
  pageIndex: number
  tool: Tool
  rect?: PdfRect
  point?: PdfPoint
  selection?: TextSelection
  pageTextEdit?: PageTextEdit
}
