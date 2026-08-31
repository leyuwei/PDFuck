import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { convertOfficeDocument, libreOfficeCandidates, macOfficeScript, officeImportSourceFormat, windowsOfficeScript } from './office-import'

const temporaryDirectories: string[] = []

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('cross-platform Office imports', () => {
  it('recognizes Word and PowerPoint formats without accepting unrelated files', () => {
    expect(officeImportSourceFormat('paper.DOCX')).toBe('docx')
    expect(officeImportSourceFormat('legacy.doc')).toBe('doc')
    expect(officeImportSourceFormat('slides.pptx')).toBe('pptx')
    expect(officeImportSourceFormat('slides.ppt')).toBe('ppt')
    expect(officeImportSourceFormat('sheet.xlsx')).toBeUndefined()
  })

  it('discovers LibreOffice locations on Windows, macOS, and Linux', () => {
    expect(libreOfficeCandidates({ platform: 'win32', resourcesPath: 'C:\\app', homePath: 'C:\\user', environment: { PATH: 'C:\\tools;D:\\portable', ProgramFiles: 'C:\\Program Files' } })).toContain('C:\\Program Files\\LibreOffice\\program\\soffice.exe')
    expect(libreOfficeCandidates({ platform: 'darwin', resourcesPath: '/app', homePath: '/Users/test', environment: { PATH: '/usr/local/bin' } })).toContain('/Applications/LibreOffice.app/Contents/MacOS/soffice')
    expect(libreOfficeCandidates({ platform: 'linux', resourcesPath: '/app', homePath: '/home/test', environment: { PATH: '/usr/local/bin' } })).toContain('/usr/bin/libreoffice')
  })

  it('contains native Microsoft Office fallbacks for both desktop platforms', () => {
    expect(windowsOfficeScript('word')).toContain('ExportAsFixedFormat')
    expect(windowsOfficeScript('powerpoint')).toContain('Presentations.Open')
    expect(macOfficeScript('word')).toContain('Microsoft Word')
    expect(macOfficeScript('powerpoint')).toContain('Microsoft PowerPoint')
  })

  it('converts through a discovered LibreOffice binary and validates the PDF signature', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pdfuck-office-test-'))
    temporaryDirectories.push(root)
    const bin = join(root, 'bin'), source = join(root, 'paper.docx')
    await mkdir(bin); await writeFile(source, 'DOCX fixture')
    const command = join(bin, process.platform === 'win32' ? 'soffice.exe' : 'soffice')
    await writeFile(command, '')
    const result = await convertOfficeDocument(source, {
      platform: process.platform,
      resourcesPath: root,
      homePath: root,
      temporaryPath: root,
      environment: { PATH: bin },
      execute: async (_command, args) => {
        const outputDirectory = args[args.indexOf('--outdir') + 1]
        await writeFile(join(outputDirectory, 'paper.pdf'), '%PDF-1.7\nfixture')
      }
    })
    expect(new TextDecoder().decode(result)).toContain('%PDF-1.7')
  })

  it('falls back to Microsoft Office automation on Windows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pdfuck-office-test-'))
    temporaryDirectories.push(root)
    const source = join(root, 'paper.docx')
    await writeFile(source, 'DOCX fixture')
    const result = await convertOfficeDocument(source, {
      platform: 'win32', resourcesPath: root, homePath: root, temporaryPath: root,
      environment: { PATH: '', SystemRoot: 'C:\\Windows' },
      exists: (candidate) => candidate.endsWith('powershell.exe'),
      execute: async (_command, _args, options) => { await writeFile(options.env!.PDFUCK_OFFICE_OUTPUT!, '%PDF-1.7\nword fallback') }
    })
    expect(new TextDecoder().decode(result)).toContain('word fallback')
  })

  it('falls back to Microsoft Office automation on macOS', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pdfuck-office-test-'))
    temporaryDirectories.push(root)
    const source = join(root, 'slides.pptx')
    await writeFile(source, 'PPTX fixture')
    const result = await convertOfficeDocument(source, {
      platform: 'darwin', resourcesPath: root, homePath: root, temporaryPath: root,
      environment: { PATH: '' }, exists: (candidate) => candidate === '/usr/bin/osascript',
      execute: async (_command, args) => { await writeFile(args[3], '%PDF-1.7\npowerpoint fallback') }
    })
    expect(new TextDecoder().decode(result)).toContain('powerpoint fallback')
  })

  it('reports an unavailable converter on a platform with no conversion route', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pdfuck-office-test-'))
    temporaryDirectories.push(root)
    const source = join(root, 'slides.pptx')
    await writeFile(source, 'PPTX fixture')
    await expect(convertOfficeDocument(source, { platform: 'linux', resourcesPath: root, homePath: root, temporaryPath: root, environment: { PATH: '' }, exists: () => false, execute: async () => undefined }))
      .rejects.toMatchObject({ code: 'converter-unavailable' })
  })
})
