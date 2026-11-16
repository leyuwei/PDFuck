export const captionPattern = /^(?:(?:fig(?:ure)?\.?|image|plate|table|tab\.?)\s*(?:\d+(?:[.\-–]\d+)*[a-z]?|[IVXLCDM]+)\b|[图表]\s*\d+(?:[.\-–]\d+)*[a-z]?)/i
/** A sentence referring to a table or figure is ordinary prose. */
export function captionLabel(text:string):string|undefined {
 const match=text.trim().match(captionPattern)
 if(!match)return
 const rest=text.trim().slice(match[0].length).trim()
 if(/^(?:(?:also|further|above|below|clearly|briefly)\s+)*(?:shows?|illustrates?|details?|lists?|reports?|focus(?:es)?|discuss(?:es)?|plots?|indicates?|demonstrates?|gives?|depicts?|describes?|contains?|is|are|was|were|can|provides?|compares?|summarizes?|presents?)\b|^(?:所示|显示|展示|说明|给出)/i.test(rest))return
 return match[0]
}
