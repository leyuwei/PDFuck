import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Cairo preserves vectors and confines unsupported transparency to local fallback regions.
 * The caller supplies a one-page PDF including all current edits. Never render a canvas. */
export async function convertPdfToEps(command: string, data: Uint8Array): Promise<Uint8Array> {
  if (!(data instanceof Uint8Array) || Buffer.from(data.subarray(0, 5)).toString() !== '%PDF-') throw new Error('ui.epsConversionFailed')
  const directory = await mkdtemp(join(tmpdir(), 'pdfuck-vector-eps-'))
  try {
    const source = join(directory, 'page.pdf'), output = join(directory, 'page.eps')
    await writeFile(source, data)
    await run(command, ['-eps', '-level3', '-r', '600', '-f', '1', '-l', '1', source, output], { windowsHide: true, timeout: 120_000, maxBuffer: 2 * 1024 * 1024 })
    const bytes = await readFile(output)
    if (!bytes.subarray(0, 80).toString().includes('EPSF-3.0')) throw new Error('ui.epsConversionFailed')
    return new Uint8Array(bytes)
  } catch { throw new Error('ui.epsConversionFailed') }
  finally { await rm(directory, { recursive: true, force: true }) }
}

/** Prefer an app-provided converter; also support GUI launches with a minimal PATH. */
export function findPdfToCairo(resourcesPath: string): string | undefined {
  const name = process.platform === 'win32' ? 'pdftocairo.exe' : 'pdftocairo'
  const directories = [join(resourcesPath, 'poppler', 'bin'), join(resourcesPath, 'poppler'), ...(process.env.PATH || '').split(delimiter), ...(process.platform === 'darwin' ? ['/opt/homebrew/bin', '/usr/local/bin'] : [])]
  return directories.filter(Boolean).map((directory) => join(directory, name)).find(existsSync)
}
