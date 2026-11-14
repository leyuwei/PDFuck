export function HistoryIcon({direction}: {direction:'undo'|'redo'}) {
  return <svg className={`history-icon ${direction}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><g transform={direction==='redo'?'translate(24 0) scale(-1 1)':undefined}><path d="m8 4-5 5 5 5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></g></svg>
}
