# Memory Garden

A live visualization of an AI agent's memory as a garden. Chat with a small agent and watch its mind grow, link up, and forget.

> **Talk:** *What should forgetting look like?*

Almost nobody designs for AI memory. This project treats memory as something with a lifecycle you can *see*, and uses forgetting as the lens: when an agent lets something go, what should the person see, and what should the agent be able to say about it?

The agent here is a deliberately simple, rule-based stand-in (no model, no real data, nothing proprietary). The point is the interface, not the intelligence.

## Look

An isometric block of garden: lime ground, flowers built from little 3-tone balls, trees as stacked spheres, terracotta plots, yellow paths and halftone shadows. The style is inspired by [Garden Blocks](https://dribbble.com/shots/8552286-Garden-Blocks) by Guillaume Kurkdjian; it's a re-interpretation, not a copy.

## The metaphor

| Memory event | Garden event |
| --- | --- |
| You tell the agent a fact | A seed is planted; it sprouts and blooms over a few days |
| The fact isn't used | It wilts: stem bends, petals fall, colour drains |
| The agent recalls it (you ask) | It's watered; neighbours it's linked to get a little fresher |
| Two facts share a topic | Cross-pollination: a yellow path between them with white pollen drifting along it |
| A fact is recalled and well-connected | Consolidation: it grows into a tree and absorbs its neighbours as acorns |
| Different kinds of memory | Different flower species (people, preferences, places, work, plans, facts) |

Plans decay fastest, people and preferences slowest, and trees barely at all. Memories that are linked decay more slowly.

## Four ways to forget

The switcher in the UI changes what happens when a memory runs out of strength. This is the design question.

| Style | What you see | What the agent knows | Trade-off |
| --- | --- | --- | --- |
| **Fade** | Wilts, then is simply gone | "I used to know something about that, but it faded." | Honest, but the detail is lost for good |
| **Compost** | Returns to the soil as a dark plot; the gist remains and feeds new growth on the same topic | "I've only got the gist now." | Graceful loss that keeps some value |
| **Press** | Flattened into a herbarium sheet, out of the garden | Can retrieve it whole on request | Safe, but nothing is really forgotten |
| **Delete** | Vanishes with no wilting | "I don't have anything about that." (unaware) | Abrupt; the agent can't tell you it lost anything |

## Design principles (draft)

1. **Forgetting should be visible before it's final.** Wilting is a warning you can act on (water it, or let it go).
2. **Loss should degrade, not cliff.** Detail goes first, gist last.
3. **The agent should know what it has forgotten.** Honest "I used to know" beats silent amnesia.
4. **Use strengthens.** Recall, links and consolidation are the only things that keep a memory alive.
5. **People hold the garden's shears.** Any memory can be watered or let go by hand.

## Try it

```bash
npm install
npm run dev   # http://localhost:5180
```

1. Hit **Plant a sample garden**, or type your own sentences.
2. Let time pass (**A week passes**) and watch what wilts.
3. Ask a question ("What do you remember about Amara?") to water something.
4. Switch **Forgetting** style and compare.

## How it's built

- Vite + React + TypeScript, SVG rendering, no runtime dependencies beyond React.
- `src/engine/memory.ts`: the whole memory model (keyword extraction, linking, decay, consolidation, the four forgetting styles). Pure functions over a `World`.
- `src/components/Garden.tsx`: the SVG scene.
- `src/App.tsx`: chat, controls, inspector, herbarium, journal.

## Open questions

- Should the person ever see a wilting memory *before* they could be asked about it?
- Is the gist a feature or a privacy leak?
- Who decides when something should be forgotten: the agent, the user, or a policy?
- What does forgetting look like for memories that other memories depend on?
