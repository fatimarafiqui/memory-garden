import { useEffect, useMemo, useRef, useState } from 'react'
import Garden, { Overlay } from './components/Garden'
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
          <h1>
            Memory Garden <span>Debugger</span>
          </h1>
          <p className="kicker">See why your agent retrieved X instead of Y, what consolidated, and what decayed.</p>
        </div>
        <dl className="kpis mono">
          <div>
            <dt>live</dt>
            <dd>{count('live')}</dd>
          </div>
          <div>
            <dt>fading</dt>
            <dd>{count('fading')}</dd>
          </div>
          <div>
            <dt>merged</dt>
            <dd>{count('merged')}</dd>
          </div>
          <div>
            <dt>forgotten</dt>
            <dd>{count('forgotten')}</dd>
          </div>
          <div>
            <dt>turns</dt>
            <dd>
              {turnsSoFar}/{retrieves.length}
            </dd>
          </div>
        </dl>
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
              <ul className="legend">
                <li>size = times retrieved</li>
                <li>colour = layer</li>
                <li>opacity = strength</li>
                <li>vines = consolidation</li>
              </ul>
            )}
          </div>

          <div className="canvas">
            <Garden
              mems={mems}
              pos={layout.pos}
              layers={layout.layers}
              laneWidth={layout.laneWidth}
              cursor={cursor}
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
                {t === 'detail' ? 'Inspect' : t === 'events' ? `Events · ${events.length}` : 'Trace'}
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
                  <p>Press ▶ or drag the timeline to replay the trace. Click any plant to inspect a memory.</p>
                  <p className="muted">Switch to Retrieval replay and pick a turn to see why each candidate won or lost.</p>
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
    </div>
  )
}
