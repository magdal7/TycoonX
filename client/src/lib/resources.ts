import { useEffect } from 'react'
import { useApi, type ApiState } from './useApi'
import { fetchResources, type Resources } from './game'

export const RESOURCES_CHANGED = 'tycoonx:resources'

/** Announce that server-side resources (XP/SP) changed so mounted views refetch. */
export function notifyResourcesChanged(): void {
  window.dispatchEvent(new Event(RESOURCES_CHANGED))
}

/** Shared resources state that refreshes whenever a claim/collect announces a change. */
export function useResources(): ApiState<Resources> {
  const state = useApi(() => fetchResources(), [])
  const { reload } = state
  useEffect(() => {
    const handler = () => reload()
    window.addEventListener(RESOURCES_CHANGED, handler)
    return () => window.removeEventListener(RESOURCES_CHANGED, handler)
  }, [reload])
  return state
}
