/** Decode a PDF ToUnicode table, including ligatures and array ranges. */
export function readUnicodeCmap(text: string): Map<number, string> {
  const pairs = new Map<number, string>()
  const decode = (hex: string) => String.fromCharCode(...(hex.replace(/\s/g, '').match(/.{4}/g) || []).map(value => parseInt(value, 16)))
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const pair of block[1].matchAll(/<([\da-f]+)>\s*<([\da-f\s]+)>/gi)) pairs.set(parseInt(pair[1], 16), decode(pair[2]))
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const pair of block[1].matchAll(/<([\da-f]+)>\s*<([\da-f]+)>\s*(?:<([\da-f]+)>|\[([^\]]*)\])/gi)) {
    const start = parseInt(pair[1], 16), end = parseInt(pair[2], 16)
    if (end < start || end - start > 65535) throw new Error('ui.nativeTextUnsupported')
    const values = pair[4] ? [...pair[4].matchAll(/<([\da-f\s]+)>/gi)].map(value => decode(value[1])) : undefined
    for (let code = start; code <= end; code++) {
      const value = values ? values[code - start] : decode((BigInt('0x' + pair[3]) + BigInt(code - start)).toString(16).padStart(pair[3].length, '0'))
      if (value !== undefined) pairs.set(code, value)
    }
  }
  return pairs
}
