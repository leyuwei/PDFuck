export type AiFailure = 'network' | 'timeout' | 'rate' | 'service' | 'input' | 'budget' | 'structure' | 'configuration' | 'cancelled'
export class AiFailureError extends Error {
  constructor(public kind: AiFailure, message: string, public status?: number, public retryAfterMs?: number) { super(message) }
}
export function classifyAiFailure(cause: unknown): AiFailure {
  if (cause instanceof AiFailureError) return cause.kind
  const text = cause instanceof Error ? cause.message : String(cause)
  if (/cancel|取消/iu.test(text)) return 'cancelled'
  if (/aiCertificateFailure|aiDnsFailure/iu.test(text)) return 'configuration'
  if (/timeout|timed.?out|aiFirstOutputTimeout|aiStreamIdleTimeout|超时/iu.test(text)) return 'timeout'
  if (/truncat|token.*(?:budget|limit)|max_tokens/iu.test(text)) return 'budget'
  if (/context.*(?:length|window|limit)|too.*(?:long|large)|exceeds.*limit|413/iu.test(text)) return 'input'
  if (/structure|schema|json|automaticAnnotation.*(?:Response|Finding)|结构/iu.test(text)) return 'structure'
  if (/network|fetch|连接模型|ECONN|ENOTFOUND|socket/iu.test(text)) return 'network'
  return 'configuration'
}
export function classifyAiResponse(status: number, body: string): AiFailure {
  if ([401,403,404].includes(status) || /insufficient_quota|billing|credit|余额|额度不足|quota.*exceed/iu.test(body)) return 'configuration'
  if (status === 413 || /context.*(?:length|window|limit)|input.*(?:too long|too large)/iu.test(body)) return 'input'
  if (status === 429) return 'rate'
  if ([408,504,524].includes(status)) return 'timeout'
  if (status >= 500) return 'service'
  return 'configuration'
}
