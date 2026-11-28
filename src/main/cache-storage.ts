import { lstat, readdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import manifest from '../../resources/feature-resources.json'
import type { CacheEntry } from '../shared/cache'
import { OCR_LANGUAGES, type OcrLanguage } from '../shared/ocr'
import type { FeatureResourceCatalog } from './feature-resources'
import { atomicWrite } from './atomic-write'
import { downloadPath } from './resource-download'

const runtimeCaches = ['Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'ShaderCache', 'GrShaderCache', 'GraphiteDawnCache']
const runtimeMarker = (userData: string) => join(userData, 'clear-runtime-cache')

async function fileInfo(path: string) {
  try { return await lstat(path) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
}

async function children(path: string) {
  return (await fileInfo(path))?.isDirectory() ? await readdir(path) : []
}

async function size(path: string): Promise<number> {
  const info = await fileInfo(path)
  if (!info || info.isSymbolicLink()) return 0
  if (!info.isDirectory()) return info.size
  let bytes = 0
  for (const name of await readdir(path)) bytes += await size(join(path, name))
  return bytes
}

export async function queueRuntimeCacheRemoval(userData: string) {
  await atomicWrite(runtimeMarker(userData), Buffer.from('1'))
}

export async function clearQueuedRuntimeCaches(userData: string, sessionData: string) {
  const marker = runtimeMarker(userData)
  if (!await fileInfo(marker)) return
  await removeCachePaths(runtimeCaches.map(name => join(sessionData, name)))
  await rm(marker, { force: true })
}

export async function removeCachePaths(paths: string[]) {
  for (const path of paths) await rm(path, { recursive: true, force: true, maxRetries: 2 })
}

type DiskEntry = CacheEntry & { paths: string[] }
export async function diskCacheEntries(catalog: FeatureResourceCatalog, legacyRoot: string, userData: string, sessionData: string): Promise<DiskEntry[]> {
  const roots = [...new Set([catalog.root, legacyRoot])]
  const groups = await Promise.all(roots.map(async root => ({ root, names: await children(root) })))
  const matching = (pattern: RegExp) => groups.flatMap(({ root, names }) => names.filter(name => pattern.test(name)).map(name => join(root, name)))
  const modelDirs = matching(/^models-[a-f0-9]{20}$/)
  const ocrDirs = matching(/^ocr-[a-f0-9]{20}$/)
  const grammarDirs = matching(/^grammar-[a-f0-9]{20}$/)
  const archiveDirs = matching(/^downloads$/)
  const updateDirs = matching(/^app-updates$/)
  const describe = async (id: string, group: CacheEntry['group'], kind: CacheEntry['kind'], paths: string[], extra: Partial<CacheEntry> = {}): Promise<DiskEntry> => {
    try {
      const bytes = (await Promise.all(paths.map(size))).reduce((total, n) => total + n, 0)
      return { id, group, kind, paths, bytes, status: bytes ? 'stored' : 'empty', ...extra }
    } catch { return { id, group, kind, paths, bytes: 0, ...extra, status: 'unknown' } }
  }
  // Guard nested model paths against linked directories and ignore unrelated profile files.
  const modelFiles = await Promise.all(modelDirs.map(async dir => ({ dir, names: await children(dir) })))
  const archives = await Promise.all(archiveDirs.map(async dir => ({ dir, names: await children(dir) })))
  const archivePaths = archives.flatMap(({ dir, names }) => names.map(name => join(dir, name)))
  const archiveSpecs = [
    ...manifest.ocr.packages.map(asset => [asset, asset.id.replace(/^node_modules\//, '')] as const),
    ...Object.entries(manifest.ocr.models).map(([language, asset]) => [asset, OCR_LANGUAGES[language as OcrLanguage]] as const),
    [manifest.grammar.engine, 'LanguageTool'] as const,
    ...Object.values(manifest.grammar.runtimes).map(asset => [asset, 'Java (Temurin)'] as const)
  ]
  const archiveNames = archivePaths.map(path => basename(path))
  const cachedLibraries = archiveSpecs.flatMap(([asset, name]) => {
    const file = basename(downloadPath(catalog.root, asset))
    return archiveNames.some(value => value === file || value === `${file}.part`) ? [name] : []
  })
  const updateNames = (await Promise.all(updateDirs.map(children))).flat().filter(name => /^PDFuck-[\w.-]+\.(?:exe|dmg)$/i.test(name))
  const staged = await fileInfo(runtimeMarker(userData))
  const currentOcr = ocrDirs.includes(catalog.ocrRuntime) && (await children(catalog.ocrRuntime)).includes('.ready.json')
  const currentGrammar = grammarDirs.includes(catalog.grammar) && (await children(catalog.grammar)).includes('.ready.json')
  return Promise.all([
    describe('runtime', 'app', 'runtime', runtimeCaches.map(name => join(sessionData, name)), staged ? { status: 'restart' } : {}),
    describe('ocr', 'libraries', 'ocrEngine', ocrDirs, currentOcr ? { status: 'installed', detail: `Tesseract.js ${manifest.ocr.version}` } : {}),
    describe('grammar', 'libraries', 'grammar', grammarDirs, currentGrammar ? { status: 'installed', detail: `LanguageTool ${manifest.grammar.engine.version} · Java (Temurin)` } : {}),
    describe('archives', 'libraries', 'archives', archiveDirs, { detail: [...new Set(cachedLibraries)].join(' · '), ...(archiveNames.some(name => name.endsWith('.part')) ? { status: 'partial' } : {}) }),
    ...Object.keys(OCR_LANGUAGES).map(code => {
      const language = code as OcrLanguage
      const modelName = `${language}.traineddata.gz`
      const paths = modelFiles.flatMap(({ dir, names }) => names.filter(name => name === modelName || name === `${modelName}.tmp`).map(name => join(dir, name)))
      const installed = paths.some(path => path === join(catalog.ocrModels, modelName))
      return describe(`model-${language}`, 'libraries', 'model', paths, { language, ...(installed ? { status: 'installed' } : paths.length ? { status: 'partial' } : {}) })
    }),
    describe('updates', 'updates', 'update', updateDirs, { detail: [...new Set(updateNames)].join(' · ') })
  ])
}
