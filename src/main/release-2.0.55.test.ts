import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesktopApi } from '../shared/contracts'
import { returnFocusToWindow, showAndFocusWindow } from './window-focus'

const electron = vi.hoisted(() => ({
  app: { show: vi.fn(), focus: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  webUtils: {}
}))
vi.mock('electron', () => electron)
import '../preload/index'
const desktop = electron.contextBridge.exposeInMainWorld.mock.calls[0][1] as DesktopApi

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

function windowDouble(minimized = false, destroyed = false) {
  return { isDestroyed: () => destroyed, isMinimized: () => minimized, restore: vi.fn(), show: vi.fn(), focus: vi.fn(), webContents: { focus: vi.fn() } }
}

describe('2.0.55 macOS regressions', () => {
  it('activates the macOS application before focusing a restored window', () => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' })
    const window = windowDouble(true)
    showAndFocusWindow(window)
    expect(window.restore).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledOnce()
    expect(electron.app.show).toHaveBeenCalledOnce()
    expect(electron.app.focus).toHaveBeenCalledWith({ steal: true })
    expect(window.focus).toHaveBeenCalledOnce()
    expect(window.show.mock.invocationCallOrder[0]).toBeLessThan(electron.app.focus.mock.invocationCallOrder[0])
    expect(electron.app.focus.mock.invocationCallOrder[0]).toBeLessThan(window.focus.mock.invocationCallOrder[0])
    expect(window.webContents.focus).not.toHaveBeenCalled()
  })

  it('does not activate the app for a destroyed window or ordinary focus return', () => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' })
    const destroyed = windowDouble(false, true), live = windowDouble()
    showAndFocusWindow(destroyed)
    returnFocusToWindow(destroyed)
    returnFocusToWindow(live)
    expect(destroyed.show).not.toHaveBeenCalled()
    expect(destroyed.focus).not.toHaveBeenCalled()
    expect(live.focus).toHaveBeenCalledOnce()
    expect(electron.app.focus).not.toHaveBeenCalled()
  })

  it.each(['win32', 'linux'])('preserves %s window behavior without macOS APIs', (platform) => {
    vi.stubGlobal('process', { ...process, platform })
    const window = windowDouble()
    showAndFocusWindow(window)
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    expect(window.restore).not.toHaveBeenCalled()
    expect(electron.app.show).not.toHaveBeenCalled()
    expect(electron.app.focus).not.toHaveBeenCalled()
  })

  it('queries native fullscreen and unsubscribes the exact bridge listener', async () => {
    electron.ipcRenderer.invoke.mockResolvedValueOnce(true)
    expect(await desktop.windowIsFullScreen()).toBe(true)
    expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith('window:is-full-screen')
    const callback = vi.fn(), off = desktop.onWindowFullScreen(callback)
    const [channel, listener] = electron.ipcRenderer.on.mock.calls[0]
    expect(channel).toBe('window:full-screen')
    listener({}, true); listener({}, false)
    expect(callback.mock.calls).toEqual([[true], [false]])
    off()
    expect(electron.ipcRenderer.removeListener).toHaveBeenCalledWith(channel, listener)
  })

  it('declares one PDF editor association with a dedicated native icon', () => {
    const metadata = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
    const lock = JSON.parse(readFileSync(resolve('package-lock.json'), 'utf8'))
    expect([metadata.version, lock.version, lock.packages[''].version]).toEqual([metadata.version, metadata.version, metadata.version])
    expect(metadata.build.fileAssociations).toBeUndefined()
    expect(metadata.build.mac.extendInfo.CFBundleDocumentTypes).toContainEqual({
      CFBundleTypeName: 'PDF Document', CFBundleTypeExtensions: ['pdf'], LSItemContentTypes: ['com.adobe.pdf'],
      CFBundleTypeRole: 'Editor', LSHandlerRank: 'Default', CFBundleTypeIconFile: 'pdf.icns'
    })
    expect(metadata.build.mac.extraResources).toContainEqual({ from: 'resources/pdf.icns', to: 'pdf.icns' })
    expect(metadata.build.win.fileAssociations[0].ext).toBe('pdf')
  })

  it('includes native small icons and all Retina resolutions without truncated ICNS data', () => {
    const icon = readFileSync(resolve('resources/pdf.icns')), chunks = new Map<string, Buffer>()
    expect(icon.toString('ascii', 0, 4)).toBe('icns')
    expect(icon.readUInt32BE(4)).toBe(icon.length)
    let offset = 8
    while (offset < icon.length) {
      const size = icon.readUInt32BE(offset + 4)
      expect(size).toBeGreaterThan(8)
      expect(offset + size).toBeLessThanOrEqual(icon.length)
      chunks.set(icon.toString('ascii', offset, offset + 4), icon.subarray(offset + 8, offset + size))
      offset += size
    }
    expect(offset).toBe(icon.length)
    for (const type of ['ic04', 'ic05']) expect(chunks.get(type)?.toString('ascii', 0, 4)).toBe('ARGB')
    for (const [type, pixels] of Object.entries({ ic07: 128, ic08: 256, ic09: 512, ic10: 1024, ic11: 32, ic12: 64, ic13: 256, ic14: 512 })) {
      const png = chunks.get(type)!
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([pixels, pixels])
    }
  })
})
