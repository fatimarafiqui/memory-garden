import { Mem, Verdict, analyzeRetrieval, statusOf } from '../trace/replay'
import type { RetrieveEvent, TraceEvent } from '../trace/types'
import { colorOf } from './Garden'
import { EVENT_COLORS } from './Timeline'

const LayerDot = ({ layer, layers }: { layer: string; layers: string[] }) => <i className="dot" style={{ background: colorOf(layer, layers) }} />

export function RetrievalCard({
  event,
  verdicts,
  layers,
  selectedId,
  onSelect,
}: {
  event: RetrieveEvent
  verdicts: Verdict[]
  layers: string[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="card">
      <header className="card-head">
        <span className="chip" style={{ color: EVENT_COLORS.retrieve }}>retrieve</span>
        <span className="mono muted">turn {event.turn} · t={event.t}s</span>
      </header>
      <p className="query-text">“{event.query}”</p>
      <div className="params mono">
        <span>k={event.k ?? '—'}</span>
        <span>threshold={event.threshold?.toFixed(2) ?? '—'}</span>
        <span>layers={event.layers?.join(', ') ?? 'all'}</span>
      </div>
      <table className="cands">
        <thead>
          <tr>
            <th>#</th>
            <th>memory</th>
            <th>score</th>
            <th>verdict</th>
          </tr>
        </thead>
        <tbody>
          {verdicts.map((v) => (
            <tr key={v.id} className={`${v.won ? 'won' : 'lost'} ${v.id === selectedId ? 'sel' : ''}`} onClick={() => onSelect(v.id)}>
              <td className="mono muted">{v.rank}</td>
              <td>
                <span className="mono">
                  {v.mem && <LayerDot layer={v.mem.layer} layers={layers} />}
                  {v.id}
                </span>
              </td>
              <td>
                <span className="bar">
                  <i style={{ width: `${Math.round(v.score * 100)}%` }} />
                </span>
                <span className="mono">{v.score.toFixed(2)}</span>
              </td>
              <td className="verdict">
                {v.won ? (
                  <span className="ok">✓ returned</span>
                ) : (
                  <>
                    <span className="no">✕ {v.reasons[0]}</span>
                    {v.reasons.slice(1).map((r) => (
                      <span key={r} className="also">
                        + {r}
                      </span>
                    ))}
                  </>
                )}
                {v.note && <span className="also">note: {v.note}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function EventCard({ event, mems, layers }: { event: TraceEvent; mems: Map<string, Mem>; layers: string[] }) {
  const head = (
    <header className="card-head">
      <span className="chip" style={{ color: EVENT_COLORS[event.type] }}>{event.type}</span>
      <span className="mono muted">t={event.t}s</span>
    </header>
  )
  if (event.type === 'store')
    return (
      <section className="card">
        {head}
        <p className="mono">
          <LayerDot layer={event.layer} layers={layers} />
          {event.id} <span className="muted">· {event.layer}</span>
        </p>
        <p>{event.text}</p>
      </section>
    )
  if (event.type === 'consolidate')
    return (
      <section className="card">
        {head}
        <ul className="merge">
          {event.from.map((id) => (
            <li key={id}>
              <span className="mono">{id}</span> <span className="muted">{mems.get(id)?.text ?? 'unknown'}</span>
            </li>
          ))}
        </ul>
        <p className="merge-into">
          <span className="arrow">↓ folded into</span>
          <span className="mono">
            <LayerDot layer={event.layer ?? 'semantic'} layers={layers} />
            {event.into}
          </span>{' '}
          {event.text}
        </p>
      </section>
    )
  if (event.type === 'decay') {
    const m = mems.get(event.id)
    return (
      <section className="card">
        {head}
        <p className="mono">
          {event.id} strength → {m ? m.strength.toFixed(2) : event.to}
        </p>
        {event.reason && <p className="muted">{event.reason}</p>}
        {m && <p>{m.text}</p>}
      </section>
    )
  }
  return null
}

function Sparkline({ m, total }: { m: Mem; total: number }) {
  const w = 280
  const h = 44
  const x = (idx: number) => (total ? (idx / total) * w : 0)
  const y = (v: number) => 4 + (1 - v) * (h - 8)
  let d = `M${x(m.history[0].idx)},${y(m.history[0].v)}`
  for (let i = 1; i < m.history.length; i++) d += ` H${x(m.history[i].idx)} V${y(m.history[i].v)}`
  d += ` H${x(total)}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" preserveAspectRatio="none" aria-label="Strength over time">
      <line x1={0} x2={w} y1={y(0.35)} y2={y(0.35)} className="spark-ref" />
      <path d={d} className="spark-line" />
    </svg>
  )
}

export function MemoryCard({ m, events, cursor, layers, onClose }: { m: Mem; events: TraceEvent[]; cursor: number; layers: string[]; onClose: () => void }) {
  const history = events
    .slice(0, cursor)
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.type === 'retrieve' && e.candidates.some((c) => c.id === m.id))
    .map(({ e, i }) => ({ turn: (e as RetrieveEvent).turn, v: analyzeRetrieval(events, i).find((v) => v.id === m.id)! }))
  const st = statusOf(m)
  return (
    <section className="card">
      <header className="card-head">
        <span className="mono">
          <LayerDot layer={m.layer} layers={layers} />
          {m.id}
        </span>
        <span className={`status ${st}`}>{st}</span>
        <button className="x" onClick={onClose} aria-label="Close memory">
          ×
        </button>
      </header>
      <p>{m.text}</p>
      <dl className="stats mono">
        <dt>layer</dt>
        <dd>{m.layer}</dd>
        <dt>strength</dt>
        <dd>{m.strength.toFixed(2)}</dd>
        <dt>returned</dt>
        <dd>
          {m.retrievals} / {m.candidateCount} times considered
        </dd>
        {m.mergedInto && (
          <>
            <dt>merged into</dt>
            <dd>{m.mergedInto}</dd>
          </>
        )}
        {m.children.length > 0 && (
          <>
            <dt>made from</dt>
            <dd>{m.children.join(', ')}</dd>
          </>
        )}
      </dl>
      <div className="spark-wrap">
        <span className="muted mono">strength over trace</span>
        <Sparkline m={m} total={Math.max(events.length, 1)} />
      </div>
      {history.length > 0 && (
        <ul className="hist">
          {history.map(({ turn, v }) => (
            <li key={turn} className={v.won ? 'ok' : 'no'}>
              <span className="mono">turn {turn}</span> <span className="mono">{v.score.toFixed(2)}</span> {v.won ? '✓ returned' : `✕ ${v.reasons[0]}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
