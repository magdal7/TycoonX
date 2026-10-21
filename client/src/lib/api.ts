const base = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export function apiUrl(path: string): string {
  if (!base) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
