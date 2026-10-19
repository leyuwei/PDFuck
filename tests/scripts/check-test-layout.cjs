// Static migration checks only: never runs historical tests or UI suites.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript'), root = path.resolve(__dirname, '../..')
const mapping = require('../migration-map.json')
for (const [old, current] of Object.entries(mapping)) {
  assert.ok(!fs.existsSync(path.join(root, old)), old)
  assert.ok(fs.existsSync(path.join(root, current)), current)
}
let scripts = 0, imports = 0
for (const name of fs.readdirSync(__dirname).filter(n => n.endsWith('.cjs'))) {
  const file = path.join(__dirname, name), source = fs.readFileSync(file, 'utf8')
  new vm.Script(source, { filename: file }); scripts++
  for (const match of source.matchAll(/require\(['"](\.{1,2}\/[^'"]+)['"]\)/g)) {
    assert.ok(fs.existsSync(path.resolve(__dirname, match[1])), `${name}: ${match[1]}`); imports++
  }
}
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
const fixtures = path.join(root, 'tests/fixtures')
const inputNames = fs.readdirSync(fixtures).filter(name => name !== 'README.md')
assert.ok(inputNames.length > 0)
for (const name of inputNames) assert.match(name, /^[a-f0-9]{32}\.pdf$/, 'fixture filenames must be opaque')
assert.ok(!Object.values(mapping).some(name => name.startsWith('tests/fixtures/')), 'migration records must not disclose original fixture names')
const documentedMissing = new Set([...fs.readFileSync(path.join(fixtures, 'README.md'), 'utf8').matchAll(/`([a-f0-9]{32}\.(?:pdf|md))`/g)].map(match => match[1]).filter(name => !inputNames.includes(name)))
const references = [path.join(root, 'README.md'), path.join(root, 'PACKAGING_GUIDE.md'), path.join(root, 'tests/README.md'), ...walk(path.join(root, 'tests/scripts')), ...walk(path.join(root, 'tests/unit')), ...walk(path.join(root, 'tests/docs'))]
for (const file of references) for (const match of fs.readFileSync(file, 'utf8').matchAll(/\b([a-f0-9]{32}\.(?:pdf|md))\b/g)) {
  assert.ok(inputNames.includes(match[1]) || documentedMissing.has(match[1]), `${file}: unknown fixture ${match[1]}`)
}
for (const file of walk(path.join(root, 'tests/unit'))) {
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  function visit(node) {
    const parent = node.parent
    const moduleSpecifier = parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isCallExpression(parent) && (parent.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(parent.expression) && parent.expression.text === 'require' || ts.isPropertyAccessExpression(parent.expression) && ['mock', 'doMock', 'unmock', 'doUnmock'].includes(parent.expression.name.text)))
    if (moduleSpecifier && ts.isStringLiteral(node) && /^\.{1,2}\//.test(node.text)) {
      const target = path.resolve(path.dirname(file), node.text)
      assert.ok(['', '.ts', '.tsx', '.json', '.css'].some(suffix => fs.existsSync(target + suffix)), `${file}: ${node.text}`); imports++
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
}
assert.ok(!fs.existsSync(path.join(root, 'tmp')) && !fs.existsSync(path.join(root, 'output')))
assert.equal(require('../../package.json').version, '2.1.10')
console.log(JSON.stringify({ moved: Object.keys(mapping).length, anonymousFixtures: inputNames.length, documentedMissingInputs: documentedMissing.size, scriptsParsed: scripts, localReferencesResolved: imports, historicalTestsExecuted: 0 }))
