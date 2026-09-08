const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), postcss = require('postcss')
const root = path.resolve(__dirname, '../src/renderer/src')
let declarations = 0
for (const file of fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('.css'))) {
  postcss.parse(fs.readFileSync(path.join(root, file), 'utf8')).walkDecls(/^font(?:-size)?$/, declaration => {
    declarations++
    const value = declaration.value
    // Invisible PDF text mapping is geometry, not interface typography.
    if (declaration.parent.selector === '.text-map span' && value === '1px') return
    const allowedSizes = ['inherit', ...['small', 'body', 'title'].map(role => `var(--ui-font-${role})`), 'var(--annotation-list-font-size, var(--ui-font-body))', 'var(--bookmark-font-size, var(--ui-font-body))']
    assert.ok(declaration.prop === 'font-size' ? allowedSizes.includes(value) : value === 'inherit' || /var\(--ui-font-(?:small|body|title)\)/.test(value), `${file}: ${declaration.parent.selector}: ${declaration.prop}: ${value}`)
    assert.ok(!/\d(?:px|rem|em)\b/.test(value), `${file}: hard-coded UI font size: ${value}`)
  })
}
console.log(JSON.stringify({ typography: 'passed', declarations, sizes: ['small', 'body', 'title'] }))
