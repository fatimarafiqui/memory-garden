// The trace format: plain JSONL, one event per line. Any memory framework can emit it.

export type Layer = string

export interface StoreEvent {
  type: 'store'
  t: number
  id: string
  text: string
  layer: Layer
}

export interface Candidate {
  id: string
  score: number
  reason?: string // optional note from the memory layer, shown next to the verdict
}

export interface RetrieveEvent {
  type: 'retrieve'
  t: number
  turn: number
  query: string
  k?: number // how many results the layer returns
  threshold?: number // minimum score
  layers?: Layer[] // layers that were searched; omitted means all
  candidates: Candidate[]
  selected?: string[] // what was actually returned; derived from k/threshold if omitted
}

export interface ConsolidateEvent {
  type: 'consolidate'
  t: number
  from: string[]
  into: string
  text: string
  layer?: Layer
}

export interface DecayEvent {
  type: 'decay'
  t: number
  id: string
  to?: number // new strength 0..1
  delta?: number // or a change in strength
  reason?: string
}

export type TraceEvent = StoreEvent | RetrieveEvent | ConsolidateEvent | DecayEvent
