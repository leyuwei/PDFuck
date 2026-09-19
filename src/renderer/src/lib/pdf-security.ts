import { Certificate, ContentInfo, SignedData, type RelativeDistinguishedNames } from 'pkijs'
import type { PdfSignatureInfo } from '../../../shared/contracts'

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function derBytes(bytes: Uint8Array): Uint8Array | undefined {
  if (bytes[0] !== 0x30 || bytes.length < 2) return undefined
  const first = bytes[1]
  if (first < 0x80) return bytes.slice(0, first + 2)
  const count = first & 0x7f
  if (!count || count > 4 || bytes.length < count + 2) return undefined
  let length = 0
  for (let index = 0; index < count; index += 1) length = length * 256 + bytes[index + 2]
  const total = count + 2 + length
  return total <= bytes.length ? bytes.slice(0, total) : undefined
}

function commonName(name: RelativeDistinguishedNames): string | undefined {
  const value = name.typesAndValues.find((entry) => entry.type === '2.5.4.3')?.value.valueBlock.value
  return typeof value === 'string' ? value : undefined
}

async function verifySignature(data: Uint8Array, cmsBytes: Uint8Array, ranges: number[]): Promise<Omit<PdfSignatureInfo, 'coversWholeDocument'>> {
  try {
    const cms = derBytes(cmsBytes)
    if (!cms) return { status: 'unsupported' }
    const content = ContentInfo.fromBER(arrayBuffer(cms))
    const signedData = new SignedData({ schema: content.content })
    const signed = new Uint8Array(ranges[1] + ranges[3])
    signed.set(data.subarray(ranges[0], ranges[0] + ranges[1]))
    signed.set(data.subarray(ranges[2], ranges[2] + ranges[3]), ranges[1])
    const result = await signedData.verify({ signer: 0, data: arrayBuffer(signed), checkChain: false, extendedMode: true })
    const certificate = result.signerCertificate instanceof Certificate ? result.signerCertificate : undefined
    return {
      status: result.signatureVerified ? 'valid' : 'invalid',
      signer: certificate ? commonName(certificate.subject) : undefined,
      issuer: certificate ? commonName(certificate.issuer) : undefined,
      validFrom: certificate?.notBefore.value.toISOString(),
      validTo: certificate?.notAfter.value.toISOString()
    }
  } catch (error) {
    const result = error as { signatureVerified?: boolean | null; signerCertificate?: Certificate | null }
    const certificate = result.signerCertificate instanceof Certificate ? result.signerCertificate : undefined
    return {
      status: result.signatureVerified === false ? 'invalid' : 'unsupported',
      signer: certificate ? commonName(certificate.subject) : undefined,
      issuer: certificate ? commonName(certificate.issuer) : undefined,
      validFrom: certificate?.notBefore.value.toISOString(),
      validTo: certificate?.notAfter.value.toISOString()
    }
  }
}

/** Validate detached CMS signatures without claiming operating-system trust. */
export async function pdfSignatures(data: Uint8Array, signatureFieldCount = 0): Promise<PdfSignatureInfo[]> {
  const source = new TextDecoder('latin1').decode(data)
  const objectPattern = /\d+\s+\d+\s+obj\b/g
  const objects: number[] = []
  for (let match = objectPattern.exec(source); match; match = objectPattern.exec(source)) objects.push(match.index)
  const byteRangePattern = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g
  const signatures: PdfSignatureInfo[] = []
  for (let match = byteRangePattern.exec(source); match; match = byteRangePattern.exec(source)) {
    const ranges = match.slice(1).map(Number)
    let objectStart = Math.max(0, match.index - 65_536)
    for (let index = objects.length - 1; index >= 0; index -= 1) if (objects[index] < match.index) { objectStart = objects[index]; break }
    const objectEnd = source.indexOf('endobj', match.index)
    const object = source.slice(objectStart, objectEnd < 0 ? Math.min(source.length, match.index + 65_536) : objectEnd)
    const contents = /\/Contents\s*<([0-9a-f\s]+)>/i.exec(object)?.[1]?.replace(/\s/g, '')
    const structurallyValid = ranges[0] === 0 && ranges.every(Number.isSafeInteger) && ranges.every((value) => value >= 0)
      && ranges[0] + ranges[1] <= ranges[2] && ranges[2] + ranges[3] <= data.length
    if (!contents || contents.length % 2 || !structurallyValid) {
      signatures.push({ status: 'unsupported', coversWholeDocument: false })
      continue
    }
    const cms = Uint8Array.from(contents.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)))
    signatures.push({ ...(await verifySignature(data, cms, ranges)), coversWholeDocument: ranges[2] + ranges[3] === data.length })
  }
  while (signatures.length < signatureFieldCount) signatures.push({ status: 'unsigned', coversWholeDocument: false })
  return signatures
}
