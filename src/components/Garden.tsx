import { Category, GRID, Memory, WILT_BELOW, ageOf } from '../engine/memory'

// Look: an isometric block of garden, inspired by "Garden Blocks" by Guillaume Kurkdjian
// (lime ground, stacked-sphere topiary, terracotta plots, yellow paths, halftone shadows).

export const W = 1000
export const H = 560

const TW = 100
const TH = 50
const OX = 500
const OY = 56
const DEPTH = 36

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${[c(r1, r2), c(g1, g2), c(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const LEAF = '#2f7a3a'
const LEAF_DEEP = '#21602c'
const DRY = '#c9a24a'
const PATH = '#f4ec6a'
const TERRA = '#c98a55'

export const SPECIES: Record<Category, { petal: string; center: string; petals: number; r: number; label: string }> = {
  person: { petal: '#ffffff', center: '#f4c430', petals: 7, r: 14, label: 'People' },
  preference: { petal: '#ffd84a', center: '#e08a2e', petals: 5, r: 13, label: 'Preferences' },
  place: { petal: '#6fa8ff', center: '#ffffff', petals: 6, r: 13, label: 'Places' },
  work: { petal: '#ee9a72', center: '#fff0c0', petals: 4, r: 14, label: 'Work' },
  plan: { petal: '#f7a8c8', center: '#ffffff', petals: 9, r: 12, label: 'Plans' },
  fact: { petal: '#9fe3c0', center: '#2f7a3a', petals: 3, r: 13, label: 'Facts' },
}

const point = (u: number, v: number) => ({ x: OX + ((u - v) * TW) / 2, y: OY + ((u + v) * TH) / 2 })
const proj = (c: number, r: number) => point(c + 0.5, r + 0.5)

export function geom(m: Memory, day: number) {
  const { x: px, y: py } = proj(m.x, m.z)
  const age = ageOf(m, day)
  const growth = clamp(age / 3, 0, 1)
  const s = clamp(m.strength, 0, 1)
  const w = clamp((WILT_BELOW - s) / 0.3, 0, 1)
  if (m.tree) {
    const k = 0.65 + 0.35 * clamp(age / 8, 0, 1)
    const r1 = (24 + 8 * s) * k
    return { px, py, x: px, y: py - r1 * 2.9, w, growth, h: r1 * 3, side: 1, r1 }
  }
  const h = 14 + 54 * growth * (0.55 + 0.45 * s)
  const side = (m.x + m.z) % 2 === 0 ? 1 : -1
  return { px, py, x: px + side * w * h * 0.4, y: py - h * (1 - 0.5 * w) + 16 * w, w, growth, h, side, r1: 0 }
}

/** A little 3-tone ball: base, lit side, highlight. */
function Ball({ cx, cy, r, color, shade, light }: { cx: number; cy: number; r: number; color: string; shade: string; light: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={shade} />
      <circle cx={cx - r * 0.1} cy={cy - r * 0.12} r={r * 0.86} fill={color} />
      <ellipse cx={cx - r * 0.34} cy={cy - r * 0.38} rx={r * 0.3} ry={r * 0.2} fill={light} opacity={0.75} transform={`rotate(-30 ${cx - r * 0.34} ${cy - r * 0.38})`} />
    </g>
  )
}

export function FlowerHead({ category, scale = 1, wilt = 0, flat = false }: { category: Category; scale?: number; wilt?: number; flat?: boolean }) {
  const sp = SPECIES[category]
  const base = flat ? mix(sp.petal, '#b9a98a', 0.55) : mix(sp.petal, DRY, wilt * 0.8)
  const centre = flat ? '#8a7a5a' : mix(sp.center, '#8a6a30', wilt)
  const pr = sp.r * (sp.petals > 7 ? 0.3 : 0.4)
  const ring = sp.r * 0.68
  return (
    <g transform={`scale(${scale})`}>
      {Array.from({ length: sp.petals }, (_, i) => {
        const a = (i * Math.PI * 2) / sp.petals - Math.PI / 2
        return <Ball key={i} cx={Math.cos(a) * ring} cy={Math.sin(a) * ring * 0.85} r={pr} color={base} shade={mix(base, '#000000', 0.18)} light="#ffffff" />
      })}
      <Ball cx={0} cy={0} r={sp.r * 0.38} color={centre} shade={mix(centre, '#000000', 0.2)} light="#ffffff" />
    </g>
  )
}

const zoom = (px: number, py: number, k = 1.3) => `translate(${px} ${py}) scale(${k}) translate(${-px} ${-py})`

const diamond = (cx: number, cy: number, rx: number, ry: number) => `${cx - rx},${cy} ${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry}`

function Shadow({ x, y, rx }: { x: number; y: number; rx: number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={x + rx * 0.7} cy={y + 3} rx={rx} ry={rx * 0.42} fill="#8fb83f" opacity={0.55} />
      <ellipse cx={x + rx * 0.7} cy={y + 3} rx={rx} ry={rx * 0.42} fill="url(#dither)" opacity={0.7} />
    </g>
  )
}

const Plot = ({ px, py, color = TERRA }: { px: number; py: number; color?: string }) => (
  <g pointerEvents="none">
    <polygon points={diamond(px, py + 4, 28, 14)} fill={mix(color, '#000000', 0.22)} />
    <polygon points={diamond(px, py, 28, 14)} fill={color} />
  </g>
)

function Plant({ m, day, selected, onSelect }: { m: Memory; day: number; selected: boolean; onSelect: () => void }) {
  const { px, py, x, y, w, growth, h, side } = geom(m, day)
  const s = clamp(m.strength, 0, 1)
  const opacity = s < 0.2 ? Math.max(0.15, s / 0.2) : 1
  const stem = mix(LEAF, '#8d8a4a', w)
  const bud = growth < 0.6
  const recent = m.recalls > 0 && day - m.lastUsed < 0.8
  const sp = SPECIES[m.category]
  const headScale = (0.45 + 0.55 * growth) * (1 - 0.4 * w)
  const leafY = py - h * 0.4

  return (
    <g opacity={opacity} onClick={onSelect} style={{ cursor: 'pointer' }} transform={zoom(px, py)}>
      <rect x={px - 32} y={py - 90} width={64} height={110} fill="transparent" />
      <Plot px={px} py={py} />
      <Shadow x={px} y={py} rx={14 + h * 0.12} />
      <path d={`M${px},${py} Q${px},${py - h * 0.7} ${x},${y}`} stroke={stem} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <ellipse cx={px - 8} cy={leafY} rx={8} ry={3.6} fill={stem} transform={`rotate(-28 ${px - 8} ${leafY})`} />
      <ellipse cx={px + 8} cy={leafY - 12} rx={8} ry={3.6} fill={mix(stem, LEAF_DEEP, 0.4)} transform={`rotate(28 ${px + 8} ${leafY - 12})`} />
      <g transform={`translate(${x},${y}) rotate(${w * side * 38})`}>
        {recent && <ellipse rx={sp.r * 2} ry={sp.r * 1.5} className="pulse" fill="none" stroke="#ffffff" strokeWidth={2} />}
        {bud ? <Ball cx={0} cy={0} r={4 + 6 * growth} color={mix(sp.petal, LEAF, 0.3)} shade={mix(sp.petal, LEAF, 0.6)} light="#ffffff" /> : <FlowerHead category={m.category} scale={headScale} wilt={w} />}
      </g>
      {w > 0.15 &&
        [0, 1, 2].map((i) => (
          <circle key={i} className="fall" cx={x} cy={y + 4} r={2.8} fill={mix(sp.petal, DRY, 0.6)} style={{ animationDelay: `${i * 1.1}s`, ['--dx' as string]: `${(i - 1) * 14 + side * 10}px` }} />
        ))}
      {selected && <polygon points={diamond(px, py, 38, 19)} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeDasharray="5 5" />}
    </g>
  )
}

function Tree({ m, day, selected, onSelect }: { m: Memory; day: number; selected: boolean; onSelect: () => void }) {
  const { px, py, w, r1 } = geom(m, day)
  const s = clamp(m.strength, 0, 1)
  const opacity = s < 0.2 ? Math.max(0.15, s / 0.2) : 1
  const r2 = r1 * 0.74
  const r3 = r1 * 0.5
  const c1 = py - r1 * 0.8
  const c2 = c1 - r1 * 0.72 - r2 * 0.4
  const c3 = c2 - r2 * 0.7 - r3 * 0.4
  const base = mix(LEAF, DRY, w)
  const shade = mix(LEAF_DEEP, '#8a6a30', w)
  const light = mix('#6fc24a', '#e8d27a', w)
  const recent = m.recalls > 0 && day - m.lastUsed < 0.8

  return (
    <g opacity={opacity} onClick={onSelect} style={{ cursor: 'pointer' }} transform={zoom(px, py)}>
      <rect x={px - r1 - 6} y={c3 - r3 - 6} width={r1 * 2 + 12} height={py - c3 + r3 + 24} fill="transparent" />
      <Shadow x={px} y={py} rx={r1 * 1.15} />
      <Ball cx={px} cy={c1} r={r1} color={base} shade={shade} light={light} />
      <Ball cx={px} cy={c2} r={r2} color={base} shade={shade} light={light} />
      <Ball cx={px} cy={c3} r={r3} color={base} shade={shade} light={light} />
      {m.children.map((id, i) => (
        <Ball key={id} cx={px + (i % 2 ? 1 : -1) * (r1 * 0.95 + Math.floor(i / 2) * 6)} cy={py - 5 + (i % 2) * 5} r={7} color={mix(base, '#6fc24a', 0.25)} shade={shade} light={light} />
      ))}
      {recent && <ellipse cx={px} cy={c2} rx={r1 * 1.4} ry={r1 * 1.6} className="pulse" fill="none" stroke="#ffffff" strokeWidth={2} />}
      {w > 0.15 &&
        [0, 1, 2, 3].map((i) => (
          <circle key={i} className="fall" cx={px + (i - 1.5) * r1 * 0.5} cy={c1 + r1 * 0.3} r={3.2} fill={base} style={{ animationDelay: `${i * 0.9}s`, ['--dx' as string]: `${(i - 1.5) * 10}px` }} />
        ))}
      {selected && <polygon points={diamond(px, py, 38, 19)} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeDasharray="5 5" />}
    </g>
  )
}

function Mound({ m, selected, onSelect }: { m: Memory; selected: boolean; onSelect: () => void }) {
  const { x: px, y: py } = proj(m.x, m.z)
  return (
    <g onClick={onSelect} style={{ cursor: 'pointer' }} transform={zoom(px, py)}>
      <rect x={px - 32} y={py - 18} width={64} height={40} fill="transparent" />
      <Plot px={px} py={py} color="#8a5a3a" />
      <ellipse cx={px} cy={py - 2} rx={13} ry={5.5} fill="#6b4328" />
      {[[-9, 0], [7, 2], [2, -5], [-3, 4], [11, -2]].map(([dx, dy], i) => (
        <circle key={i} cx={px + dx} cy={py + dy} r={1.5} fill={i % 2 ? '#b98a5a' : '#4a2f1c'} />
      ))}
      {selected && <polygon points={diamond(px, py, 38, 19)} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeDasharray="5 5" />}
    </g>
  )
}

const labelOf = (m: Memory) => {
  if (m.fate === 'composted') return m.gist.split(' · ')[0].slice(0, 12)
  if (m.tree) return m.gist.split(' · ').slice(0, 2).join(' · ').slice(0, 20)
  const [a, b] = m.keywords
  return ((b && (a + ' ' + b).length <= 13 ? `${a} ${b}` : a) ?? '').slice(0, 13)
}

function Label({ m }: { m: Memory }) {
  const { x: px, y: py } = proj(m.x, m.z)
  const t = labelOf(m)
  const wd = t.length * 5.4 + 12
  return (
    <g pointerEvents="none">
      <rect x={px - wd / 2} y={py + 20} width={wd} height={16} rx={8} fill="#ffffff" opacity={0.85} />
      <text x={px} y={py + 31.5} textAnchor="middle" className="plant-label">
        {t}
      </text>
    </g>
  )
}

function Pollen({ a, b, day, now }: { a: Memory; b: Memory; day: number; now: number }) {
  const ga = geom(a, day)
  const gb = geom(b, day)
  const strength = Math.min(a.strength, b.strength)
  const t = (((now / 5200 + (a.x * 0.13 + b.z * 0.07)) % 1) + 1) % 1
  const mx = (ga.px + gb.px) / 2
  const my = Math.min(ga.y, gb.y) - 30
  const hx = (1 - t) * (1 - t) * ga.x + 2 * (1 - t) * t * mx + t * t * gb.x
  const hy = (1 - t) * (1 - t) * ga.y + 2 * (1 - t) * t * my + t * t * gb.y
  return (
    <g pointerEvents="none">
      <circle cx={hx} cy={hy} r={3} fill="#ffffff" opacity={clamp(strength + 0.2, 0.3, 1)} />
      <circle cx={hx} cy={hy} r={5.5} fill="#ffffff" opacity={0.25} />
    </g>
  )
}

function PathLine({ a, b }: { a: Memory; b: Memory }) {
  const pa = proj(a.x, a.z)
  const pb = proj(b.x, b.z)
  const o = clamp(Math.min(a.strength, b.strength) * 1.3, 0.25, 1)
  return (
    <g pointerEvents="none" opacity={o}>
      <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#d9cf45" strokeWidth={12} strokeLinecap="round" />
      <line x1={pa.x} y1={pa.y - 1} x2={pb.x} y2={pb.y - 1} stroke={PATH} strokeWidth={9} strokeLinecap="round" />
    </g>
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
  const now = performance.now()
  const things = memories.filter((m) => (m.fate === 'alive' || m.fate === 'composted') && !m.mergedInto)
  const alive = things.filter((m) => m.fate === 'alive')
  const order = [...things].sort((a, b) => a.x + a.z - (b.x + b.z) || a.x - b.x)

  const pairs: [Memory, Memory][] = []
  for (const a of alive)
    for (const id of a.links) {
      const b = alive.find((o) => o.id === id)
      if (b && a.id < b.id) pairs.push([a, b])
    }

  const T = point(0, 0)
  const R = point(GRID, 0)
  const B = point(GRID, GRID)
  const L = point(0, GRID)
  const grid = Array.from({ length: GRID - 1 }, (_, i) => i + 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="garden" role="img" aria-label="An isometric garden showing the agent’s memories" onClick={() => onSelect(null)}>
      <defs>
        <radialGradient id="bg" cx="0.5" cy="0.45" r="0.8">
          <stop offset="0" stopColor="#e3f1a6" />
          <stop offset="1" stopColor="#b9d85a" />
        </radialGradient>
        <linearGradient id="top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c8e272" />
          <stop offset="1" stopColor="#a6cf4a" />
        </linearGradient>
        <pattern id="dither" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1.3" cy="1.3" r="1.1" fill="#3f7f2c" />
          <circle cx="3.8" cy="3.8" r="0.8" fill="#3f7f2c" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#bg)" />

      {/* the block */}
      <ellipse cx={OX + 30} cy={B.y + DEPTH + 16} rx={380} ry={34} fill="#6e9a2c" opacity={0.35} />
      <polygon points={`${L.x},${L.y} ${B.x},${B.y} ${B.x},${B.y + DEPTH} ${L.x},${L.y + DEPTH}`} fill="#b7794a" />
      <polygon points={`${R.x},${R.y} ${B.x},${B.y} ${B.x},${B.y + DEPTH} ${R.x},${R.y + DEPTH}`} fill="#9a6339" />
      <polygon points={`${T.x},${T.y} ${R.x},${R.y} ${B.x},${B.y} ${L.x},${L.y}`} fill="url(#top)" />
      {grid.map((i) => {
        const a = point(i, 0)
        const b = point(i, GRID)
        const c = point(0, i)
        const d = point(GRID, i)
        return (
          <g key={i} stroke="#ffffff" strokeOpacity={0.16} strokeWidth={1.5}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} />
          </g>
        )
      })}

      <g onClick={(e) => e.stopPropagation()}>
        {pairs.map(([a, b]) => (
          <PathLine key={a.id + b.id} a={a} b={b} />
        ))}
        {order.map((m) =>
          m.fate === 'composted' ? (
            <Mound key={m.id} m={m} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
          ) : m.tree ? (
            <Tree key={m.id} m={m} day={day} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
          ) : (
            <Plant key={m.id} m={m} day={day} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
          ),
        )}
        {pairs.map(([a, b]) => (
          <Pollen key={'p' + a.id + b.id} a={a} b={b} day={day} now={now} />
        ))}
        {order.map((m) => (
          <Label key={'l' + m.id} m={m} />
        ))}
      </g>

      {!things.length && (
        <g pointerEvents="none">
          <rect x={OX - 150} y={OY + 180} width={300} height={34} rx={17} fill="#ffffff" opacity={0.85} />
          <text x={OX} y={OY + 202} textAnchor="middle" className="empty">
            Bare ground. Tell the agent something.
          </text>
        </g>
      )}
    </svg>
  )
}
