import type { RetrieveEvent, TraceEvent } from './types'

export const FORGOTTEN_BELOW = 0.12
export const FADING_BELOW = 0.35

export interface Mem {
  id: string
  text: string
  layer: string
  bornIdx: number
  bornT: number
  retrievals: number // times it was actually returned
  candidateCount: number // times it was considered
  strength: number
  mergedInto?: string
  children: string[]
  consolidated: boolean
  history: { idx: number; t: number; v: number; reason?: string }[]
}

export type Status = 'live' | 'fading' | 'forgotten' | 'merged'

export const statusOf = (m: Mem): Status =>
  m.mergedInto ? 'merged' : m.strength <= FORGOTTEN_BELOW ? 'forgotten' : m.strength < FADING_BELOW ? 'fading' : 'live'

const clamp = (n: number) => Math.min(1, Math.max(0, n))

export function winnersOf(e: RetrieveEvent): string[] {
  if (e.selected) return e.selected
  const k = e.k ?? 3
  return [...e.candidates]
    .sort((a, b) => b.score - a.score)
    .filter((c) => c.score >= (e.threshold ?? 0))
    .slice(0, k)
    .map((c) => c.id)
}

/** The state of memory after the first `n` events. Pure, so scrubbing is just calling this. */
export function stateAt(events: TraceEvent[], n: number): Map<string, Mem> {
  const mems = new Map<string, Mem>()
  const make = (id: string, text: string, layer: string, i: number, t: number): Mem => ({
    id, text, layer, bornIdx: i, bornT: t, retrievals: 0, candidateCount: 0, strength: 1, children: [], consolidated: false,
    history: [{ idx: i, t, v: 1 }],
  })

  for (let i = 0; i < Math.min(n, events.length); i++) {
    const e = events[i]
    if (e.type === 'store') {
      if (!mems.has(e.id)) mems.set(e.id, make(e.id, e.text, e.layer, i, e.t))
    } else if (e.type === 'consolidate') {
      let into = mems.get(e.into)
      if (!into) {
        into = make(e.into, e.text, e.layer ?? 'semantic', i, e.t)
        mems.set(e.into, into)
      }
      into.consolidated = true
      into.children = e.from.filter((id) => id !== e.into && mems.has(id))
      for (const id of into.children) mems.get(id)!.mergedInto = e.into
    } else if (e.type === 'decay') {
      const m = mems.get(e.id)
      if (m) {
        m.strength = clamp(e.to ?? m.strength + (e.delta ?? 0))
        m.history.push({ idx: i, t: e.t, v: m.strength, reason: e.reason })
      }
    } else {
      const won = new Set(winnersOf(e))
      for (const c of e.candidates) {
        const m = mems.get(c.id)
        if (!m) continue
        m.candidateCount++
        if (won.has(c.id)) m.retrievals++
      }
    }
  }
  return mems
}

export interface Verdict {
  id: string
  score: number
  rank: number
  won: boolean
  reasons: string[]
  mem?: Mem
  note?: string
}

/** Why each candidate in a retrieve event won or lost, judged against memory as it was just before the event. */
export function analyzeRetrieval(events: TraceEvent[], idx: number): Verdict[] {
  const e = events[idx]
  if (!e || e.type !== 'retrieve') return []
  const mems = stateAt(events, idx)
  const won = new Set(winnersOf(e))
  const k = e.k ?? Math.max(won.size, 3)
  const sorted = [...e.candidates].sort((a, b) => b.score - a.score)

  return sorted.map((c, i) => {
    const mem = mems.get(c.id)
    const reasons: string[] = []
    if (!won.has(c.id)) {
      if (!mem) reasons.push('not in memory at this point')
      else {
        if (mem.mergedInto) reasons.push(`already consolidated into ${mem.mergedInto}`)
        if (mem.strength <= FORGOTTEN_BELOW) reasons.push(`forgotten (strength ${mem.strength.toFixed(2)})`)
        else if (mem.strength < FADING_BELOW) reasons.push(`decayed (strength ${mem.strength.toFixed(2)})`)
        if (e.layers && !e.layers.includes(mem.layer)) reasons.push(`${mem.layer} not in searched layers`)
      }
      if (e.threshold !== undefined && c.score < e.threshold) reasons.push(`score ${c.score.toFixed(2)} below threshold ${e.threshold.toFixed(2)}`)
      if (i >= k) reasons.push(`ranked #${i + 1}, outside top-${k}`)
      if (!reasons.length) reasons.push('not selected')
    }
    return { id: c.id, score: c.score, rank: i + 1, won: won.has(c.id), reasons, mem, note: c.reason }
  })
}

export function layoutOf(events: TraceEvent[]) {
  const order = ['short-term', 'episodic', 'semantic', 'procedural']
  const byLayer = new Map<string, string[]>()
  const add = (id: string, layer: string) => {
    const list = byLayer.get(layer) ?? []
    if (!list.includes(id)) list.push(id)
    byLayer.set(layer, list)
  }
  for (const e of events) {
    if (e.type === 'store') add(e.id, e.layer)
    else if (e.type === 'consolidate') add(e.into, e.layer ?? 'semantic')
  }
  const layers = [...order.filter((l) => byLayer.has(l)), ...[...byLayer.keys()].filter((l) => !order.includes(l))]
  const W = 1000
  const lw = (W - 60) / Math.max(layers.length, 1)
  const pos = new Map<string, { x: number; lane: number; scale: number }>()
  layers.forEach((layer, lane) => {
    const ids = byLayer.get(layer)!
    const scale = Math.min(1, Math.max(0.55, lw / (ids.length * 46)))
    ids.forEach((id, i) => pos.set(id, { x: 30 + lane * lw + ((i + 1) / (ids.length + 1)) * lw, lane, scale }))
  })
  return { layers, pos, laneWidth: lw }
}

export const describe = (e: TraceEvent): string => {
  switch (e.type) {
    case 'store': return `store ${e.id} · ${e.layer}`
    case 'retrieve': return `retrieve · turn ${e.turn} · “${e.query}”`
    case 'consolidate': return `consolidate ${e.from.join(' + ')} → ${e.into}`
    case 'decay': return `decay ${e.id} → ${e.to !== undefined ? e.to.toFixed(2) : `Δ${e.delta}`}`
  }
}
