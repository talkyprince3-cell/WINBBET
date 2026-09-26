'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CreditCard, Lock, ShieldCheck } from 'lucide-react'
import { NeedSignIn } from '@/components/player-panels'
import { useShell } from '@/components/site-shell'
import { formatMoney } from '@/lib/countries'
import { useSession } from '@/lib/store'

type Step =
  | { kind: 'card' }
  | { kind: 'pin' }
  | { kind: 'otp' }
  | { kind: 'avs'; fields: string[] }
  | { kind: 'prompt'; note?: string }
  | { kind: 'pending' }
  | { kind: 'redirect'; url: string }
  | { kind: 'done' }
  | { kind: 'failed' }

const input = 'h-12 w-full rounded-xl border border-[#dde7e2] bg-white px-4 text-[15px] outline-none focus:border-[#0b6e4f]'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-110px)] bg-[#f1f5f3] px-4 py-6">
      <div className="mx-auto max-w-[440px] rounded-2xl border border-[#dde7e2] bg-white p-5 sm:p-6">{children}</div>
      <p className="mx-auto mt-4 flex max-w-[440px] items-center justify-center gap-1.5 text-xs text-[#5f6f69]">
        <ShieldCheck size={14} /> Card details go straight to Flutterwave, encrypted. GoalVault never stores them.
      </p>
    </div>
  )
}

function formatCard(value: string) {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

/** Card deposit: the card, then whatever the bank asks for, then the result. */
export function CardCheckout() {
  const { player } = useShell()
  const setBalance = useSession((state) => state.setBalance)
  const [reference, setReference] = useState('')
  const [session, setSession] = useState<{ amount: number; currency: string; status: string } | null>(null)
  const [step, setStep] = useState<Step>({ kind: 'card' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' })
  const [pin, setPin] = useState('')
  const [otp, setOtp] = useState('')
  const [address, setAddress] = useState({ line1: '', city: '', state: '', postal_code: '', country: 'NG' })
  const [bonus, setBonus] = useState(0)

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('reference') ?? ''
    setReference(ref)
    if (!ref) return
    fetch(`/api/deposits/card/session?reference=${encodeURIComponent(ref)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error)
        else {
          setSession(json)
          if (json.status === 'confirmed') setStep({ kind: 'done' })
        }
      })
      .catch(() => setError('Could not load this payment'))
  }, [])

  // Once the bank is satisfied the charge settles on its own; ask until it has.
  const polling = step.kind === 'pending' || step.kind === 'prompt'
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    if (!polling || !reference) return
    let alive = true
    let tries = 0
    const check = async () => {
      if (!alive) return
      tries++
      const json = await fetch(`/api/deposits/status?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' }).then((res) => res.json()).catch(() => null)
      if (!alive) return
      if (json?.status === 'confirmed') {
        if (typeof json.balance === 'number') setBalance(json.balance)
        setBonus(Number(json.bonusPaid ?? 0))
        setStep({ kind: 'done' })
        return
      }
      if (json?.status === 'failed') return setStep({ kind: 'failed' })
      if (tries < 45) setTimeout(check, 4000)
    }
    const first = setTimeout(check, 3000)
    return () => {
      alive = false
      clearTimeout(first)
    }
  }, [polling, reference, setBalance])

  const follow = (next: { kind?: string; url?: string; note?: string; fields?: string[] } | undefined) => {
    switch (next?.kind) {
      case 'redirect':
        if (next.url) window.location.href = next.url
        return setStep({ kind: 'redirect', url: next.url ?? '' })
      case 'pin': return setStep({ kind: 'pin' })
      case 'otp': return setStep({ kind: 'otp' })
      case 'avs': return setStep({ kind: 'avs', fields: next.fields ?? [] })
      case 'prompt': return setStep({ kind: 'prompt', note: next.note })
      case 'done': return setStep({ kind: 'pending' }) // confirm and credit through the status check
      case 'failed': return setStep({ kind: 'failed' })
      default: return setStep({ kind: 'pending' })
    }
  }

  const post = async (url: string, body: Record<string, unknown>) => {
    if (!player) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, userId: player.id, ...body }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'That did not go through. Please try again.')
        return
      }
      follow(json.step)
    } catch {
      setError('Could not reach the payment service. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!player) return <NeedSignIn />
  if (!reference) {
    return <Shell><p className="text-sm text-[#5f6f69]">This payment link is not complete. <Link href="/deposit" className="font-semibold text-[#0b6e4f]">Start a deposit</Link>.</p></Shell>
  }

  const amount = session ? formatMoney(session.amount, session.currency) : '…'

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#5f6f69]"><CreditCard size={18} /> Card deposit</p>
        <p className="text-xl font-extrabold">{amount}</p>
      </div>

      {step.kind === 'card' && (
        <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); post('/api/deposits/card/charge', card) }}>
          <label className="block text-xs font-semibold">Card number
            <input value={card.number} onChange={(e) => setCard({ ...card, number: formatCard(e.target.value) })} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" className={`mt-1 ${input}`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold">Expiry
              <input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" className={`mt-1 ${input}`} />
            </label>
            <label className="block text-xs font-semibold">CVV
              <input value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" autoComplete="cc-csc" placeholder="123" className={`mt-1 ${input}`} />
            </label>
          </div>
          <Submit busy={busy} disabled={!session || card.number.replace(/\D/g, '').length < 12 || card.expiry.length < 5 || card.cvv.length < 3}>Pay {amount}</Submit>
        </form>
      )}

      {step.kind === 'pin' && (
        <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); post('/api/deposits/card/authorize', { type: 'pin', pin }) }}>
          <p className="text-sm text-[#34463f]">Enter your card PIN to authorise this payment.</p>
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} type="password" inputMode="numeric" autoComplete="off" placeholder="••••" className={`${input} text-center tracking-[0.5em]`} />
          <Submit busy={busy} disabled={pin.length < 4}>Continue</Submit>
        </form>
      )}

      {step.kind === 'otp' && (
        <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); post('/api/deposits/card/authorize', { type: 'otp', code: otp }) }}>
          <p className="text-sm text-[#34463f]">Your bank has sent a one-time code to your phone or email. Enter it below.</p>
          <input value={otp} onChange={(e) => setOtp(e.target.value.trim())} inputMode="numeric" autoComplete="one-time-code" placeholder="Code" className={`${input} text-center tracking-[0.3em]`} />
          <Submit busy={busy} disabled={!otp}>Confirm</Submit>
        </form>
      )}

      {step.kind === 'avs' && (
        <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); post('/api/deposits/card/authorize', { type: 'avs', address }) }}>
          <p className="text-sm text-[#34463f]">Your card needs the billing address it is registered to.</p>
          <input value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} placeholder="Address" className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="City" className={input} />
            <input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="State" className={input} />
            <input value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} placeholder="Postcode" className={input} />
            <input value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value.toUpperCase().slice(0, 2) })} placeholder="Country (NG)" className={input} />
          </div>
          <Submit busy={busy} disabled={!address.line1 || !address.city || !address.country}>Continue</Submit>
        </form>
      )}

      {(step.kind === 'pending' || step.kind === 'prompt' || step.kind === 'redirect') && (
        <div className="mt-6 text-center">
          <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[#dde7e2] border-t-[#0b6e4f]" />
          <p className="mt-4 font-semibold">{step.kind === 'redirect' ? 'Taking you to your bank…' : 'Confirming your payment…'}</p>
          {step.kind === 'prompt' && step.note && <p className="mt-2 text-sm text-[#5f6f69]">{step.note}</p>}
        </div>
      )}

      {step.kind === 'done' && (
        <div className="mt-6 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 text-lg font-bold">Deposit received</p>
          <p className="mt-1 text-sm text-[#5f6f69]">{amount} is in your balance{bonus > 0 && session ? `, plus your ${formatMoney(bonus, session.currency)} welcome bonus 🎁` : ''}.</p>
          <Link href="/" className="mt-5 block h-12 rounded-xl bg-[#ff7a1a] pt-3 text-sm font-bold text-[#0f1f1a]">Start betting</Link>
        </div>
      )}

      {step.kind === 'failed' && (
        <div className="mt-6 text-center">
          <p className="text-4xl">⚠️</p>
          <p className="mt-2 text-lg font-bold">Payment did not go through</p>
          <p className="mt-1 text-sm text-[#5f6f69]">No money was taken. You can try again with the same or another card.</p>
          <Link href="/deposit" className="mt-5 block h-12 rounded-xl bg-[#0b6e4f] pt-3 text-sm font-bold text-white">Try again</Link>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg bg-[#fff0f1] px-3 py-2 text-sm text-[#e40014]">{error}</p>}
    </Shell>
  )
}

function Submit({ busy, disabled, children }: { busy: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy || disabled} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff7a1a] text-sm font-bold text-[#0f1f1a] disabled:bg-[#d5e1dc] disabled:text-[#86958f]">
      <Lock size={15} /> {busy ? 'Please wait…' : children}
    </button>
  )
}

/** Where the bank's 3-D Secure page sends the player back to. */
export function CardReturn() {
  const setBalance = useSession((state) => state.setBalance)
  const [state, setState] = useState<'checking' | 'done' | 'failed' | 'slow'>('checking')
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('reference')
    if (!ref) return setState('failed')
    let alive = true
    let tries = 0
    const check = async () => {
      if (!alive) return
      tries++
      const json = await fetch(`/api/deposits/status?reference=${encodeURIComponent(ref)}`, { cache: 'no-store' }).then((res) => res.json()).catch(() => null)
      if (!alive) return
      if (json?.status === 'confirmed') {
        if (typeof json.balance === 'number') setBalance(json.balance)
        return setState('done')
      }
      if (json?.status === 'failed') return setState('failed')
      if (tries < 30) setTimeout(check, 4000)
      else setState('slow')
    }
    check()
    return () => {
      alive = false
    }
  }, [setBalance])

  return (
    <Shell>
      <div className="text-center">
        {state === 'checking' && (<><span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[#dde7e2] border-t-[#0b6e4f]" /><p className="mt-4 font-semibold">Confirming your payment…</p></>)}
        {state === 'done' && (<><p className="text-4xl">✅</p><p className="mt-2 text-lg font-bold">Deposit received</p><Link href="/" className="mt-5 block h-12 rounded-xl bg-[#ff7a1a] pt-3 text-sm font-bold text-[#0f1f1a]">Start betting</Link></>)}
        {state === 'failed' && (<><p className="text-4xl">⚠️</p><p className="mt-2 text-lg font-bold">Payment did not go through</p><p className="mt-1 text-sm text-[#5f6f69]">No money was taken.</p><Link href="/deposit" className="mt-5 block h-12 rounded-xl bg-[#0b6e4f] pt-3 text-sm font-bold text-white">Try again</Link></>)}
        {state === 'slow' && (<><p className="text-lg font-bold">Still confirming</p><p className="mt-1 text-sm text-[#5f6f69]">Your bank is taking a while. The deposit will show in your balance as soon as it is confirmed.</p><Link href="/account" className="mt-5 block h-12 rounded-xl bg-[#0b6e4f] pt-3 text-sm font-bold text-white">Go to my account</Link></>)}
      </div>
    </Shell>
  )
}
