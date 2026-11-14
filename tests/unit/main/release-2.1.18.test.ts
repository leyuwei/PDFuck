import { afterEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resourceStorageRoot, migrateResourceStorage } from '../../../src/main/resource-storage'
const dirs: string[] = []
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })
it('keeps resource storage independent of application version, install location and profile name', () => {
  expect(resourceStorageRoot('/user/appdata', '/user/profile-v1')).toBe(resourceStorageRoot('/user/appdata', '/user/profile-v2'))
  expect(resourceStorageRoot('/user/appdata', '/user/profile')).toBe(join('/user/appdata', 'PDFuck-resources'))
  expect(resourceStorageRoot('/user/appdata', '/test/profile', true)).toBe(join('/test/profile', 'feature-resources'))
})
it('migrates installed payloads and partial downloads without overwriting newer files or deleting originals', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pdfuck-2118-')); dirs.push(dir)
  const old = join(dir, 'old'), next = join(dir, 'next')
  await mkdir(join(old, 'ocr-runtime'), { recursive: true }); await mkdir(join(old, 'downloads')); await mkdir(join(old, '.install-stale'))
  await writeFile(join(old, 'ocr-runtime', '.ready.json'), 'inventory'); await writeFile(join(old, 'downloads', 'model.part'), 'partial')
  await mkdir(join(next, 'ocr-runtime'), { recursive: true }); await writeFile(join(next, 'ocr-runtime', '.ready.json'), 'newer')
  await migrateResourceStorage(old, next); await migrateResourceStorage(old, next)
  expect(await readFile(join(next, 'ocr-runtime', '.ready.json'), 'utf8')).toBe('newer')
  expect(await readFile(join(next, 'downloads', 'model.part'), 'utf8')).toBe('partial')
  expect(await readFile(join(old, 'downloads', 'model.part'), 'utf8')).toBe('partial')
  await expect(readFile(join(next, '.install-stale'))).rejects.toThrow()
})
it('accepts a fresh install or already isolated root but reports real filesystem errors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pdfuck-2118-')); dirs.push(dir)
  await expect(migrateResourceStorage(join(dir, 'absent'), join(dir, 'next'))).resolves.toBeUndefined()
  await expect(migrateResourceStorage(dir, dir)).resolves.toBeUndefined()
  await writeFile(join(dir, 'file'), 'x')
  await expect(migrateResourceStorage(join(dir, 'file'), join(dir, 'next'))).rejects.toThrow()
})
it.each(['mac-arm64', 'win-x64'])('reuses a verified installed engine after migration and an app/profile upgrade on %s', async target => {
  const { FeatureResourceCatalog } = await import('../../../src/main/feature-resources')
  const { createHash } = await import('node:crypto')
  const manifest = (await import('../../../resources/feature-resources.json')).default
  const dir = await mkdtemp(join(tmpdir(), 'pdfuck-2118-')); dirs.push(dir)
  const old = join(dir, 'old', 'feature-resources'), next = resourceStorageRoot(dir, join(dir, 'new-profile'))
  const catalog = new FeatureResourceCatalog(old, '', target), payload = Buffer.from('synthetic installed engine')
  const expected = createHash('sha256').update(JSON.stringify({ engine: manifest.grammar.engine, java: manifest.grammar.runtimes[target as keyof typeof manifest.grammar.runtimes] })).digest('hex').slice(0, 20)
  await mkdir(catalog.grammar, { recursive: true }); await writeFile(join(catalog.grammar, 'engine.jar'), payload)
  await writeFile(join(catalog.grammar, '.ready.json'), JSON.stringify({ fingerprint: expected, files: { 'engine.jar': { bytes: payload.length, sha256: createHash('sha256').update(payload).digest('hex') } } }))
  await migrateResourceStorage(old, next)
  const upgraded = new FeatureResourceCatalog(next, '', target)
  await upgraded.cleanup()
  expect(await upgraded.missing({ kind: 'grammar' }, new AbortController().signal)).toEqual([])
  const restarted = new FeatureResourceCatalog(resourceStorageRoot(dir, join(dir, 'another-profile')), '', target)
  expect(await restarted.missing({ kind: 'grammar' }, new AbortController().signal)).toEqual([])
  await writeFile(join(upgraded.grammar, 'engine.jar'), 'corrupt')
  expect(await new FeatureResourceCatalog(next, '', target).missing({ kind: 'grammar' }, new AbortController().signal)).toHaveLength(2)
})
