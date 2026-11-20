import type { InterfaceLanguage } from '../../../shared/i18n-catalogue'

export type ResponseLanguage = InterfaceLanguage | 'source'
type LatinLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt'

const commonWords: Record<LatinLanguage, Set<string>> = {
  en: new Set('the and of to in is that for with are was as from this these their by we our which on have has text results into review every document page'.split(' ')),
  es: new Set('el la los las un una de del y en que para con por se estos esta son como sus sobre pero entre nuestro nuestra texto mediante resultados redacción revise'.split(' ')),
  fr: new Set('le la les des du de et en que pour avec dans ces cette ce est sont nous notre leurs une un sur mais aux texte entre afin selon revue paragraphe dont les résultats'.split(' ')),
  de: new Set('der die das den dem des ein eine einer und ist sind für mit von auf im zu zum zur sich auch diese dieser zwischen durch wir sie ihren absatz ergebnisse'.split(' ')),
  pt: new Set('o a os as um uma de do da dos das e em que para com por este esta são como seus suas sobre mas entre nosso nossa texto pelo pela através resultados seção'.split(' '))
}
const latinLanguages = Object.keys(commonWords) as LatinLanguage[]

function latinLanguage(text: string): LatinLanguage | undefined {
  const scores: Record<LatinLanguage, number> = { en: 0, es: 0, fr: 0, de: 0, pt: 0 }
  for (const token of text.toLowerCase().match(/[\p{Script=Latin}\p{M}]+/gu) || []) {
    const candidates = latinLanguages.filter(language => commonWords[language].has(token))
    for (const language of candidates) scores[language] += 1 / candidates.length
    if (/[äöß]/u.test(token)) scores.de += 2
    if (/[ãõ]/u.test(token)) scores.pt += 2
    if (/[àâæèêëîïôœùûÿ]/u.test(token)) scores.fr += 2
    if (/[ñíóú]/u.test(token)) scores.es += 2
  }
  if (/[¿¡]/u.test(text)) scores.es += 2
  const best = latinLanguages.reduce((best, language) => scores[language] > scores[best] ? language : best, 'en')
  return scores[best] > 0 ? best : undefined
}

/** Measure the submitted prose. A foreign quotation or a localized page label should not switch the answer. */
export function sourceAiLanguage(text: string, fallback?: InterfaceLanguage): InterfaceLanguage | undefined {
  const source = text.normalize('NFC').replace(/^\s*---\s*(?:Page|第)?\s*\d+\s*(?:页)?\s*---\s*$/gimu, '')
  const counts = { ko: 0, ar: 0, ru: 0, ja: 0, zh: 0, latin: 0, other: 0 }
  for (const line of source.split(/\r?\n/u)) {
    const han = line.match(/\p{Script=Han}/gu)?.length || 0
    const kana = line.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length || 0
    const ko = line.match(/\p{Script=Hangul}/gu)?.length || 0
    const ar = line.match(/(?=\p{Letter})\p{Script=Arabic}/gu)?.length || 0
    const ru = line.match(/\p{Script=Cyrillic}/gu)?.length || 0
    const latin = line.match(/\p{Script=Latin}/gu)?.length || 0
    const letters = line.match(/\p{Letter}/gu)?.length || 0
    const japaneseHan = kana > 0 && kana >= han * .2 ? han : 0
    counts.ko += ko
    counts.ar += ar
    counts.ru += ru
    counts.ja += kana + japaneseHan
    counts.zh += han - japaneseHan
    counts.latin += latin
    counts.other += Math.max(0, letters - han - kana - ko - ar - ru - latin)
  }
  const scripts = Object.keys(counts) as Array<keyof typeof counts>
  const leading = scripts.reduce((best, script) => counts[script] > counts[best] ? script : best)
  if (!counts[leading]) return fallback
  if (leading === 'other') return undefined
  return leading === 'latin' ? latinLanguage(source) ?? fallback : leading
}

const reply: Record<InterfaceLanguage, string> = {
  zh: '请用中文回答。', en: 'Respond in English.', ja: '日本語で回答してください。', ru: 'Отвечайте на русском языке.',
  es: 'Responda en español.', fr: 'Répondez en français.', de: 'Antworten Sie auf Deutsch.', pt: 'Responda em português.',
  ko: '한국어로 답변하세요.', ar: 'أجب باللغة العربية.'
}
const followSource: Record<InterfaceLanguage, string> = {
  zh: '请使用待处理内容的主要语言回答。', en: 'Respond in the predominant language of the material being reviewed.',
  ja: '対象資料で主に使用されている言語で回答してください。', ru: 'Отвечайте на основном языке рассматриваемого материала.',
  es: 'Responda en el idioma predominante del material revisado.', fr: 'Répondez dans la langue principale du contenu examiné.',
  de: 'Antworten Sie in der vorherrschenden Sprache des geprüften Inhalts.', pt: 'Responda no idioma predominante do material analisado.',
  ko: '검토 대상 자료의 주된 언어로 답변하세요.', ar: 'أجب باللغة السائدة في المادة التي تراجعها.'
}

export function responseLanguageInstruction(language: ResponseLanguage, locale: InterfaceLanguage = 'en'): string {
  return language === 'source' ? followSource[locale] : reply[language]
}

const explicitLanguage = /(?:[最]?[后後]\s*)?(?:[请請]\s*)?(?:用|使用|以)\s*(?:简体中文|簡體中文|繁体中文|繁體中文|中文|汉语|漢語|英语|英語|英文|日语|日語|日文|俄语|俄文|西班牙语|法语|法文|德语|德文|葡萄牙语|韩语|韓語|韩文|阿拉伯语|English)\s*(?:[来來]\s*)?(?:作答|回答|回复|回覆)[。.!！]?|(?:finally,?\s+)?(?:please\s+)?(?:respond|reply|answer) in (?:English|Chinese|Mandarin|Japanese|Russian|Spanish|French|German|Portuguese|Korean|Arabic)\b[.!]?/giu

export function withoutResponseLanguage(instruction: string): string {
  let body = instruction
  for (const directive of [...Object.values(reply), ...Object.values(followSource)]) body = body.split(directive).join('')
  return body.replace(explicitLanguage, '').trim()
}

export function withResponseLanguage(instruction: string, language: ResponseLanguage, locale: InterfaceLanguage = 'en'): string {
  return [withoutResponseLanguage(instruction), responseLanguageInstruction(language, locale)].filter(Boolean).join('\n\n')
}
