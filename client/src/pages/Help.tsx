import { HelpCircle, RotateCcw, ShieldCheck, Send } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { SectionHeading } from '../components/ui/kit'
import { usePublicSettings } from '../lib/siteSettings'
import { requestOnboardingReplay } from '../components/OnboardingGuide'

const COMMUNITY_URL = 'https://t.me/tycoonX_official'

function Item({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface/60 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
        {q}
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-muted">{a}</p>
    </details>
  )
}

export default function Help() {
  const caps = usePublicSettings().data?.capabilities

  const deposits = caps?.deposits === true ? 'available' : caps?.deposits === false ? 'currently unavailable' : 'shown in the app'
  const payouts = caps?.payouts === true ? 'available with Admin approval' : caps?.payouts === false ? 'currently unavailable' : 'shown in the app'
  const referrals = caps?.referralRewards === true ? 'active for qualified referrals' : caps?.referralRewards === false ? 'not currently active' : 'shown in the app'

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Support"
        title="Help & FAQ"
        description="How TycoonX works, in plain language."
        right={
          <Button size="sm" variant="outline" onClick={requestOnboardingReplay} iconLeft={<RotateCcw className="h-4 w-4" />}>
            Replay guide
          </Button>
        }
      />

      <Card padding="md" className="border-success/25 bg-success/5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p className="text-xs text-success/90">
            TycoonX is a game, not a financial product. Nominal production rates are game rules, not guaranteed
            income or returns. Every CEO copy has a finite lifetime production cap.
          </p>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted">Getting started</h2>
        <Item q="How do I create an account?" a="Register with a username, email and password. You accept the Terms and Privacy Policy at sign-up. Email verification and password recovery are not yet available." />
        <Item q="What do I get for free?" a="Every account receives one free Intern CEO, provisioned automatically the first time you sign in. You can start a production cycle immediately — no deposit required." />
        <Item q="How do I buy more CEOs?" a="Use the Market. CEO copies are bought with SP (Bonus SP spends first, then Earned SP) at 1 USDT = 1,000 SP. Each template has an ownership limit and every copy has a finite lifetime cap." />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted">Production</h2>
        <Item q="How does production work?" a="Production is manual. Start a cycle on a CEO, wait for it to finish, then collect to receive Earned SP. Nothing restarts automatically. Elapsed offline time counts only up to the cycle's end." />
        <Item q="What does equipment do?" a="Equipment sets the cycle length: Standard 4h, Extended 6h, Advanced 8h. Longer cycles yield proportionally more SP per collection — the hourly rate is unchanged. Upgrades cost SP once and apply to future cycles, not an active one." />
        <Item q="What is the lifetime cap?" a="Each CEO copy can produce a fixed maximum lifetime amount of Earned SP. When the cap is reached the copy is archived; you keep ownership but it no longer produces." />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted">SP, missions and progression</h2>
        <Item q="Earned SP vs Bonus SP?" a="Earned SP is produced by your CEOs and is the only balance that can ever be withdrawn. Bonus SP comes from bonuses such as missions, referrals and confirmed deposits; it is spent first where eligible and is never withdrawable." />
        <Item q="How do missions and achievements work?" a="Daily and weekly missions reset on UTC boundaries and award XP when claimed. Achievements are permanent cumulative tracks that award XP per stage. Unclaimed rewards persist until claimed." />
        <Item q="What is My Empire?" a="My Empire is an interactive visualisation of the CEO copies you actually own. Each unit reflects real ownership and its live production state (idle, producing, ready or exhausted). Selecting a unit opens its details and the same Start/Collect actions." />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted">Deposits, withdrawals and referrals</h2>
        <Item q="How do deposits work?" a={`Deposits through our payment provider are ${deposits}. A confirmed deposit is credited as Bonus SP at 1 USDT = 1,000 SP, once the invoice is fully paid.`} />
        <Item q="How do withdrawals work?" a={`Withdrawals of eligible Earned SP are ${payouts}. The minimum is 1,000 Earned SP (1 USDT) with a 0.25 USDT player fee, paid as USDT on BSC/BEP20. Admin approval is required before payout, and a separate payout action submits the transfer. Bonus SP can never be withdrawn.`} />
        <Item q="How do referrals work?" a={`Referral rewards are ${referrals}. A referred player qualifies through their first eligible CEO purchase; commission applies only to the eligible deposit-funded portion. Single-level only.`} />
        <Item q="What do the transaction statuses mean?" a="Paid: the invoice was confirmed. Confirming on-chain: the network is confirming. Awaiting payment / Underpaid / Expired: the invoice is not fully settled and no SP is credited. Withdrawals show Requested, On hold, Approved, then Paid once the transfer is confirmed." />
      </section>

      <Card padding="md" className="border-line">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Still need help?</p>
            <p className="text-xs text-muted">Announcements and support are in our Telegram channel.</p>
          </div>
          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#229ED9] px-3 py-2 text-xs font-bold text-white"
          >
            <Send className="h-3.5 w-3.5" /> Telegram
          </a>
        </div>
      </Card>
    </div>
  )
}
