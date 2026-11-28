import { afterEach, describe, expect, it } from 'vitest'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { clearQueuedRuntimeCaches, diskCacheEntries, queueRuntimeCacheRemoval, removeCachePaths } from '../../../src/main/cache-storage'
import { FeatureResourceCatalog } from '../../../src/main/feature-resources'
import { resourceStorageRoot } from '../../../src/main/resource-storage'

let temporary: string
afterEach(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }) })

describe('2.2.3 cache storage', () => {
  it.each(['win-x64', 'mac-arm64'])('handles %s profile paths and legacy copies', async target => {
    temporary = await mkdtemp(join(tmpdir(), 'pdfuck-cache-unit-'))
    const appData = target.startsWith('mac') ? join(temporary, 'Library', 'Application Support') : join(temporary, 'AppData', 'Roaming')
    const userData = join(appData, 'PDFuck')
    const sessionData = join(temporary, 'Session Data')
    const legacyRoot = join(userData, 'feature-resources')
    const catalog = new FeatureResourceCatalog(resourceStorageRoot(appData, userData), temporary, target)
    const put = async (dir: string, name: string, text: string) => { await mkdir(dir, { recursive: true }); await writeFile(join(dir, name), text) }
    await put(catalog.ocrModels, 'jpn.traineddata.gz', 'model')
    await put(join(legacyRoot, basename(catalog.ocrModels)), 'jpn.traineddata.gz', 'old')
    await put(catalog.grammar, '.ready.json', '{}')
    await put(join(catalog.root, 'downloads'), 'part.archive.part', 'archive')
    await put(join(userData, 'Local Storage'), 'memos', 'memo data')
    await put(join(sessionData, 'GPUCache'), 'sample', 'runtime data')
    await put(legacyRoot, 'proxy.json', '{"mode":"system"}')
    const outsiders = join(temporary, 'outside')
    await put(outsiders, 'private', 'protected')
    await symlink(outsiders, join(catalog.root, 'app-updates'), 'junction')

    const entries = () => diskCacheEntries(catalog, legacyRoot, userData, sessionData)
    const inventory = await entries()
    expect(inventory.find(item => item.id === 'archives')).toMatchObject({ status: 'partial', bytes: 7 })
    expect(inventory.find(item => item.id === 'grammar')).toMatchObject({ status: 'installed' })
    expect(inventory.find(item => item.id === 'updates')).toMatchObject({ status: 'empty', bytes: 0 })
    const model = inventory.find(item => item.id === 'model-jpn')!
    expect(model).toMatchObject({ status: 'installed', bytes: 8 })
    await removeCachePaths(model.paths)
    expect((await entries()).find(item => item.id === model.id)).toMatchObject({ status: 'empty', bytes: 0 })
    await queueRuntimeCacheRemoval(userData)
    expect((await entries()).find(item => item.id === 'runtime')).toMatchObject({ status: 'restart' })
    await clearQueuedRuntimeCaches(userData, sessionData)
    await expect(lstat(join(sessionData, 'GPUCache'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(join(outsiders, 'private'), 'utf8')).toBe('protected')
    expect(await readFile(join(userData, 'Local Storage', 'memos'), 'utf8')).toBe('memo data')
    expect(await readFile(join(legacyRoot, 'proxy.json'), 'utf8')).toMatch(/system/)
  })
})
