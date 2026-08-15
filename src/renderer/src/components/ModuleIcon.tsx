import type { ModuleKey } from '../types'

export function ModuleIcon({ module }: { module: ModuleKey }) {
  const common = { width: 25, height: 25, viewBox: '0 0 24 24', 'aria-hidden': true as const }
  if (module === 'view') return <svg {...common} className="module-icon"><path d="M6.5 3.5h8l3 3v5.2" /><path d="M6.5 3.5v17h6" /><path d="M14.5 3.5v3h3" /><circle cx="15.5" cy="15.5" r="3.3" /><path d="m18 18 2.5 2.5" /></svg>
  if (module === 'edit') return <svg {...common} className="module-icon"><path d="M6 3.5h8l3 3v5" /><path d="M14 3.5v3h3" /><path d="M6 3.5v17h6" /><path d="m12.2 18.8.7-3.2 5.6-5.6 2.5 2.5-5.6 5.6-3.2.7Z" /><path d="m17.4 11.1 2.5 2.5" /></svg>
  if (module === 'annotate') return <svg {...common} className="module-icon"><path d="M4 4.5h16v12H9l-5 4v-16Z" /><path d="M8 9h8M8 12.5h5" /><path className="module-icon-accent" d="M15.5 16.5 19 13" /></svg>
  return <svg {...common} className="module-icon"><path d="M5 3.5h12l2 2v15H5v-17Z" /><path d="M8 3.5v6h8v-6" /><path d="M8 20.5v-7h8v7" /><path className="module-icon-accent" d="M10.5 6.5h3" /></svg>
}
