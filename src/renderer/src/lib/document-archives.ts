export const DOCUMENT_ARCHIVES_KEY = 'pdfuck.document-archives.v1'
export interface DocumentArchive { id: string; name: string; paths: string[] }

export function documentPathKey(path: string, platform: string): string {
  const normalized = path.replace(/\\/g, '/')
  return platform === 'win32' ? normalized.toLowerCase() : normalized
}

export function loadDocumentArchives(): DocumentArchive[] {
  const value: unknown = JSON.parse(localStorage.getItem(DOCUMENT_ARCHIVES_KEY) || '[]')
  if (!Array.isArray(value) || value.some(item => !item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim() || !Array.isArray(item.paths) || !item.paths.length || item.paths.some((path: unknown) => typeof path !== 'string' || !path.trim()))) throw new Error('archives.storageError')
  if (new Set(value.map(item => item.id)).size !== value.length) throw new Error('archives.storageError')
  return value
}

/** Read again before each edit so another native window's changes are retained. */
export function saveDocumentArchive(name: string, paths: string[], id?: string): DocumentArchive[] {
  const archives = loadDocumentArchives(), trimmed = name.trim()
  if (!trimmed || trimmed.length > 80 || (!id && !paths.length)) throw new Error('archives.invalid')
  const existing = id ? archives.find(item => item.id === id) : undefined
  if (id && !existing) throw new Error('archives.storageError')
  const archive = existing ? { ...existing, name: trimmed } : { id: crypto.randomUUID(), name: trimmed, paths: [...new Set(paths)] }
  const next = existing ? archives.map(item => item.id === id ? archive : item) : [...archives, archive]
  localStorage.setItem(DOCUMENT_ARCHIVES_KEY, JSON.stringify(next))
  return next
}

export function deleteDocumentArchive(id: string): DocumentArchive[] {
  const next = loadDocumentArchives().filter(item => item.id !== id)
  localStorage.setItem(DOCUMENT_ARCHIVES_KEY, JSON.stringify(next))
  return next
}
