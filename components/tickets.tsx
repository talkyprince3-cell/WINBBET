'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Copy, Download, Link2, Share2, X, ZoomIn } from 'lucide-react'
import { formatMoney } from '@/lib/countries'
import { useSession, type SlipLeg } from '@/lib/store'
import { BrandLogo } from '@/components/brand'

const MAX_IMAGE_RETRIES = 3
const TROPHY_WIDTH = 700
const TROPHY_HEIGHT = 649

export function Trophy({ size = 220, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/trophy.png"
      alt="Trophy"
      width={size}
      height={Math.round((size * TROPHY_HEIGHT) / TROPHY_WIDTH)}
      className={className}
      unoptimized
    />
  )
}

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[92vh] w-full max-w-sm overflow-y-auto bg-white shadow-xl">{children}</div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between bg-[#0b6e4f] px-4 py-3 text-white">
      <BrandLogo size={24} tone="light" className="text-lg" />
      <span className="text-sm font-semibold">{title}</span>
      <button onClick={onClose} aria-label="Close"><X size={18} /></button>
    </div>
  )
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (value: string, which: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(which)
        setTimeout(() => setCopied(null), 1600)
      },
      () => setCopied(null),
    )
  }
  return { copied, copy }
}

export function BookedCode({ code, expiresAt, onClose }: { code: string; expiresAt?: string | null; onClose: () => void }) {
  const player = useSession((state) => state.player)
  const { copied, copy } = useCopy()
  const [shared, setShared] = useState(true)
  const [zoom, setZoom] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const link = `${window.location.origin}/load-code?code=${code}`
  const imageUrl = `/api/bookings/${code}/image`
  const previewUrl = `${imageUrl}?v=${attempt}`

  // The image is rendered on first request, which can be slow while the server warms up.
  const retry = () => {
    if (attempt >= MAX_IMAGE_RETRIES) {
      setAttempt(MAX_IMAGE_RETRIES + 1)
      return
    }
    setTimeout(() => setAttempt((n) => n + 1), 1500)
  }
  const message = `Load my GoalVault code ${code} — ${link}`

  const toggleShare = async (next: boolean) => {
    setShared(next)
    if (!player) return
    await fetch(`/api/bookings/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: player.id, shared: next }),
    }).catch(() => {})
  }

  const shareInApp = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `GoalVault code ${code}`, text: message, url: link })
        return
      } catch {
        return
      }
    }
    copy(link, 'link')
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Booking Code" onClose={onClose} />
      <div className="px-5 pb-5 pt-4 text-[#24262c]">
        <button onClick={() => copy(code, 'code')} className="mx-auto flex items-center gap-2" aria-label="Copy booking code">
          <span className="text-[32px] font-black tracking-[0.12em] text-[#ed1324]">{code}</span>
          {copied === 'code' ? <Check size={18} className="text-[#0b9b3a]" /> : <Copy size={18} className="text-[#8b8f94]" />}
        </button>
        <p className="text-center text-xs text-[#6b7077]">
          {expiresAt
            ? `Expires ${new Date(expiresAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
            : 'No expiry'}
        </p>

        <button onClick={() => setZoom(true)} className="relative mx-auto mt-4 block h-[160px] w-[120px] overflow-hidden border bg-[#f5f6f7]" aria-label="Enlarge ticket">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={attempt}
            src={previewUrl}
            alt={`Ticket for booking code ${code}`}
            onLoad={() => setLoaded(true)}
            onError={retry}
            className={`h-full w-full object-cover object-top transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
          {!loaded && <span className="absolute inset-0 flex items-center justify-center text-[11px] text-[#8b8f94]">{attempt > MAX_IMAGE_RETRIES ? 'Preview unavailable' : 'Loading ticket…'}</span>}
          {loaded && (
            <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"><ZoomIn size={14} /></span>
          )}
        </button>

        <div className="mt-4 flex items-center justify-between border-y py-3">
          <span className="text-sm">Share code on personal page</span>
          <button
            role="switch"
            aria-checked={shared}
            onClick={() => toggleShare(!shared)}
            className={`relative h-6 w-11 rounded-full transition-colors ${shared ? 'bg-[#0b9b3a]' : 'bg-[#d7d9dd]'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${shared ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-1">
          <ShareAction label="X / Twitter" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`} icon={<XLogo />} />
          <ShareAction label="WhatsApp" href={`https://wa.me/?text=${encodeURIComponent(message)}`} icon={<WhatsAppLogo />} />
          <ShareAction label="Share" onClick={shareInApp} icon={<Share2 size={18} />} />
          <ShareAction label={copied === 'link' ? 'Copied' : 'Copy link'} onClick={() => copy(link, 'link')} icon={copied === 'link' ? <Check size={18} /> : <Link2 size={18} />} />
          <ShareAction label="Save" href={imageUrl} download={`goalvault-${code}.png`} icon={<Download size={18} />} />
        </div>

        <button onClick={onClose} className="mt-5 w-full bg-[#0b9b3a] py-3 text-sm font-semibold text-white">Back to betslip</button>
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6">
          <button className="absolute inset-0" onClick={() => setZoom(false)} aria-label="Close" />
          <button onClick={() => setZoom(false)} aria-label="Close" className="absolute right-4 top-4 text-white"><X size={26} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`Ticket for booking code ${code}`} className="relative max-h-full w-auto bg-white" />
        </div>
      )}
    </Modal>
  )
}

function ShareAction({ label, icon, href, onClick, download }: { label: string; icon: ReactNode; href?: string; onClick?: () => void; download?: string }) {
  const body = (
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f1f2f4] text-[#24262c]">{icon}</span>
      <span className="text-center text-[11px] leading-tight text-[#6b7077]">{label}</span>
    </>
  )
  const shell = 'flex flex-col items-center gap-1.5'
  if (href) {
    return <a href={href} download={download} target={download ? undefined : '_blank'} rel="noopener noreferrer" className={shell}>{body}</a>
  }
  return <button onClick={onClick} className={shell}>{body}</button>
}

export type PlacedTicket = {
  code: string
  stake: number
  total_odds: number
  potential_win: number
  bonus: number
  currency: string
  mode: string
}

export function PlacedReceipt({
  ticket,
  legs,
  lines,
  totalCost,
  oddsChanged,
  onClose,
}: {
  ticket: PlacedTicket
  legs: SlipLeg[]
  lines: number
  totalCost: number
  oddsChanged: { match: string; from: number; to: number }[]
  onClose: () => void
}) {
  const { copied, copy } = useCopy()

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Bet placed" onClose={onClose} />
      <div className="text-[#24262c]">
        <div className="px-4 pt-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7077]">{lines > 1 ? 'First ticket code' : 'Ticket code'}</p>
          <button onClick={() => copy(ticket.code, 'code')} className="mx-auto mt-1 flex items-center gap-2">
            <span className="text-[26px] font-black tracking-[0.1em] text-[#ed1324]">{ticket.code}</span>
            {copied ? <Check size={17} className="text-[#0b9b3a]" /> : <Copy size={17} className="text-[#8b8f94]" />}
          </button>
        </div>
        <div className="mx-4 mt-3 flex items-center justify-between border px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7077]">Total odds</span>
          <span className="text-xl font-black">{Number(ticket.total_odds).toFixed(2)}</span>
        </div>
        <SectionLabel>Bet</SectionLabel>
        <dl className="space-y-1 px-4 py-2 text-sm">
          <Row label={lines > 1 ? `Stake · ${lines} lines` : 'Stake'} value={formatMoney(totalCost, ticket.currency)} />
          {Number(ticket.bonus) > 0 && <Row label="Bonus" value={formatMoney(Number(ticket.bonus), ticket.currency)} tone="text-[#0b9b3a]" />}
          <Row label="Potential win" value={formatMoney(Number(ticket.potential_win), ticket.currency)} tone="text-[#0b9b3a]" />
        </dl>
        <SectionLabel>Selections</SectionLabel>
        <ul className="max-h-[30vh] divide-y overflow-y-auto">
          {legs.map((leg) => (
            <li key={`${leg.matchId}-${leg.outcome}`} className="px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-bold">{leg.outcomeLabel}</span>
                <span className="text-sm font-black text-[#ed1324]">{leg.odds.toFixed(2)}</span>
              </div>
              <p className="truncate text-xs">{leg.homeTeam} vs {leg.awayTeam}</p>
              <p className="text-[11px] text-[#8b8f94]">{leg.marketLabel}</p>
            </li>
          ))}
        </ul>
        {oddsChanged.length > 0 && (
          <p className="mx-4 mt-2 bg-[#f5f6f7] px-3 py-2 text-[11px] text-[#6b7077]">
            {oddsChanged.length === 1
              ? `The price on ${oddsChanged[0].match} was ${oddsChanged[0].to.toFixed(2)} at placement, not ${oddsChanged[0].from.toFixed(2)}.`
              : `${oddsChanged.length} prices changed at placement. Your ticket shows the prices you got.`}
          </p>
        )}
        <div className="flex gap-2 p-4">
          <Link href={`/my-bets/${ticket.code}`} onClick={onClose} className="flex-1 border py-2.5 text-center text-sm font-semibold">View ticket</Link>
          <button onClick={onClose} className="flex-1 bg-[#0b9b3a] py-2.5 text-sm font-semibold text-white">Keep betting</button>
        </div>
      </div>
    </Modal>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mt-3 border-y bg-[#f5f6f7] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7077]">{children}</p>
}

function Row({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[#6b7077]">{label}</dt>
      <dd className={`font-bold ${tone}`}>{value}</dd>
    </div>
  )
}

const SEEN_KEY = 'sporty-celebrated'

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function hasCelebrated(code: string) {
  return readSeen().includes(code)
}

export function markCelebrated(code: string) {
  try {
    const seen = readSeen()
    if (!seen.includes(code)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, code].slice(-200)))
  } catch {}
}

const CONFETTI = [
  { left: 6, delay: 0, dur: 3.2, drift: 30, color: '#0b9b3a' },
  { left: 14, delay: 0.9, dur: 4.1, drift: -24, color: '#ffcf00' },
  { left: 22, delay: 0.35, dur: 3.6, drift: 18, color: '#ffffff' },
  { left: 31, delay: 1.6, dur: 4.4, drift: -34, color: '#ed1324' },
  { left: 39, delay: 0.15, dur: 3.9, drift: 26, color: '#ffcf00' },
  { left: 47, delay: 2.1, dur: 3.4, drift: -16, color: '#0b9b3a' },
  { left: 55, delay: 0.6, dur: 4.6, drift: 34, color: '#ffffff' },
  { left: 63, delay: 1.2, dur: 3.3, drift: -28, color: '#ed1324' },
  { left: 71, delay: 2.4, dur: 4.0, drift: 20, color: '#ffcf00' },
  { left: 79, delay: 0.45, dur: 3.7, drift: -22, color: '#0b9b3a' },
  { left: 87, delay: 1.85, dur: 4.3, drift: 30, color: '#ffffff' },
  { left: 94, delay: 1.05, dur: 3.5, drift: -18, color: '#ed1324' },
]

export function WinCelebration({ code, amount, currency, onClose }: { code: string; amount: number; currency: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const share = async () => {
    const text = `I just won ${formatMoney(amount, currency)} on GoalVault. Ticket ${code}.`
    const url = window.location.origin
    if (navigator.share) {
      try {
        await navigator.share({ title: 'GoalVault win', text, url })
        return
      } catch {
        return
      }
    }
    await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6" role="dialog" aria-modal="true" aria-label={`You won ${formatMoney(amount, currency)}`}>
      <button className="absolute inset-0 bg-black/85" onClick={onClose} aria-label="Close" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {CONFETTI.map((piece, index) => (
          <span
            key={index}
            className="confetti-piece"
            style={{
              left: `${piece.left}%`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.dur}s`,
              ['--drift' as string]: `${piece.drift}px`,
            }}
          />
        ))}
      </div>
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 text-white/80"><X size={26} /></button>
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <p className="win-line text-[40px] font-black leading-none text-white">YOU WON</p>
        <p className="win-line mt-2 text-[30px] font-black leading-none text-[#ffcf00]" style={{ animationDelay: '0.12s' }}>{formatMoney(amount, currency)}</p>
        <div className="win-cup mt-2">
          <div className="win-cup-float">
            <Trophy size={230} className="drop-shadow-[0_0_28px_rgba(237,19,36,0.45)]" />
          </div>
        </div>
        <p className="win-line -mt-2 text-sm text-white/70" style={{ animationDelay: '0.75s' }}>
          Ticket: <span className="font-bold tracking-wider text-[#ffcf00]">{code}</span>
        </p>
        <div className="win-line mt-6 grid w-full grid-cols-2 gap-3" style={{ animationDelay: '0.85s' }}>
          <Link href={`/my-bets/${code}`} onClick={onClose} className="border border-white py-3 text-center font-semibold text-white">Details</Link>
          <button onClick={share} className="flex items-center justify-center gap-2 bg-[#0b9b3a] py-3 font-semibold text-white">
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? 'Copied' : 'Show off'}
          </button>
        </div>
      </div>
    </div>
  )
}

function XLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-7.1 8.1L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.6-8.7L1.6 2h6.8l4.7 6.2zm-1.1 18h1.7L7.3 3.7H5.4z" />
    </svg>
  )
}

function WhatsAppLogo() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a9.9 9.9 0 00-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1112 20zm4.5-5.9c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.5 6.5 0 01-1.9-1.2 7.3 7.3 0 01-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5.2-.4v-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 00-.7.3 2.8 2.8 0 00-.9 2.1 4.9 4.9 0 001 2.6 11 11 0 004.2 3.7 8.6 8.6 0 001.4.5 3.4 3.4 0 001.6.1 2.6 2.6 0 001.7-1.2 2.1 2.1 0 00.1-1.2z" />
    </svg>
  )
}
