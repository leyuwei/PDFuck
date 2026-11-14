import { cp, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

// Keep downloads outside the installation and Electron's disposable profile/cache directories.
export function resourceStorageRoot(appData: string, userData: string, isolated = false): string {
  return isolated ? join(userData, 'feature-resources') : join(appData, 'PDFuck-resources')
}

export async function migrateResourceStorage(previous: string, destination: string): Promise<void> {
  if (previous === destination) return
  let entries
  try { entries = await readdir(previous, { withFileTypes: true }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error }
  await mkdir(destination, { recursive: true })
  // Retain the old copy until the new install has successfully used it; never overwrite newer files.
  for (const entry of entries) {
    if (entry.name.startsWith('.install-')) continue
    await cp(join(previous, entry.name), join(destination, entry.name), { recursive: true, force: false, errorOnExist: false, verbatimSymlinks: true })
  }
}
