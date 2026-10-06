import iconv from 'iconv-lite'
import { analyse } from 'chardet'
import { isTextEncoding, type TextEncoding } from '../shared/markdown'

function codec(encoding: TextEncoding): string { return encoding === 'utf-8-bom' ? 'utf-8' : encoding }
export function encodeText(source: string, encoding: TextEncoding = 'utf-8'): Buffer {
  if (!isTextEncoding(encoding)) throw new Error('text.invalidEncoding')
  const data = iconv.encode(source, codec(encoding))
  // Reject substitutions before writing; legacy encodings cannot represent every Unicode character.
  if (iconv.decode(data, codec(encoding), { stripBOM: false }) !== source) throw new Error('text.lossyEncoding')
  const bom = encoding === 'utf-8-bom' ? [0xef, 0xbb, 0xbf] : encoding === 'utf-16le' ? [0xff, 0xfe] : encoding === 'utf-16be' ? [0xfe, 0xff] : []
  return Buffer.concat([Buffer.from(bom), data])
}
export function decodeText(data: Uint8Array, requested?: TextEncoding): { source: string; encoding: TextEncoding } {
  const bytes = Buffer.from(data)
  if (requested !== undefined && !isTextEncoding(requested)) throw new Error('text.invalidEncoding')
  const decode = (encoding: TextEncoding) => {
    const source = iconv.decode(bytes, codec(encoding))
    const hex = bytes.subarray(0, 3).toString('hex')
    const original = /^utf-8/.test(encoding) && hex === 'efbbbf' ? bytes.subarray(3)
      : encoding === 'utf-16le' && hex.startsWith('fffe') || encoding === 'utf-16be' && hex.startsWith('feff') ? bytes.subarray(2) : bytes
    if (!iconv.encode(source, codec(encoding)).equals(original) || /[\u0000-\u0008\u000e-\u001f]/u.test(source)) throw new Error('text.invalidEncoding')
    return { source, encoding }
  }
  if (requested) return decode(requested)
  const hex = bytes.subarray(0, 3).toString('hex')
  if (hex === 'efbbbf') return decode('utf-8-bom')
  if (hex.startsWith('fffe')) return decode('utf-16le')
  if (hex.startsWith('feff')) return decode('utf-16be')
  if (bytes.length >= 4) {
    const sample = bytes.subarray(0, 4000), zeros = [0, 0]
    sample.forEach((byte, index) => { if (!byte) zeros[index % 2]++ })
    if (zeros[1] > sample.length / 5 && zeros[0] < sample.length / 20) return decode('utf-16le')
    if (zeros[0] > sample.length / 5 && zeros[1] < sample.length / 20) return decode('utf-16be')
  }
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return decode('utf-8') } catch { /* Try legacy encodings. */ }
  // ponytail: unlabelled encodings can remain ambiguous; expose an explicit reread override.
  const candidates = analyse(bytes)
  // Short Chinese text followed by ASCII can look Latin to the statistical detector.
  if (/^(ISO-8859-(1|15)|windows-1252|ASCII)$/i.test(candidates[0]?.name || '') && /[\xa1-\xfe]{4,}/.test(bytes.toString('latin1'))) {
    try { return decode('gb18030') } catch { /* Retain the ranked candidates. */ }
  }
  for (const candidate of candidates) {
    const name = candidate.name.toLowerCase(), encoding = name === 'gb18030' || name === 'gbk' ? 'gb18030'
      : name === 'shift-jis' ? 'shift_jis' : name === 'iso-8859-1' || name === 'iso-8859-15' ? 'windows-1252'
        : name === 'iso-8859-5' ? 'windows-1251' : name
    if (!isTextEncoding(encoding) || encoding.startsWith('utf-')) continue
    try {
      return decode(encoding)
    } catch { /* Try the next statistically ranked, lossless candidate. */ }
  }
  return decode('windows-1252')
}
