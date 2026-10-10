import { FADING_BELOW, Mem, Verdict, statusOf } from '../trace/replay'
import type { TraceEvent } from '../trace/types'

// A light, hand-inked garden: each layer is its own species, outlines wobble slightly
// like pen on paper, and a margin note explains the most interesting thing on screen.

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

export const INK = '#2c3e2d'
const STEM = '#5f8a63'
const DRY = '#b5a27a'
const WIN = '#3f8f63'
const LOSE = '#c4776b'
const NOTE = '#8a6d3b'

type Species = 'sprig' | 'daisy' | 'tulip' | 'lavender'
const SPECIES: Record<string, Species> = { 'short-term': 'sprig', episodic: 'daisy', semantic: 'tulip', procedural: 'lavender' }
export const LAYER_COLORS: Record<string, string> = {
  'short-term': '#8fb7a0',
  episodic: '#f1e2c2',
  semantic: '#e0b45e',
  procedural: '#b3a0d4',
}
const FALLBACK = ['#d9a39a', '#9fb6d6', '#c9d99a']
export const colorOf = (layer: string, layers: string[]) => LAYER_COLORS[layer] ?? FALLBACK[Math.max(0, layers.indexOf(layer)) % FALLBACK.length]
const speciesOf = (layer: string): Species => SPECIES[layer] ?? 'daisy'

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

const line = { stroke: INK, strokeOpacity: 0.55, strokeWidth: 0.9 }

/** A flower head drawn at the origin. Also used, small, in the key. */
export function Head({ species, R, color, wilt = 0 }: { species: Species; R: number; color: string; wilt?: number }) {
  const fill = mix(color, DRY, wilt * 0.8)
  if (species === 'sprig')
    return (
      <g>
        {[[-0.55, -0.15], [0, -0.7], [0.55, -0.15]].map(([x, y], i) => (
          <g key={i}>
            <path d={`M0,${R * 0.3} Q${x * R * 0.3},${y * R * 0.2} ${x * R},${y * R}`} stroke={mix(STEM, DRY, wilt)} strokeWidth={1.4} fill="none" />
            <circle cx={x * R} cy={y * R} r={R * 0.34} fill={fill} {...line} />
          </g>
        ))}
      </g>
    )
  if (species === 'tulip')
    return (
      <path
        d={`M${-R * 0.72},${-R * 0.35} C${-R * 0.85},${R * 0.75} ${R * 0.85},${R * 0.75} ${R * 0.72},${-R * 0.35} L${R * 0.36},${-R * 0.05} L0,${-R * 0.55} L${-R * 0.36},${-R * 0.05} Z`}
        fill={fill}
        {...line}
      />
    )
  if (species === 'lavender')
    return (
      <g>
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse key={i} cx={(i % 2 ? 1 : -1) * R * 0.2} cy={R * 0.4 - i * R * 0.34} rx={R * 0.26} ry={R * 0.19} fill={fill} {...line} />
        ))}
      </g>
    )
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cy={-R * 0.68} rx={R * 0.34} ry={R * 0.72} fill={fill} transform={`rotate(${i * 45})`} {...line} />
      ))}
      <circle r={R * 0.34} fill={mix('#d9a441', DRY, wilt)} {...line} />
    </g>
  )
}

function Plant({ m, p, color, fresh }: { m: Mem; p: Pos; color: string; fresh: boolean }) {
  const g = shape(m, p)
  if (statusOf(m) === 'forgotten')
    return (
      <g>
        <path d={`M${p.x},${G} q5,-9 16,-9`} stroke={DRY} strokeWidth={1.8} fill="none" />
        <circle cx={p.x + 18} cy={G - 9} r={3.5} fill={DRY} {...line} />
      </g>
    )
  if (g.tree) {
    const canopy = '#a9c3a5'
    const shade = '#8fae8b'
    return (
      <g className={fresh ? 'sprout' : undefined}>
        <path d={`M${g.x - 5},${G} C${g.x - 3},${G - 30} ${g.x - 4},${g.hy + 20} ${g.x - 2},${g.hy + 6} L${g.x + 3},${g.hy + 6} C${g.x + 4},${g.hy + 20} ${g.x + 3},${G - 30} ${g.x + 6},${G} Z`} fill="#9a8463" {...line} />
        <circle cx={g.x - g.R * 0.6} cy={g.hy + g.R * 0.3} r={g.R * 0.66} fill={shade} {...line} />
        <circle cx={g.x + g.R * 0.6} cy={g.hy + g.R * 0.3} r={g.R * 0.66} fill={shade} {...line} />
        <circle cx={g.x} cy={g.hy} r={g.R} fill={mix(canopy, DRY, g.w * 0.7)} {...line} />
        <path d={`M${g.x - g.R * 0.55},${g.hy - g.R * 0.2} q${g.R * 0.2},${-g.R * 0.35} ${g.R * 0.5},${-g.R * 0.45}`} stroke="#fffdf6" strokeWidth={2} fill="none" opacity={0.7} strokeLinecap="round" />
        <circle cx={g.x} cy={g.hy} r={g.R * 0.22} fill={color} {...line} />
      </g>
    )
  }
  const stem = mix(STEM, DRY, g.w)
  const leafY = G - g.h * 0.45
  return (
    <g className={fresh ? 'sprout' : undefined}>
      <path d={`M${g.x},${G} Q${g.x},${G - g.h * 0.7} ${g.hx},${g.hy}`} stroke={stem} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d={`M${g.x},${leafY} q${-10 * g.k},${-2 * g.k} ${-15 * g.k},${-9 * g.k} q${8 * g.k},${-1 * g.k} ${15 * g.k},${9 * g.k}`} fill={stem} {...line} strokeOpacity={0.3} />
      <path d={`M${g.x},${leafY - 12} q${10 * g.k},${-2 * g.k} ${15 * g.k},${-9 * g.k} q${-8 * g.k},${-1 * g.k} ${-15 * g.k},${9 * g.k}`} fill={stem} {...line} strokeOpacity={0.3} />
      <g transform={`translate(${g.hx},${g.hy}) rotate(${g.w * g.side * 38})`}>
        <Head species={speciesOf(m.layer)} R={g.R} color={color} wilt={g.w} />
      </g>
    </g>
  )
}

export interface Overlay {
  query: string
  turn: number
  verdicts: Verdict[]
}

interface Note {
  id: string
  text: string
}

function noteFor(overlay: Overlay | null, current: TraceEvent | undefined, mems: Map<string, Mem>): Note | null {
  if (overlay) {
    const losers = overlay.verdicts.filter((v) => !v.won && v.mem)
    for (const l of losers) {
      const beat = overlay.verdicts.find((v) => v.won && v.rank > l.rank)
      if (beat) return { id: l.id, text: `${l.id} outscored ${beat.id}, but it was ${l.reasons[0]}. So ${beat.id} got in.` }
    }
    if (losers[0]) return { id: losers[0].id, text: `${losers[0].id} didn't make it: ${losers[0].reasons[0]}` }
    return null
  }
  if (!current) return null
  if (current.type === 'consolidate') return { id: current.into, text: `${current.from.join(', ')} grew into ${current.into}` }
  if (current.type === 'decay') {
    const m = mems.get(current.id)
    if (m && statusOf(m) === 'forgotten') return { id: m.id, text: `${m.id} has been forgotten` }
    if (m && statusOf(m) === 'fading') return { id: m.id, text: `${m.id} is wilting${current.reason ? `: ${current.reason}` : ''}` }
  }
  if (current.type === 'store') return { id: current.id, text: `new: ${current.id}` }
  return null
}

const wrap = (text: string, max = 28) => {
  const out: string[] = []
  let cur = ''
  for (const word of text.split(' ')) {
    if ((cur + ' ' + word).trim().length > max && cur) {
      out.push(cur)
      cur = word
    } else cur = (cur + ' ' + word).trim()
  }
  if (cur) out.push(cur)
  return out
}

function MarginNote({ note, hx, hy, R }: { note: Note; hx: number; hy: number; R: number }) {
  const dir = hx > 600 ? -1 : 1
  const lines = wrap(note.text)
  const tx = hx + dir * 78
  const ty = Math.max(70 + lines.length * 10, hy - 86)
  const ex = hx + dir * (R + 6)
  const ey = hy - R * 0.6
  const cx = hx + dir * 30
  const cy = ty + 4
  const a = Math.atan2(ey - cy, ex - cx)
  const head = (da: number) => `L${ex - 9 * Math.cos(a + da)},${ey - 9 * Math.sin(a + da)}`
  return (
    <g className="note" key={note.text} pointerEvents="none">
      <path d={`M${tx - dir * 6},${ty + 2} Q${cx},${cy} ${ex},${ey} M${ex},${ey} ${head(0.45)} M${ex},${ey} ${head(-0.45)}`} stroke={NOTE} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <text x={tx} y={ty - (lines.length - 1) * 19} textAnchor={dir > 0 ? 'start' : 'end'} className="hand">
        {lines.map((l, i) => (
          <tspan key={i} x={tx} dy={i ? 19 : 0}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  )
}

export default function Garden({
  mems,
  pos,
  layers,
  laneWidth,
  cursor,
  current,
  overlay,
  selectedId,
  onSelect,
}: {
  mems: Map<string, Mem>
  pos: Map<string, Pos>
  layers: string[]
  laneWidth: number
  cursor: number
  current: TraceEvent | undefined
  overlay: Overlay | null
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const list = [...mems.values()].filter((m) => pos.has(m.id))
  const verdictOf = new Map(overlay?.verdicts.map((v) => [v.id, v]))
  const qx = W / 2
  const qy = 40
  const qText = overlay ? `Turn ${overlay.turn} · “${overlay.query.length > 64 ? overlay.query.slice(0, 63) + '…' : overlay.query}”` : ''
  const qW = Math.min(620, 40 + qText.length * 6.6)
  const note = noteFor(overlay, current, mems)
  const noteMem = note && mems.get(note.id)
  const noteGeom = noteMem && pos.get(noteMem.id) ? shape(noteMem, pos.get(noteMem.id)!) : null

  const opacityOf = (m: Mem) => {
    const st = statusOf(m)
    let o = st === 'forgotten' ? 0.4 : st === 'merged' ? 0.45 : 0.4 + 0.6 * clamp(m.strength, 0, 1)
    if (overlay && !verdictOf.has(m.id)) o *= 0.35
    return o
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="garden" role="img" aria-label="Memory garden: each plant is one memory" onClick={() => onSelect(null)}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf8f2" />
          <stop offset="1" stopColor="#edf1e6" />
        </linearGradient>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9dfcc" />
          <stop offset="1" stopColor="#e2d6bf" />
        </linearGradient>
        <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="1.8" />
        </filter>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.17  0 0 0 0 0.24  0 0 0 0 0.18  0 0 0 0.07 0" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      {[90, 170, 250, 330].map((y) => (
        <line key={y} x1={0} x2={W} y1={y} y2={y} stroke={INK} strokeOpacity={0.05} strokeDasharray="2 6" />
      ))}
      <path d={`M0,${G - 46} Q200,${G - 96} 400,${G - 52} T800,${G - 58} T1000,${G - 44} V${G} H0 Z`} fill="#e3eadc" />
      <path d={`M0,${G - 18} Q260,${G - 52} 540,${G - 22} T1000,${G - 26} V${G} H0 Z`} fill="#d7e3d1" />
      <rect y={G} width={W} height={H - G} fill="url(#soil)" />
      <path d={`M0,${G} Q250,${G - 2} 500,${G + 1} T1000,${G}`} stroke={INK} strokeOpacity={0.35} strokeWidth={1.2} fill="none" filter="url(#ink)" />

      {layers.map((layer, lane) => {
        const x0 = 30 + lane * laneWidth
        const live = list.filter((m) => m.layer === layer && statusOf(m) !== 'merged' && statusOf(m) !== 'forgotten').length
        return (
          <g key={layer} pointerEvents="none">
            {lane > 0 && <line x1={x0} x2={x0} y1={G + 10} y2={H - 10} stroke={INK} strokeOpacity={0.1} strokeDasharray="1 4" />}
            <text x={x0 + laneWidth / 2} y={H - 14} textAnchor="middle" className="lane-label">
              {layer} · {live}
            </text>
          </g>
        )
      })}

      {/* consolidation vines */}
      <g filter="url(#ink)">
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
                  opacity={overlay ? 0.2 : 0.6}
                />
              )
            }),
          )}
      </g>

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
              d={`M${qx},${qy + 14} C${qx},${qy + 100} ${g.hx},${g.hy - 100} ${g.hx},${g.hy - g.R - 2}`}
              fill="none"
              stroke={v.won ? WIN : LOSE}
              strokeWidth={0.8 + v.score * 2.4}
              strokeOpacity={0.25 + v.score * 0.5}
              strokeDasharray={v.won ? undefined : '4 5'}
              pointerEvents="none"
            />
          )
        })}

      <g onClick={(e) => e.stopPropagation()} filter="url(#ink)">
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
                <Plant m={m} p={p} color={colorOf(m.layer, layers)} fresh={m.bornIdx === cursor - 1} />
                {v?.won && <circle cx={g.hx} cy={g.hy} r={g.R * 1.5} className="ring" fill="none" stroke={WIN} strokeWidth={1.4} />}
              </g>
            )
          })}
      </g>

      {list.map((m) => {
        const p = pos.get(m.id)!
        const g = shape(m, p)
        const v = verdictOf.get(m.id)
        const sel = m.id === selectedId
        return (
          <g key={'l' + m.id} pointerEvents="none">
            {sel && <circle cx={g.hx} cy={g.hy} r={g.R * 1.9 + 4} fill="none" stroke={INK} strokeDasharray="3 4" strokeWidth={1.1} />}
            <text x={p.x} y={G + 20} textAnchor="middle" className={`id-label ${sel ? 'sel' : ''} ${m.mergedInto ? 'merged' : ''}`} opacity={overlay && !v ? 0.4 : 1}>
              {m.id}
            </text>
            {v && (
              <g transform={`translate(${g.hx},${g.hy - g.R - 18 - (v.rank % 2 ? 0 : 22)})`}>
                <rect x={-23} y={-9} width={46} height={18} rx={9} fill="#fffdf8" stroke={v.won ? WIN : LOSE} strokeWidth={1} />
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
          <rect x={qx - qW / 2} y={qy - 14} width={qW} height={28} rx={14} fill={INK} />
          <text x={qx} y={qy + 4.5} textAnchor="middle" className="query">
            {qText}
          </text>
        </g>
      )}

      {note && noteGeom && <MarginNote note={note} hx={noteGeom.hx} hy={noteGeom.hy} R={noteGeom.R} />}

      {!list.length && (
        <text x={W / 2} y={G - 130} textAnchor="middle" className="hand big">
          Nothing planted yet. Press play and watch it grow.
        </text>
      )}

      <rect width={W} height={H} filter="url(#grain)" pointerEvents="none" />
    </svg>
  )
}
