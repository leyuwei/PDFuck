import { expect, it } from 'vitest'
import { focusScrollDelta } from '../../../src/renderer/src/lib/focus-navigation'
import { inlineAnnotationPosition } from '../../../src/renderer/src/components/InlineAnnotation'
it.each([[30,60,0],[20,80,0],[10,40,-10],[60,100,20],[10,120,-10],[30,150,10]])('reveals %s..%s with only the required offset',(a,b,delta)=>expect(focusScrollDelta(a,b,20,80)).toBe(delta))
it('keeps a card inside the viewport when the annotation fills it',()=>{const area={x:0,y:0,width:300,height:200};expect(inlineAnnotationPosition(area,area,360,420)).toEqual({left:0,top:0,width:300,maxHeight:200})})
