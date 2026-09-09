// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { DOCUMENT_ARCHIVES_KEY, deleteDocumentArchive, documentPathKey, loadDocumentArchives, saveDocumentArchive } from './document-archives'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

it('persists independent named groups, renames without changing files, and deletes only the selected group', () => {
  const [first] = saveDocumentArchive('  论文 العربية  ', ['/a.pdf', '/b.pdf', '/a.pdf'])
  const second = saveDocumentArchive('日本語', ['/c.pdf'])[1]
  expect(loadDocumentArchives()).toEqual([{ ...first, name: '论文 العربية', paths: ['/a.pdf', '/b.pdf'] }, second])
  expect(saveDocumentArchive('Renamed', [], first.id)).toEqual([{ ...first, name: 'Renamed' }, second])
  expect(deleteDocumentArchive(first.id)).toEqual([second])
  expect(loadDocumentArchives()).toEqual([second])
  expect(documentPathKey('C:\\Folder\\A.PDF', 'win32')).toBe(documentPathKey('c:/folder/a.pdf', 'win32'))
  expect(documentPathKey('/A.pdf', 'darwin')).not.toBe(documentPathKey('/a.pdf', 'darwin'))
})

it('rejects empty names, missing files, stale edits and corrupt storage without overwriting saved data', () => {
  expect(() => saveDocumentArchive(' ', ['/a.pdf'])).toThrow()
  expect(() => saveDocumentArchive('name', [])).toThrow()
  saveDocumentArchive('Existing', ['/a.pdf'])
  const original = localStorage.getItem(DOCUMENT_ARCHIVES_KEY)
  expect(() => saveDocumentArchive('name', [], 'missing')).toThrow()
  expect(localStorage.getItem(DOCUMENT_ARCHIVES_KEY)).toBe(original)
  for (const corrupt of ['{', '{}', '[null]', '[{"id":"1","name":"A","paths":[null]}]']) {
    localStorage.setItem(DOCUMENT_ARCHIVES_KEY, corrupt)
    expect(() => loadDocumentArchives()).toThrow()
    expect(() => saveDocumentArchive('Another', ['/c.pdf'])).toThrow()
    expect(localStorage.getItem(DOCUMENT_ARCHIVES_KEY)).toBe(corrupt)
  }
})

it('preserves existing groups when a storage write fails', () => {
  saveDocumentArchive('Existing', ['/a.pdf'])
  const original = localStorage.getItem(DOCUMENT_ARCHIVES_KEY)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded') })
  expect(() => saveDocumentArchive('Next', ['/b.pdf'])).toThrow('quota exceeded')
  expect(localStorage.getItem(DOCUMENT_ARCHIVES_KEY)).toBe(original)
})
