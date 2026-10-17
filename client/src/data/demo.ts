/**
 * Demo data for TycoonX frontend placeholder views.
 *
 * ⚠️ DEMO DATA ONLY — Not persisted, not real, and not withdrawable.
 * No actual earnings, no GEM-to-USD conversion, no payments.
 * Used for UI preview until real backend data is wired up.
 */

import { Play, UserPlus, Building2 as BuildingIcon } from 'lucide-react'

export interface DemoCEO {
  id: string
  name: string
  level: number
  incomePerSec: number
  owned: boolean
  image?: string
}

export interface DemoProductionCycle {
  id: string
  name: string
  progress: number // 0-100
  durationSec: number
  reward: number
  active: boolean
}

export interface DemoDailyTask {
  id: string
  title: string
  reward: number
  completed: boolean
}

export interface DemoPlayer {
  id: number
  email: string
  username: string
  role: string
  level: number
  xp: number
  xpToNext: number
  energy: number
  maxEnergy: number
  projectedEarnings: number // clearly non-withdrawable demo value
  ceosOwned: number
}

export const DEMO_PLAYER: DemoPlayer = {
  id: 1,
  email: 'demo@tycoonx.local',
  username: 'demo_tycoon',
  role: 'USER',
  level: 5,
  xp: 1240,
  xpToNext: 2000,
  energy: 78,
  maxEnergy: 100,
  projectedEarnings: 0,
  ceosOwned: 3
}

export const DEMO_CEOS: DemoCEO[] = [
  { id: 'ceo-1', name: 'Operations Chief', level: 3, incomePerSec: 12, owned: true },
  { id: 'ceo-2', name: 'Tech Director', level: 2, incomePerSec: 7, owned: true },
  { id: 'ceo-3', name: 'Growth Lead', level: 1, incomePerSec: 3, owned: true },
  { id: 'ceo-4', name: 'Security Head', level: 1, incomePerSec: 2, owned: false },
  { id: 'ceo-5', name: 'Finance VP', level: 1, incomePerSec: 1, owned: false }
]

export const DEMO_PRODUCTION_CYCLES: DemoProductionCycle[] = [
  { id: 'cycle-1', name: 'Server Farm Output', progress: 65, durationSec: 3600, reward: 450, active: true },
  { id: 'cycle-2', name: 'Data Center Batch', progress: 22, durationSec: 7200, reward: 900, active: false },
  { id: 'cycle-3', name: 'Cloud Sync', progress: 100, durationSec: 1800, reward: 200, active: false }
]

export const DEMO_DAILY_TASKS: DemoDailyTask[] = [
  { id: 'task-1', title: 'Log in today', reward: 50, completed: true },
  { id: 'task-2', title: 'Hire your first CEO', reward: 100, completed: false },
  { id: 'task-3', title: 'Complete a production cycle', reward: 150, completed: false }
]

export const DEMO_QUICK_ACTIONS = [
  { id: 'qa-1', label: 'Start Cycle', icon: Play, onClick: () => {} },
  { id: 'qa-2', label: 'Hire CEO', icon: UserPlus, onClick: () => {} },
  { id: 'qa-3', label: 'Upgrade Office', icon: BuildingIcon, onClick: () => {} }
]
