const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, StandardFonts } = require('pdf-lib')

async function makeTitleTableFixtures(directory) {
  fs.mkdirSync(directory, { recursive: true })
  const fixtures = []
  const W = 612, H = 792
  const add = async (id, pages) => {
    const pdf = await PDFDocument.create({updateMetadata:false})
    const font = await pdf.embedFont(StandardFonts.TimesRoman)
    const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
    const symbol = await pdf.embedFont(StandardFonts.ZapfDingbats)
    const plan = pages.map(draw => {
      const page = pdf.addPage([W, H])
      const tests = { body: [], titles: [], contacts: [], tables: [], figures: [], lanes: 0 }
      const at = (value, x, y, size = 10, style = font) => page.drawText(value, { x, y: H-y, size, font: style })
      const centered = (value,y,size,style=font) => {
        const x = (W-style.widthOfTextAtSize(value,size))/2
        at(value,x,y,size,style)
        tests.titles.push(y)
      }
      const body = (count,start,rows=25,end=H-44) => {
        tests.lanes = count
        const gutter = count === 3 ? 15 : 13
        const width = (W-92-gutter*(count-1))/count
        for (let lane=0; lane<count; lane++) for(let row=0;row<rows;row++) {
          const x = 46+lane*(width+gutter), y=Math.min(end,start+row*12.5)+(lane%2)*.65
          if(y>end+.66) break
          const marker='Lane'+String.fromCharCode(65+lane)+'Row'+String(row).padStart(2,'0')
          const vocabulary=['paper','tests','ordinary','nearby','text','and','adjacent','selection','stays','in','the','same','column','today']
          let line=marker
          for (const word of [...vocabulary,...vocabulary,...vocabulary]) {
            if(font.widthOfTextAtSize(line+' '+word,10)>width-1) break
            line+=' '+word
          }
          at(line,x,y)
          tests.body.push({x,y,width,marker})
          if(y>=end) break
        }
      }
      const rule = (x1,x2,y,split) => {
        const stroke = (a,b) => page.drawLine({start:{x:a,y:H-y},end:{x:b,y:H-y},thickness:.5})
        if(split){ const middle=(x1+x2)/2;stroke(x1,middle-.45);stroke(middle+.4,x2) }
        else stroke(x1,x2)
      }
      const table = ({label,x,w,top,side,split=false,symbols=false,wrap=false}) => {
        const foot=top+67, header=top+15
        rule(x,x+w,top,split);rule(x,x+w,header,split);rule(x,x+w,foot,split)
        const col = [x+7, x+w*.39, x+w*.67]
        ;['Study','Evidence','Result'].forEach((value,i)=>at(value,col[i],top+10,8))
        for(let row=0;row<4;row++){
          const y=header+10+row*10
          at('Trial '+(row+1),col[0],y,8)
          at(symbols?'●':row%2?'Pass':'Check',col[1],y,8,symbols?symbol:font)
          at(symbols?'◗':'Value '+(row+1),col[2],y,8,symbols?symbol:font)
        }
        const line=side==='below'?foot+11:top-9
        at(label+': Synthetic results overview',x,line,8.5)
        if(wrap)at('Status symbols describe the mock values.',x,line+9,8.5)
        tests.tables.push({label,x,w,top,foot,captionEnd:line+(wrap?9:0),side})
      }
      const contact = (x, y, email) => {
        for(let row=0;row<4;row++){
          at(row===1 && email ? 'Contact sample@example.test for a fixture.' : 'Fictional contact office and affiliation data.',x,y+row*9,8)
          if(email)tests.contacts.push({x,y:y+row*9})
        }
      }
      const figure = (label,x,w,top,height) => {
        page.drawRectangle({x,y:H-top-height,width:w,height,borderWidth:.5})
        rule(x,x+w,top+height*.4,false)
        at(label+': Synthetic shape',x,top+height+9,8.5)
        tests.figures.push({label,x,w,top,foot:top+height})
      }
      draw({at, centered, body, table, figure, rule, contact, tests, italic})
      return tests
    })
    const file=path.join(directory,`${id}.pdf`)
    fs.writeFileSync(file,await pdf.save())
    fixtures.push({id,file,pages:plan})
  }
  await add('bottom-caption-symbols',[({table,body})=>{
    table({label:'TABLE I',x:46,w:520,top:51,side:'below',split:true,symbols:true,wrap:true})
    body(2,152,37)
  }])
  await add('top-caption-near-header',[({table,body})=>{
    table({label:'TABLE II',x:46,w:520,top:50,side:'above'})
    body(2,129,37)
  }])
  await add('two-tables-same-width',[({table,body})=>{
    table({label:'TABLE III',x:46,w:520,top:73,side:'above'})
    table({label:'TABLE IV',x:46,w:520,top:150,side:'below',wrap:true})
    body(2,256,37)
  }])
  await add('parallel-localized-tables',[({table,body})=>{
    table({label:'TABLA V',x:46,w:242,top:112,side:'below',symbols:true})
    table({label:'TABLEAU VI',x:324,w:242,top:112,side:'below'})
    body(2,205,32)
  },({table,figure,body})=>{
    table({label:'TABLE VIII',x:46,w:250,top:105,side:'below',symbols:true})
    figure('Fig. 1',305,261,104,68)
    body(2,200,30)
  }])
  await add('rules-with-ordinary-prose',[({at,rule,body})=>{
    at('Table VII: A chapter heading above normal prose',46,82,9)
    rule(46,566,91,false);rule(46,566,110,false);rule(46,566,197,false)
    body(1,101,40)
  }])
  await add('two-column-front-matter',[({centered,body,contact,italic})=>{
    centered('An entirely fictional academic title',78,22)
    centered('A second line of the title',104,22)
    centered('A Fictional Author, B Fictional Author, C Researcher, D Researcher',127,10.5,italic)
    centered('E Researcher and F Researcher',140,10.5)
    body(2,163,40,660)
    contact(46,708,true)
  }])
  await add('three-column-front-matter',[({centered,body,italic})=>{
    centered('Résultats de mise en page',82,24)
    centered('Rédaction d’essai pour le titre et ses auteurs',111,10.5,italic)
    body(3,135,40)
  }])
  await add('one-column-heading-and-notes',[({centered,body,contact,at,tests})=>{
    centered('A title for a one-column page',79,22)
    body(1,108,44,685)
    contact(46,714,false)
    at('Ordinary small print without a correspondence marker.',46,755,8)
    tests.smallPrint=755
  },({centered,body,tests})=>{
    centered('A section title on a later page',79,22)
    body(2,108,39)
    tests.ordinaryHeading=tests.titles[0];tests.titles=[]
  }])
  return fixtures
}

if(require.main===module)makeTitleTableFixtures(path.join(__dirname,'../fixtures/title-table-selection-220'))
  .then(fixtures=>console.log(fixtures.map(({id,pages})=>[id,pages.length])))
  .catch(error=>{console.error(error);process.exitCode=1})
module.exports={makeTitleTableFixtures}
