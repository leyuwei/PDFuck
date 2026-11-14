export type ReadingIconKind = 'search' | 'bookmark' | 'visual' | 'citation' | 'abbreviation' | 'grammar'
export function ReadingIcon({kind}: {kind: ReadingIconKind}) {
  return <svg className={`edit-tool-icon reading-tool-icon ${kind}`} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    {kind==='search' && <><circle cx="10.5" cy="10.5" r="6.5"/><path className="accent" d="m15.5 15.5 5 5"/><path d="M8 8h5M8 11h3"/></>}
    {kind==='bookmark' && <><path d="M6 3h12v18l-6-4-6 4z"/><path className="accent" d="M9 7h6M9 10h4"/></>}
    {kind==='visual' && <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 4v16"/><path className="accent" d="m12 17 3-4 3 3 2-3"/></>}
    {kind==='citation' && <><path d="M10 14 14 10M8 16l-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M13 16a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-1 1"/><path className="accent" d="M5 20h5M14 4h5"/></>}
    {kind==='abbreviation' && <><path d="M5 4H3v16h2M19 4h2v16h-2M7 16l3-8 3 8M8 13h4"/><path className="accent" d="M15 8h2M15 12h2M15 16h2"/></>}
    {kind==='grammar' && <><path d="M4 5h13M4 10h9M4 15h6M4 20h6"/><path className="accent" d="m13 17 3 3 5-7"/></>}
  </svg>
}
