'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronLeft, Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/brand'

const UPDATED = '23 September 2026'

type SiteInfo = { support_whatsapp?: string; support_email?: string; license_text?: string }

let cached: SiteInfo | null = null

/** Contact details and licence line the operator sets in the admin console. */
export function useSiteInfo() {
  const [info, setInfo] = useState<SiteInfo>(cached ?? {})
  useEffect(() => {
    if (cached) return
    fetch('/api/settings')
      .then((res) => res.json())
      .then((json) => {
        cached = json.settings ?? {}
        setInfo(cached!)
      })
      .catch(() => {})
  }, [])
  return info
}

export function whatsappLink(number?: string) {
  const digits = (number ?? '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

// ------------------------------------------------------------------ layout

function InfoPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-[820px] px-3 py-4 sm:px-4 sm:py-8">
      <Link href="/account" className="mb-3 inline-flex items-center text-sm text-[#6b7077]"><ChevronLeft size={16} /> Back</Link>
      <article className="rounded-2xl border border-[#dde7e2] bg-white p-5 sm:p-8">
        <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
        <p className="mt-1 text-xs text-[#8b8f94]">Last updated {UPDATED}</p>
        {intro && <p className="mt-4 leading-7 text-[#3d4148]">{intro}</p>}
        <div className="mt-6 space-y-6">{children}</div>
      </article>
      <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 text-sm text-[#6b7077]">
        <Link href="/terms" className="hover:text-[#0b6e4f]">Terms &amp; Conditions</Link>
        <Link href="/privacy" className="hover:text-[#0b6e4f]">Privacy Policy</Link>
        <Link href="/responsible-gambling" className="hover:text-[#0b6e4f]">Responsible Gambling</Link>
        <Link href="/help" className="hover:text-[#0b6e4f]">Help &amp; FAQ</Link>
      </nav>
    </section>
  )
}

function Part({ n, title, children }: { n?: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold">{n ? `${n}. ` : ''}{title}</h2>
      <div className="mt-2 space-y-3 leading-7 text-[#3d4148] [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  )
}

// ------------------------------------------------------------------- terms

export function TermsPage() {
  return (
    <InfoPage
      title="Terms & Conditions"
      intro="These terms form the agreement between you and GoalVault when you open an account, deposit, place a bet or play a game. Please read them carefully. By registering or using the site you confirm that you accept them."
    >
      <Part n={1} title="Who can play">
        <ul>
          <li>You must be at least 18 years old, or the legal gambling age where you live if that is higher.</li>
          <li>You may hold one account only. Duplicate accounts may be closed and any winnings on them voided.</li>
          <li>You must not play on behalf of someone else, and you must not use the site where online betting is against the law.</li>
          <li>Staff of GoalVault and their immediate families may not bet on the site.</li>
        </ul>
      </Part>
      <Part n={2} title="Your account">
        <ul>
          <li>The details you give at registration, including your name, mobile number and email, must be true and your own.</li>
          <li>Keep your password private. Bets placed with your login are treated as placed by you.</li>
          <li>We may ask you to verify your identity or the source of your funds before a withdrawal, and may hold a withdrawal until that is done.</li>
          <li>You can ask us to close your account at any time through Customer Service. Any balance you are owed will be paid out after the usual checks.</li>
        </ul>
      </Part>
      <Part n={3} title="Deposits">
        <ul>
          <li>Deposits are made in your account currency through the payment methods shown on the Deposit page, such as mobile money.</li>
          <li>You may only deposit from a mobile money wallet, bank account or card that belongs to you.</li>
          <li>A minimum deposit applies and is shown on the Deposit page before you pay. We do not charge a fee for deposits; your network or bank may.</li>
          <li>A deposit is credited once the payment provider confirms it. If a payment is reversed or charged back, we may deduct the amount from your balance.</li>
        </ul>
      </Part>
      <Part n={4} title="Withdrawals">
        <ul>
          <li>Withdrawals are paid to a mobile money number or bank account in your own name.</li>
          <li>Some accounts must complete verification deposits before a first withdrawal. Your progress is shown on the Withdraw page.</li>
          <li>We aim to pay withdrawals quickly, but checks, provider delays or suspected misuse can hold a payment.</li>
          <li>Deposited funds are meant for betting. We may refuse to pay out money that has been deposited and withdrawn without meaningful play.</li>
        </ul>
      </Part>
      <Part n={5} title="Placing bets">
        <ul>
          <li>A bet is accepted only when it appears in My Bets with a ticket code. Until then it can be refused.</li>
          <li>Odds can change at any time before acceptance. If they change while you place a bet, the ticket records the price you actually got.</li>
          <li>Single, multiple and system bets are settled as described on the betslip. The stake shown is deducted when the bet is accepted.</li>
          <li>We may limit stakes or refuse a bet at our discretion, including where a price was clearly wrong.</li>
        </ul>
      </Part>
      <Part n={6} title="Settlement, void bets and errors">
        <ul>
          <li>Bets are settled on the official result supplied by our data provider, unless the market says otherwise.</li>
          <li>If a match is postponed or abandoned, bets on it stay open until it is played or until we settle or void them. A voided selection is shown as void on your ticket.</li>
          <li>Where an obvious error was made in the odds, the teams or the result, we may resettle the bet at the correct price or void it.</li>
          <li>If you believe a ticket was settled incorrectly, contact Customer Service within 14 days with the ticket code.</li>
        </ul>
      </Part>
      <Part n={7} title="Cash out">
        <ul>
          <li>Cash out lets you settle an open bet early for the amount offered. The offer changes with the match and can be withdrawn at any time.</li>
          <li>Once you confirm a cash out it is final, whatever happens in the match afterwards.</li>
        </ul>
      </Part>
      <Part n={8} title="Casino and instant games">
        <ul>
          <li>Each round is decided on our server from a random seed. Its hash is shown before you play and the seed after, so you can check the result.</li>
          <li>If a game fails during a round, the round is settled on the server&apos;s result. Where no result exists, your stake is returned.</li>
        </ul>
      </Part>
      <Part n={9} title="Bonuses and booking codes">
        <ul>
          <li>Bonuses, where offered, come with the conditions shown with the offer. We may withdraw a bonus that is being misused.</li>
          <li>Booking codes share a set of selections. Loading a code does not place a bet; you still choose your own stake.</li>
        </ul>
      </Part>
      <Part n={10} title="Fair play">
        <p>We may suspend an account, void bets and withhold winnings where we reasonably believe there has been fraud, collusion, match-fixing, use of automated tools, or abuse of an offer. Where the law requires, we will report it.</p>
      </Part>
      <Part n={11} title="Our responsibility">
        <p>We are not responsible for losses caused by events outside our control, such as network or provider outages. Nothing in these terms limits any right you have under the law that cannot be limited.</p>
      </Part>
      <Part n={12} title="Changes and governing law">
        <p>We may update these terms. The date at the top shows the latest version, and continuing to use the site means you accept it. These terms are governed by the laws of the Republic of Ghana.</p>
      </Part>
    </InfoPage>
  )
}

// ----------------------------------------------------------------- privacy

export function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy Policy"
      intro="This policy explains what personal information GoalVault collects, why we need it, and the choices you have."
    >
      <Part n={1} title="What we collect">
        <ul>
          <li><b>Account details:</b> your name, mobile number, email, country and password (stored only as a secure hash, never in readable form).</li>
          <li><b>Payment details:</b> deposit and withdrawal amounts, references, and the mobile money number or bank account you pay from or to. Card numbers are sent straight to the card processor; we do not store them.</li>
          <li><b>Betting activity:</b> your bets, game rounds, balances and transactions.</li>
          <li><b>Technical data:</b> basic device and browser information needed to keep the site working and secure.</li>
        </ul>
      </Part>
      <Part n={2} title="How we use it">
        <ul>
          <li>To run your account, process payments and settle bets.</li>
          <li>To verify your identity and age, and to prevent fraud and money laundering.</li>
          <li>To send you messages about your account, such as deposit and withdrawal confirmations by SMS.</li>
          <li>To meet our legal and regulatory duties.</li>
        </ul>
      </Part>
      <Part n={3} title="Who we share it with">
        <p>We share only what is needed with payment providers that move your money, SMS providers that deliver account messages, and hosting providers that run the site. We share information with authorities where the law requires. We do not sell your personal information.</p>
      </Part>
      <Part n={4} title="How long we keep it">
        <p>We keep account and transaction records for as long as your account is open and afterwards for as long as the law requires for financial and gambling records.</p>
      </Part>
      <Part n={5} title="Your rights">
        <p>You can ask to see the personal information we hold about you, ask us to correct it, or ask us to delete it where we are not required to keep it. Contact Customer Service to make a request.</p>
      </Part>
      <Part n={6} title="Security">
        <p>Your connection to the site is encrypted, passwords are hashed, and access to player records is limited to staff who need it.</p>
      </Part>
      <Part n={7} title="Changes">
        <p>We may update this policy. The date at the top shows the latest version.</p>
      </Part>
    </InfoPage>
  )
}

// ---------------------------------------------------- responsible gambling

export function ResponsibleGamblingPage() {
  return (
    <InfoPage
      title="Responsible Gambling"
      intro="Betting should be entertainment, not a way to make money or escape problems. These tips and tools help keep it that way."
    >
      <Part title="Keep it fun">
        <ul>
          <li>Only bet money you can afford to lose. Treat it as the cost of entertainment.</li>
          <li>Set a budget and a time limit before you start, and stop when you reach either.</li>
          <li>Never chase losses by betting more to win them back.</li>
          <li>Don&apos;t bet when you are upset, stressed or have been drinking.</li>
          <li>Balance betting with other activities, and never let it get in the way of work, family or bills.</li>
        </ul>
      </Part>
      <Part title="Warning signs">
        <ul>
          <li>Spending more money or time than you planned.</li>
          <li>Borrowing money or selling things to bet.</li>
          <li>Hiding your betting from family or friends.</li>
          <li>Feeling anxious or irritable when you are not betting.</li>
        </ul>
        <p>If any of these sound familiar, it is time to take a break.</p>
      </Part>
      <Part title="Take a break or close your account">
        <p>You can ask Customer Service to close your account for a period you choose, or permanently. While it is closed you will not be able to log in or deposit, and we will not send you promotions.</p>
      </Part>
      <Part title="Under 18s">
        <p>Nobody under 18 may open an account or bet. We may check your age at any time and close accounts that fail the check. If children use your device, keep your login private.</p>
      </Part>
      <Part title="Getting help">
        <p>Talking helps. Reach out to someone you trust, your doctor, or a counselling service near you. Our Customer Service team can also close your account straight away if you ask.</p>
      </Part>
    </InfoPage>
  )
}

// --------------------------------------------------------------------- FAQ

const FAQ: { q: string; a: string }[] = [
  { q: 'How do I create an account?', a: 'Tap Register, choose your country, enter your name, mobile number, email and a password. Your account opens straight away.' },
  { q: 'How do I deposit?', a: 'Go to Me › Deposit, enter an amount and tap Top Up Now. You will get a prompt on your phone; approve it with your mobile money PIN and your balance updates once the payment is confirmed.' },
  { q: 'I didn\'t receive the payment prompt. What now?', a: 'Check that your phone has signal and that the number on the Deposit page is correct. MTN users can dial *170#, then choose 6 and 3 to see pending approvals.' },
  { q: 'How do I withdraw?', a: 'Go to Me › Withdraw, check your payout number, enter an amount and tap Withdraw. If your account still needs verification, the page shows how far along you are.' },
  { q: 'How do I place a bet?', a: 'Tap the odds of the outcome you want. It is added to your betslip. Enter a stake and tap Place Bet. You will see a ticket code once the bet is accepted.' },
  { q: 'What are Single, Multiple and System bets?', a: 'A Single is a separate bet on each selection. A Multiple combines all selections into one bet: every one must win, but the odds multiply. A System bet covers every combination of a chosen size, so you can still win if some selections lose.' },
  { q: 'What is a booking code?', a: 'A booking code saves a betslip so it can be shared. Tap Book code on your betslip to get one, or enter someone else\'s code under Load booking code to copy their selections.' },
  { q: 'What is cash out?', a: 'Cash out settles an open bet early for the amount offered on the ticket. The offer moves with the match. Once you cash out, the result is final.' },
  { q: 'Why is a match locked?', a: 'Live odds lock briefly during key moments such as a goal, a penalty or a VAR check. They reopen when the price has been updated.' },
  { q: 'How are casino games kept fair?', a: 'Each round is decided on our server from a random seed. Its hash is shown before you play and the seed afterwards, so the result can be checked.' },
]

export function FaqPage() {
  const info = useSiteInfo()
  const [open, setOpen] = useState<number | null>(0)
  const whatsapp = whatsappLink(info.support_whatsapp)

  return (
    <InfoPage title="Help & FAQ" intro="Quick answers to common questions. Can't find what you need? Contact us below.">
      <div className="divide-y border">
        {FAQ.map((item, index) => (
          <div key={item.q}>
            <button onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left font-semibold" aria-expanded={open === index}>
              {item.q}
              <ChevronDown size={18} className={`shrink-0 text-[#8b8f94] transition-transform ${open === index ? 'rotate-180' : ''}`} />
            </button>
            {open === index && <p className="px-4 pb-4 leading-7 text-[#3d4148]">{item.a}</p>}
          </div>
        ))}
      </div>
      <Part title="Contact Customer Service">
        <div id="contact" className="grid gap-3 sm:grid-cols-2">
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border p-4 hover:border-[#0b9b3a]">
              <MessageCircle className="text-[#0b9b3a]" />
              <span><b className="block">WhatsApp</b><span className="text-sm text-[#6b7077]">{info.support_whatsapp}</span></span>
            </a>
          )}
          {info.support_email && (
            <a href={`mailto:${info.support_email}`} className="flex items-center gap-3 border p-4 hover:border-[#0b6e4f]">
              <Mail className="text-[#0b6e4f]" />
              <span><b className="block">Email</b><span className="break-all text-sm text-[#6b7077]">{info.support_email}</span></span>
            </a>
          )}
          {!whatsapp && !info.support_email && <p className="text-sm text-[#6b7077]">Contact details will appear here soon.</p>}
        </div>
      </Part>
    </InfoPage>
  )
}

// ------------------------------------------------------------------ footer

export function SiteFooter({ className = '' }: { className?: string }) {
  const info = useSiteInfo()
  const year = new Date().getFullYear()
  return (
    <footer className={`bg-[#eef0f4] px-3 pb-28 pt-6 md:pb-8 ${className}`}>
      <div className="mx-auto max-w-[1180px] rounded-2xl border border-[#dde7e2] bg-white px-5 py-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#0b9b3a]/40 bg-[#e9f7ef] px-3 py-1 text-sm font-bold text-[#0b7a2e]"><ShieldCheck size={16} /> 18+</span>
          <span className="text-sm text-[#6b7077]">Responsible Gaming</span>
        </div>
        <p className="mt-5 text-3xl"><BrandLogo size={44} tone="dark" /></p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#8b8f94]">Sports Betting</p>
        <nav className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-x-6 gap-y-3 text-[15px] text-[#5c6068]">
          <Link href="/terms" className="hover:text-[#0b6e4f]">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="hover:text-[#0b6e4f]">Privacy Policy</Link>
          <Link href="/help" className="hover:text-[#0b6e4f]">Help &amp; FAQ</Link>
          <Link href="/responsible-gambling" className="hover:text-[#0b6e4f]">Responsible Gambling</Link>
        </nav>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-bold">
          <span className="rounded border bg-[#ffcc00] px-2.5 py-1.5 text-[#1f1f1f]">MTN MoMo</span>
          <span className="rounded border bg-[#e60000] px-2.5 py-1.5 text-white">Telecel Cash</span>
          <span className="rounded border bg-[#0033a0] px-2.5 py-1.5 text-white">AirtelTigo Money</span>
        </div>
        <hr className="mx-auto mt-6 max-w-lg" />
        <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-[#6b7077]">
          You must be 18 or older. Gambling can be addictive and psychologically harmful —{' '}
          <Link href="/responsible-gambling" className="underline">play responsibly</Link>.
        </p>
        {info.license_text && <p className="mx-auto mt-3 max-w-lg text-xs text-[#8b8f94]">{info.license_text}</p>}
        <p className="mt-5 text-xs text-[#8b8f94]">© {year} GoalVault. All Rights Reserved.</p>
      </div>
    </footer>
  )
}
