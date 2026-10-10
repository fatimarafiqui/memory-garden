# Memory Garden Debugger

Drop in an agent's memory trace, get a live map of its memory, and scrub through time to see **why it retrieved what it retrieved**.

> **Talk:** *Your agent's memory is a garden, and your logs are hiding the weeds.*

Anyone building agents with memory layers eventually asks: why did it retrieve X instead of Y? What got consolidated? What decayed? Reading logs to answer that is slow. A live map is faster.

## Three views, one canvas

1. **Garden.** Each memory is a plant. Size = how often it has been retrieved, colour = layer (short-term, episodic, semantic, procedural), opacity = strength. Consolidated memories grow into trees; vines connect them to what they absorbed.
2. **Retrieval replay.** Pick any agent turn. The query appears above the garden, every candidate gets a line weighted by its similarity score, winners pulse, and losers say why they lost: decayed, already consolidated, outside the searched layers, below threshold, or outside top-k.
3. **Timeline scrubber.** Drag across the session (or press play) and watch stores, merges, decays and retrievals happen in order. Pause on a consolidation to see exactly what merged into what.

Click any plant to inspect it: its strength over time, and every turn it was considered for, with the verdict.

## Trace format

Plain JSONL, one event per line, four event types. Any memory framework can emit this with a few lines.

```jsonl
{"type":"store","t":0,"id":"m1","layer":"episodic","text":"User is planning a trip to Lisbon in May"}
{"type":"retrieve","t":22,"turn":1,"query":"Suggest flights","k":3,"threshold":0.4,"layers":["episodic"],"candidates":[{"id":"m1","score":0.86}],"selected":["m1"]}
{"type":"consolidate","t":45,"from":["m1","m5"],"into":"m9","layer":"semantic","text":"Lisbon trip summary"}
{"type":"decay","t":46,"id":"m1","to":0.5,"reason":"consolidated source"}
```

- `t` is any increasing clock (seconds is fine).
- `retrieve.selected` is what the layer actually returned; if omitted it is derived from `k` and `threshold`. `layers` is optional (omitted means all were searched). Candidates may carry a `reason` note.
- `decay` takes either `to` (new strength 0–1) or `delta`.

The loss reasons are computed from the memory state just before each retrieval, so you get them without logging them.

## Try it

```bash
npm install
npm run dev   # http://localhost:5180
```

A sample trace (an assistant helping plan a trip) loads by default. Paste, choose or drop your own under **Trace**.

## How it's built

- Vite + React + TypeScript, SVG rendering, no runtime dependencies beyond React.
- `src/trace/parse.ts`: JSONL parsing and validation (errors per line, warnings for unknown ids).
- `src/trace/replay.ts`: `stateAt(events, n)` replays the first n events (pure, so scrubbing is cheap); `analyzeRetrieval` explains each candidate's verdict.
- `src/components/Garden.tsx`: the canvas. `Timeline.tsx`, `Detail.tsx`, `TracePanel.tsx`: the rest of the UI.

Generic by design: layer names and the sample are not tied to any particular memory product.
