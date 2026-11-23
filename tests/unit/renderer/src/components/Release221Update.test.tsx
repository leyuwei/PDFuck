// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { AboutDialog } from '../../../../../src/renderer/src/components/AboutDialog'
import { AppUpdateDownload } from '../../../../../src/renderer/src/components/AppUpdateDownload'
import { UpdateDialog } from '../../../../../src/renderer/src/components/Dialogs'
import { setInterfaceLanguage } from '../../../../../src/renderer/src/lib/i18n'
import { INTERFACE_LANGUAGES, translateMessage } from '../../../../../src/shared/i18n-catalogue'
import type { AppUpdateState } from '../../../../../src/shared/app-update'

vi.mock('../../../../../src/renderer/src/lib/pdfjs', () => ({ AnnotationMode: { DISABLE: 0 } }))

it('localizes both automatic download entry points and the two manual actions in every UI language', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  const update = { status: 'available', currentVersion: '2.2.0', latestVersion: '2.2.1', releaseUrl: '', canDownload: true } as const
  const ready: AppUpdateState = { version: '2.2.1', name: 'PDFuck-2.2.1-Windows-Setup.exe', phase: 'ready', downloaded: 20, total: 20, speed: 0 }
  const installUpdate = vi.fn(async () => {})
  const openUpdateFolder = vi.fn().mockRejectedValueOnce(new Error('Folder cannot open')).mockResolvedValue(undefined)
  const noop = () => {}
  Object.assign(window, { desktop: { checkForUpdates: async () => update, onUpdateState: () => noop, updateState: async () => ready, installUpdate, openUpdateFolder } })
  try {
    await act(async () => root.render(<>
      <AboutDialog version="2.2.0" onClose={noop} />
      <UpdateDialog update={update} onLater={noop} onSkip={noop} onDownload={noop} />
      <AppUpdateDownload />
    </>))
    for (const language of INTERFACE_LANGUAGES) {
      const label = (key: Parameters<typeof translateMessage>[1]) => translateMessage(language, key)
      await act(async () => { setInterfaceLanguage(language) })
      expect(document.querySelector('.about-dialog .primary')?.textContent).toBe(label('ui.download'))
      expect(document.querySelector('.update-actions .primary')?.textContent).toBe(label('ui.download'))
      expect([...document.querySelectorAll('.update-download-backdrop footer button')].map(button => button.textContent)).toEqual([label('ui.openFolder'), label('updates.install')])
      expect(document.querySelector('.update-download-backdrop [role="status"]')?.textContent).toBe(label('updates.ready'))
      expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr')
    }
    expect(translateMessage('zh', 'ui.download')).toBe('自动下载')
    expect(installUpdate).not.toHaveBeenCalled()

    const [folder, install] = [...document.querySelectorAll<HTMLButtonElement>('.update-download-backdrop footer button')]
    await act(async () => folder.click())
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(translateMessage('ar', 'updates.folderUnavailable'))
    await act(async () => folder.click())
    expect(openUpdateFolder).toHaveBeenCalledTimes(2)
    expect(installUpdate).not.toHaveBeenCalled()
    await act(async () => install.click())
    expect(installUpdate).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
    setInterfaceLanguage('zh')
    document.body.innerHTML = ''
  }
})
