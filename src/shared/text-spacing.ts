const CONTINUOUS = '[\\p{Script_Extensions=Han}\\p{Script_Extensions=Hiragana}\\p{Script_Extensions=Katakana}]'
const BETWEEN = new RegExp(`(${CONTINUOUS})[ \\t\\u00a0\\u3000]+(?=${CONTINUOUS})`, 'gu')
const BEFORE_PUNCTUATION = new RegExp(`(${CONTINUOUS})[ \\t\\u00a0\\u3000]+(?=[，。；：！？、）》」』】])`, 'gu')
const AFTER_PUNCTUATION = new RegExp(`([（《「『【])[ \\t\\u00a0\\u3000]+(?=${CONTINUOUS})`, 'gu')

/** Remove OCR/PDF fragment gaps in continuous writing; retain word spaces in other scripts. */
export function normalizeTextSpacing(text: string): string {
  return text.replace(BETWEEN, '$1').replace(BEFORE_PUNCTUATION, '$1').replace(AFTER_PUNCTUATION, '$1')
}
