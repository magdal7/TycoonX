import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const clientRoot = join(here, '..')
const manifestPath = join(clientRoot, 'src', 'game', 'render', 'spriteManifest.json')
const assetsRoot = join(clientRoot, 'public', 'assets', 'game')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const categories = manifest.categories ?? []

function readPng(buf) {
  if (buf.length < 24) return null
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function readWebp(buf) {
  if (buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const fourcc = buf.toString('ascii', 12, 16)
  if (fourcc === 'VP8X') {
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
    return { width: w, height: h }
  }
  if (fourcc === 'VP8L') {
    const bits = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (fourcc === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  return null
}

function readSize(buf, file) {
  if (file.endsWith('.png')) return readPng(buf)
  if (file.endsWith('.webp')) return readWebp(buf)
  return null
}

const missingFolders = categories.filter((c) => !existsSync(join(assetsRoot, c)))

let expectedPending = 0
let missingRequired = 0
let present = 0
let dimensionMismatch = 0
const dimensionIssues = []

for (const sprite of manifest.sprites) {
  const targets = [
    { file: sprite.file, width: sprite.width, height: sprite.height },
    ...(sprite.variants ?? []).map((v) => ({ file: v.file, width: v.width, height: v.height }))
  ]
  for (const target of targets) {
    const full = join(assetsRoot, sprite.category, target.file)
    if (!existsSync(full)) {
      if (sprite.available) {
        missingRequired++
        console.log(`MISSING (required): ${sprite.category}/${target.file}`)
      } else {
        expectedPending++
      }
      continue
    }
    present++
    const buf = readFileSync(full)
    const size = readSize(buf, target.file)
    if (size && (size.width !== target.width || size.height !== target.height)) {
      dimensionMismatch++
      dimensionIssues.push(
        `DIM MISMATCH: ${sprite.category}/${target.file} — expected ${target.width}x${target.height}, got ${size.width}x${size.height}`
      )
    }
  }
}

console.log('')
console.log('TycoonX asset validation')
console.log('------------------------')
console.log(`manifest sprites:        ${manifest.sprites.length}`)
console.log(`asset folders:            ${categories.length - missingFolders.length}/${categories.length} present`)
console.log(`files present:            ${present}`)
console.log(`pending (not supplied):   ${expectedPending}  (EXPECTED until art is delivered)`)
console.log(`missing (required):       ${missingRequired}`)
console.log(`dimension mismatches:     ${dimensionMismatch}`)

if (missingFolders.length) {
  console.log('')
  console.log(`Missing folders: ${missingFolders.join(', ')}`)
}
if (dimensionIssues.length) {
  console.log('')
  for (const issue of dimensionIssues) console.log(issue)
}

if (missingRequired === 0 && dimensionMismatch === 0 && missingFolders.length === 0) {
  console.log('')
  console.log('RESULT: OK — no delivered artwork is missing or mis-sized.')
} else {
  console.log('')
  console.log('RESULT: FAIL — delivered artwork has missing files or dimension mismatches.')
}

process.exit(missingRequired > 0 || dimensionMismatch > 0 || missingFolders.length > 0 ? 1 : 0)
