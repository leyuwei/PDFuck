export function encodeRgbEps(rgb: Uint8Array, pixelWidth: number, pixelHeight: number, widthPoints: number, heightPoints: number): Uint8Array {
  const chunks: string[] = []
  let line = ''
  for (const value of rgb) {
    line += value.toString(16).padStart(2, '0')
    if (line.length >= 120) { chunks.push(line); line = '' }
  }
  if (line) chunks.push(line)
  const header = `%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${Math.ceil(widthPoints)} ${Math.ceil(heightPoints)}\n%%Pages: 1\n%%EndComments\ngsave\n${widthPoints} ${heightPoints} scale\n/picstr ${pixelWidth * 3} string def\n${pixelWidth} ${pixelHeight} 8\n[${pixelWidth} 0 0 -${pixelHeight} 0 ${pixelHeight}]\n{currentfile picstr readhexstring pop} false 3 colorimage\n`
  return new TextEncoder().encode(`${header}${chunks.join('\n')}\ngrestore\nshowpage\n%%EOF\n`)
}
