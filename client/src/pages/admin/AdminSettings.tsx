import { useEffect, useState } from 'react'
import { AlertTriangle, Megaphone, Save } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { SectionHeading, EmptyState, Skeleton } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import { fetchAdminSettings, updateAdminSettings, type AdminSettings } from '../../lib/admin'

const FEATURE_KEYS: Array<keyof AdminSettings['features']> = [
  'market',
  'collection',
  'tasks',
  'achievements',
  'leaderboard',
  'wallet',
  'specialTasks',
]

export default function AdminSettingsPage() {
  const { data, loading, error, reload } = useApi(() => fetchAdminSettings(), [])
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (data) setSettings(data)
  }, [data])

  async function save() {
    if (!settings) return
    if (!window.confirm('Apply these site settings? This is a sensitive action.')) return
    setBusy(true)
    setNotice('')
    try {
      const next = await updateAdminSettings(settings, true)
      setSettings(next)
      setNotice('Settings saved')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Skeleton className="h-60" />
  if (error || !settings) {
    return <EmptyState Icon={AlertTriangle} title="Could not load settings" description={error} action={<Button size="sm" variant="outline" onClick={reload}>Retry</Button>} />
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="Site Settings"
        description="Registration, maintenance mode, feature visibility and announcements."
        right={<Button size="sm" onClick={save} isLoading={busy} iconLeft={<Save className="h-4 w-4" />}>Save</Button>}
      />
      {notice && <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{notice}</div>}

      <Card padding="md" hover={false} className="space-y-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Registration open</span>
          <input type="checkbox" checked={settings.registrationEnabled} onChange={(e) => setSettings({ ...settings, registrationEnabled: e.target.checked })} className="h-4 w-4 rounded border-gray-600 bg-gray-800/50" />
        </label>

        <div className="border-t border-line pt-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Maintenance mode (blocks non-admin gameplay & registration)</span>
            <input type="checkbox" checked={settings.maintenance.enabled} onChange={(e) => setSettings({ ...settings, maintenance: { ...settings.maintenance, enabled: e.target.checked } })} className="h-4 w-4 rounded border-gray-600 bg-gray-800/50" />
          </label>
          <Input value={settings.maintenance.message} onChange={(e) => setSettings({ ...settings, maintenance: { ...settings.maintenance, message: e.target.value } })} placeholder="Maintenance message" className="mt-2 text-xs" />
        </div>

        <div className="border-t border-line pt-4">
          <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Public announcement</h2></div>
          <label className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span>Show announcement banner</span>
            <input type="checkbox" checked={settings.announcement.enabled} onChange={(e) => setSettings({ ...settings, announcement: { ...settings.announcement, enabled: e.target.checked } })} className="h-4 w-4 rounded border-gray-600 bg-gray-800/50" />
          </label>
          <Input value={settings.announcement.message} onChange={(e) => setSettings({ ...settings, announcement: { ...settings.announcement, message: e.target.value } })} placeholder="Announcement text" className="mt-2 text-xs" />
          <select
            value={settings.announcement.level}
            onChange={(e) => setSettings({ ...settings, announcement: { ...settings.announcement, level: e.target.value as AdminSettings['announcement']['level'] } })}
            className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="border-t border-line pt-4">
          <h2 className="text-sm font-bold">Feature visibility</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FEATURE_KEYS.map((key) => (
              <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-xs">
                <span className="capitalize">{key}</span>
                <input
                  type="checkbox"
                  checked={settings.features[key]}
                  onChange={(e) => setSettings({ ...settings, features: { ...settings.features, [key]: e.target.checked } })}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800/50"
                />
              </label>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
