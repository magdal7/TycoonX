import { useMemo, useState } from 'react'
import GameHud from './ui/GameHud'
import GameCanvas from './render/GameCanvas'
import BuildingPanel from './ui/BuildingPanel'
import { buildDemoWorld } from './engine/state'
import type { Selected } from './engine/types'

export default function GameHome({ navigate }: { navigate: (p: string) => void }) {
  const world = useMemo(() => buildDemoWorld(), [])
  const [selected, setSelected] = useState<Selected>({ kind: 'building', id: 'hq' })

  return (
    <div className="space-y-4">
      <GameHud onEmpire={() => navigate('/dashboard')} />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 lg:flex-1">
          <GameCanvas world={world} selected={selected} onSelect={setSelected} />
        </div>
        <div className="lg:w-96 lg:shrink-0">
          <BuildingPanel world={world} selected={selected} onClose={() => setSelected(null)} />
        </div>
      </div>
    </div>
  )
}
