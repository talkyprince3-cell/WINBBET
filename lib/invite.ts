/**
 * Sub-admin invite codes. A player who arrives through ?invite=CODE keeps that
 * code for 30 days, so it is still there when they get round to registering.
 */
const KEY = 'gv-invite'
const TTL_MS = 30 * 86_400_000

export function rememberInvite(code: string) {
  const clean = code.trim().toUpperCase()
  if (!clean) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() }))
  } catch {}
}

export function savedInvite(): string {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return ''
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number }
    if (!code || !at || Date.now() - at > TTL_MS) return ''
    return code
  } catch {
    return ''
  }
}

export function forgetInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}

/** The link a sub-admin shares. */
export function inviteLink(code: string, origin = typeof window === 'undefined' ? '' : window.location.origin) {
  return `${origin}/?invite=${encodeURIComponent(code)}`
}
