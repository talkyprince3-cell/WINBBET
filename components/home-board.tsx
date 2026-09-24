'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Lock, Printer, Radio, RotateCw, SlidersHorizontal } from 'lucide-react'
import {
  BetslipPanel, Crest, LiveClock, QuickRegister, kickoffLabel, legFor, resultMarket, useFixtureFeed,
  type BoardMarket, type BoardMatch, type BoardPrice,
} from '@/components/match-board'
import { useSlip } from '@/lib/store'

const SPORT_TABS = ['Football', 'vFootball', 'Basketball', 'Tennis', 'eFootball'] as const
const MORE_SPORTS = ['Table Tennis', 'Ice Hockey', 'Volleyball', 'Handball', 'Rugby', 'Cricket'] as const
type SportTab = (typeof SPORT_TABS)[number] | (typeof MORE_SPORTS)[number]

const SPORT_KEYS: Record<SportTab, string[]> = {
  Football: ['football', 'soccer'],
  vFootball: ['virtual', 'virtuals', 'vfootball'],
  Basketball: ['basketball'],
  Tennis: ['tennis'],
  eFootball: ['efootball', 'esoccer'],
  'Table Tennis': ['table-tennis', 'table tennis'],
  'Ice Hockey': ['ice-hockey', 'hockey'],
  Volleyball: ['volleyball'],
  Handball: ['handball'],
  Rugby: ['rugby'],
  Cricket: ['cricket'],
}

type Filter =
  | { kind: 'all' }
  | { kind: 'today' }
  | { kind: 'next3h' }
  | { kind: 'league'; league: string; test: RegExp }
  | { kind: 'leagues'; names: string[] }

const POPULAR_LEAGUES: { label: string; test: RegExp }[] = [
  { label: 'AFCON Qualifiers', test: /africa cup of nations|afcon/i },
  { label: 'UEFA Nations League', test: /nations league/i },
  { label: 'International Friendlies', test: /friendl/i },
  { label: 'England Premier League', test: /^premier league$|england premier league|english premier league/i },
]

const PAGE_SIZE = 5

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const VIEW_TO_TAB: Record<string, SportTab> = {
  Football: 'Football',
  Basketball: 'Basketball',
  Tennis: 'Tennis',
  Virtuals: 'vFootball',
}

function ofSport(match: BoardMatch, tab: SportTab) {
  return SPORT_KEYS[tab].includes((match.sport || 'football').toLowerCase())
}

function secondMarket(match: BoardMatch) {
  return match.markets.find((market) => market.key === 'ou25') ?? match.markets.find((market) => /2\.5/.test(market.label))
}

function byLeague(matches: BoardMatch[]) {
  const groups = new Map<string, BoardMatch[]>()
  for (const match of matches) groups.set(match.league, [...(groups.get(match.league) ?? []), match])
  return [...groups.entries()]
}

export function MatchBoard({ view, onNeedAuth, onNotice }: { view: string; onNeedAuth: () => void; onNotice: (message: string) => void }) {
  const { matches, error, loading, updatedAt, reload } = useFixtureFeed()
  const legs = useSlip((state) => state.legs)
  const has = useSlip((state) => state.has)
  const toggle = useSlip((state) => state.toggle)
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [tab, setTab] = useState<SportTab>(VIEW_TO_TAB[view] ?? 'Football')
  const [liveTab, setLiveTab] = useState<SportTab>('Football')

  const [liveLimit, setLiveLimit] = useState(PAGE_SIZE)
  const [highlightLimit, setHighlightLimit] = useState(PAGE_SIZE)

  useEffect(() => setTab(VIEW_TO_TAB[view] ?? 'Football'), [view])
  useEffect(() => setLiveLimit(PAGE_SIZE), [liveTab])
  useEffect(() => setHighlightLimit(PAGE_SIZE), [tab, filter])

  const all = useMemo(() => matches ?? [], [matches])
  const leagues = useMemo(() => {
    const counts = new Map<string, number>()
    for (const match of all) counts.set(match.league, (counts.get(match.league) ?? 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .filter((name) => !POPULAR_LEAGUES.some((item) => item.test.test(name)))
      .slice(0, 3)
  }, [all])

  const highlights = useMemo(() => {
    const now = Date.now()
    const today = new Date().toDateString()
    return all.filter((match) => {
      if (match.isLive || !ofSport(match, tab)) return false
      const kickoff = new Date(match.kickoff)
      if (filter.kind === 'today') return kickoff.toDateString() === today
      if (filter.kind === 'next3h') return kickoff.getTime() - now <= 3 * 3_600_000 && kickoff.getTime() >= now
      if (filter.kind === 'league') return filter.test.test(match.league)
      if (filter.kind === 'leagues') return filter.names.includes(match.league)
      return true
    })
  }, [all, filter, tab])

  const live = useMemo(() => all.filter((match) => match.isLive && ofSport(match, liveTab)), [all, liveTab])

  const pick = (match: BoardMatch, market: BoardMarket, price: BoardPrice) => {
    const leg = legFor(match, market, price, onNotice)
    if (leg) toggle(leg)
  }

  const popular = [
    { label: "Today's Football", active: filter.kind === 'today', select: () => { setTab('Football'); setFilter({ kind: 'today' }) } },
    { label: 'Football in Next 3 Hours', active: filter.kind === 'next3h', select: () => { setTab('Football'); setFilter({ kind: 'next3h' }) } },
    ...[...POPULAR_LEAGUES, ...leagues.map((name) => ({ label: name, test: new RegExp(`^${escape(name)}$`) }))].map((item) => ({
      label: item.label,
      active: filter.kind === 'league' && filter.league === item.label,
      select: () => setFilter({ kind: 'league', league: item.label, test: item.test }),
    })),
  ]

  // Every upcoming league in the chosen sport, busiest first, for the league picker.
  const leagueCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const match of all) {
      if (match.isLive || !ofSport(match, tab)) continue
      counts.set(match.league, (counts.get(match.league) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [all, tab])
  const [pickerOpen, setPickerOpen] = useState(false)
  const chosenLeagues = filter.kind === 'leagues' ? filter.names : []

  const filterTitle =
    filter.kind === 'today' ? "Today's Football"
      : filter.kind === 'next3h' ? 'Football in Next 3 Hours'
        : filter.kind === 'league' ? filter.league
          : filter.kind === 'leagues' ? (filter.names.length === 1 ? filter.names[0] : `${filter.names.length} leagues`)
            : 'Highlights'
  const liveOnly = view === 'Live Betting'

  return (
    <>
      <section className="mx-auto max-w-[1180px] px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)_220px]">
          <aside className="hidden self-start rounded-2xl border border-[#dde7e2] bg-white p-4 md:block">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#0f1f1a]">Popular</h2>
            {popular.map((item) => (
              <PopularLink key={item.label} active={item.active} onClick={item.select}>{item.label}</PopularLink>
            ))}
          </aside>
          <HeroBanner onNotice={onNotice} />
          <QuickRegister onNeedAuth={onNeedAuth} onNotice={onNotice} />
        </div>
        <QuickLinks />
        <div className="mt-3 overflow-hidden md:hidden">
          <div className="scrollbar-none -mb-5 flex gap-2 overflow-x-auto pb-5">
            {popular.map((item) => (
              <button key={item.label} onClick={item.select} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${item.active ? 'border-[#0b6e4f] bg-[#0b6e4f] text-white' : 'border-[#dde7e2] bg-white text-[#0f1f1a]'}`}>{item.label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-3 py-4 sm:px-4 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <div>
            <BoardHeader title="Live Now" live onRefresh={reload} loading={loading} updatedAt={updatedAt} />
            <SportTabs value={liveTab} onChange={setLiveTab} />
            <div className="space-y-2.5">
              {matches === null && !error && <Empty>Loading live matches…</Empty>}
              {matches && live.length === 0 && <Empty>No live {liveTab} matches right now.</Empty>}
              {live.slice(0, liveLimit).map((match) => <MatchCard key={match.id} match={match} has={has} pick={pick} />)}
              {live.length > liveLimit && <ViewMore remaining={live.length - liveLimit} onClick={() => setLiveLimit((n) => n + PAGE_SIZE)} />}
            </div>
          </div>

          {!liveOnly && (
            <div>
              <VirtualWorldBanner />
              <BoardHeader title={filterTitle} onRefresh={reload} loading={loading} updatedAt={updatedAt}>
                {filter.kind !== 'all' && <button onClick={() => setFilter({ kind: 'all' })} className="text-xs font-semibold text-[#0b6e4f]">Clear filter</button>}
              </BoardHeader>
              <SportTabs value={tab} onChange={setTab} />
              {pickerOpen ? (
                <LeaguePicker
                  leagues={leagueCounts}
                  chosen={chosenLeagues}
                  onClose={() => setPickerOpen(false)}
                  onApply={(names) => {
                    setFilter(names.length ? { kind: 'leagues', names } : { kind: 'all' })
                    setPickerOpen(false)
                  }}
                />
              ) : (
                <button onClick={() => setPickerOpen(true)} className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-[#dde7e2] bg-white px-4 py-3 text-left">
                  <ChevronRight size={16} className="text-[#5f6f69]" />
                  <span className="flex-1 text-[15px] font-bold">Top Leagues 🏆</span>
                  {chosenLeagues.length > 0
                    ? <span className="rounded-full bg-[#0b6e4f] px-2 py-0.5 text-[11px] font-bold text-white">{chosenLeagues.length} selected</span>
                    : <span className="text-xs text-[#5f6f69]">{leagueCounts.length} leagues</span>}
                  <SlidersHorizontal size={15} className="text-[#0b6e4f]" />
                </button>
              )}
              <div className="space-y-2.5">
                {matches === null && !error && <Empty>Loading fixtures…</Empty>}
                {error && <Empty tone="error">{error}</Empty>}
                {matches && highlights.length === 0 && <Empty>No {tab} matches in this list right now.</Empty>}
                {highlights.slice(0, highlightLimit).map((match) => <MatchCard key={match.id} match={match} has={has} pick={pick} />)}
                {highlights.length > highlightLimit && <ViewMore remaining={highlights.length - highlightLimit} onClick={() => setHighlightLimit((n) => n + PAGE_SIZE)} />}
              </div>
            </div>
          )}
        </div>

        <aside className="hidden space-y-4 md:block">
          <BetslipPanel legs={legs} onNeedAuth={onNeedAuth} onNotice={onNotice} />
          <Link href="/virtuals" className="relative block h-40 overflow-hidden rounded-2xl bg-[#0c0c0c]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/banners/instant-virtuals.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(255,122,26,0.3),rgba(0,0,0,0.55)_70%)]" />
            <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-4xl">⚡</span>
              <span className="text-2xl font-extrabold leading-none text-white">Instant Virtuals</span>
              <span className="mt-2 rounded-full bg-[#ff7a1a] px-4 py-1 text-xs font-bold text-[#0f1f1a]">Play now</span>
            </span>
          </Link>
        </aside>
      </section>
    </>
  )
}

function Empty({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' }) {
  return <p className={`rounded-2xl border border-[#dde7e2] bg-white px-4 py-8 text-center text-sm ${tone === 'error' ? 'text-[#e40014]' : 'text-[#5f6f69]'}`}>{children}</p>
}

function ViewMore({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-center gap-1 rounded-2xl border border-[#dde7e2] bg-white py-3 text-sm font-semibold text-[#0b6e4f] hover:bg-[#f6faf8]">
      View more ({remaining}) <ChevronDown size={16} />
    </button>
  )
}

const QUICK_LINKS = [
  { href: '/football', label: 'Football', icon: '⚽' },
  { href: '/live', label: 'Live', icon: '🔴' },
  { href: '/games', label: 'Games', icon: '🎮' },
  { href: '/load-code', label: 'Load code', icon: '🎟️' },
] as const

function QuickLinks() {
  return (
    <div className="mt-3 grid grid-cols-4 gap-2 md:hidden">
      {QUICK_LINKS.map((item) => (
        <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#dde7e2] bg-white py-3 text-xs font-semibold text-[#0f1f1a] shadow-[0_1px_2px_rgba(15,31,26,0.04)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf3f0] text-lg">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </div>
  )
}

function PopularLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between border-t border-[#dde7e2] py-2.5 text-left text-sm ${active ? 'font-semibold text-[#0b6e4f]' : 'text-[#0f1f1a]'}`}>
      <span className="truncate pr-2">{children}</span>
      <ChevronRight size={16} className="shrink-0 text-[#93a39c]" />
    </button>
  )
}

const SLIDES = [
  { title: 'One Cut', sub: 'Bet on live action every second', image: '/banners/hero-football.jpg', href: null },
  { title: 'Virtual World', sub: 'Football, racing and more, non-stop', image: '/banners/virtual-world.jpg', href: '/virtuals' },
  { title: 'Instant Games', sub: 'Sky Rocket, Spin The Bottle and more', image: '/banners/instant-games.jpg', href: '/games' },
] as const

function HeroBanner({ onNotice }: { onNotice: (message: string) => void }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000)
    return () => clearInterval(timer)
  }, [])
  const slide = SLIDES[index]

  return (
    <div className="relative flex min-h-[176px] flex-col justify-end overflow-hidden rounded-2xl bg-[#111319] p-5 text-white sm:min-h-[220px] sm:p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={slide.image} src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#ff7a1a]">WinnBet</p>
        <div className="text-[28px] font-extrabold leading-tight sm:text-4xl">{slide.title}</div>
        <p className="mb-4 text-[13px] text-white/80">{slide.sub}</p>
        {slide.href
          ? <Link href={slide.href} className="inline-block rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold text-[#0f1f1a]">Play now</Link>
          : <button onClick={() => onNotice('Pick a price on the board to start a slip.')} className="rounded-lg bg-[#ff7a1a] px-4 py-2 text-sm font-bold text-[#0f1f1a]">Bet now</button>}
      </div>
      <div className="absolute bottom-4 right-4 flex gap-1.5">
        {SLIDES.map((item, i) => <button key={item.title} onClick={() => setIndex(i)} aria-label={`Show ${item.title}`} className={`h-1.5 rounded-full ${i === index ? 'w-5 bg-[#ff7a1a]' : 'w-1.5 bg-white/60'}`} />)}
      </div>
    </div>
  )
}

function BoardHeader({ title, onRefresh, loading = false, updatedAt = null, live = false, children }: { title: string; onRefresh: () => void; loading?: boolean; updatedAt?: Date | null; live?: boolean; children?: ReactNode }) {
  return (
    <div className="mb-2 mt-1 flex items-center justify-between gap-3">
      <h1 className="flex min-w-0 items-center gap-2 text-[15px] font-extrabold uppercase tracking-wide text-[#0f1f1a]">
        {live && <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00c244] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00c244]" /></span>}
        <span className="truncate">{title}</span>
      </h1>
      <div className="flex shrink-0 items-center gap-4 text-xs font-medium text-[#5f6f69]">
        {children}
        <button onClick={() => window.print()} className="hidden items-center gap-1.5 sm:flex"><Printer size={14} /> Print</button>
        <button onClick={onRefresh} disabled={loading} className="flex items-center gap-1.5 disabled:opacity-70" aria-live="polite">
          <RotateCw size={14} className={loading ? 'animate-spin text-[#0b6e4f]' : ''} />
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : loading ? 'Updating…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}

function SportTabs({ value, onChange, onFilter, filterCount = 0, filterOpen = false }: { value: SportTab; onChange: (tab: SportTab) => void; onFilter?: () => void; filterCount?: number; filterOpen?: boolean }) {
  const [more, setMore] = useState(false)
  const moreActive = (MORE_SPORTS as readonly string[]).includes(value)
  const tabClass = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium ${active ? 'bg-[#0b6e4f] text-white' : 'border border-[#dde7e2] bg-white text-[#0f1f1a]'}`
  return (
    <div className="relative mb-3 flex items-center">
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="scrollbar-none -mb-5 flex items-center gap-2 overflow-x-auto pb-5">
          {SPORT_TABS.map((item) => <button key={item} onClick={() => onChange(item)} className={tabClass(value === item)}>{item}</button>)}
          <button onClick={() => setMore((open) => !open)} className={`${tabClass(moreActive)} flex items-center gap-1`}>{moreActive ? value : 'More'} <ChevronDown size={14} /></button>
        </div>
      </div>
      {onFilter && (
        <button
          onClick={onFilter}
          aria-expanded={filterOpen}
          className={`relative ml-2 flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${filterOpen || filterCount ? 'border-[#0b6e4f] bg-[#0b6e4f] text-white' : 'border-[#dde7e2] bg-white text-[#0f1f1a]'}`}
        >
          <SlidersHorizontal size={14} /> Leagues
          {filterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff7a1a] px-1 text-[11px] font-bold text-[#0f1f1a]">{filterCount}</span>}
        </button>
      )}
      {more && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#dde7e2] bg-white py-1 shadow-lg">
          {MORE_SPORTS.map((item) => (
            <button key={item} onClick={() => { onChange(item); setMore(false) }} className="block w-full px-4 py-2 text-left text-sm hover:bg-[#edf3f0]">{item}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function LeaguePicker({ leagues, chosen, onApply, onClose }: { leagues: [string, number][]; chosen: string[]; onApply: (names: string[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>(chosen)
  const total = leagues.reduce((sum, [, count]) => sum + count, 0)
  const allPicked = picked.length === 0 || picked.length === leagues.length
  const matchCount = picked.length === 0 ? total : leagues.filter(([name]) => picked.includes(name)).reduce((sum, [, count]) => sum + count, 0)
  const toggle = (name: string) => setPicked((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]))

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-[#dde7e2] bg-white">
      <button onClick={onClose} className="flex w-full items-center gap-2 border-b border-[#dde7e2] px-4 py-3 text-left">
        <ChevronDown size={16} className="text-[#5f6f69]" />
        <span className="flex-1 text-[15px] font-bold">Top Leagues 🏆</span>
        <span className="text-xs text-[#5f6f69]">{leagues.length}</span>
      </button>
      <div className="max-h-[50vh] overflow-y-auto">
        <LeagueRow label="All" count={total} checked={allPicked} onToggle={() => setPicked([])} bold />
        {leagues.map(([name, count]) => (
          <LeagueRow key={name} label={name} count={count} checked={picked.includes(name)} onToggle={() => toggle(name)} />
        ))}
        {leagues.length === 0 && <p className="px-4 py-6 text-center text-sm text-[#5f6f69]">No leagues to choose from yet.</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-[#dde7e2] p-3">
        <button onClick={() => setPicked([])} className="h-11 rounded-xl border border-[#0b6e4f] text-sm font-semibold text-[#0b6e4f]">Clear</button>
        <button onClick={() => onApply(allPicked ? [] : picked)} className="h-11 rounded-xl bg-[#ff7a1a] text-sm font-bold text-[#0f1f1a]">Apply ({matchCount})</button>
      </div>
    </div>
  )
}

function LeagueRow({ label, count, checked, onToggle, bold = false }: { label: string; count: number; checked: boolean; onToggle: () => void; bold?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 border-b border-[#edf3f0] px-4 py-3 last:border-b-0">
      <span className={`min-w-0 flex-1 truncate text-sm ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className="text-xs tabular-nums text-[#5f6f69]">{count}</span>
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-5 w-5 shrink-0 accent-[#0b6e4f]" />
    </label>
  )
}

type PickFn = (match: BoardMatch, market: BoardMarket, price: BoardPrice) => void
type HasFn = (matchId: string, market: string, outcome: string) => boolean

const NEXT_GOAL = /next goal|score the \d+(st|nd|rd|th) goal|^goal \d+$/i

function halfLabel(match: BoardMatch) {
  const label = (match.minuteLabel || '').toUpperCase()
  if (label.includes('HT')) return ''
  const minute = parseInt(label, 10)
  if (!Number.isFinite(minute)) return ''
  return minute <= 45 ? 'H1' : 'H2'
}

/**
 * A 1X2 price earns the badge only when the bookmaker's margin on it is thin.
 * Typical football margins run 5-10%; at 5% or under the player is getting a
 * genuinely sharp price, so the claim is true when we make it.
 */
const BEST_ODDS_MARGIN = 0.05

function hasBestOdds(market?: BoardMarket) {
  const prices = market?.prices.slice(0, 3) ?? []
  if (prices.length < 3 || prices.some((price) => !(price.odds > 1))) return false
  const overround = prices.reduce((sum, price) => sum + 1 / price.odds, 0) - 1
  return overround <= BEST_ODDS_MARGIN
}

/** One fixture: when and where on top, the two teams, then the 1X2 prices. */
function MatchCard({ match, has, pick }: { match: BoardMatch; has: HasFn; pick: PickFn }) {
  const main = resultMarket(match)
  const second = match.isLive ? match.markets.find((market) => NEXT_GOAL.test(market.label)) : secondMarket(match)
  const extra = Math.max(0, match.markets.length - 1)
  const half = halfLabel(match)

  return (
    <div className="rounded-2xl border border-[#dde7e2] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,31,26,0.04)]">
      <div className="flex items-center justify-between gap-3 text-xs text-[#5f6f69]">
        <p className="min-w-0 truncate">
          {match.isLive
            ? <span className="font-semibold tabular-nums text-[#00a63a]">● <LiveClock match={match} />{half ? ` ${half}` : ''}</span>
            : <span>{kickoffLabel(match)}</span>}
          <span> · {match.league}</span>
        </p>
      </div>
      <Link href={`/match/${match.id}`} className="mt-2.5 block space-y-1.5 text-[14px] text-[#0f1f1a]">
        <TeamLine crest={match.homeCrest} name={match.homeTeam} score={match.isLive ? match.scoreHome ?? 0 : null} />
        <TeamLine crest={match.awayCrest} name={match.awayTeam} score={match.isLive ? match.scoreAway ?? 0 : null} />
      </Link>
      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[3fr_2fr]">
        <OddsPills match={match} market={main} count={3} has={has} pick={pick} />
        {second && <div className="hidden lg:block"><OddsPills match={match} market={second} count={second.prices.length >= 3 ? 3 : 2} has={has} pick={pick} /></div>}
      </div>
      <div className="mt-2.5 flex items-center gap-2.5 text-xs">
        <Link href={`/match/${match.id}`} className="flex items-center font-semibold text-[#5f6f69] hover:text-[#0b6e4f]">+{extra} <ChevronRight size={14} /></Link>
        {match.isLive && <span className="flex items-center gap-1 text-[#5f6f69]"><Radio size={13} /> Live</span>}
        {hasBestOdds(main) && !match.isLocked && (
          <span className="flex items-center gap-1 rounded-md border border-[#0b6e4f]/25 bg-[#e8f5ee] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#0b6e4f]">👍 Best odds</span>
        )}
      </div>
    </div>
  )
}

function TeamLine({ crest, name, score }: { crest?: string | null; name: string; score: number | null }) {
  return (
    <span className="flex items-center gap-2">
      <Crest src={crest} name={name} size={18} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {score !== null && <b className="shrink-0 tabular-nums">{score}</b>}
    </span>
  )
}

function OddsPills({ match, market, count, has, pick }: { match: BoardMatch; market?: BoardMarket; count: number; has: HasFn; pick: PickFn }) {
  const prices = market?.prices.slice(0, count) ?? []
  return (
    <div className={`grid gap-2 ${count === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {Array.from({ length: count }, (_, i) => {
        const price = prices[i]
        if (!price || !market || match.isLocked || match.postponed) {
          return <span key={i} className="flex h-10 items-center justify-center rounded-lg bg-[#edf3f0] text-[#aebdb6]"><Lock size={13} /></span>
        }
        const selected = has(match.id, market.key, price.outcome)
        return (
          <button
            key={price.outcome}
            onClick={() => pick(match, market, price)}
            aria-label={`${price.label} at ${price.odds.toFixed(2)}`}
            className={`flex h-10 items-center justify-between rounded-lg px-3 transition-colors ${selected ? 'bg-[#0b6e4f] text-white' : 'bg-[#edf3f0] text-[#0f1f1a] hover:bg-[#e0ebe6]'}`}
          >
            <span className={`text-[11px] ${selected ? 'text-white/70' : 'text-[#86958f]'}`}>{price.outcome}</span>
            <span className="text-[15px] font-semibold tabular-nums">{price.odds.toFixed(2)}</span>
          </button>
        )
      })}
    </div>
  )
}

function VirtualWorldBanner() {
  return (
    <Link href="/virtuals" className="relative mb-4 flex h-20 items-center overflow-hidden rounded-2xl bg-[#0b6e4f] sm:h-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/banners/virtual-world.jpg" alt="" className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-[center_35%]" />
      <div className="absolute inset-y-0 left-[38%] w-24 bg-gradient-to-r from-[#0b6e4f] to-transparent" />
      <span className="relative pl-5 leading-tight">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#ff7a1a]">24/7 action</span>
        <span className="block text-xl font-extrabold text-white sm:text-2xl">Virtual World</span>
        <span className="block text-xs text-white/80">Bet on every second</span>
      </span>
    </Link>
  )
}
