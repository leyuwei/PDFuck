const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const fs = require('node:fs')
const path = require('node:path')

const width = 760, height = 720
const cases = [
  {id:'single', columns:1, gap:0, figures:[[],['figure'],['table']], ruled:true},
  {id:'double-tight', columns:2, gap:7, figures:[[],['wide-figure'],['wide-table']], numbered:true},
  {id:'double-wide', columns:2, gap:73, figures:[['figure'],['table'],['wide-figure']], ruled:true},
  {id:'triple-tight', columns:3, gap:8, figures:[['wide-table'],[],['wide-figure']], numbered:true},
  {id:'triple-wide', columns:3, gap:40, figures:[['figure'],['wide-figure','table'],[]], ruled:true},
  {id:'quadruple', columns:4, gap:18, figures:[['wide-figure'],['wide-table'],['figure','table']], numbered:true}
]
const margin = 46
const dimensions = config => {
  const colWidth = (width - 2*margin - (config.columns-1)*config.gap)/config.columns
  const left = Array.from({length:config.columns},(_,i)=>margin+i*(colWidth+config.gap))
  return {colWidth,left,gutters:left.slice(1).map(x=>x-config.gap/2)}
}

async function makeSelectionMatrix(directory) {
  fs.mkdirSync(directory,{recursive:true})
  const results=[]
  for (const config of cases) {
    const pdf=await PDFDocument.create(), font=await pdf.embedFont(StandardFonts.Helvetica)
    const icon=await pdf.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/KVEAAAAASUVORK5CYII=','base64'))
    const {colWidth,left,gutters}=dimensions(config)
    const pages=[]
    for (const [index,visualTypes] of config.figures.entries()) {
      const page=pdf.addPage([width,height])
      const text=(value,x,y,size=9)=>page.drawText(value,{x,y:height-y,size,font})
      const line=(a,b,c,d)=>page.drawLine({start:{x:a,y:height-b},end:{x:c,y:height-d},thickness:.65,color:rgb(.35,.44,.57)})
      const footerX = index%2===0 ? 48 : 375
      text('Masthead Editorial Layout Desk',46,22,8)
      text('Masthead Publication and Review',46,36,8)
      text('Edition '+String(index+21),620,31,8)
      text('Footer Publication Office',footerX,671,7)
      text('Footer Terms of Distribution',footerX,684,7)
      text(String(index+41),706,674,8)
      if(config.ruled) {line(42,53,718,53);line(42,650,718,650)}
      const figures=[]
      for(const [slot,variant] of visualTypes.entries()) {
        const first = slot && config.columns>=3 ? config.columns-1 : 0
        const spanning=variant.startsWith('wide-')
        const type=variant.endsWith('table')?'table':'figure'
        const x=left[first], w=spanning ? colWidth*2+config.gap : colWidth
        const top=267+(slot&&config.columns<3?152:0), bottom=top+91
        if(type==='figure'){
          page.drawRectangle({x,y:height-bottom,width:w,height:bottom-top,borderWidth:.7,borderColor:rgb(.2,.38,.58),color:rgb(.95,.97,.99)})
          page.drawImage(icon,{x:x+8,y:height-bottom+8,width:w-16,height:bottom-top-16})
          for(let bar=0;bar<4;bar++)page.drawRectangle({x:x+(bar+1)*w/6,y:height-bottom+12,width:w/14,height:18+(bar%3)*16,color:rgb(.3,.46+bar*.08,.66)})
          text('Axis label sample',x+12,bottom-5,7)
          text('Figure '+(slot+1)+'. Sample result summary',x,bottom+12)
        } else {
          text('Table '+(slot+1)+'. Sample measurements',x,top-7)
          for (const y of [top,top+23,top+47,top+70,bottom])line(x,y,x+w,y)
          for (const t of [x,x+w/2,x+w])line(t,top,t,bottom)
          for (const [row,y] of [top+16,top+39,top+64,top+85].entries()){
            text('Cell alpha '+row,x+5,y,8);text('Cell beta '+row,x+w/2+5,y,8)
          }
        }
        figures.push({type,label:(type==='table'?'Table':'Figure')+' '+(slot+1),left:x,right:x+w,top:top-(type==='table'?18:0),bottom:bottom+(type==='figure'?12:0)})
      }
      const body=[]
      const fragments=['common readers follow ordinary article paragraphs','local editors verify each printed line','research teams inspect each result in order','nearby sample words describe independent results']
      for(let row=0;row<39;row++) {
        const y=86+row*14
        if(config.numbered){
          text(String(101+row),14,y,6)
          text(String(301+row),733,y,6)
        }
        for (const [col,x] of left.entries()){
          if(figures.some(f=>x>=f.left-.01 && x<f.right-.01 && y>=f.top && y<=f.bottom+9))continue
          let value='Lane'+String.fromCharCode(65+col)+' '+fragments[(row+index)%fragments.length]
          const suffix=' for the review'
          while(font.widthOfTextAtSize(value+suffix,9)<colWidth-6)value+=suffix
          while(font.widthOfTextAtSize(value,9)>colWidth-3)value=value.slice(0,value.lastIndexOf(' '))
          if (row%4===2) for (const extra of ['to','show','how','it','can','be','read','in','a','row']) {
            if (font.widthOfTextAtSize(value+' '+extra,9)<colWidth-1.2) value+=' '+extra
          }
          text(value,x,y)
          body.push({text:value,x,y,col,width:font.widthOfTextAtSize(value,9)})
        }
      }
      pages.push({gutters,figures,body})
    }
    const file=path.join(directory,'selection-'+config.id+'.pdf')
    fs.writeFileSync(file,await pdf.save())
    results.push({file,pages,id:config.id})
  }
  return results
}

module.exports={makeSelectionMatrix,width,height}
if(require.main===module) makeSelectionMatrix(path.resolve(process.argv[2]||'tests/fixtures/selection-matrix-220'))
  .then(docs=>console.log({documents:docs.length,pages:docs.reduce((n,d)=>n+d.pages.length,0)}))
  .catch(error=>{console.error(error);process.exitCode=1})
