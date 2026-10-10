import { KeyboardEvent, PointerEvent, useRef } from 'react'
import { describe } from '../trace/replay'
import type { TraceEvent } from '../trace/types'

export const EVENT_COLORS: Record<TraceEvent['type'], string> = {
  store: '#7fd3b2',
  retrieve: '#8fb8ff',
  consolidate: '#ecc372',
  decay: '#e79a9a',
}

export default function Timeline({
  events,
  cursor,
  setCursor,
  playing,
  setPlaying,
  speed,
  setSpeed,
}: {
  events: TraceEvent[]
  cursor: number
  setCursor: (n: number) => void
  playing: boolean
  setPlaying: (p: boolean) => void
  speed: number
  setSpeed: (s: number) => void
}) {
  const strip = useRef<HTMLDivElement>(null)
  const n = events.length
  const current = events[cursor - 1]
  const tMax = n ? events[n - 1].t : 0

  const fromPointer = (e: PointerEvent) => {
    const r = strip.current!.getBoundingClientRect()
    const i = Math.floor(((e.clientX - r.left) / r.width) * n)
    setCursor(Math.max(0, Math.min(n, i + 1)))
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setCursor(Math.min(n, cursor + 1))
    else if (e.key === 'ArrowLeft') setCursor(Math.max(0, cursor - 1))
    else if (e.key === 'Home') setCursor(0)
    else if (e.key === 'End') setCursor(n)
    else return
    e.preventDefault()
  }

  return (
    <div className="timeline">
      <div className="tl-controls">
        <button className="icon" onClick={() => setCursor(0)} aria-label="Go to start" title="Start">
          ⏮
        </button>
        <button className="icon" onClick={() => setCursor(Math.max(0, cursor - 1))} aria-label="Previous event" title="Previous event">
          ◂
        </button>
        <button className="icon play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon" onClick={() => setCursor(Math.min(n, cursor + 1))} aria-label="Next event" title="Next event">
          ▸
        </button>
        <div className="speed" role="radiogroup" aria-label="Playback speed">
          {[1, 2, 4].map((s) => (
            <button key={s} role="radio" aria-checked={speed === s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <div className="tl-now mono">
          {current ? (
            <>
              <span className="tl-idx">#{cursor}</span> t={current.t}s · <span style={{ color: EVENT_COLORS[current.type] }}>{describe(current)}</span>
            </>
          ) : (
            <span className="muted">before the first event</span>
          )}
        </div>
      </div>

      <div
        ref={strip}
        className="tl-strip"
        role="slider"
        tabIndex={0}
        aria-label="Trace position"
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={cursor}
        aria-valuetext={current ? describe(current) : 'start'}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          fromPointer(e)
        }}
        onPointerMove={(e) => e.buttons && fromPointer(e)}
      >
        {events.map((e, i) => (
          <span
            key={i}
            className={`tick ${e.type} ${i < cursor ? 'past' : ''} ${i === cursor - 1 ? 'now' : ''}`}
            style={{ ['--c' as string]: EVENT_COLORS[e.type] }}
            title={`#${i + 1} t=${e.t}s · ${describe(e)}`}
          />
        ))}
        {n > 0 && <span className="tl-head" style={{ left: `${(cursor / n) * 100}%` }} />}
      </div>
      <div className="tl-axis mono">
        <span>t=0s</span>
        <span className="tl-legend">
          {(Object.keys(EVENT_COLORS) as TraceEvent['type'][]).map((k) => (
            <span key={k}>
              <i style={{ background: EVENT_COLORS[k] }} />
              {k}
            </span>
          ))}
        </span>
        <span>t={tMax}s</span>
      </div>
    </div>
  )
}
