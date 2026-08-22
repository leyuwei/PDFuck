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
  const visible = copy.join('\n').replace(/简体中文|日本語|Русский|Español/g, '')
  assert.ok(!/[\u3400-\u9fff]/u.test(visible), `untranslated Chinese UI text in ${scope}: ${copy.join(' | ')}`)
}

async function main() {
  // The performance regression was caused by a page-wide MutationObserver.
  // Keep this source-level guard so it cannot quietly return in a future release.
  const legacyTranslator = fs.readFileSync(path.join(root, 'src/renderer/src/components/InterfaceLanguageBridge.tsx'), 'utf8')
  assert.ok(!legacyTranslator.includes('MutationObserver'), 'i18n must not observe and rewrite the DOM')

  fs.rmSync(userData, { recursive: true, force: true })
  const app = await launch()
  try {
    const page = await app.firstWindow()
    const languages = [
      { value: 'en', view: 'View', recent: 'Recent Files', modules: ['Edit', 'Annotate', 'Save'], cjkFree: true },
      { value: 'ja', view: '表示', recent: '最近開いたファイル', modules: ['編集', '注釈', '保存'], cjkFree: false },
      { value: 'ru', view: 'Просмотр', recent: 'Недавние файлы', modules: ['Редактирование', 'Аннотации', 'Сохранить'], cjkFree: true },
      { value: 'es', view: 'Ver', recent: 'Archivos recientes', modules: ['Editar', 'Anotar', 'Guardar'], cjkFree: true }
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
      if (language.cjkFree) await assertNoChineseControls(page, '.titlebar, .tool-panel, .nav-rail, .window-manager-bar')
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
    const documentPage = page.locator('.pdf-page[data-page="1"]')
    await documentPage.waitFor({ timeout: 60000 })
    await page.getByText('Ajustar al ancho', { exact: true }).waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: 'Anotar', exact: true }).click()
    await page.waitForTimeout(150)
    for (const label of ['Lista de anotaciones', 'Resumen de respuestas', 'Tamaño de texto de la lista', 'Una línea', 'Laboratorio', 'Edición con IA']) {
      await page.getByText(label, { exact: true }).first().waitFor()
    }
    for (const chinese of ['批注列表', '回复统计', '列表字号', '单行', '实验室', '智能润色', '适合宽度']) {
      assert.equal(await page.getByText(chinese, { exact: true }).count(), 0, `untranslated UI label: ${chinese}`)
    }
    const temporaryWarning = page.locator('.temporary-document-warning')
    if (await temporaryWarning.count()) {
      await temporaryWarning.getByText('This file may be in a temporary folder. Save it elsewhere to avoid losing it.', { exact: true }).waitFor()
    }
    await page.locator('.nav-rail').getByRole('button', { name: 'Guardar', exact: true }).click()
    await page.getByText('Seleccionar páginas e imprimir…', { exact: true }).click()
    await page.getByText('15 páginas seleccionadas', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Imprimir las 15 páginas seleccionadas', exact: true }).waitFor()
    await assertNoChineseControls(page, 'body')
    assert.equal(await page.getByText('已选择 15 页', { exact: true }).count(), 0, 'page-selection summary was not localized')
    await page.getByRole('button', { name: 'Imprimir las 15 páginas seleccionadas', exact: true }).click()
    await page.getByText('15 páginas del documento · 15 hojas', { exact: true }).waitFor()
    await page.getByText('15 páginas usarán 15 hojas', { exact: true }).waitFor()
    await assertNoChineseControls(page, 'body')
    assert.equal(await page.getByText('15 个文档页面 · 15 张纸', { exact: true }).count(), 0, 'print overview was not localized')
    await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click()
    await page.locator('.nav-rail').getByRole('button', { name: 'Anotar', exact: true }).click()
    await documentPage.click({ button: 'right', position: { x: 120, y: 120 } })
    await page.locator('.context-menu').waitFor()
    await page.locator('.context-menu').getByText('Nota', { exact: true }).waitFor()
    await assertNoChineseControls(page, 'body')
    assert.equal(await page.getByText('自由批注', { exact: true }).count(), 0, 'PDF context menu was not localized')
    await page.keyboard.press('Escape')

    await page.locator('.nav-rail').getByRole('button', { name: 'Ver', exact: true }).click()
    const documentLanguage = page.locator('.language-select select')
    await documentLanguage.selectOption('ru')
    await page.getByRole('heading', { name: 'Просмотр', exact: true }).waitFor()
    await page.locator('.nav-rail').getByRole('button', { name: 'Редактирование', exact: true }).click()
    await page.getByText('Удалить страницы…', { exact: true }).click()
    await page.getByText('Массовое удаление страниц', { exact: true }).waitFor()
    await assertNoChineseControls(page, 'body')
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
