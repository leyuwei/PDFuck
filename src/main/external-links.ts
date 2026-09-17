const EXTERNAL_LINK_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

/** Renderer-supplied PDF links are untrusted. Keep opening to ordinary web and mail URIs. */
export function validExternalLink(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\u0000-\u001f\u007f]/u.test(value)) return false
  try {
    const url = new URL(value)
    if (!EXTERNAL_LINK_PROTOCOLS.has(url.protocol)) return false
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.hostname) return false
    return true
  } catch { return false }
}
