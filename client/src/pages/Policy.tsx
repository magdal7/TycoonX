import { ArrowLeft, ShieldCheck } from 'lucide-react'

export type PolicyKind = 'terms' | 'privacy'

export type PolicyMeta = {
  title: string
  version: string
  effective: string
}

export const POLICY_META: Record<PolicyKind, PolicyMeta> = {
  terms: { title: 'Terms of Service', version: '1.0', effective: '2026-10-19' },
  privacy: { title: 'Privacy Policy', version: '1.0', effective: '2026-10-19' },
}

type Section = { heading: string; paragraphs: string[] }

const TERMS: Section[] = [
  {
    heading: '1. About TycoonX',
    paragraphs: [
      'TycoonX is a mobile-first technology-company tycoon game. You collect in-game CEOs, run manual production cycles, earn Strategy Points (SP) and experience (XP), and progress through ranks.',
      'TycoonX is entertainment software. It is not a bank, exchange, investment scheme, or financial product, and nothing in the game is an offer of securities, ownership, or guaranteed returns.',
    ],
  },
  {
    heading: '2. Your account',
    paragraphs: [
      'You must provide an accurate email address and choose a permanent, unique username. Keep your password secure and do not share your account.',
      'You are responsible for activity performed through your account. Report suspected unauthorised access promptly.',
    ],
  },
  {
    heading: '3. In-game currency and progression',
    paragraphs: [
      'SP and XP are game mechanics with no inherent monetary value until and unless a withdrawal feature is activated and approved. Earned SP is produced by your CEOs and has a finite lifetime cap per CEO copy. Bonus SP is non-withdrawable and is spent before Earned SP where eligible.',
      'Nominal production rates are game rules, not promised earnings. Displayed rates, caps, and rewards may be adjusted to preserve balance, subject to the product specification.',
    ],
  },
  {
    heading: '4. Purchases and withdrawals',
    paragraphs: [
      'Real-money deposits, withdrawals, and crypto payouts are currently disabled. The materials describing future payment features are planning information only and do not represent an active service.',
      'If payments are enabled in future, they will be subject to additional terms, eligibility checks, and applicable law. No purchase in the game should be made with the expectation of profit.',
    ],
  },
  {
    heading: '5. Referrals and fair play',
    paragraphs: [
      'Referral codes identify the account that invited you. Referral bonuses are disabled pending approval of qualification and anti-abuse rules. Self-referrals, duplicate or recycled accounts, and other manipulation are prohibited and may void attribution or rewards.',
      'Do not cheat, exploit bugs, automate gameplay in ways that damage the service, or interfere with other players. We may suspend or remove accounts that violate these terms.',
    ],
  },
  {
    heading: '6. Changes and availability',
    paragraphs: [
      'The game is provided on an "as is" and "as available" basis. Features may change, and downtime may occur. We may update these terms; when we do, we record the policy version you accept.',
    ],
  },
  {
    heading: '7. Contact',
    paragraphs: [
      'Questions about these terms can be raised through the support channels published inside the game or by the operator of your TycoonX instance. This document is a product summary, not legal advice.',
    ],
  },
]

const PRIVACY: Section[] = [
  {
    heading: '1. What we collect',
    paragraphs: [
      'Account data: your email address and username. Your password is stored only as a one-way bcrypt hash and is never stored or logged in plain text.',
      'Gameplay data: owned CEOs, production cycles, SP balances and ledger entries, XP, tasks, achievements, and public profile settings. Referral attribution records which account invited you.',
      'Consent records: the Terms of Service and Privacy Policy versions you accepted and the server-side acceptance timestamp.',
    ],
  },
  {
    heading: '2. What we do not collect',
    paragraphs: [
      'Email verification is not required for the MVP, so we do not yet verify email ownership. Real-money payment flows and crypto wallet storage are disabled, so no wallet addresses or payment credentials are collected.',
    ],
  },
  {
    heading: '3. How we use data',
    paragraphs: [
      'We use your data to operate the game (authentication, production, progression, and leaderboards), to keep accounts secure, to prevent abuse and fraud, and to maintain an auditable record of the policies you accepted.',
      'Leaderboards and public profiles display only your username, avatar, level, rank, total XP, and featured badges. We do not publish your email, balances, deposits, withdrawals, or referral data.',
    ],
  },
  {
    heading: '4. Legal basis and consent',
    paragraphs: [
      'We process account and gameplay data to provide the service you request. For the policy acceptance you explicitly agree to, we rely on your consent, which is recorded at registration.',
    ],
  },
  {
    heading: '5. Sharing and retention',
    paragraphs: [
      'We do not sell your personal data. We use infrastructure providers (for example, a managed PostgreSQL database host) strictly to run the service.',
      'We retain account and consent records for as long as your account exists and as needed to meet legal, security, and audit obligations.',
    ],
  },
  {
    heading: '6. Your choices',
    paragraphs: [
      'You can change your avatar and featured badges freely. Requests to access or delete your account data can be made through the support channels published inside the game; some records may be retained where the law requires it.',
    ],
  },
  {
    heading: '7. Security and children',
    paragraphs: [
      'Sessions use secure, HttpOnly cookies and passwords are hashed. No system is perfectly secure, so please use a strong, unique password. TycoonX is not directed at children below the age required by your local law.',
    ],
  },
]

export default function Policy({ kind, navigate }: { kind: PolicyKind; navigate: (p: string) => void }) {
  const meta = POLICY_META[kind]
  const sections = kind === 'terms' ? TERMS : PRIVACY

  return (
    <div className="min-h-screen bg-bg text-white font-sans">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-[calc(env(safe-area-inset-bottom)_+_3rem)] md:px-6 md:py-10">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); navigate('/') }}
          className="flex items-center gap-2 text-accent/70 hover:text-accent transition mb-8"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </a>

        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{meta.title}</h1>
            <p className="text-xs text-gray-400">Version {meta.version} · Effective {meta.effective}</p>
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-400">
          TycoonX is a game. This summary explains how the service works and how we handle your data. It is not legal advice.
        </p>

        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold text-white">{section.heading}</h2>
              <div className="mt-2 space-y-2">
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-gray-400">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t border-gray-800/60 pt-6 text-sm">
          <a
            href={kind === 'terms' ? '/privacy' : '/terms'}
            onClick={(e) => { e.preventDefault(); navigate(kind === 'terms' ? '/privacy' : '/terms') }}
            className="text-accent underline"
          >
            {kind === 'terms' ? 'Privacy Policy' : 'Terms of Service'}
          </a>
        </div>

        <p className="mt-8 text-[10px] text-gray-500">© {new Date().getFullYear()} TycoonX. A game — not a financial product.</p>
      </div>
    </div>
  )
}
