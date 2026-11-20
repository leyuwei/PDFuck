const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib')
const { createCanvas } = require('@napi-rs/canvas')

const directory = path.resolve(__dirname, '../fixtures/interleaved-figures-220')
const width = 640, height = 820
const ink = rgb(.27,.42,.59), light = rgb(.9,.94,.97)
const cases = [
  { id:'shared-legend-after-older-figure', lanes:2, panels:true, labels:['Fig. 6','Fig. 7'] },
  { id:'span-interleaved-raster', lanes:2, raster:true, labels:['Figure 1','Figura 2'] },
  { id:'span-interleaved-vector', lanes:2, labels:['Abb. 3','Gráfico 4'] },
  { id:'one-column-interleaved', lanes:1, labels:['Fig. 1','Fig. 2'] },
  { id:'three-columns-full-span', lanes:3, labels:['Fig. 1','Fig. 2'] },
  { id:'four-columns-full-span', lanes:4, labels:['Figura 1','Figure 2'] },
  { id:'three-columns-partial-span', lanes:3, partial:true, labels:['Figura 1','Abb. 2'] },
  { id:'one-column-figure-next-to-prose', lanes:2, partial:true, labels:['Figure 1','Figure 2'] },
  { id:'separate-panels-with-body-between', lanes:2, separate:true, labels:['Fig. 1','Fig. 2','Fig. 3'] },
  { id:'prose-blocks-detached-key', lanes:2, separate:true, uncaptioned:true, labels:['ui.image','ui.image','Fig. 3'] },
]

async function makeInterleavedFixtures() {
  fs.mkdirSync(directory,{recursive:true})
  const result = []
  for (const scenario of cases) {
    const doc = await PDFDocument.create({updateMetadata:false})
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const page = doc.addPage([width,height])
    const draw = (value,x,y,size=10,angle=0) => page.drawText(value,{x,y:height-y,size,font,rotate:degrees(angle)})
    const rect = (x,y,w,h) => page.drawRectangle({x,y:height-y-h,width:w,height:h,color:light,borderColor:ink,borderWidth:.5})
    const line = (x,y,x2,y2) => page.drawLine({start:{x,y:height-y},end:{x:x2,y:height-y2},color:ink,thickness:1})
    const canvas = createCanvas(64,32), context = canvas.getContext('2d')
    context.fillStyle = '#ceddeb'
    context.fillRect(0,0,64,32)
    context.fillStyle = '#385b99'
    for (let i=0;i<6;i++) context.fillRect(6+i*9,32-(i+1)*4,3,(i+1)*4)
    const image = scenario.raster && await doc.embedPng(canvas.toBuffer('image/png'))
    const figures = [], body = []
    const left = 39, gutter = 24, right = 601
    const laneWidth = (right-left - gutter*(scenario.lanes-1))/scenario.lanes
    const laneX = lane => left+lane*(laneWidth+gutter)
    const paint = (x,y,w,h) => {
      if (image) page.drawImage(image,{x,y:height-y-h,width:w,height:h})
      else rect(x,y,w,h)
      for (let i=1;i<8;i++) {
        const dx = i*w/9
        line(x+dx,y+h*.78,x+dx,y+h*(.36+(i%3)*.09))
      }
    }
    const caption = (index,x,y,w) => {
      const label = scenario.labels[index]
      draw(label+': Sample measurements and their neutral legend',x,y,8)
      const tail = 'from the independent reference series.'
      draw(tail,x,y+11,8)
      figures.push({label,x,y,w,captionBottom:y+13})
    }
    const rows = (from,count,band,columns=Array.from({length:scenario.lanes},(_,lane)=>lane)) => {
      for (const lane of columns) for (let row=0;row<count;row++) {
        const y=from+row*12, x=laneX(lane)
        const marker = `S${band}C${lane}R${row}`
        const suffix = 'end'+marker
        let text = marker
        for (const token of (' ordinary prose continues along a stable reading column with narrow adjacent margins and original test words').repeat(2).split(/\s+/u).filter(Boolean)) {
          if (font.widthOfTextAtSize(text+' '+token+' '+suffix,10)>laneWidth) break
          text+=' '+token
        }
        draw(text+' '+suffix,x,y)
        body.push({marker,band,lane,y})
      }
    }
    const simple = (index,top,foot,w=right-left,x=left) => {
      paint(x,top,w,foot-top)
      draw(`Key${index} reading`,x+16,top+20,7)
      caption(index,x,foot+13,w)
      Object.assign(figures.at(-1),{top,foot,parts:[{x,y:top,w,h:foot-top}], marks:[`Key${index}`]})
    }
    if (scenario.panels) {
      rows(58,7,0)
      simple(0,164,258)
      rows(310,6,1)
      const top=410, foot=489, parts=[], marks=[]
      for(const [index,x] of [83,337].entries()) {
        const w=224
        paint(x,top,w,foot-top)
        draw(`PanelTitle${index} sample`,x+45,top-4,7)
        draw('0.0',x-10,foot+2,7)
        draw(`AxisVertical${index}`,x-6,top+65,7,90)
        draw(`AxisAngled${index}`,x+18,foot+33,7,24)
        parts.push({x,y:top,w,h:foot-top})
        marks.push(`PanelTitle${index}`,`AxisVertical${index}`,`AxisAngled${index}`)
      }
      paint(192,foot+45,256,19)
      draw('SharedKey reference data',220,foot+58,7)
      parts.push({x:192,y:foot+45,w:256,h:19})
      marks.push('SharedKey')
      // The first caption baseline is emitted in two independent fragments.
      const captionY=foot+77
      draw('Fig. 7: The two plots share the same experimental reference and caption.',39,captionY,8)
      draw('Long continuation for both panels.',296,captionY,8)
      draw('Final line of the caption.',39,captionY+11,8)
      figures.push({label:'Fig. 7',x:39,y:captionY,top:top-8,foot:foot+64,captionBottom:captionY+13,parts,marks})
      rows(623,15,2)
    } else if (scenario.separate) {
      rows(57,7,0)
      for (const [index,x] of [65,323].entries()) {
        if (!scenario.uncaptioned) simple(index,155,242,227,x)
        else {
          paint(x,155,227,165)
          figures.push({label:'ui.image',parts:[{x,y:155,w:227,h:165}],marks:[]})
        }
      }
      // In the uncaptioned case the upper boxes are within legend distance.
      // The intervening prose still prevents them from borrowing its caption.
      rows(scenario.uncaptioned?334:302,scenario.uncaptioned?3:5,1)
      simple(2,373,399,310,165)
      rows(452,20,2)
    } else if (scenario.partial) {
      rows(55,8,0)
      const lanesCovered=scenario.lanes-1
      const visualWidth=laneX(lanesCovered)-left-gutter
      simple(0,174,257,visualWidth)
      const other=[scenario.lanes-1]
      rows(182,9,3,other)
      rows(310,8,1)
      simple(1,429,529,visualWidth)
      rows(438,9,4,other)
      rows(582,17,2)
    } else {
      rows(55,8,0)
      simple(0,173,253)
      rows(305,9,1)
      simple(1,432,532)
      rows(578,18,2)
    }
    const file = path.join(directory,scenario.id+'.pdf')
    fs.writeFileSync(file,await doc.save())
    result.push({...scenario,file,figures,body})
  }
  return result
}

if (require.main===module) makeInterleavedFixtures().catch(error=>{console.error(error);process.exitCode=1})
module.exports={makeInterleavedFixtures}
