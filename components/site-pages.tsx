'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AdminDashboard } from '@/components/admin-dashboard'
import { AuthForm } from '@/components/auth-form'
import { GamesLobby } from '@/components/games-lobby'
import { MatchBoard } from '@/components/home-board'
import { AccountPage, DepositPage, OpenBetsPage, WithdrawPage } from '@/components/account'
import { FaqPage, PrivacyPage, ResponsibleGamblingPage, TermsPage } from '@/components/info-pages'
import { TransactionsPanel } from '@/components/player-panels'
import { useShell } from '@/components/site-shell'
import { useSession, useSlip, type SlipLeg } from '@/lib/store'

const boardViews: Record<string, string> = {
  football: 'Football',
  live: 'Live Betting',
  basketball: 'Basketball',
  tennis: 'Tennis',
  virtuals: 'Virtuals',
}

export function BoardPage({ view = 'Home' }: { view?: string }) {
  const { notify, openAuth } = useShell()
  return <MatchBoard view={view} onNeedAuth={() => openAuth('login')} onNotice={notify} />
}

export function SectionView({ section }: { section: string }) {
  const { notify } = useShell()
  const router = useRouter()

  if (boardViews[section]) return <BoardPage view={boardViews[section]} />

  switch (section) {
    case 'games':
      return <GamesLobby />
    case 'crash-games':
      return <GamesLobby initialCategory="crash" />
    case 'help':
      return <FaqPage />
    case 'terms':
      return <TermsPage />
    case 'privacy':
      return <PrivacyPage />
    case 'responsible-gambling':
      return <ResponsibleGamblingPage />
    case 'jackpot':
    case 'promotions':
      return <Help title={section[0].toUpperCase() + section.slice(1)} />
    case 'account':
      return <AccountPage />
    case 'deposit':
      return <DepositPage />
    case 'withdraw':
      return <WithdrawPage />
    case 'transactions':
      return <TransactionsPanel />
    case 'login':
    case 'register':
      return <SignInPage mode={section} />
    case 'admin':
      return <AdminDashboard role="admin" close={() => router.push('/')} />
    case 'sub-admin':
      return <AdminDashboard role="subadmin" close={() => router.push('/')} />
    default:
      return null
  }
}

export function MyBetsPage({ tab }: { tab?: string }) {
  return <OpenBetsPage initialTab={tab === 'history' ? 'history' : 'open'} />
}

function Help({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-[900px] px-3 py-6 sm:px-4 sm:py-12">
      <div className="bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-black sm:text-3xl">{title === 'Help' ? 'How GoalVault works' : title}</h1>
        <p className="mt-3 text-[#6b7077]">Create an account, fund your wallet, choose a fixture or game, and review your selections before placing a bet.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {['Create your account', 'Choose your market', 'Withdraw winnings'].map((step, i) => (
            <div key={step} className="border p-5">
              <span className="text-sm font-bold text-[#0b6e4f]">0{i + 1}</span>
              <h2 className="mt-3 font-bold">{step}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6b7077]">Review the applicable rules before continuing.</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LoadCodePage({ initialCode }: { initialCode: string }) {
  const router = useRouter()
  const load = useSlip((state) => state.load)
  const [code, setCode] = useState(initialCode.toUpperCase())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState<string | null>(null)

  const submit = async (value = code) => {
    const trimmed = value.trim().toUpperCase()
    if (trimmed.length < 4) return
    setBusy(true)
    setError('')
    setTicket(null)
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(trimmed)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'That code was not found')
        if (json.ticket) setTicket(json.ticket as string)
        return
      }
      load(json.booking.selections as SlipLeg[])
      router.push('/')
    } catch {
      setError('Network problem. Try again.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (initialCode) submit(initialCode)
    // A shared link loads its code once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="mx-auto max-w-[480px] px-4 py-10">
      <div className="bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black">Load a booking code</h1>
        <p className="mt-1 text-sm text-[#6b7077]">Enter a code someone shared with you to get the same selections on your betslip.</p>
        <form onSubmit={(event) => { event.preventDefault(); submit() }} className="mt-5 space-y-3">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={8}
            className="h-14 w-full border text-center text-2xl font-black tracking-[0.25em] outline-none focus:border-[#0b6e4f]"
          />
          {error && (
            <p className="bg-[#fff0f1] px-3 py-2 text-xs text-[#0b6e4f]">
              {error}
              {ticket && <> <Link href={`/my-bets/${ticket}`} className="font-bold underline">Open it in My Bets</Link></>}
            </p>
          )}
          <button type="submit" disabled={busy || code.trim().length < 4} className="h-11 w-full rounded-xl bg-[#ff7a1a] text-sm font-bold text-[#0f1f1a] disabled:opacity-50">{busy ? 'Loading…' : 'Load code'}</button>
        </form>
      </div>
    </section>
  )
}

function SignInPage({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter()
  const { notify, player } = useShell()
  const signIn = useSession((state) => state.signIn)

  useEffect(() => {
    if (player) router.replace('/')
  }, [player, router])

  return (
    <section className="flex justify-center px-4 py-10">
      <AuthForm
        mode={mode}
        onClose={() => router.push('/')}
        switchMode={() => router.push(mode === 'login' ? '/register' : '/login')}
        onSignedIn={(next) => {
          signIn(next)
          notify(`Welcome, ${next.name}.`)
          router.push('/')
        }}
      />
    </section>
  )
}
