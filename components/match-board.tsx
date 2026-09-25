'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Lock, Trophy } from 'lucide-react'
import { useShell } from '@/components/site-shell'
import { BookedCode, PlacedReceipt, type PlacedTicket } from '@/components/tickets'
import { bonusAmount, combinationCount, combinations } from '@/lib/bonus'
import { matchClock } from '@/lib/clock'
import { formatMoney } from '@/lib/countries'
import { useSession, useSlip, type SlipLeg } from '@/lib/store'

export type BoardPrice = { outcome: string; label: string; odds: number }
export type BoardMarket = { key: string; label: string; prices: BoardPrice[] }
export type BoardMatch = {
  id: string
  league: string
  sport: string
  homeTeam: string
  awayTeam: string
  homeCrest?: string | null
  awayCrest?: string | null
  kickoff: string
  isLive: boolean
  isLocked: boolean
  postponed: boolean
  minuteLabel: string
  scoreHome: number | null
  scoreAway: number | null
  stoppage?: { first: number; second: number }
  markets: BoardMarket[]
}

const POLL_MS = 30_000

export function useFixtureFeed() {
  const [matches, setMatches] = useState<BoardMatch[] | null>(null)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/fixtures', { cache: 'no-store' })
        if (!res.ok) {
          if (alive) setError('Fixtures are unavailable right now.')
          return
        }
        const json = await res.json()
        if (alive) {
          setMatches(json.matches ?? [])
          setError('')
          setUpdatedAt(new Date())
        }
      } catch {
        if (alive) setError('Fixtures are unavailable right now.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [nonce])

  return { matches, error, loading, updatedAt, reload: () => setNonce((n) => n + 1) }
}

export function Crest({ src, name, size = 20 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src && !failed ? src : '/crest-fallback.svg'}
      alt={`${name} crest`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-white object-contain"
      style={{ width: size, height: size }}
    />
  )
}

export function legFor(match: BoardMatch, market: BoardMarket, price: BoardPrice, onNotice: (message: string) => void): SlipLeg | null {
  if (match.isLocked || match.postponed) {
    onNotice(match.postponed ? 'This fixture is postponed.' : 'Live betting is locked.')
    return null
  }
  return {
    matchId: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    league: match.league,
    kickoff: match.kickoff,
    market: market.key,
    marketLabel: market.label,
    outcome: price.outcome,
    outcomeLabel: price.label,
    odds: price.odds,
  }
}

export function resultMarket(match: BoardMatch) {
  return match.markets.find((market) => market.key === '1x2') ?? match.markets[0]
}

/**
 * The running clock for a live match. Custom matches keep time from their
 * kickoff, so the clock can tick every second on the player's device rather
 * than jumping once per feed poll. Upstream matches only report whole
 * minutes, so they show the feed's label as it comes.
 */
export function useLiveClock(match: BoardMatch) {
  const ticking = match.isLive && match.id.startsWith('cm_')
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [ticking])
  if (!ticking) return match.minuteLabel || 'LIVE'
  return matchClock(match.kickoff, match.sport || 'football', new Date(), match.stoppage).label
}

export function LiveClock({ match, className = '' }: { match: BoardMatch; className?: string }) {
  return <span className={className}>{useLiveClock(match)}</span>
}

export function kickoffLabel(match: BoardMatch) {
  if (match.postponed) return 'Postponed'
  if (match.isLive) return match.minuteLabel || 'LIVE'
  return new Date(match.kickoff).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export function QuickRegister({ onNeedAuth, onNotice }: { onNeedAuth: () => void; onNotice: (message: string) => void }) {
  const { player } = useShell()
  const [phone, setPhone] = useState('')
  if (player) {
    return (
      <aside className="hidden rounded-2xl border border-[#dde7e2] bg-white p-4 text-[#0f1f1a] md:block">
        <h2 className="text-sm font-bold">{player.name}</h2>
        <p className="my-3 text-xs font-semibold text-[#0b9b3a]">{formatMoney(player.balance, player.currency)} available</p>
        <p className="text-xs text-[#6b7077]">Deposit, then add a selection from the board.</p>
      </aside>
    )
  }
  return (
    <aside className="hidden rounded-2xl border border-[#dde7e2] bg-white p-4 text-[#0f1f1a] md:block">
      <h2 className="text-sm font-bold">Instant Registration</h2>
      <p className="my-3 text-xs font-semibold text-[#0b9b3a]">Make a Deposit and Start Betting!</p>
      <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+233 Mobile Number" className="mb-3 h-10 w-full rounded-lg border border-[#dde7e2] bg-[#edf3f0] px-3 text-xs outline-none focus:border-[#0b6e4f]" />
      <button
        onClick={() => {
          if (phone.trim()) sessionStorage.setItem('sporty-phone', phone.trim())
          onNotice('Create your account to start betting.')
          onNeedAuth()
        }}
        className="h-10 w-full rounded-lg bg-[#ff7a1a] text-sm font-bold text-[#0f1f1a]"
      >
        Join Now
      </button>
    </aside>
  )
}

export function BetslipPanel({
  legs,
  onNeedAuth,
  onNotice,
}: {
  legs: SlipLeg[]
  onNeedAuth: () => void
  onNotice: (message: string) => void
}) {
  const { player } = useShell()
  const setBalance = useSession((state) => state.setBalance)
  const stake = useSlip((state) => state.stake)
  const setStake = useSlip((state) => state.setStake)
  const chosenMode = useSlip((state) => state.mode)
  const setMode = useSlip((state) => state.setMode)
  const systemSize = useSlip((state) => state.systemSize)
  const setSystemSize = useSlip((state) => state.setSystemSize)
  const acceptOddsChanges = useSlip((state) => state.acceptOddsChanges)
  const totalOdds = useSlip((state) => state.totalOdds)
  const clearLegs = useSlip((state) => state.clearLegs)
  const remove = useSlip((state) => state.remove)
  const load = useSlip((state) => state.load)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [booked, setBooked] = useState<{ code: string; expiresAt: string | null } | null>(null)
  const [placed, setPlaced] = useState<{
    ticket: PlacedTicket
    legs: SlipLeg[]
    lines: number
    totalCost: number
    oddsChanged: { match: string; from: number; to: number }[]
  } | null>(null)

  // A multiple needs two selections and a system three, so the slip plays the
  // best mode the selections allow; the player's choice returns once it fits.
  const allowed = (item: 'single' | 'multiple' | 'system') => item === 'single' || (item === 'multiple' ? legs.length >= 2 : legs.length >= 3)
  const mode = allowed(chosenMode) ? chosenMode : legs.length >= 2 ? 'multiple' : 'single'
  const odds = legs.length ? totalOdds() : 0
  const lines = mode === 'single' ? Math.max(legs.length, 1) : mode === 'system' ? combinationCount(legs.length, systemSize) : 1
  const bonus = mode === 'multiple' && legs.length >= 2 ? bonusAmount(stake, odds, legs.map((leg) => leg.odds)) : 0
  const returns = mode === 'single'
    ? Math.round(legs.reduce((sum, leg) => sum + stake * leg.odds, 0) * 100) / 100
    : mode === 'system'
      ? Math.round(combinations(legs, systemSize).reduce((sum, line) => sum + stake * line.reduce((acc, leg) => acc * leg.odds, 1), 0) * 100) / 100
      : Math.round((stake * odds + bonus) * 100) / 100

  useEffect(() => setError(''), [legs.length])

  const place = async () => {
    setError('')
    if (!player) {
      onNeedAuth()
      return
    }
    if (!legs.length) return
    setBusy(true)
    try {
      const res = await fetch('/api/bets/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: player.id,
          stake,
          mode,
          systemSize,
          acceptOddsChanges,
          selections: legs.map((leg) => ({
            matchId: leg.matchId,
            market: leg.market,
            outcome: leg.outcome,
            odds: leg.odds,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not place your bet')
        return
      }
      if (typeof json.balance === 'number') setBalance(json.balance)
      if (json.ticket) {
        setPlaced({
          ticket: json.ticket,
          legs,
          lines: Number(json.lines ?? 1),
          totalCost: Number(json.totalCost ?? stake),
          oddsChanged: json.oddsChanged ?? [],
        })
      }
      clearLegs()
    } catch {
      setError('Could not place your bet')
    } finally {
      setBusy(false)
    }
  }

  const book = async () => {
    setError('')
    if (!legs.length) return
    setBusy(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: player?.id,
          selections: legs,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not book this slip')
        return
      }
      setBooked({ code: json.code, expiresAt: json.expiresAt ?? null })
    } catch {
      setError('Could not book this slip')
    } finally {
      setBusy(false)
    }
  }

  const loadCode = async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(trimmed)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Booking code was not found')
        return
      }
      const selections = (json.booking?.selections ?? []) as SlipLeg[]
      if (!selections.length) {
        setError('That code has no selections')
        return
      }
      load(selections)
      setCode('')
    } catch {
      setError('Could not load that code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside id="betslip" className="scroll-mt-20 overflow-hidden rounded-2xl border border-[#dde7e2] bg-white">
      <div className="flex items-center gap-2 border-b border-[#dde7e2] px-4 py-3.5 text-[15px] font-extrabold uppercase tracking-wide">
        Bet Slip {legs.length > 0 && <span className="rounded-full bg-[#0b6e4f] px-2 text-[11px] text-white">{legs.length}</span>}
      </div>
      {legs.length ? (
        <div className="space-y-3 p-3 text-xs">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#edf3f0] p-1">
            {(['single', 'multiple', 'system'] as const).map((item) => (
              <button key={item} disabled={!allowed(item)} onClick={() => setMode(item)} title={allowed(item) ? undefined : item === 'multiple' ? 'Add at least 2 selections' : 'Add at least 3 selections'} className={`rounded-md py-1.5 font-semibold capitalize disabled:cursor-not-allowed disabled:opacity-40 ${mode === item ? 'bg-white text-[#0b6e4f] shadow-sm' : 'text-[#5f6f69]'}`}>{item}</button>
            ))}
          </div>
          {mode === 'system' && (
            <label className="block text-[11px] text-[#6b7077]">
              Combination size
              <input type="number" min={2} max={legs.length || 2} value={systemSize} onChange={(event) => setSystemSize(Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-[#dde7e2] px-2" />
            </label>
          )}
          {legs.map((leg) => (
            <div key={leg.matchId} className="flex items-start justify-between gap-2 rounded-lg bg-[#f6faf8] p-2.5">
              <div className="min-w-0">
                <p className="break-words font-semibold">{leg.homeTeam} vs {leg.awayTeam}</p>
                <p className="text-[#5f6f69]">{leg.marketLabel} · {leg.outcomeLabel} <b className="text-[#0f1f1a]">@ {leg.odds.toFixed(2)}</b></p>
              </div>
              <button onClick={() => remove(leg.matchId)} className="shrink-0 text-[#86958f] hover:text-[#e40014]" aria-label="Remove selection">✕</button>
            </div>
          ))}
          <label className="block text-[11px] text-[#6b7077]">
            Stake {mode === 'single' || mode === 'system' ? 'per line' : ''}
            <input type="number" min={0} value={stake} onChange={(event) => setStake(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border border-[#dde7e2] px-3 text-sm outline-none focus:border-[#0b6e4f]" />
          </label>
          <p className="flex justify-between"><span>{mode === 'multiple' ? 'Total odds' : 'Lines'}</span><strong>{mode === 'multiple' ? odds.toFixed(2) : lines}</strong></p>
          <p className="flex justify-between"><span>Total stake</span><strong>{formatMoney(stake * lines, player?.currency ?? 'GHS')}</strong></p>
          {bonus > 0 && <p className="flex justify-between text-[#0b9b3a]"><span>Accumulator bonus</span><strong>{formatMoney(bonus, player?.currency ?? 'GHS')}</strong></p>}
          <p className="flex justify-between"><span>Potential win</span><strong>{formatMoney(returns, player?.currency ?? 'GHS')}</strong></p>
          {error && <p className="text-[#e40014]">{error}</p>}
          <button disabled={busy} onClick={place} className="w-full rounded-lg bg-[#ff7a1a] py-3 text-sm font-bold text-[#0f1f1a] disabled:opacity-60">{busy ? 'Please wait…' : 'Place Bet'}</button>
          <button disabled={busy} onClick={book} className="w-full rounded-lg border border-[#dde7e2] py-2.5 font-semibold text-[#0b6e4f]">Book code</button>
        </div>
      ) : (
        <div className="px-6 py-10 text-center text-sm text-[#5f6f69]">
          <Trophy size={34} className="mx-auto mb-3 text-[#c4d3cc]" />
          No selections yet
          <p className="mt-1 text-xs">Click on odds to add selections</p>
          {error && <p className="mt-3 text-xs text-[#e40014]">{error}</p>}
        </div>
      )}
      <div className="border-t border-[#dde7e2] p-3">
        <p className="mb-2 text-[11px] font-semibold text-[#5f6f69]">Load booking code</p>
        <div className="flex gap-2">
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Code" className="h-10 min-w-0 flex-1 rounded-lg border border-[#dde7e2] px-3 text-sm outline-none focus:border-[#0b6e4f]" />
          <button onClick={loadCode} className="rounded-lg bg-[#0b6e4f] px-4 text-xs font-semibold text-white">Load</button>
        </div>
      </div>
      {booked && <BookedCode code={booked.code} expiresAt={booked.expiresAt} onClose={() => setBooked(null)} />}
      {placed && <PlacedReceipt {...placed} onClose={() => setPlaced(null)} />}
    </aside>
  )
}

type DetailMarket = BoardMarket & { group?: string; badge?: string; dense?: boolean }

const GROUP_LABELS: Record<string, string> = {
  main: 'Main',
  goals: 'Goals',
  half: 'Halves',
  handicap: 'Handicap',
  corners: 'Corners',
  teams: 'Teams',
  specials: 'Specials',
}

export function MatchDetail({ id }: { id: string }) {
  const { notify, openAuth } = useShell()
  const [match, setMatch] = useState<(Omit<BoardMatch, 'markets'> & { markets: DetailMarket[] }) | null>(null)
  const [error, setError] = useState('')
  const [group, setGroup] = useState('all')
  const legs = useSlip((state) => state.legs)
  const has = useSlip((state) => state.has)
  const toggle = useSlip((state) => state.toggle)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/match/${encodeURIComponent(id)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!alive) return
        if (!res.ok) {
          setError(json.error ?? 'This match is not available.')
          return
        }
        setMatch(json.match)
        setError('')
      } catch {
        if (alive) setError('This match is not available.')
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [id])

  const groups = useMemo(() => [...new Set((match?.markets ?? []).map((market) => market.group ?? 'main'))], [match])
  const shown = (match?.markets ?? []).filter((market) => group === 'all' || (market.group ?? 'main') === group)
  const score = match && match.scoreHome != null && match.scoreAway != null ? `${match.scoreHome} - ${match.scoreAway}` : 'vs'

  return (
    <section className="mx-auto grid max-w-[1180px] gap-4 px-3 py-4 sm:px-4 grid-cols-1 md:grid-cols-[minmax(0,1fr)_275px]">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-[#dde7e2] bg-white">
        <div className="bg-[#0b6e4f] bg-[linear-gradient(rgba(11,110,79,0.82),rgba(15,31,26,0.92)),url('/banners/hero-football.jpg')] bg-cover bg-center px-4 py-5 text-white">
          <Link href="/" className="mb-3 inline-flex items-center text-xs text-white/70"><ChevronLeft size={14} /> Back to matches</Link>
          {match ? (
            <>
              <p className="text-center text-xs text-white/60">{match.league}</p>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center sm:gap-4">
                <div className="flex min-w-0 flex-col items-center gap-2"><Crest src={match.homeCrest} name={match.homeTeam} size={48} /><p className="break-words text-sm font-bold sm:text-lg">{match.homeTeam}</p></div>
                <p className="text-xl font-extrabold text-[#ff7a1a] sm:text-2xl">{score}</p>
                <div className="flex min-w-0 flex-col items-center gap-2"><Crest src={match.awayCrest} name={match.awayTeam} size={48} /><p className="break-words text-sm font-bold sm:text-lg">{match.awayTeam}</p></div>
              </div>
              {match.isLive ? <LiveClock match={match} className="mt-2 block text-center text-sm font-semibold tabular-nums text-white" /> : <p className="mt-2 text-center text-xs text-white/60">{kickoffLabel(match)}</p>}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-white/70">{error || 'Loading match…'}</p>
          )}
        </div>
        {match && (
          <>
            <div className="overflow-hidden border-b border-[#dde7e2]"><div className="scrollbar-none -mb-5 flex gap-2 overflow-x-auto px-3 py-3 pb-8">
              {['all', ...groups].map((item) => (
                <button key={item} onClick={() => setGroup(item)} className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium ${group === item ? 'bg-[#0b6e4f] text-white' : 'border border-[#dde7e2] text-[#0f1f1a]'}`}>
                  {item === 'all' ? 'All' : GROUP_LABELS[item] ?? item}
                </button>
              ))}
            </div></div>
            <div className="space-y-4 p-3 sm:p-4">
              {match.isLocked && <p className="rounded-lg bg-[#fff0f1] px-3 py-2 text-xs text-[#e40014]">{match.postponed ? 'This fixture is postponed.' : 'Betting is locked on this match.'}</p>}
              {shown.map((market) => (
                <div key={market.key}>
                  <p className="mb-1.5 text-[13px] font-semibold text-[#0f1f1a]">
                    {market.label}
                    {market.badge && <span className="ml-2 rounded bg-[#ff7a1a] px-1.5 py-0.5 text-[10px] font-bold text-[#0f1f1a]">{market.badge}</span>}
                  </p>
                  <div className={`grid gap-2 ${market.dense ? 'grid-cols-3 sm:grid-cols-5' : market.prices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {market.prices.map((price) => {
                      if (match.isLocked || match.postponed) {
                        return (
                          <span key={price.outcome} className="flex h-10 min-w-0 items-center justify-between gap-1 rounded-lg bg-[#edf3f0] px-2.5 text-[#aebdb6]" aria-label={`${price.label} locked`}>
                            <span className="truncate text-[11px]">{price.label}</span>
                            <Lock size={13} className="shrink-0" />
                          </span>
                        )
                      }
                      const selected = has(match.id, market.key, price.outcome)
                      return (
                        <button
                          key={price.outcome}
                          onClick={() => {
                            const leg = legFor(match, market, price, notify)
                            if (leg) toggle(leg)
                          }}
                          className={`flex h-10 min-w-0 items-center justify-between gap-1 rounded-lg px-2.5 ${selected ? 'bg-[#0b6e4f] text-white' : 'bg-[#edf3f0] text-[#0f1f1a] hover:bg-[#e0ebe6]'}`}
                        >
                          <span className={`truncate text-[11px] ${selected ? 'text-white/70' : 'text-[#86958f]'}`}>{price.label}</span>
                          <span className="shrink-0 text-[14px] font-semibold tabular-nums">{price.odds.toFixed(2)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="hidden md:block"><BetslipPanel legs={legs} onNeedAuth={() => openAuth('login')} onNotice={notify} /></div>
    </section>
  )
}
