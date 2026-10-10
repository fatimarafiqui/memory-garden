import type { ParseResult } from '../trace/parse'

const FORMAT = `{"type":"store","t":0,"id":"m1","layer":"episodic","text":"…"}
{"type":"retrieve","t":22,"turn":1,"query":"…","k":3,"threshold":0.4,
 "layers":["episodic"],"candidates":[{"id":"m1","score":0.86}],"selected":["m1"]}
{"type":"consolidate","t":45,"from":["m1","m5"],"into":"m9","layer":"semantic","text":"…"}
{"type":"decay","t":46,"id":"m1","to":0.5,"reason":"…"}`

export default function TracePanel({
  draft,
  setDraft,
  result,
  onApply,
  onSample,
}: {
  draft: string
  setDraft: (s: string) => void
  result: ParseResult
  onApply: () => void
  onSample: () => void
}) {
  const onFile = async (f: File | undefined) => {
    if (f) setDraft(await f.text())
  }
  return (
    <section className="card trace">
      <p className="muted">Paste a JSONL trace, choose a file, or drop one anywhere on the page. One event per line.</p>
      <textarea className="mono" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} aria-label="Trace JSONL" rows={10} />
      <div className="row">
        <button className="btn primary" onClick={onApply}>
          Load trace
        </button>
        <label className="btn">
          Choose file…
          <input type="file" accept=".jsonl,.json,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button className="btn ghost" onClick={onSample}>
          Use sample
        </button>
      </div>
      <p className="mono muted small">
        {result.events.length} events loaded · {result.errors.length} errors · {result.warnings.length} warnings
      </p>
      {result.errors.length > 0 && (
        <ul className="issues err">
          {result.errors.slice(0, 8).map((e) => (
            <li key={e.line}>
              line {e.line}: {e.message}
            </li>
          ))}
        </ul>
      )}
      {result.warnings.length > 0 && (
        <ul className="issues warn">
          {result.warnings.slice(0, 8).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <details>
        <summary>Trace format</summary>
        <p className="muted small">
          Four event types. <code>t</code> is any increasing clock. For <code>retrieve</code>, <code>selected</code> is what was returned; if omitted it is
          derived from <code>k</code> and <code>threshold</code>.
        </p>
        <pre className="mono">{FORMAT}</pre>
      </details>
    </section>
  )
}
