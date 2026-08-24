/** DataTransfer type used only for moving an in-memory PDF between PDFuck windows. */
export const DOCUMENT_TRANSFER_MIME = 'application/x-pdfuck-document-transfer'
const DOCUMENT_TRANSFER_PREFIX = 'pdfuck-document-transfer:'
const DOCUMENT_TRANSFER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function writeDocumentTransfer(dataTransfer: DataTransfer, transferId: string): void {
  dataTransfer.effectAllowed = 'move'
  dataTransfer.setData(DOCUMENT_TRANSFER_MIME, transferId)
  // text/plain survives the Windows native drag bridge as a fallback.
  dataTransfer.setData('text/plain', `${DOCUMENT_TRANSFER_PREFIX}${transferId}`)
}

export function documentTransferToken(dataTransfer: DataTransfer): string | undefined {
  const direct = dataTransfer.getData(DOCUMENT_TRANSFER_MIME)
  const fallback = dataTransfer.getData('text/plain')
  const value = direct || (fallback.startsWith(DOCUMENT_TRANSFER_PREFIX) ? fallback.slice(DOCUMENT_TRANSFER_PREFIX.length) : '')
  return DOCUMENT_TRANSFER_ID.test(value) ? value : undefined
}

export function isDocumentTransferDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(DOCUMENT_TRANSFER_MIME) || Boolean(documentTransferToken(dataTransfer))
}
