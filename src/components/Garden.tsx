import { useEffect, useRef } from 'react'
import { Category, GRID_H, GRID_W, Memory, WILT_BELOW, ageOf } from '../engine/memory'

// Look: a top-down pixel-art farm field. Everything is drawn at a tiny logical resolution
// onto a canvas and scaled up with nearest-neighbour filtering.

const T = 24 // tile size in logical px
const FX = 12
const FY = 22
const CW = FX * 2 + GRID_W * T
const CH = FY + GRID_H * T + 14

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${[c(r1, r2), c(g1, g2), c(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const DRY = '#b98a3e'
const LEAF = '#3f9a3f'
const LEAF_DARK = '#2c6e32'

interface Species {
  p: string
  d: string
  c: string
  label: string
  head: string[] // 7px wide: p petal, d dark petal, c centre
}

export const SPECIES: Record<Category, Species> = {
  person: { p: '#ffffff', d: '#d6d6e6', c: '#f4c430', label: 'People', head: ['.p.p.p.', '.ppppp.', 'pppcppp', '.ppppp.', '.p.p.p.'] },
  preference: { p: '#ffd84a', d: '#e0912e', c: '#e0912e', label: 'Preferences', head: ['p.ppp.p', 'ppppppp', 'ppdpdpp', '.ppppp.', '..ppp..'] },
  place: { p: '#6fa8ff', d: '#3f6fd0', c: '#ffffff', label: 'Places', head: ['..ppp..', '.ppppp.', '.ppcpp.', 'ppppppp', 'd.ddd.d'] },
  work: { p: '#f08a5d', d: '#c85a3a', c: '#ffe9a8', label: 'Work', head: ['.ppppp.', 'ppdddpp', 'ppdcdpp', 'ppdddpp', '.ppppp.'] },
  plan: { p: '#f7a8c8', d: '#d86f9f', c: '#ffffff', label: 'Plans', head: ['..p.p..', '.p.p.p.', '..pcp..', '.p.p.p.', '..p.p..'] },
  fact: { p: '#9fe3a8', d: '#4f9a5a', c: '#2f6a3a', label: 'Facts', head: ['.pp.pp.', 'ppppppp', '..pcp..', '.ppppp.'] },
}

const cellOrigin = (m: Memory) => ({ ox: FX + m.x * T, oy: FY + m.z * T })

function geom(m: Memory, day: number) {
  const age = ageOf(m, day)
  const growth = clamp(age / 3, 0, 1)
  const s = clamp(m.strength, 0, 1)
  const w = clamp((WILT_BELOW - s) / 0.3, 0, 1)
  const { ox, oy } = cellOrigin(m)
  return { age, growth, s, w, ox, oy, cx: ox + 12, by: oy + 17, side: (m.x + m.z) % 2 === 0 ? 1 : -1 }
}

// ---------- drawing helpers ----------

type Ctx = CanvasRenderingContext2D
const R = (ctx: Ctx, x: number, y: number, w: number, h: number, col: string) => {
  ctx.fillStyle = col
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const disc = (ctx: Ctx, cx: number, cy: number, r: number, col: string) => {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy + 0.5))
    R(ctx, cx - half, cy + dy, half * 2 + 1, 1, col)
  }
}

const hash = (n: number) => {
  let h = Math.imul(n + 1, 2654435761) >>> 0
  h ^= h >>> 15
  return h >>> 0
}

const petalColor = (sp: Species, ch: string) => (ch === 'p' ? sp.p : ch === 'd' ? sp.d : sp.c)

function drawHead(ctx: Ctx, cat: Category, cx: number, bottom: number, wilt: number) {
  const sp = SPECIES[cat]
  sp.head.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== '.') R(ctx, cx - 3 + i, bottom - sp.head.length + j, 1, 1, mix(petalColor(sp, ch), DRY, wilt * 0.85))
    }),
  )
}

function drawBackground(ctx: Ctx) {
  R(ctx, 0, 0, CW, CH, '#7bb661')
  for (let j = 0; j < CH / 8; j++) for (let i = 0; i < CW / 8; i++) if ((i + j) % 2) R(ctx, i * 8, j * 8, 8, 8, '#74ae59')
  for (let k = 0; k < 90; k++) {
    const h = hash(k)
    const x = h % CW
    const y = (h >>> 9) % CH
    if (x > FX - 6 && x < CW - FX + 6 && y > FY - 10 && y < FY + GRID_H * T + 8) continue
    R(ctx, x, y, 1, 2, '#5f9a48')
    R(ctx, x + 1, y + 1, 1, 1, '#5f9a48')
    if (k % 9 === 0) R(ctx, x, y, 2, 2, k % 2 ? '#fff7d6' : '#ffe27a')
  }
}

function drawFence(ctx: Ctx) {
  const left = FX - 5
  const right = FX + GRID_W * T + 3
  const top = FY - 8
  const bottom = FY + GRID_H * T + 3
  R(ctx, left, top, right - left + 2, 2, '#a8723a')
  R(ctx, left, bottom, right - left + 2, 2, '#a8723a')
  R(ctx, left, top, 2, bottom - top + 2, '#a8723a')
  R(ctx, right, top, 2, bottom - top + 2, '#a8723a')
  for (let x = left; x <= right; x += 12) {
    R(ctx, x, top - 2, 3, 6, '#c9965a')
    R(ctx, x, bottom - 2, 3, 6, '#c9965a')
  }
  for (let y = top; y <= bottom; y += 12) {
    R(ctx, left, y - 1, 3, 5, '#c9965a')
    R(ctx, right, y - 1, 3, 5, '#c9965a')
  }
}

function drawTiles(ctx: Ctx, cells: Map<string, Memory>) {
  for (let c = 0; c < GRID_W; c++)
    for (let r = 0; r < GRID_H; r++) {
      const ox = FX + c * T
      const oy = FY + r * T
      const m = cells.get(`${c},${r}`)
      if (!m) {
        R(ctx, ox + 1, oy + 1, T - 2, T - 2, '#a97b47')
        R(ctx, ox + 1, oy + T - 2, T - 2, 1, '#93663a')
      } else if (m.fate === 'composted') {
        R(ctx, ox + 1, oy + 1, T - 2, T - 2, '#4a2f1c')
        for (let k = 0; k < 8; k++) {
          const h = hash(m.x * 31 + m.z * 7 + k)
          R(ctx, ox + 3 + (h % 18), oy + 3 + ((h >>> 5) % 18), 1, 1, k % 2 ? '#7a5636' : '#2e1c10')
        }
      } else {
        R(ctx, ox + 1, oy + 1, T - 2, T - 2, '#8a5a30')
        for (let y = oy + 4; y < oy + T - 2; y += 4) R(ctx, ox + 2, y, T - 4, 1, '#744a27')
        R(ctx, ox + 1, oy + T - 2, T - 2, 1, '#5e3a1d')
      }
    }
}

const sparkle = (ctx: Ctx, x: number, y: number) => {
  R(ctx, x, y - 1, 1, 3, '#ffffff')
  R(ctx, x - 1, y, 3, 1, '#ffffff')
}

function drawPlant(ctx: Ctx, m: Memory, day: number, now: number) {
  const { growth, s, w, cx, by, side } = geom(m, day)
  const sp = SPECIES[m.category]
  const alpha = s < 0.2 ? Math.max(0.2, s / 0.2) : 1
  ctx.globalAlpha = alpha
  R(ctx, cx - 4, by, 9, 2, 'rgba(0,0,0,0.25)')

  if (growth < 0.25) {
    R(ctx, cx - 2, by - 1, 4, 2, '#5e3a1d')
    R(ctx, cx - 1, by - 2, 2, 1, '#d9b36a')
  } else {
    const h = 3 + Math.round(11 * growth * (0.55 + 0.45 * s)) - Math.round(w * 3)
    const stem = mix(LEAF, '#8d8a4a', w)
    const dx = side * Math.round(w * 3)
    R(ctx, cx - 1, by - h, 2, h, stem)
    R(ctx, cx - 4, by - Math.floor(h * 0.55) - 1, 3, 2, stem)
    R(ctx, cx + 1, by - Math.floor(h * 0.4) - 2, 3, 2, mix(LEAF_DARK, '#8d8a4a', w))
    const top = by - h + Math.round(w * 3)
    if (growth < 0.6) {
      R(ctx, cx - 1 + dx, top - 3, 3, 3, mix(sp.p, LEAF, 0.35))
      R(ctx, cx + dx, top - 3, 1, 1, mix(sp.p, '#ffffff', 0.3))
    } else {
      drawHead(ctx, m.category, cx + dx, top + 1, w)
    }
    if (w > 0.15)
      for (let i = 0; i < 3; i++) {
        const t = ((now / 160 + i * 5) % 14) / 14
        ctx.globalAlpha = alpha * (1 - t)
        R(ctx, cx + dx + (i - 1) * 4 + side * 2, top + t * 12, 1, 1, mix(sp.p, DRY, 0.6))
      }
  }
  ctx.globalAlpha = 1
  if (m.recalls > 0 && day - m.lastUsed < 0.8 && Math.floor(now / 250) % 2 === 0) sparkle(ctx, cx + 7, by - 15)
}

function drawTree(ctx: Ctx, m: Memory, day: number, now: number) {
  const { age, s, w, cx, by } = geom(m, day)
  const k = 0.65 + 0.35 * clamp(age / 8, 0, 1)
  const rad = Math.round((6 + 3 * s) * k)
  const alpha = s < 0.2 ? Math.max(0.2, s / 0.2) : 1
  ctx.globalAlpha = alpha
  const base = mix('#3f9a3f', '#e3a23a', w)
  const dark = mix('#2c6e32', '#b9722a', w)
  const light = mix('#6cc24a', '#f2d06a', w)
  R(ctx, cx - rad - 1, by, rad * 2 + 3, 2, 'rgba(0,0,0,0.25)')
  R(ctx, cx - 1, by - 7, 3, 7, '#7a4d28')
  const cy = by - 6 - rad
  disc(ctx, cx, cy + 1, rad, dark)
  disc(ctx, cx - 1, cy - 1, rad - 1, base)
  R(ctx, cx - rad + 2, cy - rad + 3, 3, 1, light)
  R(ctx, cx - rad + 3, cy - rad + 2, 2, 1, light)
  R(ctx, cx + 1, cy - 1, 2, 1, light)
  m.children.forEach((_, i) => {
    const sx = cx + (i % 2 ? 1 : -1) * (rad + 1 + Math.floor(i / 2) * 3)
    disc(ctx, sx, by - 1, 2, dark)
    R(ctx, sx - 1, by - 3, 2, 1, base)
  })
  if (w > 0.15)
    for (let i = 0; i < 4; i++) {
      const t = ((now / 150 + i * 6) % 16) / 16
      ctx.globalAlpha = alpha * (1 - t)
      R(ctx, cx + (i - 1.5) * 4, cy + rad - 2 + t * 12, 2, 1, base)
    }
  ctx.globalAlpha = 1
  if (m.recalls > 0 && day - m.lastUsed < 0.8 && Math.floor(now / 250) % 2 === 0) sparkle(ctx, cx + rad, cy - rad)
}

function drawCompost(ctx: Ctx, m: Memory) {
  const { cx, by } = geom(m, 0)
  R(ctx, cx - 1, by - 4, 2, 4, '#f1e6c8')
  R(ctx, cx - 3, by - 7, 6, 3, '#d9534f')
  R(ctx, cx - 2, by - 8, 4, 1, '#d9534f')
  R(ctx, cx - 2, by - 6, 1, 1, '#ffffff')
  R(ctx, cx + 1, by - 7, 1, 1, '#ffffff')
  R(ctx, cx + 4, by - 1, 2, 2, '#5e8a3a')
}

function route(a: Memory, b: Memory) {
  const A = { x: FX + a.x * T + 12, y: FY + a.z * T + 14 }
  const B = { x: FX + b.x * T + 12, y: FY + b.z * T + 14 }
  return [A, { x: B.x, y: A.y }, B]
}

function drawLinks(ctx: Ctx, pairs: [Memory, Memory][]) {
  for (const [a, b] of pairs) {
    const pts = route(a, b)
    ctx.globalAlpha = clamp(Math.min(a.strength, b.strength) * 1.4, 0.3, 1)
    for (let i = 0; i < pts.length - 1; i++) {
      const [p, q] = [pts[i], pts[i + 1]]
      const len = Math.hypot(q.x - p.x, q.y - p.y)
      for (let d = 6; d < len - 4; d += 5) R(ctx, p.x + ((q.x - p.x) * d) / len, p.y + ((q.y - p.y) * d) / len, 2, 2, '#f2d58a')
    }
  }
  ctx.globalAlpha = 1
}

function drawBees(ctx: Ctx, pairs: [Memory, Memory][], now: number) {
  for (const [a, b] of pairs) {
    const pts = route(a, b)
    const l1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
    const l2 = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y)
    const total = l1 + l2 || 1
    const t = (((now / 6000 + a.x * 0.11 + b.z * 0.07) % 1) + 1) % 1
    const d = (t < 0.5 ? t * 2 : 2 - t * 2) * total // there and back
    const [p, q, f] = d < l1 ? [pts[0], pts[1], l1 ? d / l1 : 0] : [pts[1], pts[2], l2 ? (d - l1) / l2 : 0]
    const x = p.x + (q.x - p.x) * f
    const y = p.y + (q.y - p.y) * f - 7 + Math.sin(now / 160 + a.x) * 1.5
    R(ctx, x - 1, y, 3, 2, '#ffd84a')
    R(ctx, x, y, 1, 2, '#2a1f2d')
    R(ctx, x - 1, y - 1 - (Math.floor(now / 90) % 2), 2, 1, '#ffffff')
  }
}

function drawBrackets(ctx: Ctx, m: Memory, now: number) {
  if (Math.floor(now / 350) % 2) return
  const { ox, oy } = cellOrigin(m)
  for (const [x, y, sx, sy] of [[ox, oy, 1, 1], [ox + T - 1, oy, -1, 1], [ox, oy + T - 1, 1, -1], [ox + T - 1, oy + T - 1, -1, -1]]) {
    R(ctx, x, y, 1, 1, '#2a1f2d')
    for (let i = 0; i < 5; i++) {
      R(ctx, x + sx * i, y, 1, 1, '#ffffff')
      R(ctx, x, y + sy * i, 1, 1, '#ffffff')
    }
  }
}

function draw(ctx: Ctx, memories: Memory[], day: number, selectedId: string | null, now: number) {
  const things = memories.filter((m) => (m.fate === 'alive' || m.fate === 'composted') && !m.mergedInto)
  const cells = new Map(things.map((m) => [`${m.x},${m.z}`, m]))
  const alive = things.filter((m) => m.fate === 'alive')
  const pairs: [Memory, Memory][] = []
  for (const a of alive)
    for (const id of a.links) {
      const b = alive.find((o) => o.id === id)
      if (b && a.id < b.id) pairs.push([a, b])
    }

  drawBackground(ctx)
  drawFence(ctx)
  drawTiles(ctx, cells)
  drawLinks(ctx, pairs)
  for (const m of [...things].sort((a, b) => a.z - b.z || a.x - b.x)) {
    if (m.fate === 'composted') drawCompost(ctx, m)
    else if (m.tree) drawTree(ctx, m, day, now)
    else drawPlant(ctx, m, day, now)
  }
  drawBees(ctx, pairs, now)
  const sel = things.find((m) => m.id === selectedId)
  if (sel) drawBrackets(ctx, sel, now)
}

const labelOf = (m: Memory) => {
  if (m.fate === 'composted') return m.gist.split(' · ')[0].slice(0, 12)
  if (m.tree) return m.gist.split(' · ').slice(0, 2).join(' · ').slice(0, 18)
  const [a, b] = m.keywords
  return ((b && (a + ' ' + b).length <= 12 ? `${a} ${b}` : a) ?? '').slice(0, 12)
}

/** A flat little flower for the herbarium. */
export function PixelHead({ category, flat = false, size = 5 }: { category: Category; flat?: boolean; size?: number }) {
  const sp = SPECIES[category]
  return (
    <svg width={7 * size} height={5 * size} viewBox="0 0 7 5" shapeRendering="crispEdges" aria-hidden>
      {sp.head.flatMap((row, j) =>
        [...row].map((ch, i) =>
          ch === '.' ? null : <rect key={`${i}-${j}`} x={i} y={j} width={1} height={1} fill={flat ? mix(petalColor(sp, ch), '#b9a98a', 0.6) : petalColor(sp, ch)} />,
        ),
      )}
    </svg>
  )
}

export default function Garden({
  memories,
  day,
  selectedId,
  onSelect,
}: {
  memories: Memory[]
  day: number
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) draw(ctx, memories, day, selectedId, performance.now())
  })

  const things = memories.filter((m) => (m.fate === 'alive' || m.fate === 'composted') && !m.mergedInto)

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const lx = ((e.clientX - rect.left) / rect.width) * CW
    const ly = ((e.clientY - rect.top) / rect.height) * CH
    const c = Math.floor((lx - FX) / T)
    const r = Math.floor((ly - FY) / T)
    // sprites reach up into the tile above, so also accept a click just above a plant
    const hit = things.find((m) => m.x === c && m.z === r) ?? things.find((m) => m.x === c && m.z === r + 1)
    onSelect(hit ? hit.id : null)
  }

  return (
    <div className="garden-wrap">
      <canvas ref={ref} width={CW} height={CH} className="garden" onClick={onClick} role="img" aria-label="A pixel-art field showing the agent’s memories" />
      {things.map((m) => {
        const { ox, oy } = cellOrigin(m)
        return (
          <span key={m.id} className="plant-label" style={{ left: `${((ox + 12) / CW) * 100}%`, top: `${((oy + 21) / CH) * 100}%` }}>
            {labelOf(m)}
          </span>
        )
      })}
      {!things.length && <div className="empty">The field is empty. Tell the agent something.</div>}
    </div>
  )
}
