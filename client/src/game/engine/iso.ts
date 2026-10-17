export const TILE_W = 64
export const TILE_H = 32

export interface Point {
  x: number
  y: number
}

export interface Origin {
  x: number
  y: number
}

export function project(gx: number, gy: number): Point {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) }
}

export function toScreen(gx: number, gy: number, origin: Origin): Point {
  const p = project(gx, gy)
  return { x: origin.x + p.x, y: origin.y + p.y }
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function points(list: Point[]): string {
  return list.map((p) => `${p.x},${p.y}`).join(' ')
}

export function up(p: Point, d: number): Point {
  return { x: p.x, y: p.y - d }
}

export function tilePoints(center: Point): string {
  return points([
    { x: center.x, y: center.y - TILE_H / 2 },
    { x: center.x + TILE_W / 2, y: center.y },
    { x: center.x, y: center.y + TILE_H / 2 },
    { x: center.x - TILE_W / 2, y: center.y }
  ])
}

export function center(a: Point, b: Point, c: Point, d: Point): Point {
  return { x: (a.x + b.x + c.x + d.x) / 4, y: (a.y + b.y + c.y + d.y) / 4 }
}
