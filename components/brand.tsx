/**
 * The GoalVault mark: a vault wheel whose hub is a football panel. Drawn inline
 * so it is crisp at any size and needs no extra request; the same artwork
 * lives in public/logo-mark.svg for icons and sharing.
 */
export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#0b6e4f" />
      <g fill="#ffffff" opacity="0.9">
        <circle cx="41.95" cy="7.98" r="2.2" /><circle cx="56.02" cy="22.05" r="2.2" /><circle cx="56.02" cy="41.95" r="2.2" /><circle cx="41.95" cy="56.02" r="2.2" />
        <circle cx="22.05" cy="56.02" r="2.2" /><circle cx="7.98" cy="41.95" r="2.2" /><circle cx="7.98" cy="22.05" r="2.2" /><circle cx="22.05" cy="7.98" r="2.2" />
      </g>
      <circle cx="32" cy="32" r="20.5" fill="none" stroke="#ffffff" strokeWidth="4" />
      <g stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round">
        <line x1="32" y1="23.5" x2="32" y2="15" /><line x1="40.08" y1="29.37" x2="48.17" y2="26.75" /><line x1="37" y1="38.88" x2="41.99" y2="45.75" />
        <line x1="27" y1="38.88" x2="22.01" y2="45.75" /><line x1="23.92" y1="29.37" x2="15.83" y2="26.75" />
      </g>
      <polygon points="32,23.5 40.08,29.37 37,38.88 27,38.88 23.92,29.37" fill="#ff7a1a" stroke="#ff7a1a" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

/** Mark plus wordmark. `tone` is the colour of "Goal": white on dark, ink on light. */
export function BrandLogo({ size = 28, tone = 'light', className = '', wordmarkClassName = '' }: { size?: number; tone?: 'light' | 'dark'; className?: string; wordmarkClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap font-extrabold tracking-tight ${className}`}>
      <BrandMark size={size} className={tone === 'light' ? 'rounded-[10px] ring-1 ring-white/25' : ''} />
      <span className={wordmarkClassName}>
        <span className={tone === 'light' ? 'text-white' : 'text-[#0f1f1a]'}>Goal</span>
        <span className="text-[#ff7a1a]">Vault</span>
      </span>
    </span>
  )
}
