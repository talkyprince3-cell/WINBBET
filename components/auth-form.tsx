'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Player } from '@/lib/store'
import { BrandLogo } from '@/components/brand'

const countries = [
  { code: 'GH', name: 'Ghana', dial: '+233', example: '24 123 4567' },
  { code: 'NG', name: 'Nigeria', dial: '+234', example: '803 123 4567' },
  { code: 'KE', name: 'Kenya', dial: '+254', example: '712 345 678' },
  { code: 'ZA', name: 'South Africa', dial: '+27', example: '82 123 4567' },
]

export function AuthForm({ mode, onClose, switchMode, onSignedIn }: { mode: 'login' | 'register'; onClose: () => void; switchMode: () => void; onSignedIn: (player: Player) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [countryCode, setCountryCode] = useState('GH')
  const country = countries.find((item) => item.code === countryCode) ?? countries[0]
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('sporty-phone')
    if (saved) setIdentifier(saved)
  }, [])

  const submit = async () => {
    setError('')
    if (mode === 'register' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { identifier, password } : { name, phone: identifier, email, password, countryCode }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not continue')
        return
      }
      onSignedIn({ ...json.user, balance: Number(json.user.balance) })
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <BrandLogo size={24} tone="dark" className="text-base" />
          <h2 className="mt-1 text-xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        </div>
        <button onClick={onClose} aria-label="Close dialog"><X /></button>
      </div>
      {mode === 'register' && (
        <>
          <label className="mb-1 block text-xs font-semibold">Full name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mb-3 h-11 w-full rounded-xl border border-[#dde7e2] px-3 text-sm outline-none focus:border-[#0b6e4f]" placeholder="Your name" />
          <label className="mb-1 block text-xs font-semibold">Country</label>
          <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="mb-3 h-11 w-full rounded-xl border border-[#dde7e2] px-3 text-sm outline-none focus:border-[#0b6e4f]">
            {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </>
      )}
      <label className="mb-1 block text-xs font-semibold">{mode === 'login' ? 'Mobile number or email' : 'Mobile number'}</label>
      {mode === 'login' ? (
        <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mb-3 h-11 w-full rounded-xl border border-[#dde7e2] px-3 text-sm outline-none focus:border-[#0b6e4f]" placeholder="+233 Mobile Number" autoComplete="username" />
      ) : (
        <div className="mb-3 flex h-11 overflow-hidden rounded-xl border border-[#dde7e2] focus-within:border-[#0b6e4f]">
          <span className="flex items-center border-r bg-[#f5f6f7] px-3 text-sm font-semibold">{country.dial}</span>
          <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} inputMode="tel" autoComplete="tel-national" className="min-w-0 flex-1 px-3 text-sm outline-none" placeholder={country.example} />
        </div>
      )}
      {mode === 'register' && (
        <>
          <label className="mb-1 block text-xs font-semibold">Email</label>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" className="mb-3 h-11 w-full rounded-xl border border-[#dde7e2] px-3 text-sm outline-none focus:border-[#0b6e4f]" placeholder="you@example.com" />
        </>
      )}
      <label className="mb-1 block text-xs font-semibold">Password</label>
      <input value={password} onChange={(event) => setPassword(event.target.value)} className="mb-4 h-11 w-full rounded-xl border border-[#dde7e2] px-3 text-sm outline-none focus:border-[#0b6e4f]" placeholder="Password" type="password" />
      {error && <p className="mb-3 text-xs text-[#0b6e4f]">{error}</p>}
      <button disabled={busy} onClick={submit} className="w-full rounded-xl bg-[#ff7a1a] py-3 font-bold text-[#0f1f1a] disabled:opacity-60">{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}</button>
      <button onClick={switchMode} className="mt-4 w-full text-center text-xs text-[#0b6e4f]">{mode === 'login' ? 'Need an account? Register' : 'Already registered? Login'}</button>
      <p className="mt-4 text-center text-xs text-[#8b8f94]">18+ Gamble responsibly. Never bet more than you can afford.</p>
    </div>
  )
}
