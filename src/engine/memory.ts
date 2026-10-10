// A tiny, generic memory model. No LLM involved: the point is how memory *looks*,
// so the rules are deliberately simple and legible.

export type Category = 'person' | 'preference' | 'place' | 'work' | 'plan' | 'fact'
export type Fate = 'alive' | 'composted' | 'pressed' | 'deleted'
export type ForgetStyle = 'fade' | 'compost' | 'press' | 'delete'

export interface Memory {
  id: string
  text: string
  gist: string
  keywords: string[]
  category: Category
  x: number // tile column (0-7)
  z: number // tile row (0-7)
  born: number
  lastUsed: number
  strength: number
  recalls: number
  links: string[]
  fate: Fate
  tree: boolean
  children: string[]
  mergedInto?: string
}

export interface JournalEntry {
  id: number
  day: number
  kind: 'plant' | 'pollinate' | 'recall' | 'consolidate' | 'forget' | 'compost' | 'press' | 'revive'
  text: string
}

export interface World {
  day: number
  style: ForgetStyle
  memories: Memory[]
  journal: JournalEntry[]
  seq: number
}

export const newWorld = (style: ForgetStyle = 'compost'): World => ({
  day: 0,
  style,
  memories: [],
  journal: [],
  seq: 1,
})

// ---------- tuning ----------

const START: Record<Category, number> = { person: 0.85, preference: 0.8, work: 0.7, place: 0.7, fact: 0.65, plan: 0.6 }
// strength lost per day when idle. Plans are short-lived on purpose.
const RATE: Record<Category, number> = { person: 0.02, preference: 0.025, place: 0.03, work: 0.04, fact: 0.045, plan: 0.09 }
// preferred tile column per kind, so each kind forms a loose bed across the block
const ZONE: Record<Category, number> = { person: 0.8, preference: 2, place: 3.5, work: 4.7, plan: 6, fact: 7 }
export const GRID = 8

export const WILT_BELOW = 0.35
const GONE_BELOW = 0.06
const CLIFF_BELOW = 0.25 // hard-delete style: no wilting, just a cliff
const IDLE_GRACE = 1.5 // days a memory is safe after being used

// ---------- text helpers ----------

const STOP = new Set(
  `a an the and or but if of to in on at for with about from by is are was were be been am i me my mine we our you your it its this that these those there here as so very really just also too not no yes do does did have has had will would can could should may might get got like love prefer hate enjoy live lives work works working what when where who whom which how why tell remember know think thing things some any more most much many into than then them they their he she his her him next last tomorrow today tonight soon month week year`.split(
    /\s+/,
  ),
)

const stem = (w: string) => {
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y'
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1)
  return w
}

export const keywordsOf = (text: string): string[] => {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem)
    .filter((w) => !STOP.has(w))
  return [...new Set(words)]
}

const categoryOf = (s: string): Category => {
  if (/\bmy (sister|brother|mom|mother|dad|father|friend|partner|wife|husband|boss|colleague|cat|dog|kid|son|daughter)\b|\b(named|called)\b/i.test(s)) return 'person'
  if (/\b(like|love|loves|prefer|prefers|hate|enjoy|favou?rite|allergic)\b/i.test(s)) return 'preference'
  if (/\b(tomorrow|tonight|next|will|going to|plan|planning|soon|deadline|due)\b/i.test(s)) return 'plan'
  if (/\b(live|lives|moved|born in|from|city|town|home|trip|visit|visiting|travel)\b/i.test(s)) return 'place'
  if (/\b(work|project|meeting|team|client|design|code|launch|ship|job|research|review)\b/i.test(s)) return 'work'
  return 'fact'
}

const isQuestion = (t: string) =>
  /\?\s*$/.test(t) || /^\s*(what|when|where|who|which|how|do you|did you|tell me|remember)\b/i.test(t)

const quote = (s: string) => `“${s}”`

const overlap = (a: string[], b: string[]) => a.filter((k) => b.includes(k))

// ---------- layout ----------

function placeCell(memories: Memory[], category: Category): { x: number; z: number } {
  const taken = memories.filter((m) => (m.fate === 'alive' || m.fate === 'composted') && !m.mergedInto)
  const free: { x: number; z: number; score: number }[] = []
  for (let c = 0; c < GRID; c++)
    for (let r = 0; r < GRID; r++) {
      if (taken.some((t) => t.x === c && t.z === r)) continue
      const gap = taken.length ? Math.min(...taken.map((t) => Math.hypot(t.x - c, t.z - r))) : 3
      free.push({ x: c, z: r, score: Math.min(gap, 3) - Math.abs(c - ZONE[category]) * 0.8 + Math.random() * 1.2 })
    }
  free.sort((a, b) => b.score - a.score)
  return free.length ? { x: free[0].x, z: free[0].z } : { x: 0, z: 0 }
}

const visible = (m: Memory) => m.fate === 'alive' && !m.mergedInto

// ---------- journal ----------

const log = (w: World, kind: JournalEntry['kind'], text: string) => {
  w.journal = [...w.journal.slice(-39), { id: w.seq++, day: w.day, kind, text }]
}

// ---------- planting ----------

export interface PlantResult {
  planted: Memory[]
  reinforced: Memory[]
  pollinated: number
  fed: boolean
}

function plant(w: World, text: string): PlantResult {
  const res: PlantResult = { planted: [], reinforced: [], pollinated: 0, fed: false }
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  for (const s of sentences) {
    const kws = keywordsOf(s)
    if (kws.length < 1 || s.split(/\s+/).length < 3) continue

    // already know this? water it instead of planting a twin
    const twin = w.memories.find(
      (m) => visible(m) && overlap(m.keywords, kws).length / Math.max(m.keywords.length, kws.length) > 0.7,
    )
    if (twin) {
      water(w, twin)
      res.reinforced.push(twin)
      continue
    }

    const category = categoryOf(s)
    const m: Memory = {
      id: `m${w.seq++}`,
      text: s.replace(/\s+/g, ' '),
      gist: kws.slice(0, 3).join(' · '),
      keywords: kws,
      category,
      ...placeCell(w.memories, category),
      born: w.day,
      lastUsed: w.day,
      strength: START[category],
      recalls: 0,
      links: [],
      fate: 'alive',
      tree: false,
      children: [],
    }

    // compost feeds new growth on the same topic
    const feeders = w.memories.filter((o) => o.fate === 'composted' && !o.mergedInto && overlap(o.keywords, kws).length)
    if (feeders.length) {
      m.strength = Math.min(1, m.strength + 0.15)
      res.fed = true
      log(w, 'compost', `${quote(m.gist)} grew from compost: ${feeders[0].gist}`)
    }

    // cross-pollination: shared keywords link two living memories
    for (const o of w.memories) {
      if (!visible(o)) continue
      const shared = overlap(o.keywords, kws)
      if (!shared.length) continue
      o.links = [...o.links, m.id]
      m.links.push(o.id)
      res.pollinated++
      log(w, 'pollinate', `${quote(o.gist)} ↔ ${quote(m.gist)} (${shared[0]})`)
    }

    w.memories = [...w.memories, m]
    res.planted.push(m)
    log(w, 'plant', `Planted ${quote(m.text)}`)
  }
  return res
}

// ---------- recall ----------

function water(w: World, m: Memory) {
  m.strength = Math.min(1, m.strength + 0.3)
  m.recalls++
  m.lastUsed = w.day
  // spreading activation: neighbours stay a little fresher
  for (const id of m.links) {
    const n = w.memories.find((o) => o.id === id)
    if (n && n.fate === 'alive') n.strength = Math.min(1, n.strength + 0.08)
  }
}

function recall(w: World, text: string): string {
  const kws = keywordsOf(text)
  if (!kws.length) return 'Ask me about something specific and I’ll look through the garden.'

  const scored = w.memories
    .map((m) => ({ m, score: overlap(m.keywords, kws).length }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.m.strength - a.m.strength)

  if (!scored.length) return 'I don’t have anything about that yet. Tell me and I’ll plant it.'

  let m = scored[0].m
  if (m.mergedInto) m = w.memories.find((o) => o.id === m.mergedInto) ?? m

  if (m.fate === 'alive') {
    const weak = m.strength < WILT_BELOW
    water(w, m)
    log(w, 'recall', `Recalled ${quote(m.tree ? m.gist : m.text)}`)
    if (m.tree) {
      const parts = [m, ...m.children.map((id) => w.memories.find((o) => o.id === id)!)]
        .filter(Boolean)
        .sort((a, b) => overlap(b.keywords, kws).length - overlap(a.keywords, kws).length)
        .map((o) => o.text)
      return `That’s grown into something bigger for me, around ${quote(m.gist)}: ${parts.slice(0, 3).join(' ')}`
    }
    return `${weak ? 'Just in time, I was starting to lose this one. ' : ''}I remember: ${quote(m.text)}`
  }

  if (m.fate === 'composted') {
    m.fate = 'alive'
    m.strength = 0.4
    m.lastUsed = w.day
    m.recalls++
    log(w, 'revive', `Regrew ${quote(m.gist)} from compost`)
    return `I’ve only got the gist now: ${quote(m.gist)}. The details broke down. I’ve planted it again; fill me in?`
  }

  if (m.fate === 'pressed') {
    m.fate = 'alive'
    m.strength = 0.5
    m.lastUsed = w.day
    m.recalls++
    Object.assign(m, placeCell(w.memories, m.category))
    log(w, 'revive', `Took ${quote(m.gist)} out of the herbarium`)
    return `Found it in the herbarium, kept whole: ${quote(m.text)} I’ve put it back in the garden.`
  }

  // deleted
  return w.style === 'delete'
    ? 'I don’t have anything about that.'
    : 'I think I used to know something about that, but it faded.'
}

// ---------- the public entry point for chat ----------

export function respond(world: World, text: string): { world: World; reply: string } {
  const w: World = { ...world, memories: world.memories.map((m) => ({ ...m })), journal: [...world.journal] }
  if (isQuestion(text)) return { world: w, reply: recall(w, text) }

  const r = plant(w, text)
  if (!r.planted.length && !r.reinforced.length)
    return { world: w, reply: 'I couldn’t find anything to hold on to there. Try a sentence about you, people, places or plans.' }

  const bits: string[] = []
  if (r.planted.length) bits.push(`Planted ${r.planted.length === 1 ? 'a seed' : `${r.planted.length} seeds`}`)
  if (r.reinforced.length) bits.push('already knew that, so I watered it')
  if (r.pollinated) bits.push(`${r.pollinated} link${r.pollinated > 1 ? 's' : ''} formed with things I already knew`)
  if (r.fed) bits.push('compost gave it a head start')
  return { world: w, reply: bits.join('; ') + '.' }
}

// manual gestures from the inspector
export function waterById(world: World, id: string): World {
  const w: World = { ...world, memories: world.memories.map((m) => ({ ...m })), journal: [...world.journal] }
  const m = w.memories.find((o) => o.id === id)
  if (m && m.fate === 'alive') {
    water(w, m)
    log(w, 'recall', `Watered ${quote(m.tree ? m.gist : m.text)}`)
  }
  return w
}

export function letGo(world: World, id: string): World {
  const w: World = { ...world, memories: world.memories.map((m) => ({ ...m })), journal: [...world.journal] }
  const m = w.memories.find((o) => o.id === id)
  if (m && m.fate === 'alive') {
    m.strength = 0
    forget(w, m)
  }
  return w
}

// ---------- forgetting ----------

function forget(w: World, m: Memory) {
  const kids = m.children.map((id) => w.memories.find((o) => o.id === id)).filter((k): k is Memory => !!k)
  const label = m.tree ? m.gist : m.text
  switch (w.style) {
    case 'compost':
      m.fate = 'composted'
      m.text = `Something about ${m.gist}.` // the detail is gone; the gist feeds the soil
      kids.forEach((k) => (k.fate = 'composted'))
      log(w, 'compost', `${quote(label)} returned to the soil`)
      break
    case 'press':
      m.fate = 'pressed'
      kids.forEach((k) => (k.fate = 'pressed'))
      log(w, 'press', `${quote(label)} pressed into the herbarium`)
      break
    case 'delete':
      m.fate = 'deleted'
      kids.forEach((k) => (k.fate = 'deleted'))
      log(w, 'forget', `${quote(label)} deleted`)
      break
    default:
      m.fate = 'deleted'
      kids.forEach((k) => (k.fate = 'deleted'))
      log(w, 'forget', `${quote(label)} faded away`)
  }
}

function consolidate(w: World, m: Memory) {
  const kids = m.links
    .map((id) => w.memories.find((o) => o.id === id))
    .filter((k): k is Memory => !!k && k.fate === 'alive' && !k.tree && !k.mergedInto && k.strength > 0.2)
  if (!kids.length) return
  const freq = new Map<string, number>()
  for (const k of [m, ...kids]) for (const kw of k.keywords) freq.set(kw, (freq.get(kw) ?? 0) + 1)
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
  m.tree = true
  m.children = kids.map((k) => k.id)
  m.gist = top.join(' · ')
  m.strength = 0.9
  m.lastUsed = w.day
  kids.forEach((k) => (k.mergedInto = m.id))
  log(w, 'consolidate', `${kids.length + 1} memories grew into a tree: ${quote(m.gist)}`)
}

// ---------- time ----------

export function step(world: World, dt: number): World {
  if (dt <= 0) return world
  const w: World = { ...world, day: world.day + dt, memories: world.memories.map((m) => ({ ...m })), journal: [...world.journal] }

  for (const m of w.memories) {
    if (!visible(m)) continue

    if (w.day - m.lastUsed > IDLE_GRACE) {
      const linkShield = 1 - 0.18 * Math.min(m.links.length, 3)
      const treeShield = m.tree ? 0.25 : 1
      m.strength = Math.max(0, m.strength - RATE[m.category] * linkShield * treeShield * dt)
    }

    if (
      !m.tree &&
      m.strength > 0.5 &&
      w.day - m.born >= 2 &&
      ((m.recalls >= 2 && m.links.length >= 1) || m.links.length >= 3)
    )
      consolidate(w, m)

    const gone = w.style === 'delete' ? m.strength < CLIFF_BELOW : m.strength < GONE_BELOW
    if (gone) forget(w, m)
  }
  return w
}

// ---------- read helpers for the UI ----------

export const ageOf = (m: Memory, day: number) => Math.max(0, day - m.born)

export function stageOf(m: Memory, day: number): string {
  if (m.fate === 'composted') return 'compost'
  if (m.fate === 'pressed') return 'pressed'
  if (m.fate === 'deleted') return 'gone'
  if (m.mergedInto) return 'part of a tree'
  if (m.tree) return m.strength < WILT_BELOW ? 'tree, shedding leaves' : 'tree'
  if (ageOf(m, day) < 1) return 'seed'
  if (m.strength < WILT_BELOW) return 'wilting'
  return ageOf(m, day) < 3 ? 'sprout' : 'in bloom'
}
