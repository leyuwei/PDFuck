export type EditIconKind = 'crop' | 'merge' | 'manage' | 'edit_text' | 'add_text' | 'image' | 'page_numbers'

export function EditIcon({ kind, size = 22 }: { kind: EditIconKind; size?: number }) {
  return <svg className={`edit-tool-icon ${kind}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {kind === 'crop' && <><path d="M7 3v14a2 2 0 0 0 2 2h12" /><path d="M3 7h14a2 2 0 0 1 2 2v12" /><path className="accent" d="M4 4h3v3M17 17h3v3" /></>}
    {kind === 'merge' && <><path d="M5 4h8l3 3v9H5z" /><path d="M13 4v3h3" /><path d="M9 19h10V9" /><path className="accent" d="M9 11h4M11 9v4" /></>}
    {kind === 'manage' && <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M15 16h5M18 13l2 3-2 3" /><path className="accent" d="M7 6.5v1M17 6.5v1M7 16.5v1" /></>}
    {kind === 'edit_text' && <><path d="M4 5h11M9.5 5v14M6.5 19h6" /><path d="m14 17 .6-2.7 4.8-4.8 2.1 2.1-4.8 4.8z" /><path className="accent" d="m18.4 10.5 2.1 2.1" /></>}
    {kind === 'add_text' && <><path d="M4 5h11M9.5 5v14M6.5 19h6" /><path className="accent" d="M17.5 13v7M14 16.5h7" /></>}
    {kind === 'image' && <><rect x="3.5" y="5" width="14" height="14" rx="2" /><circle cx="8" cy="9.5" r="1.5" /><path d="m5.5 17 3.8-4 2.5 2.3 2.2-2.2 3.5 3.5" /><path className="accent" d="M19.5 3.5v6M16.5 6.5h6" /></>}
    {kind === 'page_numbers' && <><path d="M5 3.5h10l4 4v13H5z" /><path d="M15 3.5v4h4" /><path className="accent" d="M9 11.5h6M8.5 15h6M11 10l-1 7M14 10l-1 7" /></>}
  </svg>
}
