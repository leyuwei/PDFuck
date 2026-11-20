const fs = require('node:fs')
const path = require('node:path')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

const file = path.resolve(__dirname,'../fixtures/figure-label-protection-220.pdf')
const W=612, H=792
const ink=rgb(.22,.35,.5), tint=rgb(.9,.94,.98)
const cases = [
  {id:'two-column-flowchart', lanes:2, caption:'Fig. 1', heading:true, notes:1},
  {id:'one-column-wrapped-note', lanes:1, caption:'Figure 2', heading:true, notes:2},
  {id:'three-column-fragmented-note', lanes:3, caption:'Abb. 3', heading:true, notes:2, split:true},
  {id:'local-figure-adjacent-prose', lanes:2, caption:'Figura 4', local:true, heading:true, notes:2, split:true},
  {id:'flowchart-without-heading-echo', lanes:2, caption:'Figure 5', heading:false, notes:1},
  {id:'independent-body-in-gap', lanes:2, caption:'Fig. 6', heading:true, notes:0},
  {id:'normal-size-neighbor-text', lanes:2, caption:'Gráfico 7', local:true, heading:false, notes:0},
  {id:'two-distinct-figures-on-one-page', lanes:2, caption:'Fig. 8', heading:true, notes:1, earlier:true}
]

async function makeFigureLabelFixture() {
  const pdf=await PDFDocument.create({updateMetadata:false})
  const font=await pdf.embedFont(StandardFonts.Helvetica), bold=await pdf.embedFont(StandardFonts.HelveticaBold)
  const expectations=[]
  for(const scenario of cases){
    const code=String.fromCharCode(65+expectations.length)
    const page=pdf.addPage([W,H]), left=48, right=564, gutter=20, laneWidth=(right-left-gutter*(scenario.lanes-1))/scenario.lanes
    const laneX=lane=>left+lane*(laneWidth+gutter)
    const top=568, foot=681, capY=715
    const width=scenario.local?laneWidth:right-left
    const count=scenario.local?2:3, cardWidth=(width-16-(count-1)*14)/count
    const cardX=index=>left+8+index*(cardWidth+14)
    const body=[],labels=[]
    const draw=(text,x,y,size=10,face=font)=>page.drawText(text,{x,y:H-y,font:face,size,color:ink})
    const marker=(name,x,y,size=10,face=font,visual=false)=>{
      draw(name,x,y,size,face)
      ;(visual?labels:body).push({name,x,y})
    }
    const centered=(text,size)=>left+(width-font.widthOfTextAtSize(text,size))/2
    const line=(x,y,x2,y2)=>page.drawLine({start:{x,y:H-y},end:{x:x2,y:H-y2},thickness:.8,color:ink})
    const chart=(x,y,w,h)=>page.drawRectangle({x,y:H-y-h,width:w,height:h,color:tint,borderColor:ink,borderWidth:.6})
    const rows=(lane,start,end)=>{
      for(let y=start;y<=end;y+=12){
        const name=`Page${code}Lane${lane}Row${y}`, suffix='ends'
        let text=name
        for(const token of 'regular prose with independent paragraph flow on the page and consistent spacing in every block each line continues with additional content'.split(' ')){
          if(font.widthOfTextAtSize(text+' '+token+' '+suffix,10)>laneWidth-2)break
          text+=' '+token
        }
        draw(text+' '+suffix,laneX(lane),y)
        body.push({name,x:laneX(lane),y})
      }
    }
    for(let lane=0;lane<scenario.lanes;lane++){
      if(scenario.earlier){rows(lane,69,153);rows(lane,318,534)}
      else rows(lane,69,lane===0?537:549)
      if(scenario.local&&lane===1)rows(lane,581,737)
      else rows(lane,750,774)
    }
    const labelsY=[562,640]
    marker(scenario.heading?'UpperStage':'BodyHeading',cardX(0),labelsY[0],10,bold,scenario.heading)
    // A separate prose label has the same style and the same vertical gap, but no matching card.
    marker('NearbyText',scenario.local?laneX(1):right-51,labelsY[0],10,bold)
    if(scenario.earlier){
      chart(left,171,width,100)
      for(let i=0;i<6;i++)line(left+30+i*23,181,left+30+i*23,213+i*3)
      draw('Fig. 22: Independent earlier display.',left,286,8)
    }
    const bands=[top,top+79]
    for(const [row,y] of bands.entries()) {
      for(let i=0;i<count;i++) {
        const x=cardX(i)
        chart(x,y,cardWidth,34)
        marker(`Box${row}Step${i}`,x+13,y+20,8,font,true)
        if(i<count-1)line(x+cardWidth,y+17,cardX(i+1),y+17)
      }
    }
    // Connect the two node rows with a return path.
    line(cardX(count-1)+20,top+34,cardX(count-1)+20,top+79)
    if(scenario.heading)marker('LowerStage',cardX(0),labelsY[1],10,bold,true)
    const bridgeFoot=foot
    if(scenario.notes){
      for(let row=0;row<scenario.notes;row++){
        const title=`DiagramNote${row}`, text=title+' confirms independent layout samples'
        const size=7.5, y=bridgeFoot+11+row*10, x=centered(text,size)
        if(!scenario.split)draw(text,x,y,size)
        else for(const [i,word] of text.split(' ').entries()){
          const prefix=text.split(' ').slice(0,i).join(' ')
          draw(word,x+(i?font.widthOfTextAtSize(prefix+' ',size):0),y,size)
        }
        labels.push({name:title,x,y})
      }
    }else{
      const name='BodyBetween', sentence=name+' stays as ordinary body prose.'
      draw(sentence,centered(sentence,10),692)
      body.push({name,x:centered(sentence,10),y:692})
    }
    draw(scenario.caption+': Neutral example '+code+' with an independent caption.',left,capY,8)
    const captionTail='CaptionTail'+code
    draw(captionTail+' continues the example.',left,capY+10,8)
    expectations.push({...scenario,labels,body,capY,captionTail})
  }
  fs.writeFileSync(file,await pdf.save())
  return {file,expectations}
}
if(require.main===module)makeFigureLabelFixture().catch(error=>{console.error(error);process.exitCode=1})
module.exports={makeFigureLabelFixture}
