'use client'

import { Eye, EyeOff } from 'lucide-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * One switch for every balance on the site. Hiding it on the header hides it on
 * the Me page, the deposit and withdraw screens and the games too, and the
 * choice is remembered on this device.
 */
export const useBalancePrivacy = create<{ hidden: boolean; toggle: () => void }>()(
  persist((set) => ({ hidden: false, toggle: () => set((s) => ({ hidden: !s.hidden })) }), { name: 'gv-hide-balance' }),
)

export const MASK = '••••'

/** A balance figure that respects the switch. */
export function BalanceText({ children }: { children: string }) {
  const hidden = useBalancePrivacy((s) => s.hidden)
  return <span className="tabular-nums">{hidden ? MASK : children}</span>
}

/** The eye button that flips the switch. */
export function BalanceToggle({ size = 16, className = '' }: { size?: number; className?: string }) {
  const hidden = useBalancePrivacy((s) => s.hidden)
  const toggle = useBalancePrivacy((s) => s.toggle)
  return (
    <button onClick={toggle} className={`inline-flex shrink-0 items-center justify-center ${className}`} aria-label={hidden ? 'Show balance' : 'Hide balance'} aria-pressed={hidden}>
      {hidden ? <EyeOff size={size} /> : <Eye size={size} />}
    </button>
  )
}
