'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight, CircleHelp, Eye, EyeOff, FileText, Gamepad2,
  Headphones, History, Lock, LogOut, Megaphone, ReceiptText, Share2, ShieldCheck, Smartphone, Ticket,
} from 'lucide-react'
import { NeedSignIn } from '@/components/player-panels'
import { useShell } from '@/components/site-shell'
import { formatMoney, ghanaNetwork, maskPhoneTail } from '@/lib/countries'
import { useSession } from '@/lib/store'

type Me = {
  user: {
    name: string
    phone: string
    balance: number
    currency: string
    total_deposited: number
    payout_number: string | null
    payout_bank: string | null
  }
  country: {
    code: string
    currencySymbol: string
    minFirstDeposit: number
    minDeposit?: number
    maxDeposit?: number
    gateway: string
    payoutRail: 'mobile' | 'bank'
    networks: string[]
  }
  withdrawal: { unlocked: boolean; failed: string | null; progress: { have: number; need: number; label: string } }
}

function useMe() {
  const { player } = useShell()
  const setBalance = useSession((state) => state.setBalance)
  const [me, setMe] = useState<Me | null>(null)

  const load = useCallback(() => {
    if (!player) return
    fetch(`/api/me?userId=${player.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.user) return
        setMe(json)
        setBalance(Number(json.user.balance))
      })
      .catch(() => {})
  }, [player, setBalance])

  useEffect(load, [load])
  return { me, reload: load }
}

const GHANA_NETWORK_NAMES = {
  MTN: { name: 'MTN Mobile Money', badge: 'MTN', tone: 'bg-[#ffcc00] text-[#1f1f1f]' },
  VODAFONE: { name: 'Telecel Cash', badge: 'T', tone: 'bg-[#e60000] text-white' },
  AIRTELTIGO: { name: 'AirtelTigo Money', badge: 'AT', tone: 'bg-[#0033a0] text-white' },
} as const

/** The network the rail will be told about, named the way players know it. */
function networkFor(phone: string, countryCode: string, networks: string[]) {
  if (countryCode === 'GH') return GHANA_NETWORK_NAMES[ghanaNetwork(phone)]
  const name = networks[0] ?? 'Mobile Money'
  return { name, badge: name.slice(0, 2).toUpperCase(), tone: 'bg-[#0b6e4f] text-white' }
}

const CHIPS: Record<string, number[]> = {
  NGN: [500, 1000, 2000, 5000, 10000],
  GHS: [50, 100, 200, 500, 1000],
}
const DEFAULT_CHIPS = [2, 5, 10, 50, 100]

// ------------------------------------------------------------------- layout

function DarkPage({ title, back = '/account', help, children }: { title: string; back?: string; help?: string; children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-110px)] bg-[#f1f5f3] text-[#0f1f1a]">
      <div className="mx-auto max-w-[560px]">
        <div className="relative flex h-12 items-center justify-center border-b border-[#dde7e2] px-3">
          <Link href={back} className="absolute left-3 flex items-center text-sm text-[#0f1f1a]"><ChevronLeft size={22} /> {back === '/account' ? 'Me' : 'Back'}</Link>
          <h1 className="text-base font-bold">{title}</h1>
          {help && <Link href={help} className="absolute right-3 text-[#0f1f1a]" aria-label="Help"><CircleHelp size={22} /></Link>}
        </div>
        {children}
      </div>
    </div>
  )
}

function Tabs<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (key: T) => void }) {
  return (
    <div className="flex border-b border-[#dde7e2]">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={`flex-1 py-3 text-sm font-semibold ${value === item.key ? 'border-b-[3px] border-[#0b6e4f] text-[#0b6e4f]' : 'text-[#34463f]'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function PhoneRow({ phone }: { phone: string }) {
  return (
    <div className="flex h-12 items-center gap-3 rounded-xl bg-[#edf3f0] px-4 text-[15px]">
      <Smartphone size={22} className="text-[#5f6f69]" />
      <span>+{countryPrefix(phone)} {maskPhoneTail(phone)}</span>
    </div>
  )
}

function countryPrefix(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length > 9 ? digits.slice(0, digits.length - 9) : ''
}

function NetworkRow({ network, onSwitch, switching }: { network: { name: string; badge: string; tone: string }; onSwitch: () => void; switching: boolean }) {
  return (
    <button onClick={onSwitch} className="flex h-12 w-full items-center gap-3 rounded-xl border border-[#dde7e2] bg-white px-3 text-left text-[15px]">
      <span className={`flex h-7 w-11 shrink-0 items-center justify-center rounded-sm text-[10px] font-black ${network.tone}`}>{network.badge}</span>
      <span className="min-w-0 flex-1 truncate">{network.name}</span>
      <span className="text-sm text-[#0f1f1a]">{switching ? 'Cancel' : 'Switch'}</span>
      <ChevronRight size={18} className={`text-[#5f6f69] transition-transform ${switching ? 'rotate-90' : ''}`} />
    </button>
  )
}

function AmountField({ value, onChange, currency, min }: { value: string; onChange: (value: string) => void; currency: string; min: number }) {
  return (
    <label className="flex h-12 items-center rounded-xl border border-[#dde7e2] bg-white px-4 text-[15px] focus-within:border-[#0b6e4f]">
      <span className="shrink-0">Amount ({currency})</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ''))}
        inputMode="decimal"
        placeholder={`min. ${min.toFixed(2)}`}
        className="min-w-0 flex-1 bg-transparent text-right text-[#0f1f1a] outline-none placeholder:text-[#86958f]"
      />
    </label>
  )
}

function Notes({ lines }: { lines: string[] }) {
  return (
    <ol className="mt-4 space-y-0.5 text-[13px] leading-snug text-[#5f6f69]">
      {lines.map((line, i) => <li key={line}>{i + 1}. {line}</li>)}
    </ol>
  )
}

// ---------------------------------------------------------------------- Me

export function AccountPage() {
  const { player } = useShell()
  const signOut = useSession((state) => state.signOut)
  const router = useRouter()
  const { me, reload } = useMe()
  const [hidden, setHidden] = useState(false)
  const { notify } = useShell()
  const setBalance = useSession((state) => state.setBalance)

  // Back from a hosted checkout with ?ref=…: ask the rail how it went, for up
  // to a minute, and credit the moment it confirms.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (!ref || !player) return
    window.history.replaceState(null, '', '/account')
    let alive = true
    let tries = 0
    notify('Checking your payment…')
    const check = async () => {
      if (!alive) return
      tries++
      const json = await fetch(`/api/deposits/status?reference=${encodeURIComponent(ref)}`, { cache: 'no-store' }).then((res) => res.json()).catch(() => null)
      if (!alive) return
      if (json?.status === 'confirmed') {
        if (typeof json.balance === 'number') setBalance(json.balance)
        notify('Deposit received. Your balance is updated.')
        reload()
        return
      }
      if (json?.status === 'failed') {
        notify('That payment did not go through. No money was taken.')
        return
      }
      if (tries < 12) setTimeout(check, 5000)
      else notify('Your payment is still processing. It will show in your balance once confirmed.')
    }
    check()
    return () => {
      alive = false
    }
  }, [player, notify, reload, setBalance])

  if (!player) return <NeedSignIn />

  const balance = formatMoney(me ? Number(me.user.balance) : player.balance, player.currency)
  type MenuItem = { label: string; href?: string; onClick?: () => void; icon: ReactNode }
  const invite = () => {
    const url = window.location.origin
    if (navigator.share) navigator.share({ title: 'GoalVault', url }).catch(() => {})
    else navigator.clipboard?.writeText(url).catch(() => {})
  }
  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Account & Support',
      items: [
        { label: 'Customer Service', href: '/help#contact', icon: <Headphones size={22} /> },
        { label: 'Help & FAQ', href: '/help', icon: <CircleHelp size={22} /> },
        { label: 'Load booking code', href: '/load-code', icon: <Ticket size={22} /> },
      ],
    },
    {
      title: 'More',
      items: [
        { label: 'Promotions', href: '/promotions', icon: <Megaphone size={22} /> },
        { label: 'Refer a Friend', onClick: invite, icon: <Share2 size={22} /> },
        { label: 'Responsible Gambling', href: '/responsible-gambling', icon: <ShieldCheck size={22} /> },
        { label: 'Terms & Conditions', href: '/terms', icon: <FileText size={22} /> },
        { label: 'Privacy Policy', href: '/privacy', icon: <Lock size={22} /> },
        { label: 'Logout', icon: <LogOut size={22} />, onClick: () => { signOut(); router.push('/') } },
      ],
    },
  ]

  return (
    <div className="min-h-[calc(100vh-110px)] bg-[#f1f5f3] text-[#0f1f1a]">
      <div className="mx-auto max-w-[560px]">
        <div className="bg-[linear-gradient(160deg,#0b6e4f,#13936a)] px-4 pb-5 pt-5 text-white">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-[#ff7a1a] bg-[#ff7a1a] text-[#0b6e4f] text-2xl font-black uppercase">
              {player.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold uppercase">{player.name}</p>
              <p className="text-xs text-white/70">+{countryPrefix(player.phone)} {maskPhoneTail(player.phone)}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm">Total Balance</span>
            <span className="flex items-center gap-2 text-2xl font-bold">
              {hidden ? '••••' : balance}
              <button onClick={() => setHidden((value) => !value)} aria-label={hidden ? 'Show balance' : 'Hide balance'}>
                {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/deposit" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#ff7a1a] font-bold text-[#0f1f1a]"><ArrowDownToLine size={19} /> Deposit</Link>
            <Link href="/withdraw" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/60 font-bold text-white"><ArrowUpFromLine size={19} /> Withdraw</Link>
          </div>
        </div>

        <div className="mx-4 -mt-1 grid grid-cols-3 divide-x divide-[#dde7e2] rounded-2xl border border-[#dde7e2] bg-white py-4 text-center text-[13px] font-medium">
          <Link href="/my-bets?tab=history" className="flex flex-col items-center gap-2 px-1"><History size={22} className="text-[#0b6e4f]" />Bet History</Link>
          <Link href="/transactions" className="flex flex-col items-center gap-2 px-1"><ReceiptText size={22} className="text-[#0b6e4f]" />Transaction Records</Link>
          <Link href="/games" className="flex flex-col items-center gap-2 px-1"><Gamepad2 size={22} className="text-[#0b6e4f]" />Games</Link>
        </div>

        {groups.map((group) => (
          <div key={group.title} className="mt-5 px-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#86958f]">{group.title}</p>
            <ul className="divide-y divide-[#dde7e2] rounded-2xl border border-[#dde7e2] bg-white px-4">
              {group.items.map((item) => {
                const body = (
                  <>
                    <span className="text-[#0b6e4f]">{item.icon}</span>
                    <span className="flex-1 text-[16px]">{item.label}</span>
                    <ChevronRight size={18} className="text-[#86958f]" />
                  </>
                )
                return (
                  <li key={item.label}>
                    {item.href
                      ? <Link href={item.href} className="flex h-14 items-center gap-4">{body}</Link>
                      : <button onClick={item.onClick} className="flex h-14 w-full items-center gap-4 text-left">{body}</button>}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <p className="py-6 text-center text-xs text-[#86958f]">GoalVault</p>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- Deposit

export function DepositPage() {
  const { player, notify } = useShell()
  const { me } = useMe()
  const [amount, setAmount] = useState('')
  const [otherPhone, setOtherPhone] = useState('')
  const [switching, setSwitching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!player) return <NeedSignIn />

  const country = me?.country
  const currency = player.currency
  const firstDeposit = me ? Number(me.user.total_deposited) <= 0 : false
  const min = country ? (firstDeposit ? Math.max(country.minFirstDeposit, country.minDeposit ?? 1) : country.minDeposit ?? 1) : 200
  const max = country?.maxDeposit
  const phone = switching && otherPhone.replace(/\D/g, '').length >= 9 ? otherPhone : player.phone
  const network = networkFor(phone, country?.code ?? player.country_code, country?.networks ?? [])
  const cardRail = country?.gateway === 'flutterwave_card'
  const value = Number(amount)
  const ready = Number.isFinite(value) && value >= min && (!max || value <= max) && !busy
  const chips = CHIPS[currency] ?? DEFAULT_CHIPS

  const topUp = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/deposits/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: player.id, amount: value, phone }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not start your deposit')
        return
      }
      if (json.redirectUrl) {
        window.location.href = json.redirectUrl
        return
      }
      notify(json.awaitingPrompt ? 'Approve the payment prompt on your phone.' : `Deposit started. Reference ${json.reference}.`)
      setAmount('')
    } catch {
      setError('Could not start your deposit')
    } finally {
      setBusy(false)
    }
  }

  const notes = [
    `Minimum deposit is ${formatMoney(min, currency)}.`,
    ...(max ? [`Maximum per transaction is ${formatMoney(max, currency)}.`] : []),
    'Deposit is free, no transaction fees.',
    ...(cardRail ? ['You will enter your card on the next screen.'] : ['A payment prompt is sent to the number above. Approve it to finish.']),
  ]

  return (
    <DarkPage title="Deposit" help="/help">
      <Tabs items={[cardRail ? { key: 'card', label: 'Card' } : { key: 'momo', label: 'Mobile Money' }]} value={cardRail ? 'card' : 'momo'} onChange={() => {}} />
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {!cardRail && (
          <>
            <PhoneRow phone={phone} />
            <NetworkRow network={network} switching={switching} onSwitch={() => setSwitching((open) => !open)} />
            {switching && (
              <input
                value={otherPhone}
                onChange={(event) => setOtherPhone(event.target.value)}
                inputMode="tel"
                placeholder="Pay from another number"
                className="h-12 w-full rounded-xl border border-[#dde7e2] bg-white px-4 text-[15px] outline-none placeholder:text-[#86958f] focus:border-[#0b6e4f]"
              />
            )}
          </>
        )}
        <p className="text-right text-sm text-[#5f6f69]">Balance ({currency}) {Number(me?.user.balance ?? player.balance).toFixed(2)}</p>
        <AmountField value={amount} onChange={setAmount} currency={currency} min={min} />
        <div className="grid grid-cols-5 gap-2">
          {chips.map((chip) => (
            <button key={chip} onClick={() => setAmount(String((Number(amount) || 0) + chip))} className="h-10 rounded-lg border border-[#dde7e2] bg-white text-sm font-semibold text-[#0b6e4f]">
              +{chip.toLocaleString()}
            </button>
          ))}
        </div>
        {error && <p className="bg-[#fff0f1] px-3 py-2 text-sm text-[#e40014]">{error}</p>}
        <button disabled={!ready} onClick={topUp} className="h-12 w-full rounded-xl bg-[#ff7a1a] text-base font-bold text-[#0f1f1a] disabled:bg-[#d5e1dc] disabled:text-[#86958f]">
          {busy ? 'Please wait…' : 'Top Up Now'}
        </button>
        <Notes lines={notes} />
        {country?.code === 'GH' && network.badge === 'MTN' && (
          <p className="text-[13px] leading-snug text-[#5f6f69]">Note: For MTN users, if a payment prompt isn&apos;t received, dial *170#, then select 6 and 3 to approve the transaction.</p>
        )}
      </div>
    </DarkPage>
  )
}

// ---------------------------------------------------------------- Withdraw

export function WithdrawPage() {
  const { player, notify } = useShell()
  const { me, reload } = useMe()
  const [tab, setTab] = useState<'mobile' | 'bank'>('mobile')
  const [amount, setAmount] = useState('')
  const [number, setNumber] = useState('')
  const [bank, setBank] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!me) return
    setTab(me.country.payoutRail)
    setNumber(me.user.payout_number ?? '')
    setBank(me.user.payout_bank ?? '')
  }, [me])

  if (!player) return <NeedSignIn />

  const currency = player.currency
  const balance = Number(me?.user.balance ?? player.balance)
  const payoutPhone = number || player.phone
  const network = networkFor(payoutPhone, me?.country.code ?? player.country_code, me?.country.networks ?? [])
  const value = Number(amount)
  const ready = Number.isFinite(value) && value >= 1 && value <= balance && !busy && (tab === 'mobile' || (number.trim() && bank.trim()))

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: player.id,
          amount: value,
          payoutNumber: tab === 'mobile' ? payoutPhone : number,
          payoutBank: tab === 'mobile' ? network.name : bank,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not request a withdrawal')
        return
      }
      notify(json.message ?? 'Withdrawal request received.')
      setAmount('')
      reload()
    } catch {
      setError('Could not request a withdrawal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DarkPage title="Withdraw" help="/help">
      <Tabs items={[{ key: 'mobile', label: 'Mobile Money' }, { key: 'bank', label: 'Bank' }]} value={tab} onChange={setTab} />
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {tab === 'mobile' ? (
          <>
            <PhoneRow phone={payoutPhone} />
            <div className="flex h-12 items-center gap-3 rounded-xl border border-[#dde7e2] bg-white px-3 text-[15px]">
              <span className={`flex h-7 w-11 shrink-0 items-center justify-center rounded-sm text-[10px] font-black ${network.tone}`}>{network.badge}</span>
              <span className="flex-1 truncate">{network.name}</span>
            </div>
          </>
        ) : (
          <>
            <input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" placeholder="Account number" className="h-12 w-full rounded-xl border border-[#dde7e2] bg-white px-4 text-[15px] outline-none placeholder:text-[#86958f] focus:border-[#0b6e4f]" />
            <input value={bank} onChange={(event) => setBank(event.target.value)} placeholder="Bank name" className="h-12 w-full rounded-xl border border-[#dde7e2] bg-white px-4 text-[15px] outline-none placeholder:text-[#86958f] focus:border-[#0b6e4f]" />
          </>
        )}
        <div className="space-y-1 text-right text-sm text-[#5f6f69]">
          <p>Balance ({currency}) {balance.toFixed(2)}</p>
          <p className="text-[#0f1f1a]">Withdrawable Balance ({currency}) {balance.toFixed(2)}</p>
        </div>
        <AmountField value={amount} onChange={setAmount} currency={currency} min={1} />
        {me && !me.withdrawal.unlocked && me.withdrawal.progress?.label && (
          <p className="bg-[#edf3f0] px-3 py-2 text-[13px] text-[#5f6f69]">{me.withdrawal.progress.label}</p>
        )}
        {error && <p className="bg-[#fff0f1] px-3 py-2 text-sm text-[#e40014]">{error}</p>}
        <button disabled={!ready} onClick={submit} className="h-12 w-full rounded-xl bg-[#ff7a1a] text-base font-bold text-[#0f1f1a] disabled:bg-[#d5e1dc] disabled:text-[#86958f]">
          {busy ? 'Please wait…' : 'Withdraw'}
        </button>
        <Notes lines={[`Minimum per transaction is ${formatMoney(1, currency)}.`, 'You can withdraw up to your available balance.', 'Withdrawal is free, no transaction fees.']} />
      </div>
    </DarkPage>
  )
}

// --------------------------------------------------------------- Open bets

type Leg = { home_team: string; away_team: string; market: string; outcome: string; odds: number; result: string; kickoff: string; final_home: number | null; final_away: number | null }
type Ticket = { code: string; stake: number; total_odds: number; potential_win: number; currency: string; status: string; payout: number | null; created_at: string; selections: Leg[] }
type LiveLeg = Leg & { isLive?: boolean; liveHome?: number | null; liveAway?: number | null; minuteLabel?: string | null }
type Detail = { selections: LiveLeg[]; cashout: { available: boolean; amount: number } }

const STATUS_TONE: Record<string, string> = {
  won: 'text-[#00a63a]',
  lost: 'text-[#e40014]',
  cashed_out: 'text-[#0b6e4f]',
  void: 'text-[#5f6f69]',
}

export function OpenBetsPage({ initialTab = 'open' }: { initialTab?: 'open' | 'history' }) {
  const { player, notify } = useShell()
  const setBalance = useSession((state) => state.setBalance)
  const [tab, setTab] = useState<'open' | 'history'>(initialTab)
  const [filter, setFilter] = useState<'all' | 'cashout' | 'live'>('all')
  const [bets, setBets] = useState<Ticket[] | null>(null)
  const [details, setDetails] = useState<Record<string, Detail>>({})
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!player) return
    fetch(`/api/bets/mine?userId=${player.id}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) setError(json.error ?? 'Could not load your bets')
        else setBets(json.bets ?? [])
      })
      .catch(() => setError('Could not load your bets'))
  }, [player])

  useEffect(load, [load])

  const open = useMemo(() => (bets ?? []).filter((bet) => bet.status === 'pending'), [bets])
  const settled = useMemo(() => (bets ?? []).filter((bet) => bet.status !== 'pending'), [bets])

  // Cashout offers and live scores are per ticket, so each open ticket asks for its own.
  useEffect(() => {
    if (!player || !open.length) return
    let alive = true
    const fetchAll = () => {
      for (const bet of open) {
        fetch(`/api/bets/${bet.code}?userId=${player.id}`, { cache: 'no-store' })
          .then((res) => res.json())
          .then((json) => {
            if (alive && json.selections) setDetails((current) => ({ ...current, [bet.code]: { selections: json.selections, cashout: json.cashout } }))
          })
          .catch(() => {})
      }
    }
    fetchAll()
    const timer = setInterval(fetchAll, 30_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [open, player])

  if (!player) return <NeedSignIn />

  const cashout = async (code: string) => {
    const offer = details[code]?.cashout
    if (!offer?.available) return
    const res = await fetch(`/api/bets/${code}/cashout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: player.id, expected: offer.amount }),
    })
    const json = await res.json()
    if (!res.ok) {
      notify(json.error ?? 'Cashout was refused')
      return
    }
    if (typeof json.balance === 'number') setBalance(json.balance)
    notify(`Cashed out ${formatMoney(json.amount ?? offer.amount, player.currency)}.`)
    load()
  }

  const shownOpen = open.filter((bet) => {
    const detail = details[bet.code]
    if (filter === 'cashout') return Boolean(detail?.cashout.available)
    if (filter === 'live') return Boolean(detail?.selections.some((leg) => leg.isLive))
    return true
  })
  const shown = tab === 'open' ? shownOpen : settled

  return (
    <div className="min-h-[calc(100vh-110px)] bg-[#f1f5f3] text-[#0f1f1a]">
      <div className="mx-auto max-w-[560px] px-4 pb-6">
        <div className="flex items-center justify-between py-3 text-sm">
          <Link href="/help" className="flex items-center gap-1.5 text-[#0f1f1a]"><CircleHelp size={17} /> How to Cashout?</Link>
          <span className="font-semibold text-[#0b6e4f]">{formatMoney(player.balance, player.currency)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {([['open', `Open Bets (${open.length})`], ['history', 'Bet History']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`h-11 rounded-t-2xl text-[14px] ${tab === key ? 'bg-white font-bold text-[#0b6e4f]' : 'bg-[#e3ece8] text-[#5f6f69]'}`}>{label}</button>
          ))}
        </div>
        <div className="rounded-b-2xl bg-white px-2.5 pb-3 pt-3">
          {tab === 'open' && (
            <div className="mb-3 overflow-hidden">
              <div className="scrollbar-none -mb-5 flex gap-1.5 overflow-x-auto pb-5">
                {([['all', 'All'], ['cashout', 'Cashout Available'], ['live', 'Live Games']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setFilter(key)} className={`shrink-0 rounded px-3 py-2 text-sm ${filter === key ? 'bg-[#0b6e4f] text-white' : 'border border-[#dde7e2] bg-white text-[#0f1f1a]'}`}>{label}</button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="px-2 py-6 text-sm text-[#e40014]">{error}</p>}
          {!bets && !error && <p className="px-2 py-10 text-center text-sm text-[#5f6f69]">Loading your bets…</p>}
          {bets && shown.length === 0 && (
            <p className="px-2 py-10 text-center text-sm text-[#5f6f69]">{tab === 'open' ? 'No open bets here.' : 'No settled bets yet.'}</p>
          )}
          <div className="space-y-3">
            {shown.map((bet) => <BetCard key={bet.code} bet={bet} detail={details[bet.code]} onCashout={() => cashout(bet.code)} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

function BetCard({ bet, detail, onCashout }: { bet: Ticket; detail?: Detail; onCashout: () => void }) {
  const [busy, setBusy] = useState(false)
  const legs: LiveLeg[] = detail?.selections ?? bet.selections
  const live = legs.some((leg) => leg.isLive)
  const pending = bet.status === 'pending'

  return (
    <div className="rounded-2xl border border-[#dde7e2] bg-white p-3.5">
      <div className="flex items-center justify-between border-b border-[#dde7e2] pb-2.5">
        <span className="flex items-center gap-2 font-bold">
          {legs.length > 1 ? `Multiple (${legs.length})` : 'Singles'}
          {live && <span className="rounded bg-[#00a63a] px-1.5 text-xs font-semibold text-white">Live</span>}
        </span>
        <Link href={`/my-bets/${bet.code}`} className="text-sm text-[#00a63a]">
          {pending ? 'Details' : <span className={`font-semibold uppercase ${STATUS_TONE[bet.status] ?? ''}`}>{bet.status.replace('_', ' ')}</span>}
        </Link>
      </div>
      <ul className="divide-y divide-[#dde7e2]">
        {legs.map((leg, index) => {
          const score = leg.final_home != null && leg.final_away != null
            ? `FT | ${leg.final_home}:${leg.final_away}`
            : leg.isLive && leg.liveHome != null
              ? `${leg.minuteLabel ?? 'LIVE'} | ${leg.liveHome}:${leg.liveAway}`
              : new Date(leg.kickoff).toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          return (
            <li key={index} className="py-3">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{leg.outcome} @ {Number(leg.odds).toFixed(2)}</span>
                <span className="text-sm text-[#5f6f69]">{leg.market}</span>
              </p>
              <p className="mt-1 break-words text-[15px] underline decoration-[#c4d3cc] underline-offset-2">{leg.home_team} vs {leg.away_team}</p>
              <p className={`mt-1 text-sm ${leg.isLive ? 'text-[#00a63a]' : 'text-[#5f6f69]'}`}>{score}</p>
            </li>
          )
        })}
      </ul>
      <dl className="space-y-1 border-t border-[#dde7e2] pt-3 text-[15px]">
        <div className="flex justify-between"><dt className="text-[#34463f]">Stake</dt><dd className="font-bold">{Number(bet.stake).toFixed(2)}</dd></div>
        <div className="flex justify-between">
          <dt className="text-[#34463f]">{pending ? 'Pot. Win' : 'Return'}</dt>
          <dd className="font-bold">{Number(pending ? bet.potential_win : bet.payout ?? 0).toFixed(2)}</dd>
        </div>
      </dl>
      {pending && detail?.cashout.available && (
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); await onCashout(); setBusy(false) }}
          className="mt-3 h-12 w-full rounded-xl bg-[#ff7a1a] text-base font-bold text-[#0f1f1a] disabled:opacity-60"
        >
          {busy ? 'Cashing out…' : <>Cashout <b>{formatMoney(detail.cashout.amount, bet.currency)}</b></>}
        </button>
      )}
    </div>
  )
}
