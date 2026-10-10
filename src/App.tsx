import { FormEvent, useEffect, useRef, useState } from 'react'
import Garden, { FlowerHead, SPECIES } from './components/Garden'
import {
  ForgetStyle,
  World,
  ageOf,
  letGo,
  newWorld,
  respond,
  stageOf,
  step,
  waterById,
} from './engine/memory'

interface Msg {
  from: 'you' | 'agent'
  text: string
}

const STYLES: { id: ForgetStyle; name: string; blurb: string }[] = [
  { id: 'fade', name: 'Fade', blurb: 'It wilts, then it’s simply gone. The agent knows it used to know.' },
  { id: 'compost', name: 'Compost', blurb: 'Details break down into soil. The gist stays and feeds new growth.' },
  { id: 'press', name: 'Press', blurb: 'Kept whole in a herbarium. Out of the garden, but retrievable.' },
  { id: 'delete', name: 'Delete', blurb: 'No wilting, no warning. It vanishes, and the agent never knew.' },
]

const SPEEDS = [
  { label: 'Paused', v: 0 },
  { label: 'Slow', v: 0.15 },
  { label: 'Steady', v: 0.35 },
  { label: 'Fast', v: 1.2 },
]

const SAMPLE = [
  'I live in Lisbon and I’m working on a design system project.',
  'My sister Amara loves climbing.',
  'I prefer oat milk in my tea.',
  'Our design review is tomorrow.',
  'The design system launch is next month.',
  'Amara is visiting Lisbon in spring.',
  'Amara found a climbing gym in Lisbon.',
]

const TICK = 50

export default function App() {
  const worldRef = useRef<World>(newWorld('compost'))
  const [world, setWorld] = useState<World>(worldRef.current)
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'agent', text: 'Hi. I’m a small agent with a garden for a mind. Tell me things and I’ll plant them; ask me things and I’ll look.' },
  ])
  const [input, setInput] = useState('')
  const [speed, setSpeed] = useState(0.35)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const burn = useRef(0)
  const speedRef = useRef(speed)
  const chatEnd = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])
  speedRef.current = speed

  const commit = (w: World) => {
    worldRef.current = w
    setWorld(w)
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      let dt = speedRef.current * (TICK / 1000)
      if (burn.current > 0) {
        const extra = Math.min(burn.current, 3.5 * (TICK / 1000))
        burn.current -= extra
        dt += extra
      }
      if (dt > 0) commit(step(worldRef.current, dt))
    }, TICK)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'nearest' })
  }, [msgs])

  const say = (text: string) => {
    const r = respond(worldRef.current, text)
    commit(r.world)
    setMsgs((m) => [...m, { from: 'you', text }, { from: 'agent', text: r.reply }])
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const t = input.trim()
    if (!t) return
    setInput('')
    say(t)
  }

  const plantSample = () => {
    timers.current.forEach(clearTimeout)
    timers.current = SAMPLE.map((line, i) => window.setTimeout(() => say(line), i * 1400))
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const setStyle = (style: ForgetStyle) => commit({ ...worldRef.current, style })
  const reset = () => {
    timers.current.forEach(clearTimeout)
    burn.current = 0
    setSelectedId(null)
    commit(newWorld(worldRef.current.style))
    setMsgs([{ from: 'agent', text: 'Fresh soil. Tell me something.' }])
  }

  const mem = world.memories
  const selected = mem.find((m) => m.id === selectedId) ?? null
  const pressed = mem.filter((m) => m.fate === 'pressed' && !m.mergedInto)
  const style = STYLES.find((s) => s.id === world.style)!
  const count = mem.filter((m) => m.fate === 'alive' && !m.mergedInto).length

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Memory Garden</h1>
          <p className="kicker">What should forgetting look like?</p>
        </div>
        <div className="day" aria-live="off">
          Day {Math.floor(world.day)} <span>· {count} growing</span>
        </div>
      </header>

      <main className="layout">
        <section className="stage">
          <div className="canvas">
            <Garden memories={mem} day={world.day} selectedId={selectedId} onSelect={setSelectedId} />
            <Legend />
          </div>

          <div className="controls">
            <div className="group">
              <span className="group-label">Forgetting</span>
              <div className="seg" role="radiogroup" aria-label="Forgetting style">
                {STYLES.map((s) => (
                  <button key={s.id} role="radio" aria-checked={world.style === s.id} className={world.style === s.id ? 'on' : ''} onClick={() => setStyle(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
              <p className="blurb">{style.blurb}</p>
            </div>
            <div className="group">
              <span className="group-label">Time</span>
              <div className="seg" role="radiogroup" aria-label="Speed">
                {SPEEDS.map((s) => (
                  <button key={s.label} role="radio" aria-checked={speed === s.v} className={speed === s.v ? 'on' : ''} onClick={() => setSpeed(s.v)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="row">
                <button className="ghost" onClick={() => (burn.current += 7)}>
                  A week passes
                </button>
                <button className="ghost" onClick={plantSample}>
                  Plant a sample garden
                </button>
                <button className="ghost quiet" onClick={reset}>
                  Reset
                </button>
              </div>
            </div>
          </div>

          {pressed.length > 0 && (
            <div className="herbarium">
              <span className="group-label">Herbarium</span>
              <div className="sheets">
                {pressed.map((m) => (
                  <button key={m.id} className={`sheet ${m.id === selectedId ? 'sel' : ''}`} onClick={() => setSelectedId(m.id)} title={m.text}>
                    <svg viewBox="-24 -26 48 52" width="36" height="40">
                      <path d="M0,24 Q2,6 0,-4" stroke="#8a7a5a" strokeWidth="2" fill="none" />
                      <g transform="translate(0,-6) rotate(-12)">
                        <FlowerHead category={m.category} scale={0.9} flat />
                      </g>
                    </svg>
                    <span>{m.keywords[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="side">
          <section className="chat" aria-label="Chat with the agent">
            <div className="msgs">
              {msgs.map((m, i) => (
                <p key={i} className={`msg ${m.from}`}>
                  {m.text}
                </p>
              ))}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={onSubmit} className="composer">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tell me something, or ask what I remember…" aria-label="Message" />
              <button type="submit">Send</button>
            </form>
          </section>

          {selected && (
            <section className="inspector" aria-label="Selected memory">
              <div className="insp-head">
                <strong>{selected.tree ? selected.gist : selected.text}</strong>
                <button className="x" onClick={() => setSelectedId(null)} aria-label="Close">
                  ×
                </button>
              </div>
              <dl>
                <dt>Kind</dt>
                <dd>{SPECIES[selected.category].label}</dd>
                <dt>Stage</dt>
                <dd>{stageOf(selected, world.day)}</dd>
                <dt>Strength</dt>
                <dd>
                  <span className="meter">
                    <i style={{ width: `${Math.round(selected.strength * 100)}%` }} />
                  </span>
                </dd>
                <dt>Age</dt>
                <dd>{ageOf(selected, world.day).toFixed(1)} days</dd>
                <dt>Last used</dt>
                <dd>{(world.day - selected.lastUsed).toFixed(1)} days ago · recalled {selected.recalls}×</dd>
                <dt>Linked</dt>
                <dd>{selected.links.length} memories</dd>
              </dl>
              {selected.fate === 'alive' && (
                <div className="row">
                  <button className="ghost" onClick={() => commit(waterById(worldRef.current, selected.id))}>
                    Water (recall)
                  </button>
                  <button className="ghost quiet" onClick={() => commit(letGo(worldRef.current, selected.id))}>
                    Let go
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="journal" aria-label="Garden journal">
            <span className="group-label">Garden journal</span>
            <ul>
              {[...world.journal].reverse().slice(0, 7).map((j) => (
                <li key={j.id} className={j.kind}>
                  <em>Day {Math.floor(j.day)}</em> {j.text}
                </li>
              ))}
              {!world.journal.length && <li className="none">Nothing yet.</li>}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  )
}

function Legend() {
  return (
    <ul className="legend" aria-label="Legend">
      {(Object.keys(SPECIES) as (keyof typeof SPECIES)[]).map((k) => (
        <li key={k}>
          <i style={{ background: SPECIES[k].petal }} />
          {SPECIES[k].label}
        </li>
      ))}
    </ul>
  )
}
