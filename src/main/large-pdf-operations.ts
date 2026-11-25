import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { PDF_EDIT_SLICE_MAX_BYTES, type LargePdfBookmark, type LargePdfOutput } from '../shared/contracts'
import type { StagedPdfPage } from './pdf-range-files'
import { convertPdfFileToEps } from './eps-export'

const execute = promisify(execFile)

export function bundledQpdf(resourcesPath: string, appPath: string): string {
  const binary = join(`${process.platform}-${process.arch}`, 'bin', process.platform === 'win32' ? 'qpdf.exe' : 'qpdf')
  const bundled = join(resourcesPath, 'qpdf', binary)
  const development = join(appPath, 'resources', 'qpdf', binary)
  return existsSync(bundled) ? bundled : existsSync(development) ? development : 'qpdf'
}

async function qpdf(command: string, args: string[], maxBuffer = 1024 * 1024): Promise<string> {
  try {
    return (await execute(command, args, { windowsHide: true, timeout: 600_000, maxBuffer })).stdout.trim()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('pdf.largeEngineUnavailable')
    throw new Error('pdf.largeOperationFailed')
  }
}

async function temporary<T>(directory: string, operation: (folder: string) => Promise<T>): Promise<T> {
  const root = resolve(directory)
  const folder = await mkdtemp(join(root, '.pdfuck-'))
  try { return await operation(folder) }
  finally { if (dirname(resolve(folder)) === root) await rm(folder, { recursive: true, force: true, maxRetries: 3 }).catch(() => undefined) }
}

export async function largePdfPageCount(command: string, input: string): Promise<number> {
  const encryption = await qpdf(command, ['--warning-exit-0', '--show-encryption', input])
  if (!encryption.startsWith('File is not encrypted')) throw new Error('ui.encryptedPdfOpenedReadOnly')
  const count = Number(await qpdf(command, ['--warning-exit-0', '--show-npages', input]))
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('pdf.largeOperationFailed')
  return count
}

export function largePageNumbers(pages: number[], count: number): number[] {
  if (!Array.isArray(pages) || !pages.length || pages.length > count || new Set(pages).size !== pages.length ||
      pages.some(page => !Number.isSafeInteger(page) || page < 0 || page >= count)) throw new Error('pdf.largeInvalidPages')
  return pages
}

async function writeQpdf(command: string, folder: string, input: string, output: string, options: string[]): Promise<void> {
  const args = ['--warning-exit-0', '--stream-data=preserve', input, ...options, output]
  if (args.some(value => /[\r\n\0]/.test(value))) throw new Error('pdf.largeOperationFailed')
  const argsFile = join(folder, 'arguments')
  await writeFile(argsFile, args.join('\n') + '\n', 'utf8')
  await qpdf(command, ['@' + argsFile])
}

export async function readLargePages(command: string, input: string, pages: number[]): Promise<Uint8Array> {
  const count = await largePdfPageCount(command, input)
  const selected = largePageNumbers(pages, count)
  return temporary(tmpdir(), async folder => {
    const output = join(folder, 'pages.pdf')
    await writeQpdf(command, folder, '--empty', output, ['--pages', input, selected.map(page => page + 1).join(','), '--'])
    if ((await stat(output)).size > PDF_EDIT_SLICE_MAX_BYTES) throw new Error('pdf.largeSliceLimit')
    const bytes = await readFile(output)
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  })
}

export async function writeLargeEps(command: string, converter: string, input: string, page: number, target: string,
  confirmSource: () => Promise<string>): Promise<void> {
  await temporary(dirname(target), async folder => {
    const source = join(folder, 'page.pdf')
    const output = join(folder, 'page.eps')
    await writeQpdf(command, folder, '--empty', source, ['--pages', input, String(page + 1), '--'])
    await convertPdfFileToEps(converter, source, output)
    await confirmSource()
    await rename(output, target)
  })
}


async function updateOutlines(command: string, folder: string, input: string, output: string, bookmarks: LargePdfBookmark[]) {
  type Dict = Record<string, unknown>
  type ObjectTable = Record<string, { value: Dict }>
  const json = async (options: string[]) => JSON.parse(await qpdf(command, ['--warning-exit-0', '--json=2', ...options, input], 64 * 1024 * 1024))
  const { pages, qpdf: [header, trailer] } = await json(['--json-key=pages', '--json-key=qpdf', '--json-object=trailer']) as {
    pages: { object: string }[]; qpdf: [{ maxobjectid: number }, ObjectTable]
  }
  const rootRef = trailer.trailer.value['/Root']
  if (typeof rootRef !== 'string' || !/^\d+ \d+ R$/.test(rootRef)) throw new Error('pdf.largeOperationFailed')
  const { qpdf: [, objects] } = await json(['--json-key=qpdf', '--json-object=' + rootRef.split(' ').slice(0, 2).join(',')]) as { qpdf: [unknown, ObjectTable] }
  const catalog = objects['obj:' + rootRef]?.value
  if (!catalog) throw new Error('pdf.largeOperationFailed')
  let nextId = header.maxobjectid + 1
  let total = 0
  const add = (value: Dict) => {
    const ref = String(nextId++) + ' 0 R'
    objects['obj:' + ref] = { value }
    return ref
  }
  const build = (parent: Dict, parentRef: string, items: LargePdfBookmark[], depth: number) => {
    if (!Array.isArray(items) || depth > 16) throw new Error('pdf.largeOperationFailed')
    let prev: string | undefined
    let visible = 0
    for (const item of items) {
      if (++total > 10_000 || typeof item.title !== 'string' || !item.title.trim()) throw new Error('pdf.largeOperationFailed')
      const value: Dict = { '/Parent': parentRef, '/Title': 'u:' + item.title }
      if (Number.isInteger(item.pageIndex) && pages[item.pageIndex!]) {
        value['/Dest'] = [pages[item.pageIndex!].object, '/XYZ', Number.isFinite(item.left) ? item.left : null, Number.isFinite(item.top) ? item.top : null, null]
      } else if (typeof item.url === 'string') value['/A'] = { '/S': '/URI', '/URI': 'u:' + item.url }
      const flags = Number(Boolean(item.italic)) + 2 * Number(Boolean(item.bold))
      if (flags) value['/F'] = flags
      if (item.color && /^#[\da-f]{6}$/i.test(item.color)) value['/C'] = [1, 3, 5].map(index => parseInt(item.color!.slice(index, index + 2), 16) / 255)
      const ref = add(value)
      if (prev) { value['/Prev'] = prev; objects['obj:' + prev].value['/Next'] = ref }
      else parent['/First'] = ref
      prev = ref
      visible++
      if (item.children?.length) {
        const count = build(value, ref, item.children, depth + 1)
        value['/Count'] = item.open === false ? -count : count
        if (item.open !== false) visible += count
      }
    }
    if (prev) parent['/Last'] = prev
    return visible
  }
  if (bookmarks.length) {
    const root: Dict = { '/Type': '/Outlines' }
    const ref = add(root)
    root['/Count'] = build(root, ref, bookmarks, 1)
    catalog['/Outlines'] = ref
  } else delete catalog['/Outlines']
  const patch = join(folder, 'outlines.json')
  await writeFile(patch, JSON.stringify({ qpdf: [{ jsonversion: 2, calledgetallpages: true }, objects] }))
  await writeQpdf(command, folder, input, output, ['--update-from-json=' + patch])
}

export async function writeLargeOutput(command: string, input: string, target: string,
  request: Pick<LargePdfOutput, 'pages' | 'rotations'> & { bookmarks?: LargePdfBookmark[] },
  confirmSource: () => Promise<unknown>, edits: ReadonlyMap<number, StagedPdfPage> = new Map(),
  replace?: (output: string, target: string) => Promise<void>): Promise<void> {
  const count = await largePdfPageCount(command, input)
  if (!replace && (process.platform === 'win32' ? target.toLowerCase() === input.toLowerCase() : target === input)) {
    throw new Error('pdf.largeChooseCopy')
  }
  return temporary(dirname(target), async folder => {
    const output = join(folder, 'output.pdf')
    const options: string[] = []
    if (request.pages || edits.size) {
      const order = request.pages ? largePageNumbers(request.pages, count) : Array.from({ length: count }, (_, index) => index)
      const selections: string[] = []
      let originalPages: number[] = []
      const flushPages = () => {
        if (!originalPages.length) return
        selections.push('.', originalPages.join(','))
        originalPages = []
      }
      order.forEach((page, index) => {
        const edit = edits.get(page)
        if (edit && !edit.overlay) {
          flushPages()
          selections.push(edit.path, '1')
        } else {
          originalPages.push(page + 1)
          if (edit) options.push('--overlay', edit.path, '--to=' + (index + 1), '--')
        }
      })
      flushPages()
      options.unshift('--pages', ...selections, '--')
      const rotations = new Map<number, number[]>()
      order.forEach((page, index) => {
        const angle = request.rotations?.[page]
        if (!angle) return
        if (![-90, 90, 180, 270].includes(angle)) throw new Error('pdf.largeInvalidPages')
        if (!rotations.has(angle)) rotations.set(angle, [])
        rotations.get(angle)!.push(index + 1)
      })
      for (const [angle, positions] of rotations) options.push('--rotate=' + (angle > 0 ? '+' : '') + angle + ':' + positions.join(','))
    }
    if (request.bookmarks === undefined) await writeQpdf(command, folder, input, output, options)
    else {
      if (!Array.isArray(request.bookmarks)) throw new Error('pdf.largeOperationFailed')
      const composed = options.length ? join(folder, 'composed.pdf') : input
      if (options.length) await writeQpdf(command, folder, input, composed, options)
      await updateOutlines(command, folder, composed, output, request.bookmarks)
    }
    await confirmSource()
    await (replace ?? rename)(output, target)
  })
}
