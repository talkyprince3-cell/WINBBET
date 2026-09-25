'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, Gamepad2, Headphones, House, Menu, ReceiptText, UserRound, X } from 'lucide-react'
import { AuthForm } from '@/components/auth-form'
import { BrandLogo } from '@/components/brand'
import { SiteFooter } from '@/components/info-pages'
import { WinCelebration, hasCelebrated, markCelebrated } from '@/components/tickets'
import { formatMoney } from '@/lib/countries'
import { rememberInvite } from '@/lib/invite'
import { useSession, useSlip, type Player } from '@/lib/store'

type AuthMode = 'login' | 'register'
type Shell = { notify: (message: string) => void; openAuth: (mode?: AuthMode) => void; player: Player | null }

const ShellContext = createContext<Shell>({ notify: () => {}, openAuth: () => {}, player: null })

export const useShell = () => useContext(ShellContext)

const mainNav = [
  ['Sports', '/'],
  ['Games', '/games'],
  ['Live Betting', '/live'],
  ['Virtuals', '/virtuals'],
  ['Jackpot', '/jackpot'],
  ['Promotions', '/promotions'],
  ['Load Code', '/load-code'],
  ['Help', '/help'],
] as const

const accountNav = [
  ['My Account', '/account'],
  ['My Bets', '/my-bets'],
  ['Withdraw', '/withdraw'],
  ['Transactions', '/transactions'],
] as const

const sportTabs = [
  ['Home', '/'],
  ['Football', '/football'],
  ['Live Betting', '/live'],
  ['Casino', '/games'],
  ['Crash Games', '/crash-games'],
  ['Basketball', '/basketball'],
  ['Tennis', '/tennis'],
  ['Virtuals', '/virtuals'],
] as const

// Loaded on demand: the sheet imports the betslip, which imports this shell.
const BetslipSheet = dynamic(() => import('@/components/betslip-sheet'), { ssr: false })

const RECENT_WIN_MS = 3 * 86_400_000

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const storedPlayer = useSession((state) => state.player)
  const signIn = useSession((state) => state.signIn)
  const signOut = useSession((state) => state.signOut)
  const [mounted, setMounted] = useState(false)
  const [auth, setAuth] = useState<AuthMode | null>(null)
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [win, setWin] = useState<{ code: string; amount: number; currency: string } | null>(null)
  const [openBets, setOpenBets] = useState(0)
  const [slipOpen, setSlipOpen] = useState(false)
  const router = useRouter()
  const slipLegs = useSlip((state) => state.legs)
  const slipCount = mounted ? slipLegs.length : 0

  useEffect(() => setMounted(true), [])

  // A sub-admin's invite link: keep the code and invite the visitor to sign up.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('invite')
    if (!code) return
    rememberInvite(code)
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    if (!useSession.getState().player) setAuth('register')
  }, [])

  // The session lives in localStorage, so it is only read after hydration.
  const player = mounted ? storedPlayer : null

  useEffect(() => {
    if (!player?.id) return
    let alive = true
    fetch(`/api/me?userId=${player.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive || !json.user) return
        signIn({
          id: json.user.id,
          name: json.user.name,
          phone: json.user.phone,
          email: json.user.email,
          country_code: json.user.country_code,
          currency: json.user.currency,
          balance: Number(json.user.balance),
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [player?.id, signIn])

  useEffect(() => {
    if (!player?.id) return
    let alive = true
    fetch(`/api/bets/mine?userId=${player.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return
        const bets = (json.bets ?? []) as { code: string; status: string; payout: number | null; potential_win: number; currency: string; settled_at: string | null }[]
        setOpenBets(bets.filter((bet) => bet.status === 'pending').length)
        const fresh = bets.find((bet) =>
          bet.status === 'won' &&
          !hasCelebrated(bet.code) &&
          (!bet.settled_at || Date.now() - new Date(bet.settled_at).getTime() < RECENT_WIN_MS),
        )
        if (!fresh) return
        markCelebrated(fresh.code)
        setWin({ code: fresh.code, amount: Number(fresh.payout ?? fresh.potential_win), currency: fresh.currency })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [player?.id, pathname])

  useEffect(() => {
    setMenuOpen(false)
    setSlipOpen(false)
  }, [pathname])

  const notify = useCallback((message: string) => setNotice(message), [])
  const openAuth = useCallback((mode: AuthMode = 'login') => setAuth(mode), [])
  const shell = useMemo(() => ({ notify, openAuth, player }), [notify, openAuth, player])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
  const bare = pathname.startsWith('/admin') || pathname.startsWith('/sub-admin')
  const gamesPage = pathname.startsWith('/games') || pathname === '/crash-games'
  const accountPage = ['/account', '/deposit', '/withdraw', '/my-bets'].some((href) => isActive(href))

  if (bare) {
    return <ShellContext.Provider value={shell}><main className="min-h-screen bg-[#eef0f4] text-[#24262c]">{children}</main></ShellContext.Provider>
  }

  const topLinks = [...mainNav, ...(player ? accountNav : [])]

  return (
    <ShellContext.Provider value={shell}>
      <main className="min-h-screen bg-[#f1f5f3] text-[#0f1f1a]">
        <header className="sticky top-0 z-40 bg-[#0b6e4f] text-white">
          <div className="mx-auto flex max-w-[1180px] items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
            <button onClick={() => setMenuOpen((open) => !open)} className="shrink-0 md:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
            <Link href="/" aria-label="GoalVault home" className="shrink-0 text-[18px] sm:text-[23px]"><BrandLogo size={26} tone="light" className="gap-1.5 sm:gap-2" wordmarkClassName="max-[359px]:hidden" /></Link>
            <span className="hidden text-xs font-semibold md:block">{player ? player.country_code : 'Ghana'} <ChevronDown size={13} className="inline" /></span>
            <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
              {player ? (
                <>
                  <span className="truncate text-xs font-semibold sm:text-sm">{formatMoney(player.balance, player.currency)}</span>
                  <Link href="/deposit" className="flex h-8 shrink-0 items-center rounded-full bg-[#ff7a1a] px-3.5 text-xs font-bold text-[#0f1f1a] sm:h-9 sm:px-4 sm:text-sm">Deposit</Link>
                  <button onClick={() => signOut()} className="hidden h-9 px-3 text-sm font-semibold sm:block">Logout</button>
                </>
              ) : (
                <>
                  <button onClick={() => setAuth('register')} className="h-8 whitespace-nowrap rounded-full bg-[#ff7a1a] px-3 text-xs font-bold text-[#0f1f1a] sm:h-9 sm:px-5 sm:text-sm">Join Now</button>
                  <button onClick={() => setAuth('login')} className="h-8 whitespace-nowrap rounded-full border border-white/70 px-3 text-xs font-semibold sm:h-9 sm:px-5 sm:text-sm">Login</button>
                </>
              )}
            </div>
          </div>
          <nav className={`mx-auto max-w-[1180px] gap-1 overflow-x-auto px-4 pb-2 text-sm font-semibold md:flex md:pb-0 ${menuOpen ? 'flex flex-col md:flex-row' : 'hidden'}`}>
            {topLinks.map(([label, href]) => (
              <Link key={label} href={href} className={`whitespace-nowrap rounded-lg px-4 py-3 hover:bg-white/10 md:py-2.5 ${isActive(href) ? 'bg-white/15' : ''}`}>{label}</Link>
            ))}
            {player && <button onClick={() => signOut()} className="rounded-lg px-4 py-3 text-left hover:bg-white/10 sm:hidden">Logout</button>}
            <span className="ml-auto hidden px-3 py-3 text-xs md:block">GMT+00:00</span>
          </nav>
        </header>
        {!gamesPage && !accountPage && (
          <div className="overflow-hidden border-b border-[#dde7e2] bg-white">
            <div className="scrollbar-none -mb-5 mx-auto flex max-w-[1180px] overflow-x-auto px-1 pb-5 sm:px-4">
              {sportTabs.map(([label, href]) => (
                <Link key={label} href={href} className={`whitespace-nowrap border-b-[3px] px-3 py-3 text-[13px] sm:px-4 sm:text-sm ${isActive(href) ? 'border-[#0b6e4f] font-semibold text-[#0b6e4f]' : 'border-transparent text-[#5f6f69]'}`}>{label}</Link>
              ))}
            </div>
          </div>
        )}

        {children}

        {notice && (
          <div className={`fixed left-1/2 z-40 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center rounded-xl bg-[#0f1f1a] px-5 py-3 text-sm text-white shadow-xl bottom-40 md:bottom-6`}>
            {notice}
            <button onClick={() => setNotice('')} className="ml-4 text-white/60" aria-label="Close notice"><X size={16} /></button>
          </div>
        )}
        {!gamesPage && !accountPage && (
          <button
            onClick={() => setSlipOpen(true)}
            className="fixed bottom-[84px] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#0b6e4f] text-white shadow-[0_6px_20px_rgba(11,110,79,0.4)] md:hidden"
            aria-label={`Open bet slip, ${slipCount} selections`}
          >
            <ReceiptText size={24} />
            <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-[#ff7a1a] px-1 text-[11px] font-extrabold text-[#0f1f1a]">{slipCount}</span>
          </button>
        )}
        {slipOpen && <BetslipSheet onClose={() => setSlipOpen(false)} />}
        <Link href="/help#contact" className="fixed bottom-6 right-6 z-30 hidden h-12 w-12 items-center justify-center rounded-full border border-[#dde7e2] bg-white text-[#0b6e4f] shadow-lg md:flex" aria-label="Contact support"><Headphones size={22} /></Link>
        {auth && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 sm:items-center">
            <AuthForm
              mode={auth}
              onClose={() => setAuth(null)}
              switchMode={() => setAuth(auth === 'login' ? 'register' : 'login')}
              onSignedIn={(next) => {
                signIn(next)
                setAuth(null)
                setNotice(`Welcome, ${next.name}.`)
              }}
            />
          </div>
        )}
        {win && <WinCelebration code={win.code} amount={win.amount} currency={win.currency} onClose={() => setWin(null)} />}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-[#dde7e2] bg-white pb-[env(safe-area-inset-bottom)] text-[11px] text-[#86958f] md:hidden" aria-label="Main">
          <TabLink href="/" active={pathname === '/'} icon={<House size={22} />} label="Home" />
          <button onClick={() => { setMenuOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex flex-col items-center justify-center gap-1">
            <Menu size={22} /> AZ Menu
          </button>
          <TabLink href="/games" active={gamesPage} icon={<Gamepad2 size={22} />} label="Games" />
          <TabLink href="/my-bets" active={isActive('/my-bets')} icon={<ReceiptText size={22} />} label="Open Bets" badge={player ? openBets : 0} />
          {player
            ? <TabLink href="/account" active={['/account', '/deposit', '/withdraw', '/transactions'].some(isActive)} icon={<UserRound size={22} />} label="Me" />
            : <button onClick={() => setAuth('login')} className="flex flex-col items-center justify-center gap-1"><UserRound size={22} /> Me</button>}
        </nav>
        <SiteFooter className={gamesPage || accountPage ? '' : 'mt-8'} />
      </main>
    </ShellContext.Provider>
  )
}

function TabLink({ href, active, icon, label, badge = 0 }: { href: string; active: boolean; icon: ReactNode; label: string; badge?: number }) {
  return (
    <Link href={href} className={`relative flex flex-col items-center justify-center gap-1 ${active ? 'font-semibold text-[#0b6e4f] shadow-[inset_0_2px_0_#0b6e4f]' : ''}`}>
      {icon}
      {label}
      {badge > 0 && <span className="absolute left-1/2 top-1.5 ml-1.5 min-w-[18px] rounded-full bg-[#e40014] px-1 text-center text-[10px] font-bold leading-[18px] text-white">{badge}</span>}
    </Link>
  )
}
