import { useState } from 'react'
import { AlertTriangle, Pencil, Plus, Power, ShoppingCart, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { SectionHeading, EmptyState, Skeleton } from '../../components/ui/kit'
import { useApi } from '../../lib/useApi'
import {
  createAdminCatalogEntry,
  deleteAdminCatalogEntry,
  fetchAdminCatalog,
  updateAdminCatalogEntry,
  type AdminCatalogCeo,
} from '../../lib/admin'

type EditState = {
  name: string
  rarity: string
  category: string
  displayOrder: string
  imageUrl: string
}

const emptyCreate = {
  name: '',
  slug: '',
  rarity: 'Rare',
  priceUsd: '0.99',
  dailyRatePercent: '0.0100',
  cycleHours: 4,
  energyCost: 2,
  category: '',
  displayOrder: 0,
  imageUrl: '',
  confirmNewTier: false,
}

export default function AdminCatalog() {
  const { data, loading, error, reload } = useApi(() => fetchAdminCatalog(), [])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<EditState>({ name: '', rarity: '', category: '', displayOrder: '0', imageUrl: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [create, setCreate] = useState(emptyCreate)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function startEdit(c: AdminCatalogCeo) {
    setEditingId(c.id)
    setForm({
      name: c.name,
      rarity: c.rarity,
      category: c.category ?? '',
      displayOrder: String(c.displayOrder),
      imageUrl: c.imageUrl ?? '',
    })
  }

  async function saveEdit(id: number) {
    setBusy(true)
    setNotice('')
    try {
      await updateAdminCatalogEntry(id, {
        name: form.name,
        rarity: form.rarity,
        category: form.category || null,
        displayOrder: Number(form.displayOrder) || 0,
        imageUrl: form.imageUrl || null,
      })
      setEditingId(null)
      setNotice('Catalog entry updated')
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(c: AdminCatalogCeo, field: 'isActive' | 'isForSale') {
    setBusy(true)
    setNotice('')
    try {
      await updateAdminCatalogEntry(c.id, { [field]: !c[field] })
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove(c: AdminCatalogCeo) {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await deleteAdminCatalogEntry(c.id)
      setNotice('Deleted')
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setNotice('')
    try {
      await createAdminCatalogEntry({
        ...create,
        category: create.category || null,
        imageUrl: create.imageUrl || null,
      })
      setShowCreate(false)
      setCreate(emptyCreate)
      setNotice('Tier created (hidden, not for sale)')
      reload()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeading
        eyebrow="Admin"
        title="CEO Catalog"
        description="Manage presentation and availability. Production/economy parameters are locked."
        right={<Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)} iconLeft={<Plus className="h-4 w-4" />}>New tier</Button>}
      />

      {notice && <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{notice}</div>}

      {showCreate && (
        <Card padding="lg" hover={false}>
          <h2 className="text-sm font-bold">New catalog tier (created hidden, not for sale)</h2>
          <form onSubmit={submitCreate} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="text-xs text-gray-300">Name</label><Input value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} required className="mt-1" /></div>
              <div><label className="text-xs text-gray-300">Slug</label><Input value={create.slug} onChange={(e) => setCreate({ ...create, slug: e.target.value })} required pattern="[a-z0-9-]+" className="mt-1" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="text-xs text-gray-300">Rarity</label><Input value={create.rarity} onChange={(e) => setCreate({ ...create, rarity: e.target.value })} required className="mt-1" /></div>
              <div><label className="text-xs text-gray-300">Price USD</label><Input value={create.priceUsd} onChange={(e) => setCreate({ ...create, priceUsd: e.target.value })} className="mt-1" /></div>
              <div><label className="text-xs text-gray-300">Daily rate %</label><Input value={create.dailyRatePercent} onChange={(e) => setCreate({ ...create, dailyRatePercent: e.target.value })} className="mt-1" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="text-xs text-gray-300">Cycle hours</label><Input type="number" value={create.cycleHours} onChange={(e) => setCreate({ ...create, cycleHours: Number(e.target.value) })} className="mt-1" /></div>
              <div><label className="text-xs text-gray-300">Energy cost</label><Input type="number" value={create.energyCost} onChange={(e) => setCreate({ ...create, energyCost: Number(e.target.value) })} className="mt-1" /></div>
              <div><label className="text-xs text-gray-300">Display order</label><Input type="number" value={create.displayOrder} onChange={(e) => setCreate({ ...create, displayOrder: Number(e.target.value) })} className="mt-1" /></div>
            </div>
            <div><label className="text-xs text-gray-300">Image URL (optional)</label><Input value={create.imageUrl} onChange={(e) => setCreate({ ...create, imageUrl: e.target.value })} className="mt-1" /></div>
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input type="checkbox" checked={create.confirmNewTier} onChange={(e) => setCreate({ ...create, confirmNewTier: e.target.checked })} className="h-4 w-4 rounded border-gray-600 bg-gray-800/50" />
              I confirm creating a new tier (requires owner governance to activate)
            </label>
            <div className="flex gap-2">
              <Button type="submit" isLoading={busy}>Create</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <EmptyState Icon={AlertTriangle} title="Could not load catalog" description={error} action={<Button size="sm" variant="outline" onClick={reload}>Retry</Button>} />
      ) : !data || data.length === 0 ? (
        <EmptyState Icon={AlertTriangle} title="No catalog entries" />
      ) : (
        <div className="space-y-2">
          {data.map((c) => (
            <Card key={c.id} padding="md" hover={false}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold">{c.name}</h3>
                    <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Visible' : 'Hidden'}</Badge>
                    <Badge variant={c.isForSale ? 'demo' : 'default'}>{c.isForSale ? 'For sale' : 'Not for sale'}</Badge>
                    {c.isStarter && <Badge variant="warning">Starter</Badge>}
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    {c.rarity} · {c.priceUsd} USDT · {c.nominalSpPer24h ?? '—'} SP/24h · cap {c.lifetimeCapSp ?? '—'} · {c.cycleHours}h
                    {' · '}{c.ownedCount} owned
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(c, 'isActive')} iconLeft={<Power className="h-3.5 w-3.5" />}>{c.isActive ? 'Hide' : 'Show'}</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(c, 'isForSale')} iconLeft={<ShoppingCart className="h-3.5 w-3.5" />}>{c.isForSale ? 'Disable sale' : 'Enable sale'}</Button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(c)} iconLeft={<Pencil className="h-3.5 w-3.5" />}>Edit</Button>
                  <Button size="sm" variant="danger" disabled={busy || c.ownedCount > 0} onClick={() => remove(c)} iconLeft={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
                </div>
              </div>

              {editingId === c.id && (
                <form
                  onSubmit={(e) => { e.preventDefault(); saveEdit(c.id) }}
                  className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2"
                >
                  <div><label className="text-xs text-gray-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
                  <div><label className="text-xs text-gray-300">Rarity</label><Input value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })} className="mt-1" /></div>
                  <div><label className="text-xs text-gray-300">Category</label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" /></div>
                  <div><label className="text-xs text-gray-300">Display order</label><Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} className="mt-1" /></div>
                  <div className="sm:col-span-2"><label className="text-xs text-gray-300">Image URL</label><Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="mt-1" /></div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button type="submit" size="sm" isLoading={busy}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
