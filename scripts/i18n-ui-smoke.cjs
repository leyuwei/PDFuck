const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { _electron: electron } = require('playwright')

const root = path.resolve(__dirname, '..')
const userData = path.join(root, 'tmp', 'i18n-ui-smoke-user')
const entry = path.join(root, 'out/main/index.js')
const pdfPath = path.join(root, 'tmp', 'Scheduling0821m.pdf')

async function launch(args = []) {
  return electron.launch({ executablePath: process.env.PDFUCK_SMOKE_EXECUTABLE || require('electron'), args: [entry, ...args], env: { ...process.env, PDFUCK_TEST_USER_DATA: userData } })
}

async function assertNoChineseControls(page, scope) {
  const copy = await page.locator(scope).allInnerTexts()
  // Operating-system printer names are external device data and must be
  // displayed and dispatched verbatim, even when they contain CJK text.
  const printerNames = await page.locator('.print-printer-select option').allInnerTexts()
  let visible = copy.join('\n').replace(/简体中文|日本語|Русский|Español/g, '')
  for (const printerName of printerNames) visible = visible.split(printerName).join('')
  assert.ok(!/[\u3400-\u9fff]/u.test(visible), `untranslated Chinese UI text in ${scope}: ${copy.join(' | ')}`)
}

// PDF pages and annotation bodies are user/document data. They may rightly contain
// Chinese while the application chrome is displayed in another language.
const interfaceControls = '.titlebar, .tool-panel, .nav-rail, .window-manager-bar, .modal-backdrop, .toast, .temporary-document-warning'

async function main() {
  // The former page-wide DOM translator caused both missed copy and a performance
  // regression. The catalogue audit owns the source scan; this smoke test keeps a
  // direct guard around the two retired split-catalogue files.
  assert.equal(fs.existsSync(path.join(root, 'src/renderer/src/components/InterfaceLanguageBridge.tsx')), false, 'legacy DOM translator must stay removed')
  assert.equal(fs.existsSync(path.join(root, 'src/renderer/src/lib/i18n-locales.ts')), false, 'split renderer locale catalogue must stay removed')

  fs.rmSync(userData, { recursive: true, force: true })
  const app = await launch()
  try {
    const page = await app.firstWindow()
    page.on('pageerror', (error) => console.error(`renderer error: ${error.message}`))
    const languages = [
      { value: 'en', view: 'View', recent: 'Recent Files', modules: ['Edit', 'Annotate', 'Save'], transferPrompt: 'Drop to Move into Document Tabs', cjkFree: true },
      { value: 'ja', view: '表示', recent: '最近開いたファイル', modules: ['編集', '注釈', '保存'], transferPrompt: 'ドロップして文書タブに戻す', cjkFree: false },
      { value: 'ru', view: 'Просмотр', recent: 'Недавние файлы', modules: ['Редактирование', 'Аннотации', 'Сохранить'], transferPrompt: 'Отпустите, чтобы вернуть во вкладки документов', cjkFree: true },
      { value: 'es', view: 'Ver', recent: 'Archivos recientes', modules: ['Editar', 'Anotar', 'Guardar'], transferPrompt: 'Suelte para mover a las pestañas del documento', cjkFree: true }
    ]
    const languageSelect = page.locator('.language-select select')
    await languageSelect.waitFor()
    assert.equal(await languageSelect.count(), 1, 'language control must be a single dropdown')
    assert.equal(await page.locator('.language-segmented').count(), 0, 'language options must not be shown as buttons')
    assert.equal(await page.locator('.language-select').evaluate((element) => Boolean(element.closest('.theme-setting'))), false, 'language dropdown must not be nested in a display-language card')
    assert.equal(await page.getByText('显示语言', { exact: true }).count(), 0, 'language dropdown must not repeat the section heading')
    for (const language of languages) {
      await languageSelect.selectOption(language.value)
      assert.equal(await languageSelect.inputValue(), language.value)
      await page.getByRole('heading', { name: language.view, exact: true }).waitFor()
      await page.getByRole('heading', { name: language.recent, exact: true }).waitFor()
      for (const module of language.modules) {
        await page.locator('.nav-rail').getByRole('button', { name: module, exact: true }).click()
        await page.getByRole('heading', { name: module, exact: true }).waitFor()
      }
      await page.locator('.nav-rail').getByRole('button', { name: language.view, exact: true }).click()
      const documentTransfer = await page.evaluateHandle(() => {
        const transfer = new DataTransfer()
        const token = '12345678-1234-1234-1234-1234567890ab'
        transfer.setData('application/x-pdfuck-document-transfer', token)
        transfer.setData('text/plain', `pdfuck-document-transfer:${token}`)
        return transfer
      })
      await page.locator('.app-shell').dispatchEvent('dragenter', { dataTransfer: documentTransfer })
      await page.getByText(language.transferPrompt, { exact: true }).waitFor()
      assert.equal(await page.locator('.drop-overlay').count(), 0, 'a document return must not use the external-file overlay')
      assert.equal(await page.locator('.document-transfer-overlay').count(), 1, 'a document return needs its own localized overlay')
      if (language.cjkFree) await assertNoChineseControls(page, '.titlebar, .tool-panel, .nav-rail, .window-manager-bar, .document-transfer-overlay')
      await page.locator('.app-shell').dispatchEvent('dragleave', { dataTransfer: documentTransfer, relatedTarget: null })
      assert.equal(await page.locator('.document-transfer-overlay').count(), 0, 'the document-return overlay must clear when the drag leaves')
    }
  } finally { await app.close() }

  const restarted = await launch()
  try {
    const page = await restarted.firstWindow()
    await page.getByRole('heading', { name: 'Ver', exact: true }).waitFor()
    await page.getByText('No hay documento abierto', { exact: true }).first().waitFor()
    assert.equal(await page.getByText('准备就绪', { exact: true }).count(), 0, 'stored initial status was not localized after restart')
    console.log(JSON.stringify({ languages: ['en', 'ja', 'ru', 'es'], persisted: 'es', domObserver: false }, null, 2))
  } finally {
    await restarted.close()
  }

  assert.ok(fs.existsSync(pdfPath), `missing PDF fixture: ${pdfPath}`)
  const documentApp = await launch([pdfPath])
  try {
    const page = await documentApp.firstWindow()
    page.on('pageerror', (error) => console.error(`renderer error: ${error.message}`))
    const documentPage = page.locator('.pdf-page[data-page="1"]')
    await documentPage.waitFor({ timeout: 60000 })
    await page.getByRole('button', { name: 'Ajustar al ancho', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Ajustar página', exact: true }).waitFor()
    assert.equal(await page.locator('.fit-control svg').count(), 2, 'both page fitting controls must be icon buttons')
    await page.locator('.nav-rail').getByRole('button', { name: 'Editar', exact: true }).click()
    await page.getByText('Añadir números de página', { exact: true }).click()
    await page.getByRole('heading', { name: 'Añadir números de página', exact: true }).waitFor()
    await page.getByText('Página + total', { exact: true }).waitFor()
    await assertNoChineseControls(page, interfaceControls)
    await page.getByRole('button', { name: 'Añadir números', exact: true }).click()
    await page.locator('.window-dirty-dot').waitFor()
    await page.locator('.text-object').first().waitFor()
    assert.equal(await page.locator('.text-object.editable').count(), 0, 'page numbers must not become individually draggable text objects')
    await page.getByText('Añadir números de página', { exact: true }).click()
    await page.getByText('Se detectaron números de página', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Eliminar números añadidos', exact: true }).click()
    await page.locator('.text-object').first().waitFor({ state: 'detached' })
    await page.keyboard.press('Control+z')
    await page.locator('.text-object').first().waitFor()
    await page.keyboard.press('Control+z')
    await page.locator('.text-object').first().waitFor({ state: 'detached' })
    await page.locator('.window-dirty-dot').waitFor({ state: 'detached' })
    await page.locator('.nav-rail').getByRole('button', { name: 'Anotar', exact: true }).click()
    await page.waitForTimeout(150)
    for (const label of ['Lista de anotaciones', 'Resumen de respuestas', 'Tamaño de texto de la lista', 'Una línea', 'Laboratorio', 'Edición con IA']) {
      await page.getByText(label, { exact: true }).first().waitFor()
    }
    for (const chinese of ['批注列表', '回复统计', '列表字号', '单行', '实验室', '智能润色', '适合宽度']) {
      assert.equal(await page.getByText(chinese, { exact: true }).count(), 0, `untranslated UI label: ${chinese}`)
    }
    await page.locator('.annotation-lab-launch').click()
    for (const label of ['Explicación sencilla', 'Mejorar la lógica', 'Solo gramática', 'Redacción natural', 'Resolver incoherencias', 'Destacar puntos fuertes']) {
      await page.locator('.ai-polish-window').getByText(label, { exact: true }).waitFor()
    }
    await assertNoChineseControls(page, '.ai-polish-window')
    await page.locator('.ai-polish-window').getByRole('button', { name: 'Cerrar', exact: true }).click()
    const temporaryWarning = page.locator('.temporary-document-warning')
    if (await temporaryWarning.count()) {
      await temporaryWarning.getByText('Este archivo puede estar en una carpeta temporal. Guárdelo en otro lugar para no perderlo.', { exact: true }).waitFor()
    }
    await page.locator('.nav-rail').getByRole('button', { name: 'Guardar', exact: true }).click()
    await page.getByText('Seleccionar páginas e imprimir…', { exact: true }).click()
    await page.getByRole('heading', { name: 'Configuración y vista previa de impresión', exact: true }).waitFor()
    assert.equal(await page.locator('.page-selection-dialog').count(), 0, 'printing must not open a separate page-selection dialog')
    await page.getByText('15 páginas del documento · 15 hojas', { exact: true }).waitFor()
    await page.getByText('15 páginas usarán 15 hojas', { exact: true }).waitFor()
    const automaticOrientation = page.getByText('A4 · Adaptación automática', { exact: true })
    await automaticOrientation.waitFor({ state: 'attached' })
    await automaticOrientation.scrollIntoViewIfNeeded()
    await automaticOrientation.waitFor()
    assert.equal(await page.locator('.print-page-strip button').count(), 15, 'page selection must live inside the print preview')
    await assertNoChineseControls(page, interfaceControls)
    assert.equal(await page.getByText('15 个文档页面 · 15 张纸', { exact: true }).count(), 0, 'print overview was not localized')
    await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click()
    await page.locator('.nav-rail').getByRole('button', { name: 'Anotar', exact: true }).click()
    await documentPage.click({ button: 'right', position: { x: 120, y: 120 } })
    await page.locator('.context-menu').waitFor()
    await page.locator('.context-menu').getByText('Nota', { exact: true }).waitFor()
    await assertNoChineseControls(page, '.context-menu')
    assert.equal(await page.getByText('自由批注', { exact: true }).count(), 0, 'PDF context menu was not localized')
    await page.keyboard.press('Escape')

    await page.locator('.nav-rail').getByRole('button', { name: 'Ver', exact: true }).click()
    const documentLanguage = page.locator('.language-select select')
    await documentLanguage.selectOption('ru')
    await page.getByRole('heading', { name: 'Просмотр', exact: true }).waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: 'Редактирование', exact: true }).click()
    await page.getByText('Управление страницами…', { exact: true }).click()
    await page.getByRole('heading', { name: 'Управление страницами', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Раскадровка страниц', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Применить изменения', exact: true }).waitFor()
    assert.equal(await page.locator('.page-manager-card').count(), 15, 'page manager must preview the visible Russian document group')
    await assertNoChineseControls(page, interfaceControls)
    await page.getByRole('button', { name: 'Отмена', exact: true }).last().click()

    await page.locator('.nav-rail').getByRole('button', { name: 'Просмотр', exact: true }).click()
    await documentLanguage.selectOption('ja')
    await page.getByRole('heading', { name: '表示', exact: true }).waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: '注釈', exact: true }).click()
    await page.getByText('注釈リスト', { exact: true }).waitFor()
  } finally {
    await documentApp.close()
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
