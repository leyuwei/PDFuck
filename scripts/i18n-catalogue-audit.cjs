const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const cataloguePath = path.join(root, 'src/shared/i18n-catalogue.ts')
const rendererRoot = path.join(root, 'src/renderer/src')
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
function findStringArray(source, name) {
  let array
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      let initializer = node.initializer
      while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer))) initializer = initializer.expression
      if (initializer && ts.isArrayLiteralExpression(initializer)) array = initializer
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!array || array.elements.some((element) => !ts.isStringLiteralLike(element))) throw new Error(`Missing string array declaration: ${name}`)
  return array.elements.map((element) => element.text)
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
    if (result.has(key)) fail(`Duplicate message code in ${context}: ${key}`)
    result.set(key, literalRecord(property.initializer, `${context}.${key}`))
  }
  return result
}
function placeholders(value) { return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/gu)].map((match) => match[1]).sort().join(',') }

const catalogueSource = sourceFile(cataloguePath)
const languages = findStringArray(catalogueSource, 'INTERFACE_LANGUAGES')
const messages = nestedRecord(findObject(catalogueSource, 'messages'), 'messages')
const messageKeys = new Set(messages.keys())
const chineseValues = new Set()
for (const [key, translations] of messages) {
  if (!/^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/u.test(key)) fail(`Message key is not a semantic code: ${key}`)
  const sourceValue = translations.get('zh') || ''
  chineseValues.add(sourceValue)
  for (const language of languages) {
    const translated = translations.get(language)
    if (!translated?.trim()) fail(`Missing ${language} translation in messages.${key}`)
    else if (placeholders(sourceValue) !== placeholders(translated)) fail(`Placeholder mismatch in ${key}.${language}: expected {${placeholders(sourceValue)}}; received {${placeholders(translated)}}`)
  }
  for (const language of translations.keys()) if (!languages.includes(language)) fail(`Unexpected locale in messages.${key}: ${language}`)
}

function requireMessageKey(value, where) {
  if (!messageKeys.has(value)) fail(`Unknown i18n message code: ${JSON.stringify(value)} (${where})`)
  else if (/[^\x00-\x7f]/u.test(value)) fail(`Display text used as an i18n key: ${JSON.stringify(value)} (${where})`)
}
function requireChineseValue(value, where) {
  if (!chineseValues.has(value)) fail(`Visible text is not a complete multilingual message value: ${JSON.stringify(value)} (${where})`)
}

const invariantVisibleCopy = new Set([
  'PDF', 'PDFuck', 'uck', 'v', '© 2026 github@leyuwei',
  'BigModel Plan', 'Doubao', 'DeepSeek', 'KIMI',
  'A−', 'A＋', 'Aa', 'B', 'I',
  'A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid',
  '简体中文', 'English', '日本語', 'Русский', 'Español', 'Français', 'Deutsch', 'Português', '한국어', 'العربية',
  'Ctrl+F', 'Ctrl+C', 'PNG', 'JPG', 'EPS', 'DPI', 'px'
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
      const index = name === 'ui' || name === 't' ? 0 : name === 'nativeText' || name === 'translateMessage' ? 1 : -1
      const argument = index >= 0 ? node.arguments[index] : undefined
      if (argument) {
        if (name === 'ui' || name === 'nativeText') uiCalls += 1
        else parameterCalls += 1
        if (ts.isStringLiteralLike(argument)) requireMessageKey(argument.text, location(file, source, argument))
        else dynamicUiCalls += 1
        if (name === 'ui' && node.arguments.length !== 1) fail(`ui() accepts exactly one message code (${location(file, source, node)})`)
        if ((name === 'ui' || name === 't') && !insideFunction) fail(`Locale-sensitive translation runs at module scope (${location(file, source, node)})`)
      }
    }
    if (ts.isPropertyAssignment(node) && ['label', 'name'].includes(propertyName(node)) && ts.isStringLiteralLike(node.initializer) && /[\u3400-\u9fff]/u.test(node.initializer.text)) {
      rawDataPhrases += 1
      requireChineseValue(node.initializer.text, location(file, source, node.initializer))
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'THEME_COLORS' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const entry of node.initializer.elements) {
        const label = ts.isArrayLiteralExpression(entry) ? entry.elements[0] : undefined
        if (label && ts.isStringLiteralLike(label)) requireMessageKey(label.text, location(file, source, label))
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Error' && node.arguments?.[0]) {
      const message = node.arguments[0]
      if (ts.isStringLiteralLike(message) && /[\u3400-\u9fff]/u.test(message.text)) {
        userFacingErrors += 1
        requireChineseValue(message.text, location(file, source, message))
      } else if (ts.isTemplateExpression(message) && /[\u3400-\u9fff]/u.test(message.getText(source))) {
        userFacingErrors += 1
        const shape = message.head.text + message.templateSpans.map((span) => '${}' + span.literal.text).join('')
        if (!allowedDynamicErrorShapes.has(shape)) fail(`Unaudited dynamic user-facing error ${JSON.stringify(shape)} (${location(file, source, message)})`)
        for (const span of message.templateSpans) {
          function checkExpressionText(child) {
            if (ts.isStringLiteralLike(child) && /[\u3400-\u9fff]/u.test(child.text)) requireChineseValue(child.text, location(file, source, child))
            ts.forEachChild(child, checkExpressionText)
          }
          checkExpressionText(span.expression)
        }
      }
    }
    if (file.endsWith(`${path.sep}App.tsx`) && ts.isStringLiteralLike(node) && /[\u3400-\u9fff]/u.test(node.text)) requireChineseValue(node.text, location(file, source, node))
    if (file.includes(`${path.sep}src${path.sep}main${path.sep}`) && ts.isStringLiteralLike(node) && /[\u3400-\u9fff]/u.test(node.text)) requireChineseValue(node.text, location(file, source, node))
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

const catalogueText = fs.readFileSync(cataloguePath, 'utf8')
for (const legacy of ['englishPhrases', 'localePhrases', 'phraseTranslations', 'parameterMessages', 'translateCataloguePhrase']) {
  if (catalogueText.includes(legacy)) fail(`Legacy i18n structure remains: ${legacy}`)
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
  structure: 'semantic-code-to-all-languages',
  languages,
  messageKeys: messageKeys.size,
  rendererFiles: rendererFiles.length,
  mainFiles: mainFiles.length,
  uiCalls,
  parameterCalls,
  dynamicUiCalls,
  rawDataPhrases,
  userFacingErrors,
  invariantVisibleCopy: [...invariantVisibleCopy]
}, null, 2))
