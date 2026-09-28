'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft, ShieldCheck } from 'lucide-react'
import { useShell } from '@/components/site-shell'
import { BalanceText, BalanceToggle } from '@/components/balance'
import {
  CRASH_MAX, MAX_STAKE, MIN_STAKE, PLINKO_BINS, ROULETTE_REDS, WHEEL_SEGMENTS,
  crashMultiplierAt, findGame, type CasinoGame,
} from '@/lib/casino-catalog'
import { formatMoney } from '@/lib/countries'
import { useSession } from '@/lib/store'

type Round = {
  id: string
  game: string
  stake: number
  currency: string
  status: 'running' | 'won' | 'lost'
  multiplier: number | null
  payout: number
  crashPoint: number | null
  autoCashout: number | null
  pick: Record<string, unknown> | null
  outcome: Record<string, unknown> | null
  seedHash: string
  seed: string | null
  startedAt: string
}

type PlayApi = {
  stake: number
  busy: boolean
  play: (pick: Record<string, unknown>) => Promise<Round | null>
  last: Round | null
}

const CHIPS = [1, 5, 10, 50, 100]

export function GamePlay({ slug }: { slug: string }) {
  const game = findGame(slug)
  const { player, openAuth } = useShell()
  const setBalance = useSession((state) => state.setBalance)
  const [stake, setStake] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Round[]>([])
  const [last, setLast] = useState<Round | null>(null)

  const loadHistory = useCallback(async () => {
    if (!player) return
    const json = await fetch(`/api/games/history?userId=${player.id}&game=${slug}`, { cache: 'no-store' }).then((res) => res.json()).catch(() => null)
    if (json?.error) setError(json.error)
    setHistory(json?.rounds ?? [])
  }, [player, slug])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const play = useCallback(async (pick: Record<string, unknown>) => {
    if (!player) {
      openAuth('login')
      return null
    }
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/games/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: player.id, game: slug, stake, pick }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not play that round')
        return null
      }
      if (typeof json.balance === 'number') setBalance(json.balance)
      setLast(json.round)
      setHistory((rows) => [json.round, ...rows].slice(0, 20))
      return json.round as Round
    } catch {
      setError('Could not reach the server')
      return null
    } finally {
      setBusy(false)
    }
  }, [openAuth, player, setBalance, slug, stake])

  if (!game) {
    return (
      <section className="games-felt min-h-[60vh] px-4 py-16 text-center text-white">
        <p>That game does not exist.</p>
        <Link href="/games" className="mt-4 inline-block bg-[#0b9b3a] px-5 py-2 font-semibold">Back to games</Link>
      </section>
    )
  }

  const api: PlayApi = { stake, busy, play, last }
  const currency = player?.currency ?? 'GHS'

  return (
    <div className="games-felt min-h-[calc(100vh-120px)] py-5 text-white">
      <div className="mx-auto max-w-[1000px] px-3 sm:px-4">
        <Link href="/games" className="mb-3 inline-flex items-center text-xs text-white/70"><ChevronLeft size={14} /> All games</Link>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-hidden bg-[#2a2e37]">
            <div className={`flex items-center gap-3 bg-gradient-to-r ${game.art} px-4 py-3 sm:gap-4 sm:px-5 sm:py-4`}>
              <span className="text-4xl drop-shadow sm:text-5xl">{game.glyph}</span>
              <div className="min-w-0">
                <h1 className="text-lg font-black uppercase italic leading-tight sm:text-2xl">{game.name}</h1>
                <p className="hidden text-sm text-white/80 sm:block">{game.tagline}</p>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <p className="text-[11px] uppercase text-white/70">Balance</p>
                <p className="flex items-center justify-end gap-1.5 font-black">{player ? <><BalanceText>{formatMoney(player.balance, player.currency)}</BalanceText><BalanceToggle size={14} className="text-white/80" /></> : '—'}</p>
              </div>
            </div>
            <div className="p-3 sm:p-5">
              {game.engine === 'crash'
                ? <CrashGame game={game} stake={stake} onError={setError} onRound={(round) => { setLast(round); loadHistory() }} />
                : <InstantGame game={game} api={api} />}
              {error && <p className="mt-4 bg-[#ed1324]/20 px-3 py-2 text-sm text-[#ff8a8a]">{error}</p>}
              <StakeControls stake={stake} setStake={setStake} currency={currency} />
              {!player && <button onClick={() => openAuth('login')} className="mt-3 w-full bg-[#0b9b3a] py-3 font-semibold">Login to play with real money</button>}
            </div>
          </div>
          <aside className="space-y-3">
            <div className="bg-[#2a2e37] p-4">
              <h2 className="mb-2 text-sm font-bold">Your recent rounds</h2>
              {!player && <p className="text-xs text-white/60">Log in to see your rounds.</p>}
              {player && history.length === 0 && <p className="text-xs text-white/60">No rounds yet.</p>}
              <ul className="space-y-1 text-xs">
                {history.map((round) => (
                  <li key={round.id} className="flex justify-between border-b border-white/10 py-1.5">
                    <span className="text-white/70">{formatMoney(round.stake, round.currency)}</span>
                    <span className={round.status === 'won' ? 'font-bold text-[#28c76f]' : round.status === 'lost' ? 'text-[#ff6b6b]' : 'text-[#ffcf00]'}>
                      {round.status === 'running' ? 'Live' : round.status === 'won' ? `+${formatMoney(round.payout, round.currency)} (${round.multiplier}x)` : `Lost${round.crashPoint ? ` @ ${round.crashPoint}x` : ''}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#2a2e37] p-4 text-xs text-white/70">
              <p className="mb-1 flex items-center gap-1 font-bold text-white"><ShieldCheck size={14} /> Fair play</p>
              <p>Each round is decided on our server from a random seed. Its SHA-256 hash is fixed before your stake is taken, and the seed is shown once the round ends.</p>
              {last && (
                <p className="mt-2 break-all font-mono text-[10px] text-white/50">
                  hash {last.seedHash}
                  {last.seed && <><br />seed {last.seed}</>}
                </p>
              )}
            </div>
            <p className="px-1 text-[11px] text-white/50">18+ Play responsibly. Stakes {MIN_STAKE}–{MAX_STAKE.toLocaleString()} per round.</p>
          </aside>
        </div>
      </div>
    </div>
  )
}

function StakeControls({ stake, setStake, currency }: { stake: number; setStake: (n: number) => void; currency: string }) {
  const clamp = (n: number) => Math.min(MAX_STAKE, Math.max(MIN_STAKE, Math.round(n * 100) / 100))
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="mb-2 text-xs text-white/60">Stake ({currency})</p>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setStake(clamp(stake / 2))} className="h-10 bg-[#353a45] px-3 text-sm">½</button>
        <input type="number" min={MIN_STAKE} max={MAX_STAKE} value={stake} onChange={(event) => setStake(Number(event.target.value))} onBlur={() => setStake(clamp(stake))} className="h-10 w-24 min-w-0 bg-[#1f2229] px-3 text-center font-bold outline-none sm:w-28" />
        <button onClick={() => setStake(clamp(stake * 2))} className="h-10 bg-[#353a45] px-3 text-sm">2×</button>
        {CHIPS.map((chip) => (
          <button key={chip} onClick={() => setStake(chip)} className={`h-10 px-3 text-sm ${stake === chip ? 'bg-[#0b9b3a]' : 'bg-[#353a45]'}`}>{chip}</button>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- crash

function CrashGame({ game, stake, onError, onRound }: { game: CasinoGame; stake: number; onError: (message: string) => void; onRound: (round: Round) => void }) {
  const { player, openAuth } = useShell()
  const setBalance = useSession((state) => state.setBalance)
  const [round, setRound] = useState<Round | null>(null)
  const [auto, setAuto] = useState('')
  const [display, setDisplay] = useState(1)
  const [busy, setBusy] = useState(false)
  const offset = useRef(0)

  const sync = (serverNow?: number) => {
    if (typeof serverNow === 'number') offset.current = serverNow - Date.now()
  }

  const finish = useCallback((next: Round, balance?: number) => {
    setRound(next)
    if (typeof balance === 'number') setBalance(balance)
    if (next.status !== 'running') {
      setDisplay(next.status === 'won' ? Number(next.multiplier) : Number(next.crashPoint ?? next.multiplier ?? 1))
      onRound(next)
    }
  }, [onRound, setBalance])

  // Resume a round left running (after a reload, say).
  useEffect(() => {
    if (!player) return
    fetch(`/api/games/history?userId=${player.id}&game=${game.slug}`).then((res) => res.json()).then((json) => {
      const running = (json.rounds ?? []).find((r: Round) => r.status === 'running')
      if (running) setRound(running)
    }).catch(() => {})
  }, [game.slug, player])

  const running = round?.status === 'running'
  const finishRef = useRef(finish)
  finishRef.current = finish
  const roundId = running ? round?.id : undefined
  const startedAt = running ? round?.startedAt : undefined
  const playerId = player?.id

  useEffect(() => {
    if (!roundId || !startedAt || !playerId) return
    let frame = 0
    let done = false
    const start = new Date(startedAt).getTime()
    const tick = () => {
      setDisplay(crashMultiplierAt(Date.now() + offset.current - start))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const poll = setInterval(async () => {
      const json = await fetch(`/api/games/crash/status?userId=${playerId}&roundId=${roundId}`, { cache: 'no-store' }).then((res) => res.json()).catch(() => null)
      if (done || !json?.round) return
      sync(json.serverNow)
      if (json.round.status !== 'running') {
        done = true
        cancelAnimationFrame(frame)
        finishRef.current(json.round, json.balance)
      }
    }, 500)
    return () => {
      done = true
      cancelAnimationFrame(frame)
      clearInterval(poll)
    }
  }, [playerId, roundId, startedAt])

  const start = async () => {
    if (!player) {
      openAuth('login')
      return
    }
    onError('')
    setBusy(true)
    try {
      const res = await fetch('/api/games/crash/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: player.id, game: game.slug, stake, autoCashout: auto ? Number(auto) : null }),
      })
      const json = await res.json()
      if (!res.ok) {
        onError(json.error ?? 'Could not start the round')
        if (json.round) setRound(json.round)
        return
      }
      sync(json.serverNow)
      if (typeof json.balance === 'number') setBalance(json.balance)
      setDisplay(1)
      setRound(json.round)
    } finally {
      setBusy(false)
    }
  }

  const cashout = async () => {
    if (!round || !player) return
    setBusy(true)
    try {
      const res = await fetch('/api/games/crash/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: player.id, roundId: round.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        onError(json.error ?? 'Could not cash out')
        return
      }
      finish(json.round, json.balance)
    } finally {
      setBusy(false)
    }
  }

  const crashed = round?.status === 'lost'
  const won = round?.status === 'won'
  const lift = Math.min(85, Math.log(display) * 30)

  return (
    <div>
      <div className="relative h-52 overflow-hidden sm:h-64 bg-[radial-gradient(ellipse_at_bottom,#1c2640,#0b0e16)]">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:40px_40px]" />
        <span className="absolute text-5xl transition-[bottom,left] duration-100" style={{ bottom: `${8 + lift}%`, left: `${8 + lift * 0.9}%`, opacity: crashed ? 0.25 : 1 }}>{crashed ? '💥' : game.glyph}</span>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`text-5xl font-black tabular-nums sm:text-6xl ${crashed ? 'text-[#ff5252]' : won ? 'text-[#28c76f]' : 'text-white'}`}>{display.toFixed(2)}x</p>
          {crashed && <p className="mt-1 font-bold text-[#ff5252]">Crashed at {round?.crashPoint}x</p>}
          {won && <p className="mt-1 font-bold text-[#28c76f]">Cashed out · +{formatMoney(round!.payout, round!.currency)}</p>}
          {!round && <p className="mt-1 text-sm text-white/60">Place a bet to launch</p>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
        <label className="text-xs text-white/60">
          Auto cash-out (optional)
          <input value={auto} onChange={(event) => setAuto(event.target.value)} disabled={running} placeholder="e.g. 2.00" className="mt-1 h-11 w-full bg-[#1f2229] px-3 text-sm font-bold text-white outline-none disabled:opacity-50" />
        </label>
        {running ? (
          <button disabled={busy} onClick={cashout} className="h-14 self-end bg-[#ffb400] text-base font-black sm:text-lg text-[#1f1f1f] disabled:opacity-60">
            CASH OUT {formatMoney(Math.floor(round!.stake * display * 100) / 100, round!.currency)}
          </button>
        ) : (
          <button disabled={busy} onClick={start} className="h-14 self-end bg-[#0b9b3a] text-lg font-black disabled:opacity-60">
            BET {formatMoney(stake, player?.currency ?? 'GHS')}
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-white/50">The multiplier can stop at any moment, even at 1.00x. Maximum {CRASH_MAX}x.</p>
    </div>
  )
}

// ----------------------------------------------------------------- instant

function InstantGame({ game, api }: { game: CasinoGame; api: PlayApi }) {
  switch (game.engine) {
    case 'dice':
      return <DiceGame api={api} />
    case 'bottle':
      return <BottleGame api={api} />
    case 'roulette':
      return <RouletteGame api={api} />
    case 'wheel':
      return <WheelGame api={api} />
    case 'slot':
      return <SlotGame api={api} />
    case 'plinko':
      return <PlinkoGame api={api} />
    default:
      return null
  }
}

function Outcome({ round, children }: { round: Round | null; children?: ReactNode }) {
  if (!round) return <p className="text-center text-sm text-white/60">Make your pick and play.</p>
  return (
    <div className="text-center">
      {children}
      <p className={`mt-2 text-lg font-black ${round.status === 'won' ? 'text-[#28c76f]' : 'text-[#ff6b6b]'}`}>
        {round.status === 'won' ? `You won ${formatMoney(round.payout, round.currency)} (${round.multiplier}x)` : 'No win this time'}
      </p>
    </div>
  )
}

function PlayButton({ api, label, onClick, disabled }: { api: PlayApi; label?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={api.busy || disabled} onClick={onClick} className="mt-4 h-14 w-full bg-[#0b9b3a] text-lg font-black disabled:opacity-50">
      {api.busy ? 'Playing…' : label ?? `PLAY ${api.stake}`}
    </button>
  )
}

function DiceGame({ api }: { api: PlayApi }) {
  const [target, setTarget] = useState(50)
  const [direction, setDirection] = useState<'under' | 'over'>('under')
  const chance = direction === 'under' ? target : 100 - target
  const multiplier = Math.round((97 / chance) * 100) / 100
  const roll = api.last?.game === 'lucky-dice' ? Number(api.last.outcome?.roll) : null

  return (
    <div>
      <div className="relative h-20 bg-[#1f2229] px-4 pt-8">
        <div className="relative h-3 rounded-full" style={{ background: direction === 'under' ? `linear-gradient(90deg,#28c76f ${target}%,#ff5252 ${target}%)` : `linear-gradient(90deg,#ff5252 ${target}%,#28c76f ${target}%)` }}>
          {roll != null && <span className="absolute -top-7 -translate-x-1/2 bg-white px-2 py-0.5 text-sm font-black text-[#1f1f1f]" style={{ left: `${roll}%` }}>{roll.toFixed(2)}</span>}
        </div>
      </div>
      <input type="range" min={2} max={98} value={target} onChange={(event) => setTarget(Number(event.target.value))} className="mt-3 w-full accent-[#0b9b3a]" />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
        <button onClick={() => setDirection(direction === 'under' ? 'over' : 'under')} className="bg-[#353a45] py-2 font-bold">Roll {direction} {target}</button>
        <div className="bg-[#1f2229] py-2">Chance <b>{chance}%</b></div>
        <div className="bg-[#1f2229] py-2">Pays <b>{multiplier}x</b></div>
      </div>
      <div className="mt-4"><Outcome round={api.last} /></div>
      <PlayButton api={api} label={`ROLL ${direction.toUpperCase()} ${target}`} onClick={() => api.play({ target, direction })} />
    </div>
  )
}

function BottleGame({ api }: { api: PlayApi }) {
  const [spins, setSpins] = useState(0)
  const landed = api.last?.outcome?.landed as 'up' | 'down' | undefined
  const choose = async (side: 'up' | 'down') => {
    const round = await api.play({ side })
    if (round) setSpins((n) => n + 1)
  }
  return (
    <div>
      <div className="flex h-56 items-center justify-center bg-[radial-gradient(circle,#3b2a07,#1c1506)]">
        <span className="text-7xl transition-transform sm:text-8xl duration-1000" style={{ transform: `rotate(${spins * 1080 + (landed === 'down' ? 180 : 0)}deg)` }}>🍾</span>
      </div>
      <div className="mt-4"><Outcome round={api.last}>{landed && <p className="text-sm text-white/70">It landed <b className="uppercase">{landed}</b></p>}</Outcome></div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button disabled={api.busy} onClick={() => choose('up')} className="h-14 bg-[#0b9b3a] text-base font-black disabled:opacity-50 sm:text-lg">UP · 1.94x</button>
        <button disabled={api.busy} onClick={() => choose('down')} className="h-14 bg-[#ed1324] text-base font-black disabled:opacity-50 sm:text-lg">DOWN · 1.94x</button>
      </div>
    </div>
  )
}

function RouletteGame({ api }: { api: PlayApi }) {
  const [bet, setBet] = useState('red')
  const number = api.last?.game === 'roulette-royale' ? Number(api.last.outcome?.number) : null
  const color = (n: number) => (n === 0 ? 'bg-[#0b9b3a]' : ROULETTE_REDS.includes(n) ? 'bg-[#c8102e]' : 'bg-[#111]')
  return (
    <div>
      <div className="flex h-24 items-center justify-center bg-[#0e1f16]">
        {number != null ? <span className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-black ${color(number)}`}>{number}</span> : <span className="text-sm text-white/60">Pick a bet and spin</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold sm:grid-cols-5 sm:text-sm">
        {[['red', 'Red 2x', 'bg-[#c8102e]'], ['black', 'Black 2x', 'bg-[#111]'], ['green', '0 · 36x', 'bg-[#0b9b3a]'], ['odd', 'Odd 2x', 'bg-[#353a45]'], ['even', 'Even 2x', 'bg-[#353a45]']].map(([key, label, cls]) => (
          <button key={key} onClick={() => setBet(key)} className={`py-2 ${cls} ${bet === key ? 'ring-2 ring-[#ffcf00]' : ''}`}>{label}</button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1 sm:grid-cols-12">
        {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => setBet(String(n))} className={`py-2 text-xs sm:py-1.5 font-bold ${color(n)} ${bet === String(n) ? 'ring-2 ring-[#ffcf00]' : ''}`}>{n}</button>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/60">A single number pays 36x.</p>
      <div className="mt-3"><Outcome round={api.last} /></div>
      <PlayButton api={api} label={`SPIN · ${bet.toUpperCase()}`} onClick={() => api.play({ bet })} />
    </div>
  )
}

function WheelGame({ api }: { api: PlayApi }) {
  const segment = api.last?.game === 'spin-match' ? Number(api.last.outcome?.segment) : null
  const tone = (m: number) => (m === 0 ? 'bg-[#353a45] text-white/50' : m >= 5 ? 'bg-[#ffcf00] text-[#1f1f1f]' : m >= 2 ? 'bg-[#ed1324]' : 'bg-[#0b9b3a]')
  return (
    <div>
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
        {WHEEL_SEGMENTS.map((m, i) => (
          <div key={i} className={`py-3 text-center text-xs font-black ${tone(m)} ${segment === i ? 'scale-110 ring-2 ring-white' : ''} transition-transform`}>{m ? `${m}x` : '0'}</div>
        ))}
      </div>
      <div className="mt-4"><Outcome round={api.last} /></div>
      <PlayButton api={api} label="SPIN THE WHEEL" onClick={() => api.play({})} />
    </div>
  )
}

function SlotGame({ api }: { api: PlayApi }) {
  const reels = (api.last?.game === 'fruit-party' ? (api.last.outcome?.reels as string[]) : null) ?? ['🍒', '🍋', '💎']
  return (
    <div>
      <div className="flex justify-center gap-2 bg-[#1f2229] px-2 py-6 sm:gap-3">
        {reels.map((symbol, i) => <span key={i} className="flex h-20 w-20 items-center justify-center bg-white text-5xl sm:h-24 sm:w-24 sm:text-6xl">{symbol}</span>)}
      </div>
      <p className="mt-2 text-center text-xs text-white/60">💎💎💎 50x · 7️⃣7️⃣7️⃣ 20x · 🔔🔔🔔 10x · 🍉🍉🍉 5x · 🍋🍋🍋 2x · 🍒🍒🍒 1x</p>
      <div className="mt-3"><Outcome round={api.last} /></div>
      <PlayButton api={api} label="SPIN" onClick={() => api.play({})} />
    </div>
  )
}

function PlinkoGame({ api }: { api: PlayApi }) {
  const outcome = api.last?.game === 'plinko-drop' ? api.last.outcome : null
  const path = (outcome?.path as string[] | undefined) ?? []
  const bin = outcome ? Number(outcome.bin) : null
  return (
    <div>
      <div className="bg-[#1a0633] py-4">
        {Array.from({ length: PLINKO_BINS.length - 1 }, (_, row) => {
          const rights = path.slice(0, row).filter((step) => step === 'R').length
          return (
            <div key={row} className="flex justify-center gap-3 py-1 sm:gap-5">
              {Array.from({ length: row + 1 }, (_, peg) => (
                <span key={peg} className={`h-2.5 w-2.5 rounded-full ${outcome && peg === rights ? 'bg-[#ff5fa2]' : 'bg-white/40'}`} />
              ))}
            </div>
          )
        })}
        <div className="mt-3 flex justify-center gap-1 px-2">
          {PLINKO_BINS.map((m, i) => (
            <span key={i} className={`min-w-0 max-w-12 flex-1 py-1.5 text-center text-[10px] font-black sm:text-xs ${bin === i ? 'bg-[#ffcf00] text-[#1f1f1f]' : m >= 2 ? 'bg-[#ed1324]' : 'bg-[#5b1c9e]'}`}>{m}x</span>
          ))}
        </div>
      </div>
      <div className="mt-3"><Outcome round={api.last} /></div>
      <PlayButton api={api} label="DROP BALL" onClick={() => api.play({})} />
    </div>
  )
}
