const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const localesPath = path.join(root, 'src/renderer/src/lib/i18n-locales.ts')
const languages = ['ja', 'ru', 'es']

function sourceFile(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? walk(path.join(directory, entry.name))
    : /\.(?:ts|tsx)$/u.test(entry.name) ? [path.join(directory, entry.name)] : [])
}

function propertyName(property) {
  if (!property.name) return null
  return ts.isStringLiteralLike(property.name) || ts.isIdentifier(property.name) ? property.name.text : null
}

function objectDeclaration(file, name) {
  let object
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && ts.isObjectLiteralExpression(node.initializer)) object = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (!object) throw new Error(`Missing object declaration: ${name}`)
  return object
}

function arrayDeclaration(file, name) {
  let array
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && ts.isArrayLiteralExpression(node.initializer)) array = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (!array) throw new Error(`Missing array declaration: ${name}`)
  return array
}

function collectLocaleKeys() {
  const source = sourceFile(localesPath)
  const base = objectDeclaration(source, 'localePhrases')
  const additions = objectDeclaration(source, 'phraseTranslations')
  const keys = Object.fromEntries(languages.map((language) => [language, new Set()]))
  for (const languageEntry of base.properties) {
    const language = propertyName(languageEntry)
    if (!languages.includes(language) || !ts.isPropertyAssignment(languageEntry) || !ts.isObjectLiteralExpression(languageEntry.initializer)) continue
    for (const phrase of languageEntry.initializer.properties) {
      const key = propertyName(phrase)
      if (!key) continue
      if (!ts.isPropertyAssignment(phrase) || !ts.isStringLiteralLike(phrase.initializer) || !phrase.initializer.text.trim()) throw new Error(`Invalid ${language} translation for: ${key}`)
      keys[language].add(key)
    }
  }
  for (const phrase of additions.properties) {
    const key = propertyName(phrase)
    if (!key || !ts.isPropertyAssignment(phrase) || !ts.isObjectLiteralExpression(phrase.initializer)) continue
    const variants = new Set()
    for (const variant of phrase.initializer.properties) {
      const language = propertyName(variant)
      if (!language) continue
      if (!ts.isPropertyAssignment(variant) || !ts.isStringLiteralLike(variant.initializer) || !variant.initializer.text.trim()) throw new Error(`Invalid translation for ${key}.${language}`)
      variants.add(language)
    }
    for (const language of languages) {
      if (!variants.has(language)) throw new Error(`Missing ${language} translation for: ${key}`)
      keys[language].add(key)
    }
  }
  return keys
}

function collectStaticEnglishKeys() {
  const bridge = sourceFile(path.join(root, 'src/renderer/src/components/InterfaceLanguageBridge.tsx'))
  const english = objectDeclaration(bridge, 'english')
  const keys = new Set()
  for (const phrase of english.properties) {
    const key = propertyName(phrase)
    if (key) keys.add(key)
  }
  const localeSource = sourceFile(localesPath)
  const additions = objectDeclaration(localeSource, 'phraseTranslations')
  for (const phrase of additions.properties) {
    const key = propertyName(phrase)
    if (key) keys.add(key)
  }
  return keys
}

function collectInterfaceBridgeKeys() {
  const bridge = sourceFile(path.join(root, 'src/renderer/src/components/InterfaceLanguageBridge.tsx'))
  const english = objectDeclaration(bridge, 'english')
  const phrases = new Map()
  for (const phrase of english.properties) {
    const key = propertyName(phrase)
    if (key) phrases.set(key, [sourceLocation(path.join(root, 'src/renderer/src/components/InterfaceLanguageBridge.tsx'), phrase)])
  }
  return phrases
}

function sourceLocation(file, node) {
  const position = sourceFile(file).getLineAndCharacterOfPosition(node.getStart())
  return `${path.relative(root, file)}:${position.line + 1}`
}

function collectUiPhrases(files) {
  const phrases = new Map()
  for (const file of files) {
    const source = sourceFile(file)
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'ui' && ts.isStringLiteralLike(node.arguments[0])) {
        const locations = phrases.get(node.arguments[0].text) || []
        locations.push(sourceLocation(file, node.arguments[0]))
        phrases.set(node.arguments[0].text, locations)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return phrases
}

function collectAiPresetLabels() {
  const file = path.join(root, 'src/renderer/src/lib/ai-polish.ts')
  const source = sourceFile(file)
  const presets = arrayDeclaration(source, 'AI_PRESETS')
  const phrases = new Map()
  for (const preset of presets.elements) {
    if (!ts.isObjectLiteralExpression(preset)) continue
    const label = preset.properties.find((property) => propertyName(property) === 'label')
    if (!label || !ts.isPropertyAssignment(label) || !ts.isStringLiteralLike(label.initializer)) throw new Error(`Invalid AI preset label in ${sourceLocation(file, preset)}`)
    phrases.set(label.initializer.text, [sourceLocation(file, label.initializer)])
  }
  return phrases
}

function collectComponentLiterals(files) {
  const phrases = new Map()
  for (const file of files) {
    const source = sourceFile(file)
    function visit(node) {
      if ((ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /[\u3400-\u9fff]/u.test(node.text)) {
        const locations = phrases.get(node.text) || []
        locations.push(sourceLocation(file, node))
        phrases.set(node.text, locations)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return phrases
}

function collectThrownErrors(files) {
  const phrases = new Map()
  for (const file of files) {
    const source = sourceFile(file)
    function visit(node) {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Error') {
        const message = node.arguments?.[0]
        if (message && (ts.isStringLiteralLike(message) || ts.isNoSubstitutionTemplateLiteral(message)) && /[\u3400-\u9fff]/u.test(message.text)) {
          const locations = phrases.get(message.text) || []
          locations.push(sourceLocation(file, message))
          phrases.set(message.text, locations)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return phrases
}

function assertCovered(label, phrases, keys) {
  const gaps = []
  for (const [phrase, locations] of phrases) {
    const missing = languages.filter((language) => !keys[language].has(phrase))
    if (missing.length) gaps.push(`${phrase} (${missing.join(', ')}): ${[...new Set(locations)].join(', ')}`)
  }
  if (gaps.length) throw new Error(`${label} is missing translations:\n${gaps.join('\n')}`)
}

function assertStaticEnglishCovered(phrases, keys) {
  const missing = [...phrases].filter(([phrase]) => !keys.has(phrase))
  if (missing.length) throw new Error(`Static interface copy is missing an English source translation:\n${missing.map(([phrase, locations]) => `${phrase}: ${[...new Set(locations)].join(', ')}`).join('\n')}`)
}

const rendererRoot = path.join(root, 'src/renderer/src')
const components = [path.join(rendererRoot, 'App.tsx'), ...walk(path.join(rendererRoot, 'components')).filter((file) => !file.includes('.test.') && !file.endsWith('InterfaceLanguageBridge.tsx'))]
const rendererFiles = walk(rendererRoot).filter((file) => !file.includes('.test.') && !file.endsWith('i18n-locales.ts') && !file.endsWith('i18n.ts'))
const errorFiles = [...walk(path.join(root, 'src/main')), ...walk(path.join(rendererRoot, 'lib'))].filter((file) => !file.includes('.test.'))
const keys = collectLocaleKeys()
const componentPhrases = collectComponentLiterals(components)
const uiPhrases = collectUiPhrases(rendererFiles)
const staticComponentPhrases = new Map([...componentPhrases].filter(([phrase]) => !uiPhrases.has(phrase)))
const interfaceBridgePhrases = collectInterfaceBridgeKeys()
const aiPresetLabels = collectAiPresetLabels()

assertCovered('JSX interface copy', componentPhrases, keys)
assertCovered('interface bridge copy', interfaceBridgePhrases, keys)
assertStaticEnglishCovered(staticComponentPhrases, collectStaticEnglishKeys())
assertCovered('ui() interface copy', uiPhrases, keys)
assertCovered('AI preset labels', aiPresetLabels, keys)
assertStaticEnglishCovered(aiPresetLabels, collectStaticEnglishKeys())
assertCovered('user-facing errors', collectThrownErrors(errorFiles), keys)
console.log(JSON.stringify({ localeAudit: 'passed', languages, componentFiles: components.length, rendererFiles: rendererFiles.length, errorFiles: errorFiles.length, aiPresetLabels: aiPresetLabels.size }, null, 2))
