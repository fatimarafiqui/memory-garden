import { FADING_BELOW, Mem, Verdict, statusOf } from '../trace/replay'

export const W = 1000
export const H = 520
const G = 392 // ground line

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${[c(r1, r2), c(g1, g2), c(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export const LAYER_COLORS: Record<string, string> = {
  'short-term': '#9fd3e0',
  episodic: '#8fd0a8',
  semantic: '#aaa7ec',
  procedural: '#e3a9c2',
}
const FALLBACK = ['#e9c37a', '#86b4ff', '#e68c8c', '#c9d99a']
export const colorOf = (layer: string, layers: string[]) => LAYER_COLORS[layer] ?? FALLBACK[Math.max(0, layers.indexOf(layer)) % FALLBACK.length]

const WIN = '#7fe0bd'
const LOSE = '#e79a9a'
const STEM = '#5d8f7c'
const DRY = '#8f8a70'

type Pos = { x: number; lane: number; scale: number }

function shape(m: Mem, p: Pos) {
  const k = p.scale * (m.mergedInto ? 0.72 : 1)
  const r = Math.min(m.retrievals, 8)
  const s = clamp(m.strength, 0, 1)
  const w = clamp((FADING_BELOW - s) / 0.3, 0, 1)
  if (m.consolidated && !m.mergedInto) {
    const trunk = 74 * k
    const rad = (24 + 4 * r) * k
    return { tree: true, x: p.x, hx: p.x, hy: G - trunk - rad * 0.55, R: rad, h: trunk, w, side: 1, k }
  }
  const h = (58 + 14 * r) * k
  const side = m.id.charCodeAt(m.id.length - 1) % 2 ? 1 : -1
  return { tree: false, x: p.x, hx: p.x + side * w * h * 0.3, hy: G - h * (1 - 0.45 * w) + 22 * w, R: (10 + 2.6 * r) * k, h, w, side, k }
}

function Bloom({ m, p, color, fresh }: { m: Mem; p: Pos; color: string; fresh: boolean }) {
  const g = shape(m, p)
  if (statusOf(m) === 'forgotten')
    return (
      <g>
        <path d={`M${p.x},${G} q4,-10 14,-10`} stroke={DRY} strokeWidth={2} fill="none" />
        <circle cx={p.x + 16} cy={G - 10} r={4} fill={DRY} />
      </g>
    )
  if (g.tree) {
    const canopy = mix(color, '#24453c', 0.5)
    const lit = mix(color, '#24453c', 0.2)
    return (
      <g className={fresh ? 'sprout' : undefined}>
        <path d={`M${g.x - 5},${G} L${g.x - 3},${g.hy + 8} L${g.x + 3},${g.hy + 8} L${g.x + 5},${G} Z`} fill="#6c6452" />
        <circle cx={g.x - g.R * 0.6} cy={g.hy + g.R * 0.3} r={g.R * 0.66} fill={canopy} />
        <circle cx={g.x + g.R * 0.6} cy={g.hy + g.R * 0.3} r={g.R * 0.66} fill={canopy} />
        <circle cx={g.x} cy={g.hy} r={g.R} fill={lit} />
        <circle cx={g.x - g.R * 0.3} cy={g.hy - g.R * 0.25} r={g.R * 0.38} fill={color} opacity={0.35} />
      </g>
    )
  }
  const stem = mix(STEM, DRY, g.w)
  const petal = mix(color, DRY, g.w * 0.8)
  const leafY = G - g.h * 0.45
  return (
    <g className={fresh ? 'sprout' : undefined}>
      <path d={`M${g.x},${G} Q${g.x},${G - g.h * 0.7} ${g.hx},${g.hy}`} stroke={stem} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <ellipse cx={g.x - 7} cy={leafY} rx={8 * g.k} ry={3.5 * g.k} fill={stem} transform={`rotate(-30 ${g.x - 7} ${leafY})`} />
      <ellipse cx={g.x + 7} cy={leafY - 12} rx={8 * g.k} ry={3.5 * g.k} fill={stem} transform={`rotate(30 ${g.x + 7} ${leafY - 12})`} />
      <g transform={`translate(${g.hx},${g.hy}) rotate(${g.w * g.side * 38})`}>
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse key={i} cy={-g.R * 0.7} rx={g.R * 0.42} ry={g.R * 0.78} fill={petal} transform={`rotate(${i * 60})`} />
        ))}
        <circle r={g.R * 0.38} fill={mix('#efe7cf', DRY, g.w)} />
      </g>
    </g>
  )
}

export interface Overlay {
  query: string
  turn: number
  verdicts: Verdict[]
}

export default function Garden({
  mems,
  pos,
  layers,
  laneWidth,
  cursor,
  overlay,
  selectedId,
  onSelect,
}: {
  mems: Map<string, Mem>
  pos: Map<string, Pos>
  layers: string[]
  laneWidth: number
  cursor: number
  overlay: Overlay | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const list = [...mems.values()].filter((m) => pos.has(m.id))
  const verdictOf = new Map(overlay?.verdicts.map((v) => [v.id, v]))
  const qx = W / 2
  const qy = 52
  const qText = overlay ? `Turn ${overlay.turn} · “${overlay.query.length > 64 ? overlay.query.slice(0, 63) + '…' : overlay.query}”` : ''
  const qW = Math.min(620, 40 + qText.length * 6.6)

  const opacityOf = (m: Mem) => {
    const st = statusOf(m)
    let o = st === 'forgotten' ? 0.22 : st === 'merged' ? 0.38 : 0.32 + 0.68 * clamp(m.strength, 0, 1)
    if (overlay && !verdictOf.has(m.id)) o *= 0.3
    return o
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="garden" role="img" aria-label="Memory garden: each plant is one memory" onClick={() => onSelect(null)}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1d1e" />
          <stop offset="1" stopColor="#173032" />
        </linearGradient>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2a28" />
          <stop offset="1" stopColor="#121d1c" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      {[80, 160, 240, 320].map((y) => (
        <line key={y} x1={0} x2={W} y1={y} y2={y} stroke="#cfe6df" strokeOpacity={0.045} strokeDasharray="2 6" />
      ))}
      <path d={`M0,${G - 46} Q200,${G - 96} 400,${G - 52} T800,${G - 58} T1000,${G - 44} V${G} H0 Z`} fill="#1a3433" />
      <path d={`M0,${G - 18} Q260,${G - 52} 540,${G - 22} T1000,${G - 26} V${G} H0 Z`} fill="#1e3b38" />
      <rect y={G} width={W} height={H - G} fill="url(#soil)" />
      <rect y={G - 2} width={W} height={3} fill="#2c4f48" />

      {layers.map((layer, lane) => {
        const x0 = 30 + lane * laneWidth
        const live = list.filter((m) => m.layer === layer && statusOf(m) !== 'merged' && statusOf(m) !== 'forgotten').length
        return (
          <g key={layer} pointerEvents="none">
            {lane > 0 && <line x1={x0} x2={x0} y1={G + 8} y2={H - 8} stroke="#cfe6df" strokeOpacity={0.08} />}
            <rect x={x0 + laneWidth / 2 - 4} y={H - 30} width={8} height={8} rx={2} fill={colorOf(layer, layers)} />
            <text x={x0 + laneWidth / 2} y={H - 12} textAnchor="middle" className="lane-label">
              {layer.toUpperCase()} · {live}
            </text>
          </g>
        )
      })}

      {/* consolidation vines */}
      {list
        .filter((m) => m.consolidated)
        .flatMap((parent) =>
          parent.children.map((cid) => {
            const child = mems.get(cid)
            const pp = pos.get(parent.id)
            const cp = child && pos.get(cid)
            if (!child || !pp || !cp) return null
            const a = shape(parent, pp)
            const b = shape(child, cp)
            const midY = Math.min(a.hy, b.hy) - 30
            return (
              <path
                key={parent.id + cid}
                d={`M${a.hx},${a.hy} Q${(a.hx + b.hx) / 2},${midY} ${b.hx},${b.hy}`}
                pathLength={1}
                className={parent.bornIdx === cursor - 1 ? 'vine vine-in' : 'vine'}
                stroke={colorOf(parent.layer, layers)}
                opacity={overlay ? 0.15 : 0.45}
              />
            )
          }),
        )}

      {/* retrieval replay: query → candidates */}
      {overlay &&
        overlay.verdicts.map((v) => {
          const m = mems.get(v.id)
          const p = pos.get(v.id)
          if (!m || !p) return null
          const g = shape(m, p)
          return (
            <path
              key={'q' + v.id}
              d={`M${qx},${qy + 14} C${qx},${qy + 90} ${g.hx},${g.hy - 90} ${g.hx},${g.hy - g.R - 2}`}
              fill="none"
              stroke={v.won ? WIN : LOSE}
              strokeWidth={0.8 + v.score * 2.6}
              strokeOpacity={0.2 + v.score * 0.55}
              strokeDasharray={v.won ? undefined : '4 5'}
              pointerEvents="none"
            />
          )
        })}

      <g onClick={(e) => e.stopPropagation()}>
        {list
          .sort((a, b) => Number(!!b.mergedInto) - Number(!!a.mergedInto))
          .map((m) => {
            const p = pos.get(m.id)!
            const g = shape(m, p)
            const v = verdictOf.get(m.id)
            return (
              <g key={m.id} opacity={opacityOf(m)} onClick={() => onSelect(m.id)} style={{ cursor: 'pointer' }}>
                <title>{`${m.id} · ${m.layer} · ${statusOf(m)}\n${m.text}`}</title>
                <rect x={p.x - 26} y={g.hy - g.R - 10} width={52} height={G - g.hy + g.R + 28} fill="transparent" />
                <Bloom m={m} p={p} color={colorOf(m.layer, layers)} fresh={m.bornIdx === cursor - 1} />
                {v?.won && <circle cx={g.hx} cy={g.hy} r={g.R * 1.5} className="ring" fill="none" stroke={WIN} strokeWidth={1.5} />}
              </g>
            )
          })}
      </g>

      {/* labels and badges on top */}
      {list.map((m) => {
        const p = pos.get(m.id)!
        const g = shape(m, p)
        const v = verdictOf.get(m.id)
        const sel = m.id === selectedId
        return (
          <g key={'l' + m.id} pointerEvents="none">
            {sel && <circle cx={g.hx} cy={g.hy} r={g.R * 1.9 + 4} fill="none" stroke="#e8f3ef" strokeDasharray="3 4" strokeWidth={1.2} />}
            <text x={p.x} y={G + 20} textAnchor="middle" className={`id-label ${sel ? 'sel' : ''} ${m.mergedInto ? 'merged' : ''}`} opacity={overlay && !v ? 0.35 : 1}>
              {m.id}
            </text>
            {v && (
              <g transform={`translate(${g.hx},${g.hy - g.R - 18 - (v.rank % 2 ? 0 : 22)})`}>
                <rect x={-22} y={-9} width={44} height={18} rx={9} fill="#0f1d1e" stroke={v.won ? WIN : LOSE} strokeWidth={1} />
                <text y={4} textAnchor="middle" className="score" fill={v.won ? WIN : LOSE}>
                  {v.won ? '✓' : '✕'} {v.score.toFixed(2)}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {overlay && (
        <g pointerEvents="none">
          <rect x={qx - qW / 2} y={qy - 14} width={qW} height={28} rx={14} fill="#e8f3ef" />
          <text x={qx} y={qy + 4.5} textAnchor="middle" className="query">
            {qText}
          </text>
        </g>
      )}

      {!list.length && (
        <text x={W / 2} y={G - 120} textAnchor="middle" className="empty">
          No memories yet at this point in the trace. Scrub forward ▸
        </text>
      )}
    </svg>
  )
}
