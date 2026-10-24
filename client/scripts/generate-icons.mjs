// Dependency-free icon generator for TycoonX.
// Rasterizes the TX logo (signed-distance shapes) into PNGs using only Node's
// built-in zlib. Run: node client/scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const DARK = [9, 25, 22]
const EMERALD = [16, 185, 129]
const GOLD = [212, 175, 101]
const CREAM = [247, 241, 227]

const rr = (cx, cy, w, h, r) => (x, y) => {
  const qx = Math.abs(x - cx) - (w / 2 - r)
  const qy = Math.abs(y - cy) - (h / 2 - r)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r <= 0
}
const capsule = (ax, ay, bx, by, half) => (x, y) => {
  const vx = bx - ax
  const vy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)))
  return Math.hypot(x - (ax + vx * t), y - (ay + vy * t)) <= half
}

const STROKES = [
  capsule(118, 182, 228, 182, 21), // T bar
  capsule(173, 182, 173, 346, 21), // T stem
  capsule(272, 182, 398, 346, 21), // X
  capsule(398, 182, 272, 346, 21) // X
]
const GOLD_BAR = rr(258, 400, 280, 16, 8)

function layers(variant) {
  const base =
    variant === 'square'
      ? [[() => true, EMERALD]]
      : [[rr(256, 256, 512, 512, 116), DARK], [rr(256, 256, 420, 420, 100), EMERALD]]
  return [
    ...base,
    [rr(256, 256, 388, 388, 84), GOLD],
    [rr(256, 256, 382, 382, 80), EMERALD],
    ...STROKES.map((s) => [s, CREAM]),
    [GOLD_BAR, GOLD]
  ]
}

function render(size, variant) {
  const scale = 512 / size
  const buf = new Uint8ClampedArray(size * size * 4)
  const SS = 4
  const step = 1 / SS
  for (const [inside, [r, g, b]] of layers(variant)) {
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        let hit = 0
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            if (inside((px + (sx + 0.5) * step) * scale, (py + (sy + 0.5) * step) * scale)) hit++
          }
        }
        if (hit === 0) continue
        const sa = hit / (SS * SS)
        const i = (py * size + px) * 4
        const da = buf[i + 3] / 255
        const outA = sa + da * (1 - sa)
        const comp = (sc, dc) => Math.round((sc * sa + dc * da * (1 - sa)) / (outA || 1))
        buf[i] = comp(r, buf[i])
        buf[i + 1] = comp(g, buf[i + 1])
        buf[i + 2] = comp(b, buf[i + 2])
        buf[i + 3] = Math.round(outA * 255)
      }
    }
  }
  return buf
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = 1 + size * 4
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < size * 4; x++) raw[y * stride + 1 + x] = rgba[y * size * 4 + x]
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const targets = [
  ['icon-192.png', 192, 'rounded'],
  ['icon-512.png', 512, 'rounded'],
  ['icon-192-maskable.png', 192, 'square'],
  ['icon-512-maskable.png', 512, 'square'],
  ['apple-touch-icon.png', 180, 'square']
]

mkdirSync(OUT, { recursive: true })
for (const [name, size, variant] of targets) {
  const png = encodePNG(size, render(size, variant))
  writeFileSync(join(OUT, name), png)
  console.log(`wrote ${name} (${size}x${size}, ${png.length} bytes)`)
}
