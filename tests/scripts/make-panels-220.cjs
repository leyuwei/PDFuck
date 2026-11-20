const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, PDFName, PDFRawStream, StandardFonts, rgb } = require('pdf-lib')
const { createCanvas } = require('@napi-rs/canvas')

const fixtureDir = path.resolve(__dirname, '../fixtures/panels-220')
const width = 640, height = 680
const scenarios = [
  { name: 'near-right-vector', x: 40, w: 297, bodyX: 318, panels: 1, caption: 'Fig. 1' },
  { name: 'near-left-vector', x: 302, w: 298, bodyX: 40, panels: 1, caption: 'Abb. 2' },
  { name: 'near-right-raster', x: 40, w: 292, bodyX: 318, panels: 1, caption: 'Figura 3', raster: true, fragmented: true },
  { name: 'near-left-raster', x: 302, w: 298, bodyX: 40, panels: 1, caption: 'Figure 4', raster: true, fragmented: true },
  { name: 'four-panel-shared-caption', x: 323, w: 275, bodyX: 40, panels: 4, caption: 'Fig. 5', subtitles: true },
  { name: 'three-raster-panel-shared-caption', x: 40, w: 272, bodyX: 335, panels: 3, caption: 'Figura 6', raster: true, subtitles: true },
  { name: 'two-side-by-side-panels', x: 323, w: 130, bodyX: 40, panels: 2, caption: 'Fig. 21', separate: 'horizontal', raster: true, subtitles: true },
  { name: 'individually-captioned-chart-stack', x: 323, w: 275, bodyX: 40, panels: 3, caption: 'Fig. 7', separate: 'captions' },
  { name: 'prose-between-stacked-chart-and-plot', x: 40, w: 272, bodyX: 335, panels: 2, caption: 'Abb. 8', separate: 'prose', raster: true },
  { name: 'two-aligned-figures-in-two-lanes', x: 323, w: 275, bodyX: 40, panels: 3, caption: 'Fig. 9', separate: 'lanes' }
]

async function makeFixtures() {
  fs.mkdirSync(fixtureDir, { recursive: true })
  const matrix = []
  for (const scenario of scenarios) {
    const pdf = await PDFDocument.create({ updateMetadata: false })
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique)
    const page = pdf.addPage([width, height])
    const draw = (value, x, y, size = 11, face = font) => page.drawText(value, { x, y: height - y, size, font: face })
    const raster = createCanvas(80, 28)
    const context = raster.getContext('2d')
    context.fillStyle = '#dfe9f1'; context.fillRect(0, 0, 80, 28)
    context.fillStyle = '#556d9d'; context.fillRect(14, 4, 17, 20)
    context.fillStyle = '#c85245'; context.fillRect(54, 12, 12, 13)
    const image = await pdf.embedPng(raster.toBuffer('image/png'))
    const box = (x, y, w, h) => {
      if (scenario.raster) page.drawImage(image, {x, y: height-y-h, width:w, height:h})
      else page.drawRectangle({x, y:height-y-h, width:w, height:h, color:rgb(.88,.92,.95)})
      for (let i = 0; i < 4; i++) {
        const x1 = x+w*(.21+i*.17)
        page.drawLine({start:{x:x1,y:height-y-15},end:{x:x1,y:height-y-h+18},thickness:1,color:rgb(.32,.49,.58)})
      }
    }
    const panels = [], captions = [], body = []
    const panelHeight = 55, gap = scenario.separate === 'prose' ? 16 : 15
    const top = 115
    const drawCaption = (x, y, label) => {
      const value = label + (scenario.separate === 'horizontal' ? ': Comparative apparatus and measured results for both plots' : ': Demonstration apparatus and results')
      draw(value, x, y, 10)
      captions.push({label, value, x, y})
    }
    const drawPanel = (x, y, w, number) => {
      box(x, y, w, panelHeight)
      draw('Legend'+number, x+w*.47, y+31, 7)
      if (scenario.subtitles) draw('Panel'+number+' schedule', x+w*.4, y-4, 6)
      panels.push({x, y, w, h:panelHeight, number})
    }
    for (let i = 0; i < scenario.panels; i++) {
      const horizontal = scenario.separate === 'horizontal'
      const y = top + (horizontal ? 0 : i*(panelHeight+gap))
      drawPanel(scenario.x + (horizontal ? i*(scenario.w+gap) : 0), y, scenario.w, i+1)
      if (scenario.separate === 'captions') drawCaption(scenario.x, y+panelHeight+10, 'Fig. '+(10+i))
      if (scenario.separate === 'prose' && i === 0) {
        draw('A prose paragraph separates the two plots here.', scenario.x, y+panelHeight+14)
      }
    }
    const lastBottom = panels.at(-1).y+panelHeight
    if (scenario.separate !== 'captions') drawCaption(scenario.x, lastBottom+13, scenario.caption)
    if (scenario.separate === 'lanes') {
      drawPanel(40,top+2*(panelHeight+gap),253,90)
      drawCaption(40,lastBottom+13,'Fig. 20')
    }
    for (let i=0; i<33; i++) {
      const y = 85 + i*13
      if (scenario.separate === 'lanes' && y >= 245 && y <= 335) continue
      const marker = 'Row'+String(i).padStart(2,'0')
      const value = scenario.bodyX > scenario.x
        ? marker+' local measurements remain independent.'
        : (scenario.x === 302 ? 'The adjacent area measurements stay complete in ' : 'The adjacent measurements stay complete in ')+marker
      const x = scenario.bodyX
      const allWidth = font.widthOfTextAtSize(value,11)
      if (scenario.fragmented) {
        const space = (scenario.bodyX > scenario.x ? value.indexOf(' ') : value.lastIndexOf(' '))+1
        const part = value.slice(0,space)
        draw(part,x,y,11,italic)
        draw(value.slice(space),x+italic.widthOfTextAtSize(part,11),y)
      } else draw(value,x,y)
      body.push({x,y,value,marker,width:allWidth})
    }
    // Reestablish the figure-side lane below its caption without each body
    // paragraph being forced into the foreground of the other lane.
    for (let i=0; i<13; i++) draw('Secondary prose with a stable column edge.',scenario.x,Math.max(378,lastBottom+35)+i*13)
    const file = scenario.name+'.pdf'
    fs.writeFileSync(path.join(fixtureDir,file), await pdf.save())
    matrix.push({...scenario,file,panels,captions,body})
  }

  for (const broken of [false,true]) {
    const pdf = await PDFDocument.create({ updateMetadata: false })
    for (const [w,h,color] of [[460,320,rgb(.8,.15,.2)],[320,460,rgb(.15,.35,.8)]]) {
      const page = pdf.addPage([w,h])
      if (broken) {
        const stream = PDFRawStream.of(pdf.context.obj({ Filter:PDFName.of('FlateDecode') }),new Uint8Array())
        page.node.addContentStream(pdf.context.register(stream))
      }
      page.drawRectangle({x:20,y:20,width:w-40,height:h-40,color})
    }
    fs.writeFileSync(path.join(fixtureDir,broken?'print-empty-flate.pdf':'print-normal.pdf'),await pdf.save({useObjectStreams:false}))
  }
  return matrix
}

if (require.main === module) makeFixtures().catch(error => { console.error(error); process.exitCode = 1 })
module.exports = { makeFixtures, fixtureDir }
