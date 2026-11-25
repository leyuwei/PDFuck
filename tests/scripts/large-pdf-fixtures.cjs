const fs = require('node:fs/promises')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const MiB = 1024 * 1024

async function makeJpeg2000(folder) {
  const imagePath = path.join(folder, 'scan.j2k')
  execFileSync('python', ['-c', `
import sys
from PIL import Image, ImageDraw
image = Image.new('RGB', (1024, 768), (31, 148, 75))
draw = ImageDraw.Draw(image)
for y in range(0, 768, 32):
    draw.line((0, y, 1024, y), fill=(76, 187, 112), width=2)
image.save(sys.argv[1], no_jp2=True)
`, imagePath], { windowsHide: true })
  return fs.readFile(imagePath)
}

async function createScanPdf(file, pages, jpx, { small = false, extraContent } = {}) {
  // The same scan texture is written into independent page image streams so
  // the reader must seek and decode real data throughout the physical file.
  const width = small ? 192 : 2048
  const height = small ? 128 : 1365
  const pixels = Buffer.alloc(3 * width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = 3 * (y * width + x)
      const texture = (x * 17 ^ y * 43) % 24
      pixels[offset] = 178 + texture
      pixels[offset + 1] = 42 + texture
      pixels[offset + 2] = 79 + texture
    }
  }
  const handle = await fs.open(file, 'w')
  const offsets = [0]
  let position = 0
  const write = async value => {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value, 'latin1')
    let written = 0
    while (written < data.length) {
      const { bytesWritten } = await handle.write(data, written, data.length - written, position)
      written += bytesWritten
      position += bytesWritten
    }
  }
  const object = async (id, dictionary, stream) => {
    offsets[id] = position
    await write(`${id} 0 obj\n${dictionary}\n`)
    if (stream) { await write('stream\n'); await write(stream); await write('\nendstream\n') }
    await write('endobj\n')
  }
  try {
    await write('%PDF-1.7\n%\xD0\xD4\xC5\xD8\n')
    await object(1, '<< /Type /Catalog /Pages 2 0 R >>')
    const pageIds = Array.from({ length: pages }, (_, index) => 4 + index * 3)
    await object(2, `<< /Type /Pages /Count ${pages} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`)
    await object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    for (const [index, id] of pageIds.entries()) {
      const jpxPage = index % 19 === 4
      const scan = jpxPage ? jpx : pixels
      const pageWidth = index % 17 === 10 ? 950 : 612
      const pageHeight = index % 13 === 6 ? 540 : 792
      await object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> /XObject << /Scan ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`)
      const imageSize = jpxPage ? '/Width 1024 /Height 768 /Filter /JPXDecode' : `/Width ${width} /Height ${height}`
      await object(id + 1, `<< /Type /XObject /Subtype /Image ${imageSize} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${scan.length} >>`, scan)
      const text = index === 0 ? 'First-page unique search target' : `Synthetic scan page ${index + 1}`
      const content = Buffer.from(`q ${pageWidth * .8} 0 0 ${pageHeight * .63} ${pageWidth * .1} ${pageHeight * .14} cm /Scan Do Q\nBT /F1 24 Tf 40 ${pageHeight - 68} Td (${text}) Tj ET\n${extraContent?.(index, pageWidth, pageHeight) || ''}`)
      await object(id + 2, `<< /Length ${content.length} >>`, content)
    }
    const xref = position
    await write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`)
    for (const offset of offsets.slice(1)) await write(`${String(offset).padStart(10, '0')} 00000 n \n`)
    await write(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  } finally { await handle.close() }
  return { file, pages, length: position }
}

async function createDenseSinglePage(file) {
  // One physical page, one very large content stream, with real vector output
  // before and after CAD-style comment records. No unreferenced file padding.
  const handle = await fs.open(file, 'w')
  const offsets = [0]
  let pos = 0
  const write = async value => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value)
    let offset = 0
    while (offset < bytes.length) {
      const { bytesWritten } = await handle.write(bytes, offset, bytes.length - offset, pos)
      pos += bytesWritten; offset += bytesWritten
    }
  }
  const object = async (id, dictionary) => { offsets[id] = pos; await write(`${id} 0 obj\n${dictionary}\nendobj\n`) }
  try {
    await write('%PDF-1.7\n')
    await object(1, '<< /Type /Catalog /Pages 2 0 R >>')
    await object(2, '<< /Type /Pages /Count 1 /Kids [3 0 R] >>')
    await object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 800] /Resources << >> /Contents 4 0 R >>')
    const geometry = Array.from({ length: 50_000 }, (_, index) => {
      const x = 160 + index % 500 * 1.75
      const y = 120 + Math.floor(index / 500) * 5.5
      return [x, y, 'm', x + 1, y + 4, 'l', x + 2, y + 3, 'l', x + 2.5, y + 1, 'l', 'S\n'].join(' ')
    }).join('')
    const prefix = Buffer.from('q 0.18 0.34 0.63 rg 120 90 960 620 re f 0.30 0.48 0.74 RG .12 w\n' + geometry)
    const suffix = Buffer.from('\n0.95 0.22 0.12 rg 500 320 200 160 re f Q\n')
    const record = Buffer.from('% ' + 'CAD-export-vector-layer-coordinate-record '.repeat(102) + '\n')
    const repeats = Math.floor(MiB / record.length)
    const block = Buffer.concat(Array.from({ length: repeats }, () => record))
    const blocks = 1040
    offsets[4] = pos
    await write(`4 0 obj\n<< /Length ${prefix.length + block.length * blocks + suffix.length} >>\nstream\n`)
    await write(prefix)
    for (let index = 0; index < blocks; index++) await write(block)
    await write(suffix); await write('endstream\nendobj\n')
    const xref = pos
    await write('xref\n0 5\n0000000000 65535 f \n')
    for (const offset of offsets.slice(1)) await write(`${String(offset).padStart(10, '0')} 00000 n \n`)
    await write(`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  } finally { await handle.close() }
  return { file, pages: 1, length: pos }
}

module.exports = { createScanPdf, createDenseSinglePage, makeJpeg2000, MiB }
