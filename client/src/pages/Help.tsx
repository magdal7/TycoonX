import { HelpCircle, RotateCcw, ShieldCheck, Send } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { SectionHeading } from '../components/ui/kit'
import { usePublicSettings } from '../lib/siteSettings'
import { requestOnboardingReplay } from '../components/OnboardingGuide'
import { useT } from '../i18n'

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
  const t = useT()
  const caps = usePublicSettings().data?.capabilities

  const deposits = caps?.deposits === true ? t('help.state.available') : caps?.deposits === false ? t('common.unavailable') : t('help.state.shown')
  const payouts = caps?.payouts === true ? t('help.state.payouts') : caps?.payouts === false ? t('common.unavailable') : t('help.state.shown')
  const referrals = caps?.referralRewards === true ? t('referrals.rewardsActive') : caps?.referralRewards === false ? t('help.state.inactive') : t('help.state.shown')

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow={t('help.eyebrow')}
        title={t('help.title')}
        description={t('help.description')}
        right={
          <Button size="sm" variant="outline" onClick={requestOnboardingReplay} iconLeft={<RotateCcw className="h-4 w-4" />}>
            {t('help.replay')}
          </Button>
        }
      />

      <Card padding="md" className="border-success/25 bg-success/5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p className="text-xs text-success/90">{t('help.intro')}</p>
        </div>
      </Card>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted">{t('help.cat.start')}</h2>
        <Item q={t('help.q.account')} a={t('help.a.account')} />
        <Item q={t('help.q.free')} a={t('help.a.free')} />
        <Item q={t('help.q.buy')} a={t('help.a.buy')} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted">{t('help.cat.production')}</h2>
        <Item q={t('help.q.production')} a={t('help.a.production')} />
        <Item q={t('help.q.equipment')} a={t('help.a.equipment')} />
        <Item q={t('help.q.cap')} a={t('help.a.cap')} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted">{t('help.cat.progression')}</h2>
        <Item q={t('help.q.sp')} a={t('help.a.sp')} />
        <Item q={t('help.q.missions')} a={t('help.a.missions')} />
        <Item q={t('help.q.empire')} a={t('help.a.empire')} />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted">{t('help.cat.money')}</h2>
        <Item q={t('help.q.deposits')} a={t('help.a.deposits', { state: deposits })} />
        <Item q={t('help.q.withdrawals')} a={t('help.a.withdrawals', { state: payouts })} />
        <Item q={t('help.q.referrals')} a={t('help.a.referrals', { state: referrals })} />
        <Item q={t('help.q.statuses')} a={t('help.a.statuses')} />
      </section>

      <Card padding="md" className="border-line">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t('help.more.title')}</p>
            <p className="text-xs text-muted">{t('help.more.body')}</p>
          </div>
          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#229ED9] px-3 py-2 text-xs font-bold text-white"
          >
            <Send className="h-3.5 w-3.5" /> Telegram
          </a>
        </div>
      </Card>
    </div>
  )
}
