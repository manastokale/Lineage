# Lineage

Lineage is a moment-aware AI workspace for exploring *Friends* like a living script, not a flat transcript.

Pick a dialogue line, press Enter, and ask a character from that exact point in the episode. The answer is constrained by the script moment, prior character memory, shared interactions, and continuity guardrails, so characters do not casually know things that have not happened yet.

**Live app:** [lineage-sooty.vercel.app](https://lineage-sooty.vercel.app)

![Home Page](homepage.png)
![Rerank debugger](rerank_dev.png)
![Character Arcs](relation_graph.png)

## What You Can Do

- **Read episodes as a navigable screenplay.** Move line-by-line, jump scenes, and use the vertical scene selector to stay oriented.
- **Ask from a specific moment.** Highlight a line, hit Enter, and the Ask cursor opens for that exact character/context.
- **Stay inside Friends canon.** Ask is guarded to answer only from Friends context, resist prompt manipulation, and avoid future spoilers from a character POV.
- **Inspect continuity risks.** The scanner flags possible contradictions by extracting semantic claims and validating them against prior memory.
- **Analyze edited dialogue.** Change a line locally and run impact analysis only after the dialogue actually changes.
- **Explore relationship memory.** The graph view shows prior character arcs and shared interactions before the active episode.
- **Track model usage.** Usage shows provider health, RPD, feature spread, live model consumption, and Ask rerank traces.
- **Learn in-app.** The Guide button walks new users through the problem, workflow, and expected outputs.

## Why It Exists

Most character chat demos collapse time. A character answers from the whole show, the internet, or vague recap memory.

Lineage solves a narrower problem: **what could this character plausibly say at this exact line?**

That makes it useful for continuity review, story analysis, narrative AI demos, and anyone interested in grounded character reasoning instead of free-form roleplay.

## How It Works

1. Friends transcripts are parsed into seasons, episodes, scenes, and dialogue lines.
2. Prior character arcs and shared interaction summaries are generated and stored.
3. Ask retrieves and reranks only relevant prior memories for the selected moment.
4. Prompt guardrails keep answers short, Friends-only, character-aware, and timeline-safe.
5. Continuity scanning extracts meaning from current lines, retrieves older context, and validates possible contradictions.
6. Edit impact compares a changed line against prior memory, local scene context, and downstream dialogue.

## Product Surfaces

- **Hub:** screenplay feed, inline Ask, continuity cards, edit-impact workbench, scene selector, and cast lens.
- **Graph:** character relationship exploration with prior arcs and interaction memory.
- **Usage:** system health, provider routing, model limits, RPD, feature consumption, and retrieval debug traces.

## Tech Stack

- React + TypeScript + Tailwind frontend
- FastAPI backend
- Chroma-backed local memory store
- exported read-only memory for Vercel
- retrieval-augmented generation with reranking
- multi-provider LLM routing and usage telemetry
- per-device Ask threads, rate limits, and guardrail retries

## Run Locally

From the repo root:

```bash
./scripts/friendsos.sh start local dev
```

Open:

```text
http://127.0.0.1:5173
```

Stop:

```bash
./scripts/friendsos.sh stop local dev
```

## Deploy

The repo is Vercel-ready:

- frontend builds from `frontend/`
- FastAPI routes are exposed through `api/`
- serverless mode uses bundled memory from `memory_data/`

After regenerating local memory, export the latest snapshot for Vercel:

```bash
./.venv311/bin/python scripts/export_memory_store.py
```

See [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) for deployment notes.

## One-Line Summary

Lineage is a grounded narrative AI system where characters answer from what they have actually lived through, at the exact moment you select.
