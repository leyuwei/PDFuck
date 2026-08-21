/**
 * Windows may report read-only files and locked folders with either EACCES or
 * EPERM. A file currently held by another program is commonly EBUSY. In all
 * three cases the safe recovery is to preserve the in-memory edits and let the
 * user choose a different destination.
 */
export function requiresSaveAs(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return code === 'EACCES' || code === 'EPERM' || code === 'EROFS' || code === 'EBUSY'
}
