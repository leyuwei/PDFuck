const figures = String.raw`fig(?:ure|ura)?\.?|image|plate|gráfic[ao]|abb(?:ildung)?\.?|grafik|рис(?:унок)?\.?|иллюстрация|图|圖|図|그림|도표|(?:ال)?شكل|رسم`
const tables = String.raw`table(?:au)?|tab\.?|tabela|tabla|tabelle|табл(?:ица)?\.?|表|표|(?:ال)?جدول`
const marker = `(?:${figures}|${tables})`
export const captionMarkerPattern = new RegExp(`^${marker}$`, 'iu')
export const captionNumberPattern = /^(?:\p{Nd}+(?:[.\-–]\p{Nd}+)*[a-z]?|[IVXLCDM]+)[.):：]?$|^\p{Nd}+\([a-z]\)$/iu
export const captionPattern = new RegExp(String.raw`^(?:${marker}\s*(?:\p{Nd}+(?:[.\-–]\p{Nd}+)*[a-z]?|[IVXLCDM]+)(?![\p{L}\p{N}])|[图圖図表]\s*\p{Nd}+(?:[.\-–]\p{Nd}+)*[a-z]?)`, 'iu')
const tablePrefix = new RegExp(String.raw`^(?:${tables})(?=\s|\p{Nd}|[IVXLCDM]|$)`, 'iu')
const compact = '图圖図表'
const referenceNumber = String.raw`(?:\p{Nd}+(?:[.\-–]\p{Nd}+)*(?:\([a-z]\)|[a-z](?![a-z]))?|[IVXLCDM]+(?![a-z]))`
const referenceMarkers = marker.replaceAll(String.raw`\.?`, String.raw`\s*\.?`)
const visualReferencePattern = new RegExp(String.raw`第\s*(?<ordinal>\p{Nd}+)\s*(?<ordinalMarker>[図表])|(?:(?<marker>[${compact}])|(?:(?<![\p{L}\p{N}])|(?<=(?:^|[^\p{L}\p{N}])و)(?=\p{Script=Arabic}))(?<word>${referenceMarkers}))\s*(?<number>${referenceNumber})(?![\p{N}]|[a-z])`, 'giu')

/** Scan the body using the same localized marker vocabulary as caption recognition. */
export function visualReferences(text: string) {
  return [...text.matchAll(visualReferencePattern)].map(match => ({
    index: match.index, label: match[0], kind: captionKind(match.groups!.marker || match.groups!.ordinalMarker || match.groups!.word.replace(/\s+/g, '')),
    number: match.groups!.number || match.groups!.ordinal
  }))
}

/** A sentence referring to a table or figure is ordinary prose. */
export function captionLabel(text: string): string | undefined {
  const trimmed = text.trim()
  const match = trimmed.match(captionPattern)
  if (!match) return
  const rest = trimmed.slice(match[0].length).trim()
  if (/^(?:(?:also|further|above|below|clearly|briefly)\s+)*(?:shows?|illustrates?|details?|lists?|reports?|focus(?:es)?|discuss(?:es)?|plots?|indicates?|demonstrates?|gives?|depicts?|describes?|contains?|is|are|was|were|can|provides?|compares?|summarizes?|presents?)\b|^(?:所示|显示|展示|说明|给出|に示|を示|에서|은\s|는\s)|^(?:montre|illustre|présente|zeigt|beschreibt|muestra|presenta|mostra|apresenta|показывает|представляет|يوضح|يبين)(?!\p{L})/iu.test(rest)) return
  return match[0]
}

export function captionKind(label: string): 'table' | 'figure' {
  return tablePrefix.test(label) ? 'table' : 'figure'
}
