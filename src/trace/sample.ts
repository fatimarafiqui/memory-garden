import type { TraceEvent } from './types'

// A small, generic session: an assistant helping someone plan a trip.
const events: TraceEvent[] = [
  { type: 'store', t: 0, id: 'm1', layer: 'episodic', text: 'User is planning a trip to Lisbon in May' },
  { type: 'store', t: 4, id: 'm2', layer: 'episodic', text: 'User prefers window seats on flights' },
  { type: 'store', t: 8, id: 'm3', layer: 'short-term', text: 'Currently comparing two hotels in Alfama' },
  { type: 'store', t: 12, id: 'm4', layer: 'procedural', text: 'When booking, check refundable fares first' },
  { type: 'store', t: 15, id: 'm5', layer: 'episodic', text: 'Trip budget is about 1,500 EUR' },
  { type: 'store', t: 20, id: 'm6', layer: 'semantic', text: 'User likes walking tours and museums' },
  {
    type: 'retrieve', t: 22, turn: 1, query: 'Suggest flights for the Lisbon trip', k: 3, threshold: 0.4,
    candidates: [
      { id: 'm1', score: 0.86 }, { id: 'm2', score: 0.74 }, { id: 'm5', score: 0.61 },
      { id: 'm4', score: 0.58 }, { id: 'm3', score: 0.41 }, { id: 'm6', score: 0.22 },
    ],
    selected: ['m1', 'm2', 'm5'],
  },
  { type: 'decay', t: 30, id: 'm3', to: 0.55, reason: 'not retrieved for 22s' },
  { type: 'decay', t: 34, id: 'm3', to: 0.3, reason: 'short-term half-life' },
  { type: 'store', t: 36, id: 'm7', layer: 'episodic', text: 'User chose the Alfama hotel with free cancellation' },
  { type: 'store', t: 38, id: 'm8', layer: 'episodic', text: 'Hotel check-in is on May 12' },
  {
    type: 'retrieve', t: 41, turn: 2, query: 'Where is the user staying?', k: 2, threshold: 0.4, layers: ['episodic', 'short-term'],
    candidates: [
      { id: 'm7', score: 0.91 }, { id: 'm8', score: 0.72 }, { id: 'm3', score: 0.66 },
      { id: 'm1', score: 0.35 }, { id: 'm6', score: 0.3 },
    ],
    selected: ['m7', 'm8'],
  },
  { type: 'consolidate', t: 45, from: ['m1', 'm5', 'm7', 'm8'], into: 'm9', layer: 'semantic', text: 'Lisbon trip in May: refundable Alfama hotel, about 1,500 EUR budget' },
  { type: 'decay', t: 46, id: 'm1', to: 0.5, reason: 'consolidated source' },
  { type: 'decay', t: 46, id: 'm5', to: 0.45, reason: 'consolidated source' },
  { type: 'decay', t: 46, id: 'm7', to: 0.5, reason: 'consolidated source' },
  { type: 'decay', t: 46, id: 'm8', to: 0.5, reason: 'consolidated source' },
  { type: 'store', t: 50, id: 'm10', layer: 'short-term', text: 'User asked about vegetarian restaurants near the hotel' },
  { type: 'store', t: 52, id: 'm11', layer: 'semantic', text: 'User is vegetarian' },
  {
    type: 'retrieve', t: 55, turn: 3, query: 'Find dinner spots near the hotel', k: 3, threshold: 0.4, layers: ['semantic', 'episodic'],
    candidates: [
      { id: 'm11', score: 0.88 }, { id: 'm9', score: 0.8 }, { id: 'm10', score: 0.7 },
      { id: 'm8', score: 0.55 }, { id: 'm6', score: 0.5 }, { id: 'm4', score: 0.12 },
    ],
    selected: ['m11', 'm9', 'm6'],
  },
  { type: 'decay', t: 60, id: 'm3', to: 0.08, reason: 'unused for 52s' },
  { type: 'decay', t: 62, id: 'm2', to: 0.6, reason: 'not retrieved since turn 1' },
  {
    type: 'retrieve', t: 66, turn: 4, query: 'Which seat should I book?', k: 2, threshold: 0.4,
    candidates: [{ id: 'm2', score: 0.9 }, { id: 'm4', score: 0.64 }, { id: 'm3', score: 0.45 }, { id: 'm1', score: 0.3 }],
    selected: ['m2', 'm4'],
  },
  { type: 'consolidate', t: 70, from: ['m2', 'm6', 'm11'], into: 'm12', layer: 'semantic', text: 'Traveler profile: window seats, vegetarian, enjoys walking tours and museums' },
  { type: 'decay', t: 71, id: 'm2', to: 0.5, reason: 'consolidated source' },
  { type: 'decay', t: 71, id: 'm6', to: 0.5, reason: 'consolidated source' },
  { type: 'decay', t: 71, id: 'm11', to: 0.6, reason: 'consolidated source' },
  {
    type: 'retrieve', t: 74, turn: 5, query: 'Plan a day itinerary for May 13', k: 3, threshold: 0.4,
    candidates: [{ id: 'm12', score: 0.85 }, { id: 'm9', score: 0.78 }, { id: 'm6', score: 0.6 }, { id: 'm8', score: 0.52 }, { id: 'm10', score: 0.33 }],
    selected: ['m12', 'm9'],
  },
]

export const SAMPLE_TRACE = events.map((e) => JSON.stringify(e)).join('\n')
