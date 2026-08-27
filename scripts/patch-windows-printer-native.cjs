const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', 'node_modules', 'windows-pdf-printer-native')
if (!fs.existsSync(root)) process.exit(0)

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
if (manifest.version !== '2.1.1') throw new Error(`Unsupported windows-pdf-printer-native version: ${manifest.version}`)

const files = []
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) collect(target)
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(target)
  }
}
collect(path.join(root, 'lib'))

let changed = 0
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const patched = source.replace(/((?:from\s+|import\s*\()(['"]))(\.{1,2}\/[^'"]+)(\2\)?)/g, (match, prefix, quote, specifier, suffix) => {
    if (/\.(?:js|json|node)$/i.test(specifier)) return match
    const resolved = path.resolve(path.dirname(file), specifier)
    if (fs.existsSync(`${resolved}.js`)) return `${prefix}${specifier}.js${suffix}`
    if (fs.existsSync(path.join(resolved, 'index.js'))) return `${prefix}${specifier}/index.js${suffix}`
    return match
  })
  if (patched !== source) {
    fs.writeFileSync(file, patched)
    changed += 1
  }
}

console.log(`windows-pdf-printer-native ESM compatibility: ${changed ? `${changed} file(s) patched` : 'already patched'}`)
