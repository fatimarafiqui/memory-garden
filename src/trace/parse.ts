import type { Candidate, TraceEvent } from './types'

export interface ParseResult {
  events: TraceEvent[]
  errors: { line: number; message: string }[]
  warnings: string[]
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0

export function parseTrace(text: string): ParseResult {
  const events: TraceEvent[] = []
  const errors: ParseResult['errors'] = []
  const warnings: string[] = []

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const bad = (message: string) => errors.push({ line: i + 1, message })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let o: any
    try {
      o = JSON.parse(line)
    } catch {
      return bad('Not valid JSON')
    }
    if (!o || typeof o !== 'object') return bad('Expected a JSON object')
    if (!isNum(o.t)) return bad('"t" must be a number (seconds, or any increasing clock)')

    switch (o.type) {
      case 'store':
        if (!isStr(o.id) || !isStr(o.text) || !isStr(o.layer)) return bad('store needs "id", "text" and "layer"')
        events.push({ type: 'store', t: o.t, id: o.id, text: o.text, layer: o.layer })
        break
      case 'retrieve': {
        if (!isStr(o.query) || !Array.isArray(o.candidates)) return bad('retrieve needs "query" and a "candidates" array')
        const candidates: Candidate[] = o.candidates.filter((c: Candidate) => c && isStr(c.id) && isNum(c.score))
        if (candidates.length !== o.candidates.length) warnings.push(`Line ${i + 1}: some candidates were skipped (need "id" and numeric "score")`)
        events.push({
          type: 'retrieve',
          t: o.t,
          turn: isNum(o.turn) ? o.turn : 0,
          query: o.query,
          k: isNum(o.k) ? o.k : undefined,
          threshold: isNum(o.threshold) ? o.threshold : undefined,
          layers: Array.isArray(o.layers) ? o.layers.filter(isStr) : undefined,
          candidates,
          selected: Array.isArray(o.selected) ? o.selected.filter(isStr) : undefined,
        })
        break
      }
      case 'consolidate':
        if (!Array.isArray(o.from) || !o.from.every(isStr) || !o.from.length || !isStr(o.into) || !isStr(o.text))
          return bad('consolidate needs "from" (ids), "into" (id) and "text"')
        events.push({ type: 'consolidate', t: o.t, from: o.from, into: o.into, text: o.text, layer: isStr(o.layer) ? o.layer : undefined })
        break
      case 'decay':
        if (!isStr(o.id) || (!isNum(o.to) && !isNum(o.delta))) return bad('decay needs "id" and either "to" or "delta"')
        events.push({ type: 'decay', t: o.t, id: o.id, to: isNum(o.to) ? o.to : undefined, delta: isNum(o.delta) ? o.delta : undefined, reason: isStr(o.reason) ? o.reason : undefined })
        break
      default:
        bad(`Unknown event type "${String(o.type)}" (expected store, retrieve, consolidate or decay)`)
    }
  })

  if (events.some((e, i) => i > 0 && e.t < events[i - 1].t)) {
    events.sort((a, b) => a.t - b.t)
    warnings.push('Events were out of order and have been sorted by "t".')
  }

  // number turns that don't have one, and flag references to ids we haven't seen
  let turn = 0
  const known = new Set<string>()
  for (const e of events) {
    if (e.type === 'store') known.add(e.id)
    else if (e.type === 'retrieve') {
      e.turn = e.turn || ++turn
      turn = Math.max(turn, e.turn)
      const miss = e.candidates.filter((c) => !known.has(c.id)).map((c) => c.id)
      if (miss.length) warnings.push(`Turn ${e.turn}: candidates not stored earlier: ${miss.join(', ')}`)
    } else if (e.type === 'consolidate') {
      const miss = e.from.filter((id) => !known.has(id))
      if (miss.length) warnings.push(`consolidate → ${e.into}: unknown source ids ${miss.join(', ')}`)
      known.add(e.into)
    } else if (!known.has(e.id)) warnings.push(`decay: unknown id ${e.id}`)
  }

  return { events, errors, warnings }
}
