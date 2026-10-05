const { app, nativeImage } = require('electron')
const fs = require('node:fs'), path = require('node:path')
const root = path.resolve(__dirname, '..')

// NSIS uses 24-bit BMPs. Composite the existing logo onto white without extra image tools.
function bitmap(width, height, size, x, y) {
  const image = nativeImage.createFromPath(path.join(root, 'resources/icon.png')).resize({ width: size, height: size })
  if (image.isEmpty()) throw new Error('Missing application logo')
  const pixels = image.toBitmap(), stride = Math.ceil(width * 3 / 4) * 4
  const bmp = Buffer.alloc(54 + stride * height, 255)
  bmp.fill(0, 0, 54); bmp.write('BM'); bmp.writeUInt32LE(bmp.length, 2); bmp.writeUInt32LE(54, 10)
  bmp.writeUInt32LE(40, 14); bmp.writeInt32LE(width, 18); bmp.writeInt32LE(height, 22)
  bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28); bmp.writeUInt32LE(stride * height, 34)
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const from = (row * size + col) * 4, to = 54 + (height - 1 - y - row) * stride + (x + col) * 3
    for (let channel = 0; channel < 3; channel++) bmp[to + channel] = Math.round(pixels[from + channel] * pixels[from + 3] / 255 + 255 - pixels[from + 3])
  }
  return bmp
}
app.whenReady().then(() => {
  fs.writeFileSync(path.join(root, 'resources/installer-header.bmp'), bitmap(150, 57, 48, 96, 4))
  fs.writeFileSync(path.join(root, 'resources/installer-sidebar.bmp'), bitmap(164, 314, 112, 26, 60))
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
