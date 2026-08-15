function numericParts(value: string): number[] {
  const match = value.trim().replace(/^v/i, '').match(/^\d+(?:\.\d+)*/)
  return match ? match[0].split('.').map(Number) : []
}

export function compareVersions(left: string, right: string): number {
  const a = numericParts(left), b = numericParts(right)
  if (!a.length || !b.length) return 0
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0)
    if (difference) return difference > 0 ? 1 : -1
  }
  return 0
}
