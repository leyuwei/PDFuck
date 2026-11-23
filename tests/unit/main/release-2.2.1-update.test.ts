import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { expect, it, vi } from 'vitest'
import { AppUpdateDownload, selectUpdateAsset } from '../../../src/main/app-update'
import { prepareUpdateLaunch } from '../../../src/main/update-installer'

const { openPath, spawn } = vi.hoisted(() => ({ openPath: vi.fn(), spawn: vi.fn() }))
vi.mock('electron', () => ({ shell: { openPath } }))
vi.mock('node:child_process', () => ({ spawn }))

it('defers the Windows shell launch and reports a refused elevation as a handled failure', async () => {
  const file = 'C:\\Users\\Test User\\更新\\PDFuck-2.2.1-Windows-Setup.exe'
  openPath.mockReset().mockResolvedValueOnce('').mockResolvedValueOnce('Access denied or UAC canceled')
  const launch = await prepareUpdateLaunch('', file, '2.2.1', '', 'win32', 'x64', '')
  expect(openPath).not.toHaveBeenCalled()
  await expect(launch()).resolves.toBeUndefined()
  expect(openPath).toHaveBeenCalledWith(file)
  await expect(launch()).rejects.toThrow('Access denied or UAC canceled')
  expect(spawn).not.toHaveBeenCalled()
})

it('handles an asynchronous macOS helper startup error and preserves the exit wait', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdfuck-mac-update-'))
  try {
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() })
    spawn.mockReturnValueOnce(child)
    const launch = await prepareUpdateLaunch(root, '/tmp/PDFuck.dmg', '2.2.1', '/Applications/PDFuck.app/Contents/MacOS/PDFuck', 'darwin', 'arm64', 'Installation failed')
    const script = await readFile(join(root, 'install-update.sh'), 'utf8')
    expect(script).toContain(`while /bin/kill -0 ${process.pid}`)
    const pending = launch()
    child.emit('error', new Error('EACCES'))
    await expect(pending).rejects.toThrow('EACCES')
    expect(child.unref).not.toHaveBeenCalled()
  } finally { await rm(root, { force: true, recursive: true }) }
})

it('retains the verified package through install cancellation and repairs a damaged copy on retry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdfuck-update-'))
  try {
    const data = Buffer.from('synthetic installer')
    const name = 'PDFuck-2.2.1-Windows-Setup.exe'
    const asset = selectUpdateAsset([{
      name, size: data.length,
      digest: 'sha256:' + createHash('sha256').update(data).digest('hex'),
      browser_download_url: 'https://github.com/leyuwei/PDFuck/releases/download/v2.2.1/' + name
    }], 'win32', 'x64')!
    const notify = vi.fn()
    const transport = vi.fn(async () => ({ status: 200, headers: {}, body: Readable.from([data]), close() {} }))
    const service = new AppUpdateDownload(root, transport, notify)
    await service.prepare('2.2.1', asset)
    service.action('start')
    await service.settled()
    expect(notify.mock.lastCall?.[0]).toMatchObject({ phase: 'ready', downloaded: data.length })
    const installer = await service.installer()

    service.setInstalling(true)
    service.action('cancel')
    service.setInstalling(false, 'updates.installUnavailable')
    expect(service.state).toMatchObject({ phase: 'ready', installing: false, error: 'updates.installUnavailable' })
    await service.prepare('2.2.1', asset)
    service.action('start')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(await readFile(await service.installer())).toEqual(data)

    await writeFile(installer, Buffer.alloc(data.length))
    await expect(service.installer()).rejects.toThrow('updates.unavailable')
    expect(service.state).toMatchObject({ phase: 'error', error: 'resources.checksum' })
    service.action('start')
    await service.settled()
    expect(await readFile(await service.installer())).toEqual(data)
    expect(transport).toHaveBeenCalledTimes(1)
  } finally { await rm(root, { force: true, recursive: true }) }
})
