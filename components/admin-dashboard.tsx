'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, ExternalLink, FileCheck2, KeyRound, Settings, UserCog, Users, WalletCards, X } from 'lucide-react'
import { matchClock, scoreFromTimeline } from '@/lib/clock'
import { CONFIG_GROUPS } from '@/lib/config-fields'
import { formatMoney } from '@/lib/countries'

type Role = 'admin' | 'subadmin'

export function AdminDashboard({ role, close }: { role: Role; close: () => void }) {
  const isAdmin = role === 'admin'
  const [authed, setAuthed] = useState<'checking' | 'yes' | 'no'>('checking')

  useEffect(() => {
    const url = isAdmin ? '/api/admin/overview' : '/api/partner/dashboard'
    fetch(url).then((res) => setAuthed(res.ok ? 'yes' : 'no')).catch(() => setAuthed('no'))
  }, [isAdmin])

  return (
    <section className="mx-auto min-h-[620px] max-w-[1180px] bg-[#f6f7f8] px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed1324]">Operations console</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">{isAdmin ? 'Admin dashboard' : 'Sub-admin workspace'}</h1>
          <p className="mt-1 text-sm text-[#6b7077]">{isAdmin ? 'Full platform controls, financials and staff permissions.' : 'Your referred players, commission and betting wallet.'}</p>
        </div>
        <button onClick={close} className="border bg-white px-4 py-2 text-sm font-semibold">Back to site</button>
      </div>
      {authed === 'checking' && <p className="text-sm text-[#6b7077]">Checking access…</p>}
      {authed === 'no' && (isAdmin ? <AdminLogin onSuccess={() => setAuthed('yes')} /> : <PartnerLogin onSuccess={() => setAuthed('yes')} />)}
      {authed === 'yes' && (isAdmin ? <AdminConsole /> : <PartnerConsole onSignedOut={() => setAuthed('no')} />)}
    </section>
  )
}

// ------------------------------------------------------------------ shared

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[92vh] w-full overflow-y-auto bg-white shadow-xl sm:max-w-md sm:rounded-lg">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-xs font-semibold text-[#3d4148]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#8b8f94]">{hint}</span>}
    </label>
  )
}

const inputClass = 'h-11 w-full border px-3 text-sm outline-none focus:border-[#ed1324]'

function DialogActions({ busy, confirm, tone = 'red', onCancel, onConfirm, disabled }: { busy?: boolean; confirm: string; tone?: 'red' | 'green'; onCancel: () => void; onConfirm: () => void; disabled?: boolean }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button onClick={onCancel} className="h-11 border text-sm font-semibold">Cancel</button>
      <button
        disabled={busy || disabled}
        onClick={onConfirm}
        className={`h-11 text-sm font-semibold text-white disabled:opacity-50 ${tone === 'green' ? 'bg-[#0b9b3a]' : 'bg-[#ed1324]'}`}
      >
        {busy ? 'Please wait…' : confirm}
      </button>
    </div>
  )
}

function Message({ text, tone = 'ok' }: { text: string; tone?: 'ok' | 'error' }) {
  if (!text) return null
  return <p className={`mt-2 px-3 py-2 text-xs ${tone === 'ok' ? 'bg-[#e9f7ef] text-[#0b7a2e]' : 'bg-[#fff0f1] text-[#ed1324]'}`}>{text}</p>
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, json: json as Record<string, unknown> }
}

// ------------------------------------------------------------------ logins

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    setError('')
    const { ok, json } = await send('/api/admin/login', 'POST', { password })
    if (!ok) {
      setError(String(json.error ?? 'Could not sign in'))
      return
    }
    onSuccess()
  }
  return (
    <form onSubmit={(event) => { event.preventDefault(); submit() }} className="mx-auto max-w-sm bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">Admin sign in</h2>
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className={`mt-4 ${inputClass}`} />
      {error && <p className="mt-2 text-xs text-[#ed1324]">{error}</p>}
      <button type="submit" className="mt-4 w-full bg-[#ed1324] py-3 text-sm font-semibold text-white">Enter console</button>
    </form>
  )
}

function PartnerLogin({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'register') {
        const { ok, json } = await send('/api/partner/register', 'POST', { name, phone, email, password })
        if (!ok) {
          setError(String(json.error ?? 'Could not create your account'))
          return
        }
        setNotice(String(json.message ?? 'Account created. Sign in below.'))
        setMode('login')
        return
      }
      const { ok, json } = await send('/api/partner/login', 'POST', { email, password })
      if (!ok) {
        setError(String(json.error ?? 'Could not sign in'))
        return
      }
      onSuccess()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit() }} className="mx-auto max-w-sm bg-white p-6 shadow-sm">
      <div className="mb-4 grid grid-cols-2 border">
        {(['login', 'register'] as const).map((item) => (
          <button type="button" key={item} onClick={() => { setMode(item); setError('') }} className={`py-2.5 text-sm font-semibold ${mode === item ? 'bg-[#ed1324] text-white' : ''}`}>
            {item === 'login' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>
      {mode === 'register' && (
        <>
          <Field label="Full name"><input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></Field>
          <Field label="Phone"><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="+233" className={inputClass} /></Field>
        </>
      )}
      <Field label="Email"><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" className={inputClass} /></Field>
      <Field label="Password" hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputClass} />
      </Field>
      {error && <p className="mb-3 text-xs text-[#ed1324]">{error}</p>}
      {notice && <p className="mb-3 bg-[#e9f7ef] px-3 py-2 text-xs text-[#0b7a2e]">{notice}</p>}
      <button type="submit" disabled={busy} className="w-full bg-[#ed1324] py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? 'Please wait…' : mode === 'login' ? 'Enter workspace' : 'Create sub-admin account'}
      </button>
      {mode === 'register' && <p className="mt-3 text-center text-[11px] text-[#8b8f94]">New accounts start earning once the admin approves them.</p>}
    </form>
  )
}

// ------------------------------------------------------------ admin console

const NAV = [
  { key: 'Overview', icon: BarChart3 },
  { key: 'Users & KYC', icon: Users },
  { key: 'Wallets', icon: WalletCards },
  { key: 'Custom matches', icon: FileCheck2 },
  { key: 'Reports', icon: BarChart3 },
  { key: 'Sub-admins', icon: UserCog },
  { key: 'API keys & commission', icon: KeyRound },
  { key: 'Settings', icon: Settings },
] as const

type Section = (typeof NAV)[number]['key']

function AdminConsole() {
  const [section, setSection] = useState<Section>('Overview')
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    fetch('/api/admin/overview').then((res) => res.json()).then(setOverview).catch(() => {})
  }, [])

  const cards = [
    ['Total users', String(overview?.players ?? '—'), `${overview?.depositors ?? 0} depositors`, Users],
    ['Active bets', String(overview?.openTickets ?? '—'), `Stake ${overview?.openStake ?? 0}`, BarChart3],
    ['Pending reviews', String(overview?.pendingDeposits ?? '—'), 'Manual deposits', FileCheck2],
    ['Liability', moneyMap(overview?.liability), 'Open potential wins', WalletCards],
  ] as const

  const signOut = () => fetch('/api/admin/logout', { method: 'POST' }).then(() => window.location.reload())

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[215px_minmax(0,1fr)]">
      <aside className="min-w-0 self-start bg-[#171a20] p-3 text-white">
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 px-3 pb-3 md:mb-4 md:pb-4">
          <UserCog size={20} className="text-[#ffcf00]" />
          <div>
            <p className="text-xs font-bold">Super Admin</p>
            <p className="text-[10px] text-white/50">All permissions</p>
          </div>
          <button onClick={signOut} className="ml-auto text-xs text-white/50 md:hidden">Sign out</button>
        </div>
        <div className="overflow-hidden">
          <nav className="scrollbar-none -mb-5 flex overflow-x-auto pb-5 md:mb-0 md:block md:pb-0">
            {NAV.map(({ key, icon: Icon }) => (
              <button key={key} onClick={() => setSection(key)} className={`flex shrink-0 items-center gap-3 whitespace-nowrap px-3 py-3 text-left text-sm md:w-full ${section === key ? 'bg-[#ed1324] font-semibold' : 'text-white/70 hover:bg-white/10'}`}>
                <Icon size={16} />
                {key}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={signOut} className="mt-4 hidden w-full px-3 py-2 text-left text-xs text-white/50 md:block">Sign out</button>
      </aside>
      <div className="min-w-0 space-y-4">
        {section === 'Overview' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map(([label, value, change, Icon]) => (
                <div key={label} className="bg-white p-4 shadow-sm">
                  <div className="flex justify-between text-[#6b7077]"><span className="text-xs font-semibold">{label}</span><Icon size={18} /></div>
                  <p className="mt-4 break-words text-2xl font-black">{value}</p>
                  <p className="mt-1 text-xs text-[#0b9b3a]">{change}</p>
                </div>
              ))}
            </div>
            <Card>
              <h2 className="font-bold">Deposits by currency</h2>
              <p className="mt-2 text-[#6b7077]">{moneyMap(overview?.deposits)}</p>
              <h2 className="mt-4 font-bold">Withdrawals by currency</h2>
              <p className="mt-2 text-[#6b7077]">{moneyMap(overview?.withdrawals)}</p>
            </Card>
          </>
        )}
        {section === 'Users & KYC' && <PlayersPanel />}
        {section === 'Wallets' && <DepositsPanel />}
        {section === 'Custom matches' && <MatchesPanel />}
        {section === 'Reports' && <ReportsPanel />}
        {section === 'Sub-admins' && <PartnersPanel />}
        {section === 'API keys & commission' && <ConfigPanel />}
        {section === 'Settings' && <SettingsPanel />}
      </div>
    </div>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="min-w-0 break-words bg-white p-4 text-sm shadow-sm sm:p-5">{children}</div>
}

function moneyMap(value: unknown) {
  if (!value || typeof value !== 'object') return '—'
  const entries = Object.entries(value as Record<string, number>)
  if (!entries.length) return '—'
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' · ')
}

// ------------------------------------------------------------------ players

type PlayerRow = { id: string; name: string; phone: string; balance: number; currency: string; total_deposited: number; withdrawal_approved: boolean }

function PlayersPanel() {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' }>({ text: '', tone: 'ok' })
  const [crediting, setCrediting] = useState<PlayerRow | null>(null)

  const load = (q = query) => {
    fetch(`/api/admin/players?q=${encodeURIComponent(q)}`).then((res) => res.json()).then((json) => setPlayers(json.players ?? [])).catch(() => {})
  }
  useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (userId: string, action: string, amount?: number) => {
    const { ok, json } = await send('/api/admin/players', 'PATCH', { userId, action, amount })
    setMessage(ok ? { text: 'Saved.', tone: 'ok' } : { text: String(json.error ?? 'Could not update the player'), tone: 'error' })
    load()
    return ok
  }

  return (
    <Card>
      <form onSubmit={(event) => { event.preventDefault(); load() }} className="flex gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone or email" className="h-10 min-w-0 flex-1 border px-3 text-sm" />
        <button type="submit" className="bg-[#171a20] px-4 text-sm font-semibold text-white">Search</button>
      </form>
      <Message text={message.text} tone={message.tone} />
      <div className="mt-4 divide-y">
        {players.length === 0 && <p className="py-4 text-[#6b7077]">No players found.</p>}
        {players.map((player) => (
          <div key={player.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{player.name} · {player.phone}</p>
              <p className="text-xs text-[#6b7077]">{formatMoney(Number(player.balance), player.currency)} · deposited {formatMoney(Number(player.total_deposited), player.currency)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => act(player.id, player.withdrawal_approved ? 'revoke' : 'approve')} className="border px-3 py-1.5 text-xs">{player.withdrawal_approved ? 'Revoke withdrawals' : 'Approve withdrawals'}</button>
              <button onClick={() => setCrediting(player)} className="bg-[#171a20] px-3 py-1.5 text-xs text-white">Adjust balance</button>
            </div>
          </div>
        ))}
      </div>
      {crediting && <CreditDialog player={crediting} onClose={() => setCrediting(null)} onSubmit={(amount) => act(crediting.id, 'credit', amount)} />}
    </Card>
  )
}

function CreditDialog({ player, onClose, onSubmit }: { player: PlayerRow; onClose: () => void; onSubmit: (amount: number) => Promise<boolean> }) {
  const [direction, setDirection] = useState<'credit' | 'deduct'>('credit')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const value = Number(amount)
  const valid = Number.isFinite(value) && value > 0
  const balance = Number(player.balance)
  const next = balance + (direction === 'credit' ? value : -value)

  return (
    <Dialog title="Adjust balance" onClose={onClose}>
      <p className="mb-4 text-sm"><b>{player.name}</b> · {player.phone}<br /><span className="text-[#6b7077]">Current balance {formatMoney(balance, player.currency)}</span></p>
      <div className="mb-4 grid grid-cols-2 border">
        {(['credit', 'deduct'] as const).map((item) => (
          <button key={item} onClick={() => setDirection(item)} className={`py-2.5 text-sm font-semibold capitalize ${direction === item ? (item === 'credit' ? 'bg-[#0b9b3a] text-white' : 'bg-[#ed1324] text-white') : ''}`}>{item}</button>
        ))}
      </div>
      <Field label={`Amount (${player.currency})`}>
        <input autoFocus value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0.00" className={inputClass} />
      </Field>
      {valid && <p className="mb-4 text-xs text-[#6b7077]">New balance will be <b className={next < 0 ? 'text-[#ed1324]' : ''}>{formatMoney(next, player.currency)}</b></p>}
      <DialogActions
        busy={busy}
        disabled={!valid}
        tone={direction === 'credit' ? 'green' : 'red'}
        confirm={direction === 'credit' ? 'Credit player' : 'Deduct from player'}
        onCancel={onClose}
        onConfirm={async () => {
          setBusy(true)
          const ok = await onSubmit(direction === 'credit' ? value : -value)
          setBusy(false)
          if (ok) onClose()
        }}
      />
    </Dialog>
  )
}

// ----------------------------------------------------------------- deposits

function DepositsPanel() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [rejecting, setRejecting] = useState<string | null>(null)
  const load = () => fetch('/api/admin/deposits').then((res) => res.json()).then((json) => setRows(json.deposits ?? [])).catch(() => {})
  useEffect(() => { load() }, [])
  const act = async (reference: string, action: string) => {
    await send('/api/admin/deposits', 'POST', { reference, action })
    load()
  }
  return (
    <Card>
      <h2 className="font-bold">Pending manual deposits</h2>
      <p className="mt-1 text-xs text-[#6b7077]">Players can no longer submit manual transfers. Anything left here was sent before that change.</p>
      {rows.length === 0 && <p className="mt-3 text-[#6b7077]">Nothing waiting.</p>}
      {rows.map((row) => {
        const user = row.users as { name?: string; phone?: string } | undefined
        const reference = String(row.reference)
        return (
          <div key={reference} className="mt-3 border p-3">
            <p className="font-semibold">{user?.name} · {user?.phone}</p>
            <p>{formatMoney(Number(row.amount), String(row.currency))} · {String(row.senderNumber ?? '')}</p>
            {row.screenshotUrl ? <a className="text-xs text-[#ed1324]" href={String(row.screenshotUrl)} target="_blank" rel="noreferrer">Open screenshot</a> : null}
            <div className="mt-2 flex gap-2">
              <button onClick={() => act(reference, 'confirm')} className="bg-[#0b9b3a] px-3 py-1.5 text-xs text-white">Confirm</button>
              <button onClick={() => setRejecting(reference)} className="border px-3 py-1.5 text-xs">Reject</button>
            </div>
          </div>
        )
      })}
      {rejecting && (
        <Dialog title="Reject deposit?" onClose={() => setRejecting(null)}>
          <p className="mb-4 text-sm text-[#3d4148]">The player will not be credited for reference <b>{rejecting}</b>. This cannot be undone.</p>
          <DialogActions confirm="Reject deposit" onCancel={() => setRejecting(null)} onConfirm={async () => { await act(rejecting, 'reject'); setRejecting(null) }} />
        </Dialog>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- matches

type Goal = { minute: number; team: 'home' | 'away' }
type MatchRow = {
  id: string
  home_team: string
  away_team: string
  home_crest: string | null
  away_crest: string | null
  league: string
  sport: string | null
  kickoff: string
  odds_home: number
  odds_draw: number
  odds_away: number
  goal_timeline: Goal[] | null
  is_locked: boolean
  best_odds: boolean
  finished: boolean
  final_home: number | null
  final_away: number | null
  stoppage_first?: number | null
  stoppage_second?: number | null
}

type MatchForm = {
  home_team: string
  away_team: string
  home_crest: string
  away_crest: string
  league: string
  startNow: boolean
  kickoff: string
  odds_home: string
  odds_draw: string
  odds_away: string
  goal_timeline: Goal[]
  stoppage_first: string
  stoppage_second: string
  is_locked: boolean
  best_odds: boolean
}

/** "2026-09-24T18:30" in the admin's own timezone, for a datetime-local input. */
function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function blankForm(): MatchForm {
  const soon = new Date(Date.now() + 60 * 60_000)
  soon.setMinutes(0, 0, 0)
  return {
    home_team: '', away_team: '', home_crest: '', away_crest: '', league: 'GoalVault Special',
    startNow: false, kickoff: localInput(soon),
    odds_home: '2.00', odds_draw: '3.20', odds_away: '3.50',
    goal_timeline: [], stoppage_first: '0', stoppage_second: '0', is_locked: false, best_odds: false,
  }
}

function formFromRow(row: MatchRow): MatchForm {
  return {
    home_team: row.home_team, away_team: row.away_team,
    home_crest: row.home_crest ?? '', away_crest: row.away_crest ?? '',
    league: row.league, startNow: false, kickoff: localInput(new Date(row.kickoff)),
    odds_home: String(row.odds_home), odds_draw: String(row.odds_draw), odds_away: String(row.odds_away),
    goal_timeline: row.goal_timeline ?? [], stoppage_first: String(row.stoppage_first ?? 0), stoppage_second: String(row.stoppage_second ?? 0),
    is_locked: row.is_locked, best_odds: row.best_odds,
  }
}

function payload(form: MatchForm) {
  return {
    home_team: form.home_team, away_team: form.away_team,
    home_crest: form.home_crest, away_crest: form.away_crest, league: form.league,
    kickoff: (form.startNow ? new Date() : new Date(form.kickoff)).toISOString(),
    odds_home: form.odds_home, odds_draw: form.odds_draw, odds_away: form.odds_away,
    goal_timeline: form.goal_timeline, is_locked: form.is_locked, best_odds: form.best_odds,
    stoppage_first: Number(form.stoppage_first) || 0, stoppage_second: Number(form.stoppage_second) || 0,
  }
}

function stoppageOf(row: MatchRow) {
  return { first: Number(row.stoppage_first ?? 0), second: Number(row.stoppage_second ?? 0) }
}

/** Where a match stands right now, from the same clock the board uses. */
function statusOf(row: MatchRow, now: Date) {
  if (row.finished) return { kind: 'ft' as const, label: 'FT', home: row.final_home ?? 0, away: row.final_away ?? 0 }
  const clock = matchClock(row.kickoff, row.sport ?? 'football', now, stoppageOf(row))
  const score = scoreFromTimeline(row.goal_timeline ?? [], clock)
  if (clock.isOver) return { kind: 'ft' as const, label: 'FT', ...score }
  if (clock.isLive) return { kind: 'live' as const, label: clock.label, phase: clock.phase, ...score }
  return { kind: 'pre' as const, label: new Date(row.kickoff).toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), home: 0, away: 0 }
}

function MatchesPanel() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [view, setView] = useState<'active' | 'finished'>('active')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<MatchRow | null>(null)
  const [finishing, setFinishing] = useState<MatchRow | null>(null)
  const [removing, setRemoving] = useState<MatchRow | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' }>({ text: '', tone: 'ok' })
  const [now, setNow] = useState(() => new Date())

  const load = () => fetch('/api/admin/custom-matches').then((res) => res.json()).then((json) => setMatches(json.matches ?? [])).catch(() => {})
  useEffect(() => {
    load()
    // Keep the live minutes and scores moving while the panel is open.
    const tick = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(tick)
  }, [])

  const patch = async (id: string, fields: Record<string, unknown>, done?: string) => {
    const { ok, json } = await send('/api/admin/custom-matches', 'PATCH', { id, ...fields })
    setMessage(ok ? { text: done ?? 'Saved.', tone: 'ok' } : { text: String(json.error ?? 'Could not update the match'), tone: 'error' })
    load()
    return ok
  }

  const rows = matches
    .map((row) => ({ row, status: statusOf(row, now) }))
    .filter(({ status }) => (view === 'finished' ? status.kind === 'ft' : status.kind !== 'ft'))
    .sort((a, b) => (view === 'finished' ? -1 : 1) * (new Date(a.row.kickoff).getTime() - new Date(b.row.kickoff).getTime()))
  const counts = {
    active: matches.filter((row) => statusOf(row, now).kind !== 'ft').length,
    finished: matches.filter((row) => statusOf(row, now).kind === 'ft').length,
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Custom matches</h2>
            <p className="text-xs text-[#6b7077]">They start on their own at kickoff, score from your goal script, and finish and settle on their own at full time.</p>
          </div>
          <button onClick={() => setAdding(true)} className="bg-[#ed1324] px-4 py-2 text-sm font-semibold text-white">Add match</button>
        </div>
        <Message text={message.text} tone={message.tone} />
        <div className="mt-4 grid grid-cols-2 border">
          {([['active', `Upcoming & live (${counts.active})`], ['finished', `Finished (${counts.finished})`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setView(key)} className={`py-2 text-sm font-semibold ${view === key ? 'bg-[#171a20] text-white' : ''}`}>{label}</button>
          ))}
        </div>
      </Card>

      {rows.length === 0 && <Card><p className="text-[#6b7077]">{view === 'active' ? 'No upcoming or live matches. Add one above.' : 'No finished matches.'}</p></Card>}

      {rows.map(({ row, status }) => (
        <Card key={row.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-[#6b7077]">{row.league}</p>
              <p className="mt-1 font-semibold">{row.home_team} <span className="text-[#6b7077]">vs</span> {row.away_team}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 font-bold ${status.kind === 'live' ? 'bg-[#e9f7ef] text-[#0b7a2e]' : status.kind === 'ft' ? 'bg-[#eceef1] text-[#3d4148]' : 'bg-[#fff4d6] text-[#8a6100]'}`}>
                  {status.kind === 'live' ? `LIVE ${status.label}` : status.kind === 'ft' ? 'FT' : 'Starts'}
                </span>
                {status.kind === 'pre' ? <span className="text-[#6b7077]">{status.label}</span> : <b>{status.home} – {status.away}</b>}
                {row.is_locked && <span className="bg-[#fff0f1] px-1.5 py-0.5 font-bold text-[#ed1324]">Locked</span>}
                {row.best_odds && <span className="bg-[#e9f7ef] px-1.5 py-0.5 font-bold text-[#0b7a2e]">Best odds</span>}
              </p>
              <p className="mt-1 text-xs text-[#6b7077]">
                Stoppage +{row.stoppage_first ?? 0}' / +{row.stoppage_second ?? 0}' · FT at {90 + Number(row.stoppage_first ?? 0) + Number(row.stoppage_second ?? 0)}' of play
                {' · '}Odds {Number(row.odds_home).toFixed(2)} / {Number(row.odds_draw).toFixed(2)} / {Number(row.odds_away).toFixed(2)}
                {' · '}Goals: {(row.goal_timeline ?? []).length ? (row.goal_timeline ?? []).map((g) => `${g.minute}' ${g.team === 'home' ? row.home_team : row.away_team}`).join(', ') : 'none (0–0)'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {status.kind !== 'ft' && (
                <>
                  <button onClick={() => patch(row.id, { is_locked: !row.is_locked }, row.is_locked ? 'Betting unlocked.' : 'Betting locked.')} className="border px-3 py-1.5 text-xs">{row.is_locked ? 'Unlock' : 'Lock'}</button>
                  <button onClick={() => patch(row.id, { best_odds: !row.best_odds })} className="border px-3 py-1.5 text-xs">{row.best_odds ? 'Best odds off' : 'Best odds on'}</button>
                  {status.kind === 'live' && (
                    <button
                      onClick={() => {
                        const half = status.phase === 'first' ? 'stoppage_first' : 'stoppage_second'
                        patch(row.id, { [half]: Number(row[half] ?? 0) + 1 }, `+1 minute added to the ${half === 'stoppage_first' ? 'first' : 'second'} half.`)
                      }}
                      className="border border-[#0b7a2e] px-3 py-1.5 text-xs font-semibold text-[#0b7a2e]"
                    >
                      +1' stoppage
                    </button>
                  )}
                  <button onClick={() => setEditing(row)} className="border px-3 py-1.5 text-xs">Edit</button>
                  <button onClick={() => setFinishing(row)} className="border px-3 py-1.5 text-xs">Set result</button>
                </>
              )}
              <button onClick={() => setRemoving(row)} className="bg-[#ed1324] px-3 py-1.5 text-xs text-white">Remove</button>
            </div>
          </div>
        </Card>
      ))}

      {adding && (
        <MatchDialog
          title="Add a match"
          initial={blankForm()}
          allowStartNow
          onClose={() => setAdding(false)}
          onSubmit={async (form) => {
            const { ok, json } = await send('/api/admin/custom-matches', 'POST', payload(form))
            if (!ok) return String(json.error ?? 'Could not add the match')
            setMessage({ text: `${form.home_team} vs ${form.away_team} added.`, tone: 'ok' })
            load()
            return null
          }}
        />
      )}
      {editing && (
        <MatchDialog
          title="Edit match"
          initial={formFromRow(editing)}
          onClose={() => setEditing(null)}
          onSubmit={async (form) => {
            const ok = await patch(editing.id, payload(form), 'Match updated.')
            return ok ? null : 'Could not update the match'
          }}
        />
      )}
      {finishing && <ResultDialog match={finishing} onClose={() => setFinishing(null)} onSaved={load} />}
      {removing && (
        <RemoveDialog
          match={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => { setMessage({ text: `${removing.home_team} vs ${removing.away_team} removed.`, tone: 'ok' }); load() }}
        />
      )}
    </div>
  )
}

function MatchDialog({ title, initial, allowStartNow = false, onClose, onSubmit }: { title: string; initial: MatchForm; allowStartNow?: boolean; onClose: () => void; onSubmit: (form: MatchForm) => Promise<string | null> }) {
  const [form, setForm] = useState<MatchForm>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof MatchForm) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value })

  const upload = async (side: 'home_crest' | 'away_crest', file: File | undefined) => {
    if (!file) return
    const body = new FormData()
    body.set('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Could not upload that crest')
      return
    }
    setForm((current) => ({ ...current, [side]: json.url }))
  }

  const valid = form.home_team.trim() && form.away_team.trim() && (form.startNow || form.kickoff) && [form.odds_home, form.odds_draw, form.odds_away].every((value) => Number(value) > 1)

  return (
    <Dialog title={title} onClose={onClose}>
      <Field label="League"><input value={form.league} onChange={set('league')} className={inputClass} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Home team"><input value={form.home_team} onChange={set('home_team')} placeholder="Hearts of Oak" className={inputClass} /></Field>
        <Field label="Away team"><input value={form.away_team} onChange={set('away_team')} placeholder="Asante Kotoko" className={inputClass} /></Field>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {(['home_crest', 'away_crest'] as const).map((side) => (
          <div key={side} className="flex items-center gap-2 border px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form[side] || '/crest-fallback.svg'} alt="" className="h-8 w-8 shrink-0 rounded-full bg-white object-contain" />
            <label className="cursor-pointer text-xs font-semibold text-[#ed1324]">
              {form[side] ? 'Change crest' : 'Add crest'}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => upload(side, event.target.files?.[0])} />
            </label>
          </div>
        ))}
      </div>
      {allowStartNow && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.startNow} onChange={(event) => setForm({ ...form, startNow: event.target.checked })} className="h-4 w-4 accent-[#ed1324]" />
          Start the match now
        </label>
      )}
      {!form.startNow && (
        <Field label="Kickoff" hint="The match goes live on its own at this time: 45 minutes, 10 minutes half time, 45 minutes, plus any stoppage time you add.">
          <input type="datetime-local" value={form.kickoff} onChange={set('kickoff')} className={inputClass} />
        </Field>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Field label="Home (1)"><input value={form.odds_home} onChange={set('odds_home')} inputMode="decimal" className={inputClass} /></Field>
        <Field label="Draw (X)"><input value={form.odds_draw} onChange={set('odds_draw')} inputMode="decimal" className={inputClass} /></Field>
        <Field label="Away (2)"><input value={form.odds_away} onChange={set('odds_away')} inputMode="decimal" className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="1st half stoppage (min)"><input value={form.stoppage_first} onChange={set('stoppage_first')} inputMode="numeric" className={inputClass} /></Field>
        <Field label="2nd half stoppage (min)"><input value={form.stoppage_second} onChange={set('stoppage_second')} inputMode="numeric" className={inputClass} /></Field>
      </div>
      <GoalScript goals={form.goal_timeline} home={form.home_team || 'Home'} away={form.away_team || 'Away'} onChange={(goal_timeline) => setForm({ ...form, goal_timeline })} />
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_locked} onChange={(event) => setForm({ ...form, is_locked: event.target.checked })} className="h-4 w-4 accent-[#ed1324]" /> Lock betting</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.best_odds} onChange={(event) => setForm({ ...form, best_odds: event.target.checked })} className="h-4 w-4 accent-[#ed1324]" /> Best odds boost</label>
      </div>
      {error && <p className="mb-3 text-xs text-[#ed1324]">{error}</p>}
      <DialogActions
        busy={busy}
        disabled={!valid}
        tone="green"
        confirm="Save match"
        onCancel={onClose}
        onConfirm={async () => {
          setError('')
          setBusy(true)
          const problem = await onSubmit(form)
          setBusy(false)
          if (problem) setError(problem)
          else onClose()
        }}
      />
    </Dialog>
  )
}

/** The scripted scoreline: which team scores, and in which minute. */
function GoalScript({ goals, home, away, onChange }: { goals: Goal[]; home: string; away: string; onChange: (goals: Goal[]) => void }) {
  const [minute, setMinute] = useState('')
  const add = (team: 'home' | 'away') => {
    const value = Math.floor(Number(minute))
    if (!(value >= 1 && value <= 90)) return
    onChange([...goals, { minute: value, team }].sort((a, b) => a.minute - b.minute))
    setMinute('')
  }
  const final = { home: goals.filter((g) => g.team === 'home').length, away: goals.filter((g) => g.team === 'away').length }

  return (
    <div className="mb-4 border p-3">
      <p className="text-xs font-semibold text-[#3d4148]">Goal script <span className="font-normal text-[#8b8f94]">· final score {final.home} – {final.away}</span></p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {goals.length === 0 && <span className="text-xs text-[#8b8f94]">No goals: the match ends 0–0.</span>}
        {goals.map((goal, index) => (
          <span key={`${goal.minute}-${goal.team}-${index}`} className="flex items-center gap-1 bg-[#f6f7f8] px-2 py-1 text-xs">
            {goal.minute}&apos; {goal.team === 'home' ? home : away}
            <button onClick={() => onChange(goals.filter((_, i) => i !== index))} aria-label="Remove goal" className="text-[#8b8f94] hover:text-[#ed1324]"><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={minute} onChange={(event) => setMinute(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Minute" className="h-9 w-20 border px-2 text-sm" />
        <button onClick={() => add('home')} disabled={!minute} className="h-9 min-w-0 flex-1 truncate border px-2 text-xs font-semibold disabled:opacity-50">+ {home}</button>
        <button onClick={() => add('away')} disabled={!minute} className="h-9 min-w-0 flex-1 truncate border px-2 text-xs font-semibold disabled:opacity-50">+ {away}</button>
      </div>
    </div>
  )
}

function RemoveDialog({ match, onClose, onRemoved }: { match: MatchRow; onClose: () => void; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <Dialog title="Remove match?" onClose={onClose}>
      <p className="mb-4 text-sm text-[#3d4148]"><b>{match.home_team} vs {match.away_team}</b> will disappear from the site. This cannot be undone.</p>
      {error && <p className="mb-3 bg-[#fff0f1] px-3 py-2 text-xs text-[#ed1324]">{error}</p>}
      <DialogActions
        busy={busy}
        confirm="Remove match"
        onCancel={onClose}
        onConfirm={async () => {
          setBusy(true)
          const res = await fetch(`/api/admin/custom-matches?id=${encodeURIComponent(match.id)}`, { method: 'DELETE' })
          const json = await res.json().catch(() => ({}))
          setBusy(false)
          if (!res.ok) {
            setError(json.error ?? 'Could not remove the match')
            return
          }
          onRemoved()
          onClose()
        }}
      />
    </Dialog>
  )
}

function ResultDialog({ match, onClose, onSaved }: { match: MatchRow; onClose: () => void; onSaved: () => void }) {
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = /^\d+$/.test(home) && /^\d+$/.test(away)

  return (
    <Dialog title="Set final result" onClose={onClose}>
      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <Field label={match.home_team}><input autoFocus value={home} onChange={(event) => setHome(event.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${inputClass} text-center text-lg font-bold`} /></Field>
        <span className="mb-7 text-lg font-bold">–</span>
        <Field label={match.away_team}><input value={away} onChange={(event) => setAway(event.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${inputClass} text-center text-lg font-bold`} /></Field>
      </div>
      <p className="mb-4 text-xs text-[#6b7077]">Bets on this match settle from this score. Check it before saving.</p>
      {error && <p className="mb-3 text-xs text-[#ed1324]">{error}</p>}
      <DialogActions
        busy={busy}
        disabled={!valid}
        tone="green"
        confirm="Save result"
        onCancel={onClose}
        onConfirm={async () => {
          setBusy(true)
          const { ok, json } = await send('/api/admin/custom-matches', 'PATCH', { id: match.id, final_home: Number(home), final_away: Number(away) })
          setBusy(false)
          if (!ok) {
            setError(String(json.error ?? 'Could not save the result'))
            return
          }
          onSaved()
          onClose()
        }}
      />
    </Dialog>
  )
}

// ----------------------------------------------------------------- reports

function ReportsPanel() {
  const [bets, setBets] = useState<Record<string, unknown>[]>([])
  const [payments, setPayments] = useState<Record<string, unknown>[]>([])
  const loadPayments = () => fetch('/api/admin/payments').then((res) => res.json()).then((json) => setPayments(json.payments ?? [])).catch(() => {})
  useEffect(() => {
    fetch('/api/admin/bets').then((res) => res.json()).then((json) => setBets(json.bets ?? [])).catch(() => {})
    loadPayments()
  }, [])
  const resolve = async (reference: string) => {
    await send('/api/admin/payments', 'PATCH', { reference, status: 'resolved' })
    loadPayments()
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="font-bold">Tickets</h2>
        {bets.slice(0, 30).map((bet) => (
          <div key={String(bet.code)} className="border-b py-2">
            <p className="font-semibold">{String(bet.code)} · {String(bet.status)}</p>
            <p className="text-xs text-[#6b7077]">{formatMoney(Number(bet.stake), String(bet.currency))} → {formatMoney(Number(bet.potential_win), String(bet.currency))}</p>
          </div>
        ))}
      </Card>
      <Card>
        <h2 className="font-bold">Payments</h2>
        {payments.slice(0, 30).map((payment) => (
          <div key={String(payment.reference)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
            <div className="min-w-0">
              <p className="font-semibold">{formatMoney(Number(payment.amount), String(payment.currency))} · {String(payment.status)}</p>
              <p className="break-all text-xs text-[#6b7077]">{String(payment.provider)} · {String(payment.reference)}</p>
            </div>
            {payment.status === 'pending' && <button onClick={() => resolve(String(payment.reference))} className="border px-2 py-1 text-xs">Resolve</button>}
          </div>
        ))}
      </Card>
    </div>
  )
}

// --------------------------------------------------------------- sub-admins

type Partner = { id: string; name: string; email: string; phone: string | null; referral_code: string; referredPlayers: number; approved: boolean; balances: Record<string, number> | null; lifetime: Record<string, number> | null }

function PartnersPanel() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [adding, setAdding] = useState(false)
  const [settling, setSettling] = useState<{ partner: Partner; currency: string; amount: number } | null>(null)
  const [message, setMessage] = useState('')

  const load = () => fetch('/api/admin/sub-admins').then((res) => res.json()).then((json) => setPartners(json.partners ?? [])).catch(() => {})
  useEffect(() => { load() }, [])

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    await send('/api/admin/sub-admins', 'PATCH', { id, action, ...extra })
    load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Sub-admins</h2>
            <p className="text-xs text-[#6b7077]">Sub-admins sign in on their own page with their email and password.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/sub-admin" target="_blank" className="flex items-center gap-1.5 border px-3 py-2 text-xs font-semibold">Open sub-admin page <ExternalLink size={13} /></Link>
            <button onClick={() => setAdding(true)} className="bg-[#ed1324] px-3 py-2 text-xs font-semibold text-white">Add sub-admin</button>
          </div>
        </div>
        <Message text={message} />
      </Card>
      <Card>
        {partners.length === 0 && <p className="text-[#6b7077]">No sub-admins yet.</p>}
        {partners.map((partner) => {
          const owed = Object.entries(partner.balances ?? {}).filter(([, amount]) => Number(amount) > 0)
          return (
            <div key={partner.id} className="border-b py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{partner.name} <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold uppercase ${partner.approved ? 'bg-[#e9f7ef] text-[#0b7a2e]' : 'bg-[#fff4d6] text-[#8a6100]'}`}>{partner.approved ? 'Approved' : 'Waiting'}</span></p>
                  <p className="break-all text-xs text-[#6b7077]">{partner.email}{partner.phone ? ` · ${partner.phone}` : ''}</p>
                  <p className="text-xs text-[#6b7077]">Code <b>{partner.referral_code}</b> · {partner.referredPlayers} players</p>
                  <p className="mt-1 text-xs">Commission owed: {owed.length ? owed.map(([currency, amount]) => formatMoney(Number(amount), currency)).join(' · ') : 'none'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {owed.map(([currency, amount]) => (
                    <button key={currency} onClick={() => setSettling({ partner, currency, amount: Number(amount) })} className="bg-[#0b9b3a] px-3 py-1.5 text-xs text-white">Mark {currency} paid</button>
                  ))}
                  <button onClick={() => act(partner.id, partner.approved ? 'revoke' : 'approve')} className="border px-3 py-1.5 text-xs">{partner.approved ? 'Revoke' : 'Approve'}</button>
                </div>
              </div>
            </div>
          )
        })}
      </Card>
      {adding && <AddPartnerDialog onClose={() => setAdding(false)} onCreated={(name) => { setMessage(`${name} can now sign in on the sub-admin page.`); load() }} />}
      {settling && (
        <Dialog title="Mark commission as paid" onClose={() => setSettling(null)}>
          <p className="mb-4 text-sm text-[#3d4148]">
            Confirm you have paid <b>{settling.partner.name}</b> {formatMoney(settling.amount, settling.currency)}. Their owed balance resets to zero; the lifetime total is kept.
          </p>
          <DialogActions tone="green" confirm="Mark as paid" onCancel={() => setSettling(null)} onConfirm={async () => { await act(settling.partner.id, 'settle', { currency: settling.currency }); setSettling(null) }} />
        </Dialog>
      )}
    </div>
  )
}

function AddPartnerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string) => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value })

  return (
    <Dialog title="Add sub-admin" onClose={onClose}>
      <Field label="Full name"><input autoFocus value={form.name} onChange={set('name')} className={inputClass} /></Field>
      <Field label="Email" hint="They sign in with this."><input value={form.email} onChange={set('email')} type="email" className={inputClass} /></Field>
      <Field label="Phone (optional)"><input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="+233" className={inputClass} /></Field>
      <Field label="Password" hint="At least 8 characters. Share it with them privately."><input value={form.password} onChange={set('password')} type="text" autoComplete="off" className={inputClass} /></Field>
      {error && <p className="mb-3 text-xs text-[#ed1324]">{error}</p>}
      <DialogActions
        busy={busy}
        tone="green"
        confirm="Create sub-admin"
        onCancel={onClose}
        onConfirm={async () => {
          setError('')
          setBusy(true)
          const { ok, json } = await send('/api/admin/sub-admins', 'POST', form)
          setBusy(false)
          if (!ok) {
            setError(String(json.error ?? 'Could not create the sub-admin'))
            return
          }
          onCreated(form.name)
          onClose()
        }}
      />
    </Dialog>
  )
}

// ----------------------------------------------------- API keys & commission

type Status = Record<string, { saved: string | null; inEnv: boolean }>

function ConfigPanel() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>({})
  const [clear, setClear] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' }>({ text: '', tone: 'ok' })

  const load = () =>
    fetch('/api/admin/settings').then((res) => res.json()).then((json) => {
      setStatus(json.status ?? {})
      setValues(json.settings ?? {})
      setClear([])
    }).catch(() => {})
  useEffect(() => { load() }, [])

  const save = async () => {
    setBusy(true)
    const { ok, json } = await send('/api/admin/settings', 'PUT', { settings: values, clear })
    setBusy(false)
    setMessage(ok ? { text: 'Saved. New values are used within 30 seconds.', tone: 'ok' } : { text: String(json.error ?? 'Could not save'), tone: 'error' })
    if (ok) load()
  }

  return (
    <div className="space-y-4">
      {CONFIG_GROUPS.map((group) => (
        <Card key={group.title}>
          <h2 className="mb-3 font-bold">{group.title}</h2>
          <div className="grid gap-x-4 md:grid-cols-2">
            {group.fields.map((field) => {
              const state = status[field.key]
              const cleared = clear.includes(field.key)
              const source = cleared
                ? 'Will be removed on save'
                : state?.saved
                  ? field.secret ? `Saved here (${state.saved})` : 'Saved here'
                  : state?.inEnv ? 'Using the value set in Vercel' : 'Not set'
              return (
                <Field key={field.key} label={field.label} hint={[field.hint, source].filter(Boolean).join(' · ')}>
                  <div className="flex gap-2">
                    {field.options ? (
                      <select value={values[field.key] ?? ''} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} className={`${inputClass} min-w-0 flex-1 bg-white`}>
                        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                    <input
                      value={values[field.key] ?? ''}
                      onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                      type={field.secret ? 'password' : 'text'}
                      autoComplete="off"
                      placeholder={field.secret && state?.saved ? 'Enter a new value to replace it' : ''}
                      className={`${inputClass} min-w-0 flex-1`}
                    />
                    )}
                    {state?.saved && !cleared && (
                      <button onClick={() => { setClear([...clear, field.key]); setValues({ ...values, [field.key]: '' }) }} className="shrink-0 border px-3 text-xs">Clear</button>
                    )}
                  </div>
                </Field>
              )
            })}
          </div>
        </Card>
      ))}
      <Card>
        <p className="text-xs text-[#6b7077]">A value saved here overrides the same variable in Vercel. Clear it to go back to the Vercel value. Secret keys are never shown again after saving.</p>
        <Message text={message.text} tone={message.tone} />
        <button disabled={busy} onClick={save} className="mt-3 bg-[#171a20] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button>
      </Card>
    </div>
  )
}

// ----------------------------------------------------------------- settings

function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  useEffect(() => {
    fetch('/api/admin/settings').then((res) => res.json()).then((json) => setSettings(json.settings ?? {})).catch(() => {})
  }, [])
  const keys = ['support_whatsapp', 'support_email', 'license_text']
  const save = async () => {
    const { ok } = await send('/api/admin/settings', 'PUT', { settings: Object.fromEntries(keys.map((key) => [key, settings[key] ?? ''])) })
    setMessage(ok ? 'Saved.' : 'Could not save settings')
  }
  return (
    <Card>
      <h2 className="font-bold">Support and footer</h2>
      <p className="mt-1 text-xs text-[#6b7077]">Shown on the Help page and in the site footer. Leave the licence line empty until you have a licence number.</p>
      {keys.map((key) => (
        <label key={key} className="mt-3 block text-xs font-semibold">
          {{ support_whatsapp: 'Support WhatsApp number', support_email: 'Support email', license_text: 'Licence line (e.g. Licensed by the Gaming Commission of Ghana · your licence number)' }[key] ?? key}
          <input value={settings[key] ?? ''} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} className="mt-1 h-10 w-full border px-3 text-sm font-normal" />
        </label>
      ))}
      <Message text={message} />
      <button onClick={save} className="mt-4 bg-[#171a20] px-4 py-2 text-sm font-semibold text-white">Save settings</button>
    </Card>
  )
}

// ---------------------------------------------------------- partner console

function PartnerConsole({ onSignedOut }: { onSignedOut: () => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' }>({ text: '', tone: 'ok' })
  const [opening, setOpening] = useState(false)
  const [period, setPeriod] = useState<Period>('today')

  const load = () => fetch('/api/partner/dashboard').then((res) => res.json()).then(setData).catch(() => {})
  useEffect(() => { load() }, [])

  const partner = (data?.partner ?? {}) as { name?: string; referral_code?: string; approved?: boolean }
  const wallet = data?.wallet as { balance?: number; currency?: string } | null
  const allPlayers = (data?.players ?? []) as { id: string; name: string; phone: string; total_deposited: number; currency: string; created_at: string }[]
  const allCommissions = (data?.commissions ?? []) as { id: string; amount: number; currency: string; deposit_amount: number; created_at: string }[]
  // Only the chosen day is shown; older rows stay in the database and under "All".
  const players = allPlayers.filter((row) => inPeriod(row.created_at, period))
  const commissions = allCommissions.filter((row) => inPeriod(row.created_at, period))
  const earned = sumByCurrency(commissions)
  const periodLabel = PERIODS.find((item) => item.key === period)!.label

  const credit = async () => {
    const { ok, json } = await send('/api/partner/credit', 'POST', { amount: Number(amount) })
    setMessage(ok ? { text: 'Wallet credited.', tone: 'ok' } : { text: String(json.error ?? 'Could not credit'), tone: 'error' })
    setAmount('')
    load()
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[215px_minmax(0,1fr)]">
      <aside className="min-w-0 self-start bg-[#171a20] p-3 text-white">
        <div className="mb-2 flex items-center gap-2 px-3 pb-2">
          <UserCog size={20} className="text-[#ffcf00]" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{partner.name ?? 'Sub-admin'}</p>
            <p className="text-[10px] text-white/50">{partner.approved ? 'Approved' : 'Waiting for approval'}</p>
          </div>
        </div>
        <button onClick={async () => { await fetch('/api/partner/logout', { method: 'POST' }); onSignedOut() }} className="w-full px-3 py-2 text-left text-xs text-white/50">Sign out</button>
      </aside>
      <div className="min-w-0 space-y-4">
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          {PERIODS.map((item) => (
            <button key={item.key} onClick={() => setPeriod(item.key)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${period === item.key ? 'bg-[#171a20] text-white' : 'text-[#6b7077]'}`}>{item.label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Referral code" value={partner.referral_code ?? '—'} />
          <Stat label={`New players · ${periodLabel}`} value={String(players.length)} />
          <Stat label={`Commission · ${periodLabel}`} value={earned || formatMoney(0, wallet?.currency ?? 'GHS')} />
          <Stat label="Betting wallet" value={wallet ? formatMoney(Number(wallet.balance), wallet.currency ?? 'GHS') : 'Not opened'} />
        </div>
        <Card>
          <h2 className="font-bold">Credit betting wallet</h2>
          {!wallet && <button onClick={() => setOpening(true)} className="mt-3 border px-3 py-2 text-xs font-semibold">Open betting account</button>}
          <div className="mt-3 flex gap-2">
            <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Amount" className="h-10 min-w-0 flex-1 border px-3" />
            <button onClick={credit} disabled={!Number(amount)} className="bg-[#0b9b3a] px-4 text-sm font-semibold text-white disabled:opacity-50">Credit</button>
          </div>
          <Message text={message.text} tone={message.tone} />
          <p className="mt-2 text-xs text-[#6b7077]">Used today {String(data?.creditedToday ?? 0)} of {String(data?.dailyLimit ?? 0)}.</p>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-bold">Referred players · {periodLabel}</h2>
            {players.length === 0 && <p className="mt-2 text-[#6b7077]">{period === 'all' ? `Share your code ${partner.referral_code ?? ''} to bring players in.` : `No new players ${periodLabel.toLowerCase()}.`}</p>}
            {players.map((player) => <p key={player.id} className="border-b py-2">{player.name} · {player.phone} · {formatMoney(player.total_deposited, player.currency)}</p>)}
          </Card>
          <Card>
            <h2 className="font-bold">Commission · {periodLabel}</h2>
            {commissions.length === 0 && <p className="mt-2 text-[#6b7077]">{period === 'all' ? 'No commission yet.' : `No commission ${periodLabel.toLowerCase()}.`}</p>}
            {commissions.map((row) => <p key={row.id} className="border-b py-2">{formatMoney(row.amount, row.currency)} on {formatMoney(row.deposit_amount, row.currency)}</p>)}
          </Card>
        </div>
      </div>
      {opening && <OpenAccountDialog onClose={() => setOpening(false)} onDone={(text, ok) => { setMessage({ text, tone: ok ? 'ok' : 'error' }); load() }} />}
    </div>
  )
}

type Period = 'today' | 'yesterday' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'all', label: 'All' },
]

const DAY_MS = 86_400_000

/** Days run midnight to midnight UTC, which is local time in Ghana. */
function inPeriod(iso: string, period: Period) {
  if (period === 'all') return true
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const at = new Date(iso).getTime()
  return period === 'today' ? at >= today : at >= today - DAY_MS && at < today
}

function sumByCurrency(rows: { amount: number; currency: string }[]) {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0) + Number(row.amount))
  return [...totals.entries()].map(([currency, amount]) => formatMoney(amount, currency)).join(' · ')
}

function OpenAccountDialog({ onClose, onDone }: { onClose: () => void; onDone: (text: string, ok: boolean) => void }) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog title="Open betting account" onClose={onClose}>
      <Field label="Phone number for the betting account" hint="You sign in to the betting site with this number.">
        <div className="flex h-11 border focus-within:border-[#ed1324]">
          <span className="flex items-center border-r bg-[#f5f6f7] px-3 text-sm font-semibold">+233</span>
          <input autoFocus value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="24 123 4567" className="min-w-0 flex-1 px-3 text-sm outline-none" />
        </div>
      </Field>
      <DialogActions
        busy={busy}
        disabled={phone.replace(/\D/g, '').length < 9}
        tone="green"
        confirm="Open account"
        onCancel={onClose}
        onConfirm={async () => {
          setBusy(true)
          const { ok, json } = await send('/api/partner/play', 'POST', { phone, countryCode: 'GH' })
          setBusy(false)
          onDone(ok ? 'Betting account opened.' : String(json.error ?? 'Could not open the account'), ok)
          onClose()
        }}
      />
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-[#6b7077]">{label}</p><p className="mt-3 break-words text-xl font-black">{value}</p></div>
}
