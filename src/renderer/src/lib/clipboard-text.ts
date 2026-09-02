const CONTINUOUS_SCRIPT = /[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Thai}\p{Script_Extensions=Lao}\p{Script_Extensions=Khmer}\p{Script_Extensions=Myanmar}]/u
const COMBINING_MARK = /\p{Mark}/u
const OPENING = /[(\[\{“‘《〈「『【〔（［｛]/u
const CLOSING_OR_PUNCTUATION = /[)\]\}”’》〉」』】〕）］｝,.;:!?，。；：！？、]/u

function joinWithoutInsertedSpace(left: string, right: string): boolean {
  return CONTINUOUS_SCRIPT.test(left) || CONTINUOUS_SCRIPT.test(right) || COMBINING_MARK.test(right) || OPENING.test(left) || CLOSING_OR_PUNCTUATION.test(right)
}

/** Convert PDF line-wrapped text into clipboard text that reads like normal prose. */
export function normalizeCopiedText(value: string): string {
  const dehyphenated = value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00ad/g, '')
    .replace(/(\p{L}{2,})-[ \t]*\n[ \t]*(?=\p{Ll}{2})/gu, '$1')
    .replace(/(\p{L}{2,})-[ \t]+(?=\p{Ll}{2})/gu, '$1')
  const lines = dehyphenated.split('\n').map((line) => line.replace(/[\t\u00a0 ]+/g, ' ').trim()).filter(Boolean)
  return lines.reduce((result, line) => {
    if (!result) return line
    const left = Array.from(result).at(-1) || ''
    const right = Array.from(line)[0] || ''
    return `${result}${joinWithoutInsertedSpace(left, right) ? '' : ' '}${line}`
  }, '').replace(/[\t\u00a0 ]+/g, ' ').trim()
}
