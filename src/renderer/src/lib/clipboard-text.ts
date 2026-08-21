const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/
const OPENING = /[(\[\{“‘《〈「『【]/
const CLOSING_OR_PUNCTUATION = /[)\]\}”’》〉」』】,.;:!?，。；：！？、]/

function joinWithoutInsertedSpace(left: string, right: string): boolean {
  return (CJK.test(left) && CJK.test(right)) || OPENING.test(left) || CLOSING_OR_PUNCTUATION.test(right)
}

/** Convert PDF line-wrapped text into clipboard text that reads like normal prose. */
export function normalizeCopiedText(value: string): string {
  const dehyphenated = value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z]{2,})-[ \t]*\n[ \t]*(?=[a-z]{2})/g, '$1')
    .replace(/([A-Za-z]{2,})-[ \t]+(?=[a-z]{2})/g, '$1')
  const lines = dehyphenated.split('\n').map((line) => line.replace(/[\t\u00a0 ]+/g, ' ').trim()).filter(Boolean)
  return lines.reduce((result, line) => {
    if (!result) return line
    const left = Array.from(result).at(-1) || ''
    const right = Array.from(line)[0] || ''
    return `${result}${joinWithoutInsertedSpace(left, right) ? '' : ' '}${line}`
  }, '').replace(/[\t\u00a0 ]+/g, ' ').trim()
}
