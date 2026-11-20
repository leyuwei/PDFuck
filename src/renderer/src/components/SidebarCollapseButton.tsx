export function SidebarCollapseButton({ label, onClick, side = 'start' }: { label: string; onClick?: () => void; side?: 'start' | 'end' }) {
  return <button type="button" className="sidebar-hide" data-side={side} aria-expanded="true" aria-label={label} title={label} onClick={onClick}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16m8-12-4 4 4 4" />
    </svg>
  </button>
}
