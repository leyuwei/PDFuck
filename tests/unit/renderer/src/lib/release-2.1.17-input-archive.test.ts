import {it,expect} from 'vitest'
import {textItemsToWordBoxes} from '../../../../../src/renderer/src/lib/text-layout'
import {detectPageVisuals,isolateVisualWords} from '../../../../../src/renderer/src/lib/page-visuals'
import pages from '../../../../fixtures/layout-2117.json'
it.each([{page:7,bodyTop:350},{page:11,bodyTop:380}])('keeps larger body prose below captions out of graphics on input 5 page $page',({page,bodyTop})=>{
 const source=pages.find(p=>p.fixture===4&&p.page===page)!
 const words=textItemsToWordBoxes(source.items as any,source.styles as any,source.transform as any,{},undefined,source.graphics)
 const visuals=detectPageVisuals(words,source.graphics,source.size)
 const isolated=isolateVisualWords(words,visuals)
 const body=isolated.filter(w=>w.rect.x>310&&w.rect.y>bodyTop&&w.rect.height>9.5&&/\p{L}{3}/u.test(w.text))
 expect(body.length).toBeGreaterThan(10)
 expect(body.filter(w=>w.visualRegion!==undefined)).toEqual([])
})
it.each(['I','II'])('keeps a centered TABLE %s heading and its spanning subtitle together',number=>{
 const item=(str:string,x:number,y:number,width:number,size=10)=>({str,width,height:size,fontName:'safe',dir:'ltr' as const,hasEOL:true,transform:[size,0,0,size,x,800-y]})
 const items=[]
 for(let row=0;row<12;row++)for(const x of [40,320])items.push(item('Sample body paragraph in its own column.',x,150+row*14,230))
 items.push(item('TABLE',289,60,25,8),item(number,318,60,9,8),item('Complete spanning table subtitle from left to right.',40,70,530,8),item('70',580,70,9,7))
 const words=textItemsToWordBoxes(items as any,{safe:{fontFamily:'serif',ascent:.8,descent:-.2,vertical:false}},[1,0,0,-1,0,800])
 const heading=words.find(w=>w.text==='TABLE')!,subtitle=words.filter(w=>w.rect.y>60&&w.rect.y<75&&w.rect.x<570)
 expect(subtitle.length).toBeGreaterThan(4)
 expect(subtitle.every(w=>w.visualBlock===heading.visualBlock)).toBe(true)
 expect(words.find(w=>w.text==='70')!.visualBlock).not.toBe(heading.visualBlock)
})
