import { Category, Memory, WILT_BELOW, ageOf } from '../engine/memory'

export const W = 1000
export const H = 560
export const G = 410 // ground line

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`
}

export const SPECIES: Record<Category, { petal: string; center: string; petals: number; r: number; label: string }> = {
  person: { petal: '#f0ebe4', center: '#e8d5b0', petals: 8, r: 15, label: 'People' },
  preference: { petal: '#e8d5b0', center: '#b8935a', petals: 6, r: 14, label: 'Preferences' },
  place: { petal: '#a9d9b4', center: '#2c3e2d', petals: 5, r: 13, label: 'Places' },
  work: { petal: '#7a9e7e', center: '#e8d5b0', petals: 4, r: 15, label: 'Work' },
  plan: { petal: '#c8dbc9', center: '#7a9e7e', petals: 12, r: 11, label: 'Plans' },
  fact: { petal: '#dfe9d8', center: '#8a7a5a', petals: 3, r: 13, label: 'Facts' },
}

const WILTED = '#9a8a68'
const STEM = '#5f8a63'

// where the "head" of a memory sits; used for flowers and for the pollen arcs
export function geom(m: Memory, day: number) {
  const age = ageOf(m, day)
  const growth = clamp(age / 3, 0, 1)
  const s = clamp(m.strength, 0, 1)
  const w = clamp((WILT_BELOW - s) / 0.3, 0, 1)
  if (m.tree) {
    const trunk = 70 + 50 * clamp(age / 8, 0, 1)
    return { x: m.x, y: G - trunk - 22, w, growth, h: trunk, side: 1 }
  }
  const h = 22 + 98 * growth * (0.55 + 0.45 * s)
  const side = Math.floor(m.x) % 2 === 0 ? 1 : -1
  return { x: m.x + side * w * h * 0.45, y: G - h * (1 - 0.5 * w) + 28 * w, w, growth, h, side }
}

export function FlowerHead({ category, scale = 1, wilt = 0, flat = false }: { category: Category; scale?: number; wilt?: number; flat?: boolean }) {
  const sp = SPECIES[category]
  const petal = flat ? mix(sp.petal, '#b9a98a', 0.5) : mix(sp.petal, WILTED, wilt * 0.85)
  const center = flat ? '#8a7a5a' : mix(sp.center, '#6f6248', wilt)
  return (
    <g transform={`scale(${scale})`}>
      {Array.from({ length: sp.petals }, (_, i) => (
        <ellipse
          key={i}
          cx={0}
          cy={-sp.r * 0.75}
          rx={sp.r * (sp.petals > 8 ? 0.28 : 0.5)}
          ry={sp.r * 0.8}
          fill={petal}
          transform={`rotate(${(i * 360) / sp.petals})`}
        />
      ))}
      <circle r={sp.r * 0.42} fill={center} />
    </g>
  )
}

function Plant({ m, day, selected, onSelect }: { m: Memory; day: number; selected: boolean; onSelect: () => void }) {
  const { x, y, w, growth, h, side } = geom(m, day)
  const s = clamp(m.strength, 0, 1)
  const opacity = s < 0.2 ? Math.max(0.12, s / 0.2) : 1
  const stem = mix(STEM, WILTED, w)
  const bud = growth < 0.6
  const recent = m.recalls > 0 && day - m.lastUsed < 0.8
  const leafY = G - h * 0.45
  const sp = SPECIES[m.category]
  const headScale = (0.4 + 0.6 * growth) * (1 - 0.45 * w)

  return (
    <g opacity={opacity} onClick={onSelect} style={{ cursor: 'pointer' }}>
      <rect x={m.x - 26} y={G - 150} width={52} height={160} fill="transparent" />
      {growth < 0.15 && <ellipse cx={m.x} cy={G + 1} rx={8} ry={3.5} fill="#4a3a2c" />}
      <path d={`M${m.x},${G} Q${m.x},${G - h * 0.7} ${x},${y}`} stroke={stem} strokeWidth={3} fill="none" strokeLinecap="round" />
      <ellipse cx={m.x - 8} cy={leafY} rx={9} ry={4} fill={stem} transform={`rotate(-30 ${m.x - 8} ${leafY})`} />
      <ellipse cx={m.x + 8} cy={leafY - 14} rx={9} ry={4} fill={stem} transform={`rotate(30 ${m.x + 8} ${leafY - 14})`} />
      <g transform={`translate(${x},${y}) rotate(${w * side * 40})`}>
        {recent && <circle r={sp.r * 1.8} className="pulse" fill="none" stroke="#e8d5b0" strokeWidth={1.5} />}
        {bud ? <circle r={4 + 6 * growth} fill={mix(sp.petal, STEM, 0.35)} /> : <FlowerHead category={m.category} scale={headScale} wilt={w} />}
      </g>
      {w > 0.15 &&
        [0, 1, 2].map((i) => (
          <ellipse
            key={i}
            className="fall"
            cx={x}
            cy={y + 4}
            rx={3.5}
            ry={2}
            fill={mix(sp.petal, WILTED, 0.6)}
            style={{ animationDelay: `${i * 1.1}s`, ['--dx' as string]: `${(i - 1) * 14 + side * 10}px` }}
          />
        ))}
      {selected && <circle cx={x} cy={y} r={sp.r * 2.2} fill="none" stroke="#e8d5b0" strokeDasharray="3 4" opacity={0.9} />}
      <text x={m.x} y={G + 20} textAnchor="middle" className="plant-label">
        {labelOf(m)}
      </text>
    </g>
  )
}

const labelOf = (m: Memory) => {
  const [a, b] = m.keywords
  const two = b && (a + ' ' + b).length <= 13 ? `${a} ${b}` : a
  return (two ?? '').slice(0, 13)
}

function Tree({ m, day, selected, onSelect }: { m: Memory; day: number; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = geom(m, day)
  const s = clamp(m.strength, 0, 1)
  const r = 34 + 24 * s
  const leaf = mix('#5f8a63', '#c9a66b', w)
  const leaf2 = mix('#7a9e7e', '#b8935a', w)
  const opacity = s < 0.2 ? Math.max(0.12, s / 0.2) : 1
  const recent = day - m.lastUsed < 0.8 && m.recalls > 0

  return (
    <g opacity={opacity} onClick={onSelect} style={{ cursor: 'pointer' }}>
      <rect x={m.x - 70} y={G - h - 90} width={140} height={h + 100} fill="transparent" />
      <path d={`M${m.x - 8},${G} L${m.x - 4},${y + 10} L${m.x + 4},${y + 10} L${m.x + 8},${G} Z`} fill="#7a6a52" />
      <circle cx={x - r * 0.62} cy={y + 12} r={r * 0.68} fill={leaf2} />
      <circle cx={x + r * 0.62} cy={y + 12} r={r * 0.68} fill={leaf2} />
      <circle cx={x} cy={y - 8} r={r} fill={leaf} />
      <circle cx={x - r * 0.3} cy={y - 14} r={r * 0.45} fill={mix('#5f8a63', '#c9a66b', w * 0.8 + 0.1)} opacity={0.6} />
      {recent && <circle cx={x} cy={y} r={r * 1.2} className="pulse" fill="none" stroke="#e8d5b0" strokeWidth={1.5} />}
      {m.children.map((id, i) => (
        <circle key={id} cx={m.x + (i % 2 ? 1 : -1) * (16 + Math.floor(i / 2) * 11)} cy={G - 3} r={3.6} fill="#8a7a5a" />
      ))}
      {w > 0.15 &&
        [0, 1, 2, 3].map((i) => (
          <ellipse
            key={i}
            className="fall"
            cx={x + (i - 1.5) * r * 0.5}
            cy={y + r * 0.6}
            rx={4}
            ry={2.2}
            fill={leaf}
            style={{ animationDelay: `${i * 0.9}s`, ['--dx' as string]: `${(i - 1.5) * 10}px` }}
          />
        ))}
      {selected && <circle cx={x} cy={y} r={r * 1.35} fill="none" stroke="#e8d5b0" strokeDasharray="3 4" />}
      <text x={m.x} y={G + 20} textAnchor="middle" className="plant-label tree-label">
        {m.gist.slice(0, 20)}
      </text>
    </g>
  )
}

function Mound({ m, selected, onSelect }: { m: Memory; selected: boolean; onSelect: () => void }) {
  return (
    <g onClick={onSelect} style={{ cursor: 'pointer' }}>
      <rect x={m.x - 24} y={G - 12} width={48} height={26} fill="transparent" />
      <ellipse cx={m.x} cy={G + 1} rx={m.tree ? 26 : 18} ry={m.tree ? 9 : 6.5} fill="#4a3a2c" />
      <circle cx={m.x - 6} cy={G - 2} r={1.6} fill="#6b563f" />
      <circle cx={m.x + 5} cy={G} r={1.4} fill="#6b563f" />
      <circle cx={m.x + 1} cy={G - 4} r={1.2} fill="#8a7a5a" />
      {selected && <ellipse cx={m.x} cy={G + 1} rx={28} ry={11} fill="none" stroke="#e8d5b0" strokeDasharray="3 4" />}
      <text x={m.x} y={G + 20} textAnchor="middle" className="plant-label soil-label">
        {m.gist.split(' · ')[0].slice(0, 12)}
      </text>
    </g>
  )
}

function Pollen({ a, b, day, now }: { a: Memory; b: Memory; day: number; now: number }) {
  const ga = geom(a, day)
  const gb = geom(b, day)
  const mx = (ga.x + gb.x) / 2
  const my = Math.min(ga.y, gb.y) - 36 - Math.abs(ga.x - gb.x) * 0.12
  const strength = Math.min(a.strength, b.strength)
  const o = clamp(strength * 0.5, 0.08, 0.45)
  const phase = ((now / 5200 + (a.x * 0.013 + b.x * 0.007)) % 1 + 1) % 1
  const t = phase
  const px = (1 - t) * (1 - t) * ga.x + 2 * (1 - t) * t * mx + t * t * gb.x
  const py = (1 - t) * (1 - t) * ga.y + 2 * (1 - t) * t * my + t * t * gb.y
  return (
    <g pointerEvents="none">
      <path d={`M${ga.x},${ga.y} Q${mx},${my} ${gb.x},${gb.y}`} fill="none" stroke="#e8d5b0" strokeWidth={1} strokeDasharray="2 6" opacity={o} />
      <circle cx={px} cy={py} r={2.4} fill="#e8d5b0" opacity={clamp(strength, 0.2, 0.9)} />
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
  const alive = memories.filter((m) => m.fate === 'alive' && !m.mergedInto)
  const composted = memories.filter((m) => m.fate === 'composted' && !m.mergedInto)

  const pairs: [Memory, Memory][] = []
  for (const a of alive)
    for (const id of a.links) {
      const b = alive.find((o) => o.id === id)
      if (b && a.id < b.id) pairs.push([a, b])
    }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="garden" role="img" aria-label="A garden showing the agent’s memories" onClick={() => onSelect(null)}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2e21" />
          <stop offset="1" stopColor="#3a5340" />
        </linearGradient>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b2f25" />
          <stop offset="1" stopColor="#2a2119" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      <path d={`M0,${G - 50} Q180,${G - 110} 360,${G - 55} T720,${G - 60} T1000,${G - 45} V${G} H0 Z`} fill="#34503a" opacity={0.7} />
      <path d={`M0,${G - 20} Q250,${G - 60} 520,${G - 24} T1000,${G - 28} V${G} H0 Z`} fill="#40604a" opacity={0.9} />
      <rect y={G} width={W} height={H - G} fill="url(#soil)" />
      <rect y={G - 4} width={W} height={6} fill="#4f7355" />

      <g onClick={(e) => e.stopPropagation()}>
        {pairs.map(([a, b]) => (
          <Pollen key={a.id + b.id} a={a} b={b} day={day} now={now} />
        ))}
        {composted.map((m) => (
          <Mound key={m.id} m={m} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
        ))}
        {alive.map((m) =>
          m.tree ? (
            <Tree key={m.id} m={m} day={day} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
          ) : (
            <Plant key={m.id} m={m} day={day} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
          ),
        )}
      </g>

      {!alive.length && !composted.length && (
        <text x={W / 2} y={G - 90} textAnchor="middle" className="empty">
          The garden is empty. Tell the agent something.
        </text>
      )}
    </svg>
  )
}
