import { useEffect, useMemo, useRef, useState } from 'react'
import Garden, { Head, LAYER_COLORS, Overlay, colorOf } from './components/Garden'
import Timeline, { EVENT_COLORS } from './components/Timeline'
import { EventCard, MemoryCard, RetrievalCard } from './components/Detail'
import TracePanel from './components/TracePanel'
import { ParseResult, parseTrace } from './trace/parse'
import { analyzeRetrieval, describe, layoutOf, stateAt, statusOf } from './trace/replay'
import { SAMPLE_TRACE } from './trace/sample'
import type { RetrieveEvent } from './trace/types'

type Mode = 'garden' | 'replay'
type Tab = 'detail' | 'events' | 'trace'

export default function App() {
  const [result, setResult] = useState<ParseResult>(() => parseTrace(SAMPLE_TRACE))
  const [draft, setDraft] = useState(SAMPLE_TRACE)
  const events = result.events
  const [cursor, setCursorRaw] = useState(0)
  const [mode, setMode] = useState<Mode>('garden')
  const [tab, setTab] = useState<Tab>('detail')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const logRef = useRef<HTMLOListElement>(null)

  const setCursor = (n: number) => setCursorRaw(Math.max(0, Math.min(events.length, n)))

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setCursorRaw((c) => {
        if (c >= events.length) {
          setPlaying(false)
          return c
        }
        return c + 1
      })
    }, 900 / speed)
    return () => window.clearInterval(id)
  }, [playing, speed, events.length])

  const layout = useMemo(() => layoutOf(events), [events])
  const mems = useMemo(() => stateAt(events, cursor), [events, cursor])
  const current = events[cursor - 1]

  const retrieves = useMemo(() => events.map((e, i) => ({ e, i })).filter((r): r is { e: RetrieveEvent; i: number } => r.e.type === 'retrieve'), [events])
  const replayIdx = useMemo(() => {
    if (mode === 'replay') {
      for (let i = cursor - 1; i >= 0; i--) if (events[i].type === 'retrieve') return i
      return -1
    }
    return current?.type === 'retrieve' ? cursor - 1 : -1
  }, [mode, cursor, events, current])

  const verdicts = useMemo(() => (replayIdx >= 0 ? analyzeRetrieval(events, replayIdx) : []), [events, replayIdx])
  const replayEvent = replayIdx >= 0 ? (events[replayIdx] as RetrieveEvent) : null
  const overlay: Overlay | null = replayEvent ? { query: replayEvent.query, turn: replayEvent.turn, verdicts } : null

  const switchMode = (m: Mode) => {
    setMode(m)
    if (m === 'replay' && retrieves.length && !retrieves.some((r) => r.i < cursor)) setCursor(retrieves[0].i + 1)
  }

  useEffect(() => {
    logRef.current?.querySelector('.now')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, tab])

  const load = (text: string) => {
    const r = parseTrace(text)
    setResult(r)
    setDraft(text)
    setCursorRaw(0)
    setSelectedId(null)
    setPlaying(false)
    if (r.events.length) setTab('detail')
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) load(await f.text())
  }

  const all = [...mems.values()]
  const count = (s: string) => all.filter((m) => statusOf(m) === s).length
  const turnsSoFar = retrieves.filter((r) => r.i < cursor).length
  const selected = selectedId ? mems.get(selectedId) ?? null : null

  return (
    <div className="app" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <header className="top">
        <div className="brand">
          <svg className="mark" viewBox="0 0 40 40" aria-hidden>
            <path d="M20 37 C20 28 19 22 20 14" stroke="#5f8a63" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M20 27 q-8 -1 -11 -7 q7 0 11 7" fill="#5f8a63" />
            <path d="M20 22 q7 -2 9 -8 q-6 1 -9 8" fill="#7a9e7e" />
            {Array.from({ length: 8 }, (_, i) => (
              <ellipse key={i} cx="20" cy="5.5" rx="2.6" ry="4.6" fill="#f1e2c2" stroke="#2c3e2d" strokeOpacity="0.5" strokeWidth="0.7" transform={`rotate(${i * 45} 20 10)`} />
            ))}
            <circle cx="20" cy="10" r="2.6" fill="#d9a441" />
          </svg>
          <div>
            <h1>Memory Garden</h1>
            <p className="kicker">
              Logs tell you what your agent remembered. This shows you <em>why</em>.
            </p>
          </div>
        </div>
        <p className="readout mono" aria-live="off">
          <b>{count('live')}</b> growing · <b>{count('fading')}</b> wilting · <b>{count('merged')}</b> folded · <b>{count('forgotten')}</b> forgotten
          <span className="sep">|</span> turn <b>{turnsSoFar}</b> of {retrieves.length}
        </p>
      </header>

      <main className="layout">
        <section className="stage">
          <div className="toolbar">
            <div className="seg" role="tablist" aria-label="View">
              <button role="tab" aria-selected={mode === 'garden'} className={mode === 'garden' ? 'on' : ''} onClick={() => switchMode('garden')}>
                Garden
              </button>
              <button role="tab" aria-selected={mode === 'replay'} className={mode === 'replay' ? 'on' : ''} onClick={() => switchMode('replay')}>
                Retrieval replay
              </button>
            </div>
            {mode === 'replay' ? (
              <div className="turns" aria-label="Agent turns">
                {retrieves.map((r) => (
                  <button key={r.i} className={`turn ${r.i === replayIdx ? 'on' : ''}`} onClick={() => setCursor(r.i + 1)} title={r.e.query}>
                    Turn {r.e.turn}
                  </button>
                ))}
              </div>
            ) : (
              <Key layers={layout.layers} />
            )}
          </div>

          <div className="canvas">
            <Garden
              mems={mems}
              pos={layout.pos}
              layers={layout.layers}
              laneWidth={layout.laneWidth}
              cursor={cursor}
              current={current}
              overlay={overlay}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id)
                if (id) setTab('detail')
              }}
            />
          </div>

          <Timeline events={events} cursor={cursor} setCursor={setCursor} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />
        </section>

        <aside className="side">
          <div className="seg tabs" role="tablist" aria-label="Panel">
            {(['detail', 'events', 'trace'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {t === 'detail' ? 'Field notes' : t === 'events' ? `Log · ${events.length}` : 'Load a trace'}
              </button>
            ))}
          </div>

          {tab === 'detail' && (
            <div className="stack">
              {replayEvent && <RetrievalCard event={replayEvent} verdicts={verdicts} layers={layout.layers} selectedId={selectedId} onSelect={setSelectedId} />}
              {current && current.type !== 'retrieve' && !(mode === 'replay' && replayEvent) && <EventCard event={current} mems={mems} layers={layout.layers} />}
              {selected && <MemoryCard m={selected} events={events} cursor={cursor} layers={layout.layers} onClose={() => setSelectedId(null)} />}
              {!current && !selected && (
                <section className="card hint">
                  <p className="hand-p">Start here.</p>
                  <p>Press ▶ to replay the session, or drag along the timeline. Click any plant to see its story.</p>
                  <p className="muted">The interesting bit is <b>Retrieval replay</b>: pick a turn and see why each memory made it, or didn’t.</p>
                </section>
              )}
            </div>
          )}

          {tab === 'events' && (
            <ol className="log card" ref={logRef}>
              {events.map((e, i) => (
                <li key={i} className={`${i < cursor ? 'past' : ''} ${i === cursor - 1 ? 'now' : ''}`} onClick={() => setCursor(i + 1)}>
                  <span className="mono muted">{String(i + 1).padStart(2, '0')}</span>
                  <i className="dot" style={{ background: EVENT_COLORS[e.type] }} />
                  <span className="mono muted">t={e.t}</span>
                  <span className="log-text">{describe(e)}</span>
                </li>
              ))}
            </ol>
          )}

          {tab === 'trace' && <TracePanel draft={draft} setDraft={setDraft} result={result} onApply={() => load(draft)} onSample={() => load(SAMPLE_TRACE)} />}
        </aside>
      </main>

      <footer className="foot">
        <span>
          Designed and built by <a href="https://fatimarafiqui.com">Fatima Rafiqui</a>
        </span>
        <span className="muted">The sample session is made up. Drop in your own trace to see your agent’s garden.</span>
      </footer>
    </div>
  )
}

const KEY_SPECIES: Record<string, 'sprig' | 'daisy' | 'tulip' | 'lavender'> = { 'short-term': 'sprig', episodic: 'daisy', semantic: 'tulip', procedural: 'lavender' }

function Key({ layers }: { layers: string[] }) {
  return (
    <div className="key" aria-label="How to read the garden">
      {layers.map((l) => (
        <span key={l} className="key-item">
          <svg viewBox="-14 -14 28 28" width="22" height="22" aria-hidden>
            <Head species={KEY_SPECIES[l] ?? 'daisy'} R={9} color={LAYER_COLORS[l] ?? colorOf(l, layers)} />
          </svg>
          {l}
        </span>
      ))}
      <span className="key-rules">bigger = recalled more · fainter = weaker · vines = merged</span>
    </div>
  )
}
