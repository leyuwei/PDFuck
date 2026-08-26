const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const cataloguePath = path.join(root, 'src/shared/i18n-catalogue.ts')
const rendererRoot = path.join(root, 'src/renderer/src')
const languages = ['zh', 'en', 'ja', 'ru', 'es']
const translatedLanguages = ['en', 'ja', 'ru', 'es']
const failures = []

function fail(message) { failures.push(message) }
function sourceFile(file) { return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS) }
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? walk(path.join(directory, entry.name))
    : /\.(?:ts|tsx)$/u.test(entry.name) ? [path.join(directory, entry.name)] : [])
}
function propertyName(property) {
  if (!property.name) return null
  return ts.isStringLiteralLike(property.name) || ts.isIdentifier(property.name) || ts.isNumericLiteral(property.name) ? property.name.text : null
}
function location(file, source, node) {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source))
  return `${path.relative(root, file)}:${position.line + 1}`
}
function findObject(source, name) {
  let object
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      let initializer = node.initializer
      while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer))) initializer = initializer.expression
      if (initializer && ts.isObjectLiteralExpression(initializer)) object = initializer
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!object) throw new Error(`Missing object declaration: ${name}`)
  return object
}
function literalRecord(object, context) {
  const result = new Map()
  for (const property of object.properties) {
    const key = propertyName(property)
    if (!key || !ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) {
      fail(`Invalid string entry in ${context}`)
      continue
    }
    if (!property.initializer.text.trim()) fail(`Empty translation in ${context}.${key}`)
    if (result.has(key)) fail(`Duplicate key in ${context}: ${key}`)
    result.set(key, property.initializer.text)
  }
  return result
}
function nestedRecord(object, context) {
  const result = new Map()
  for (const property of object.properties) {
    const key = propertyName(property)
    if (!key || !ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) {
      fail(`Invalid locale object in ${context}`)
      continue
    }
    result.set(key, literalRecord(property.initializer, `${context}.${key}`))
  }
  return result
}
function placeholders(value) { return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/gu)].map((match) => match[1]).sort().join(',') }

const catalogueSource = sourceFile(cataloguePath)
const english = literalRecord(findObject(catalogueSource, 'englishPhrases'), 'englishPhrases')
const localeBase = nestedRecord(findObject(catalogueSource, 'localePhrases'), 'localePhrases')
const additions = nestedRecord(findObject(catalogueSource, 'phraseTranslations'), 'phraseTranslations')
const parameterMessages = nestedRecord(findObject(catalogueSource, 'parameterMessages'), 'parameterMessages')
const catalogue = { en: new Map(english), ja: new Map(localeBase.get('ja')), ru: new Map(localeBase.get('ru')), es: new Map(localeBase.get('es')) }

for (const [source, variants] of additions) {
  for (const language of translatedLanguages) {
    const value = variants.get(language)
    if (!value?.trim()) fail(`Missing ${language} translation in phraseTranslations: ${source}`)
    else catalogue[language].set(source, value)
  }
  for (const language of variants.keys()) if (!translatedLanguages.includes(language)) fail(`Unknown phraseTranslations locale ${language}: ${source}`)
}

const allCatalogueKeys = new Set(translatedLanguages.flatMap((language) => [...catalogue[language].keys()]))
for (const source of allCatalogueKeys) {
  for (const language of translatedLanguages) if (!catalogue[language].get(source)?.trim()) fail(`Catalogue key lacks ${language}: ${source}`)
}
for (const language of localeBase.keys()) if (!['ja', 'ru', 'es'].includes(language)) fail(`Unexpected localePhrases language: ${language}`)

const expectedParameterKeys = new Set(parameterMessages.get('zh')?.keys() || [])
for (const language of languages) {
  const messages = parameterMessages.get(language)
  if (!messages) { fail(`Missing parameterMessages locale: ${language}`); continue }
  for (const key of expectedParameterKeys) {
    const sourceValue = parameterMessages.get('zh').get(key)
    const translated = messages.get(key)
    if (!translated?.trim()) fail(`Missing parameter message ${language}.${key}`)
    else if (placeholders(sourceValue) !== placeholders(translated)) fail(`Placeholder mismatch in ${language}.${key}: expected {${placeholders(sourceValue)}}; received {${placeholders(translated)}}`)
  }
  for (const key of messages.keys()) if (!expectedParameterKeys.has(key)) fail(`Extra parameter message ${language}.${key}`)
}
for (const language of parameterMessages.keys()) if (!languages.includes(language)) fail(`Unexpected parameterMessages language: ${language}`)

function requireCatalogue(value, where) {
  if (!allCatalogueKeys.has(value)) fail(`Text is not in the shared catalogue: ${JSON.stringify(value)} (${where})`)
}
function requireMessageKey(value, where) {
  if (!expectedParameterKeys.has(value) && !allCatalogueKeys.has(value)) fail(`Unknown i18n key: ${JSON.stringify(value)} (${where})`)
}

const invariantVisibleCopy = new Set([
  'PDF', 'PDFuck', 'uck', 'v', '© 2026 github@leyuwei',
  'BigModel Plan', 'Doubao', 'DeepSeek', 'KIMI',
  'A−', 'A＋', 'Aa', 'B', 'I',
  'A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid',
  '简体中文', 'English', '日本語', 'Русский', 'Español',
  'Ctrl+F', 'Ctrl+C', 'PNG', 'JPG', 'EPS', 'DPI'
])
function normalizedVisible(value) { return value.replace(/\s+/gu, ' ').trim() }
function checkRawVisible(value, where) {
  const normalized = normalizedVisible(value)
  if (!normalized || !/[\p{L}\p{N}]/u.test(normalized)) return
  if (!invariantVisibleCopy.has(normalized)) fail(`Raw visible copy must use i18n (or be an audited invariant): ${JSON.stringify(normalized)} (${where})`)
}
function unwrap(expression) {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression)) expression = expression.expression
  return expression
}
function checkRenderableExpression(expression, file, source) {
  if (!expression) return
  expression = unwrap(expression)
  if (ts.isStringLiteralLike(expression)) checkRawVisible(expression.text, location(file, source, expression))
  else if (ts.isTemplateExpression(expression)) {
    checkRawVisible(expression.head.text, location(file, source, expression.head))
    for (const span of expression.templateSpans) checkRawVisible(span.literal.text, location(file, source, span.literal))
  } else if (ts.isConditionalExpression(expression)) {
    checkRenderableExpression(expression.whenTrue, file, source)
    checkRenderableExpression(expression.whenFalse, file, source)
  } else if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    checkRenderableExpression(expression.left, file, source)
    checkRenderableExpression(expression.right, file, source)
  }
}

const rendererFiles = walk(rendererRoot).filter((file) => !file.includes('.test.') && !file.endsWith('i18n.ts'))
const mainFiles = walk(path.join(root, 'src/main')).filter((file) => !file.includes('.test.'))
const auditedFiles = [...rendererFiles, ...mainFiles]
let uiCalls = 0
let parameterCalls = 0
let dynamicUiCalls = 0
let rawDataPhrases = 0
let userFacingErrors = 0
const allowedDynamicErrorShapes = new Set(['请求失败（${}）：${}'])

for (const file of auditedFiles) {
  const source = sourceFile(file)
  function visit(node, insideFunction = false) {
    const nextInsideFunction = insideFunction || ts.isFunctionLike(node)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text
      let argument
      if (name === 'ui' || name === 'translatePhrase') argument = node.arguments[0]
      else if (name === 'nativeText' || name === 'translateCataloguePhrase') argument = node.arguments[1]
      if (argument) {
        uiCalls += 1
        if (ts.isStringLiteralLike(argument)) requireCatalogue(argument.text, location(file, source, argument))
        else dynamicUiCalls += 1
        if (name === 'ui' && node.arguments.length !== 1) fail(`ui() accepts exactly one shared-catalogue key (${location(file, source, node)})`)
        if ((name === 'ui' || name === 'translatePhrase') && !insideFunction) fail(`Locale-sensitive translation runs at module scope (${location(file, source, node)})`)
      }
      if ((name === 't' || name === 'translateMessage') && ts.isStringLiteralLike(node.arguments[name === 't' ? 0 : 1])) {
        const key = node.arguments[name === 't' ? 0 : 1]
        parameterCalls += 1
        requireMessageKey(key.text, location(file, source, key))
      }
    }
    if (ts.isPropertyAssignment(node) && ['label', 'name'].includes(propertyName(node)) && ts.isStringLiteralLike(node.initializer) && /[\u3400-\u9fff]/u.test(node.initializer.text)) {
      rawDataPhrases += 1
      requireCatalogue(node.initializer.text, location(file, source, node.initializer))
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'THEME_COLORS' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const entry of node.initializer.elements) {
        const label = ts.isArrayLiteralExpression(entry) ? entry.elements[0] : undefined
        if (label && ts.isStringLiteralLike(label)) { rawDataPhrases += 1; requireCatalogue(label.text, location(file, source, label)) }
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Error' && node.arguments?.[0]) {
      const message = node.arguments[0]
      if (ts.isStringLiteralLike(message) && /[\u3400-\u9fff]/u.test(message.text)) {
        userFacingErrors += 1
        requireCatalogue(message.text, location(file, source, message))
      } else if (ts.isTemplateExpression(message) && /[\u3400-\u9fff]/u.test(message.getText(source))) {
        userFacingErrors += 1
        const shape = message.head.text + message.templateSpans.map((span) => '${}' + span.literal.text).join('')
        if (!allowedDynamicErrorShapes.has(shape)) fail(`Unaudited dynamic user-facing error ${JSON.stringify(shape)} (${location(file, source, message)})`)
        for (const span of message.templateSpans) {
          function checkExpressionText(child) {
            if (ts.isStringLiteralLike(child) && /[\u3400-\u9fff]/u.test(child.text)) requireCatalogue(child.text, location(file, source, child))
            ts.forEachChild(child, checkExpressionText)
          }
          checkExpressionText(span.expression)
        }
      }
    }
    if (file.endsWith(`${path.sep}App.tsx`) && ts.isStringLiteralLike(node) && /[\u3400-\u9fff]/u.test(node.text)) requireCatalogue(node.text, location(file, source, node))
    if (file.includes(`${path.sep}src${path.sep}main${path.sep}`) && ts.isStringLiteralLike(node) && /[\u3400-\u9fff]/u.test(node.text)) requireCatalogue(node.text, location(file, source, node))
    if (ts.isJsxText(node)) checkRawVisible(node.text, location(file, source, node))
    if (ts.isJsxAttribute(node) && ['title', 'placeholder', 'alt', 'aria-label', 'aria-description'].includes(node.name.text)) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) checkRawVisible(node.initializer.text, location(file, source, node.initializer))
      else if (node.initializer && ts.isJsxExpression(node.initializer)) checkRenderableExpression(node.initializer.expression, file, source)
    }
    if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) checkRenderableExpression(node.expression, file, source)
    ts.forEachChild(node, (child) => visit(child, nextInsideFunction))
  }
  visit(source)
}

for (const relative of ['src/renderer/src/components/InterfaceLanguageBridge.tsx', 'src/renderer/src/lib/i18n-locales.ts']) {
  if (fs.existsSync(path.join(root, relative))) fail(`Legacy i18n source still exists: ${relative}`)
}
for (const file of rendererFiles) {
  const contents = fs.readFileSync(file, 'utf8')
  if (/LocalizedInterfaceCopy|InterfaceLanguageBridge|MutationObserver/u.test(contents)) fail(`Legacy DOM translation mechanism remains in ${path.relative(root, file)}`)
}

if (failures.length) {
  console.error(`i18n catalogue audit failed with ${failures.length} issue(s):\n${failures.map((failure) => `- ${failure}`).join('\n')}`)
  process.exit(1)
}

console.log(JSON.stringify({
  localeAudit: 'passed',
  languages,
  sharedCatalogueKeys: allCatalogueKeys.size,
  parameterMessageKeys: expectedParameterKeys.size,
  rendererFiles: rendererFiles.length,
  mainFiles: mainFiles.length,
  uiCalls,
  parameterCalls,
  dynamicUiCalls,
  rawDataPhrases,
  userFacingErrors,
  invariantVisibleCopy: [...invariantVisibleCopy]
}, null, 2))
