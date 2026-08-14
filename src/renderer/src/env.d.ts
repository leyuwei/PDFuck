import type { DesktopApi } from '../../shared/contracts'

declare global {
  interface Window { desktop: DesktopApi }
}

export {}
