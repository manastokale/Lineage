# FriendsOS — Master Build Instructions
### For Antigravity IDE · Claude Opus 4.6 · End-to-End Implementation Guide

---

> **How to use this file**: Feed this document directly to Antigravity IDE. It is written as a series of explicit, ordered directives. The IDE should execute each phase sequentially, never skipping ahead. Phases marked `[PARALLEL]` may be scaffolded simultaneously. Every section that says `<!-- AI: ... -->` is a direct instruction to the IDE agent.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure to Create](#2-folder-structure-to-create)
3. [User Setup Manual](#3-user-setup-manual-read-first)
4. [Environment & API Keys](#4-environment--api-keys)
5. [Phase 1 — Script Ingestion Pipeline](#5-phase-1--script-ingestion-pipeline)
6. [Phase 2 — Character Agent System](#6-phase-2--character-agent-system)
7. [Phase 3 — Memory Stack (Redis + ChromaDB)](#7-phase-3--memory-stack-redis--chromadb)
8. [Phase 4 — LangGraph Orchestrator](#8-phase-4--langgraph-orchestrator)
9. [Phase 5 — FastAPI Backend](#9-phase-5--fastapi-backend)
10. [Phase 6 — React Frontend (Tailwind + TypeScript)](#10-phase-6--react-frontend-tailwind--typescript)
11. [Phase 7 — What-If Mode](#11-phase-7--what-if-mode)
12. [Phase 8 — Converge Mode](#12-phase-8--converge-mode)
13. [Dummy Data Layer (Frontend Testing)](#13-dummy-data-layer-frontend-testing)
14. [Mockup Frame Reference](#14-mockup-frame-reference)
15. [Design System Reference](#15-design-system-reference)
16. [Docker Compose & Infra](#16-docker-compose--infra)
17. [Deployment Guide](#17-deployment-guide)
18. [Testing Checklist](#18-testing-checklist)

---

## 1. Project Overview

**FriendsOS** is a multi-agent narrative simulation engine built around the Friends TV show. Each main character (Ross, Rachel, Monica, Chandler, Joey, Phoebe) is an independent LLM-powered agent with its own persistent memory, emotion state, and personality identity file. Users can:

- Watch AI-generated episodes unfold in real time (Live Script Stream)
- Manipulate character emotions and inject scenario overrides (What-If mode)
- Force the narrative back to a canonical episode ending despite divergence (Converge mode)
- Browse and manage an episode archive with branching timelines
- View and edit each character's personality matrix (Cast Roster / Agent Directory)

### Core Architecture

```
episode_scripts/          ← Raw HTML episode scripts (provided by user)
        ↓
  Script Parser (Python/BeautifulSoup)
        ↓
  Scene Graphs (JSON: who speaks, to whom, emotion tags, scene metadata)
        ↓
  ChromaDB (semantic memory per character, cross-episode)
  Redis   (in-episode working memory)
        ↓
  Agent Layer (one LangGraph node per character)
   ├── character.md identity files (emotion levels, memory clusters, anchors)
   ├── Short-term: Redis
   └── Long-term: ChromaDB
        ↓
  LangGraph Orchestrator
   ├── What-If Mode  (user manipulates → agents respond to new reality)
   └── Converge Mode (agents steered back toward canonical ending)
        ↓
  FastAPI Backend (SSE for live streaming, REST for state)
        ↓
  React + TypeScript + Tailwind Frontend
```

### Model Strategy (Hybrid — No Fine-Tuning Required)

| Task | Model | Why |
|---|---|---|
| Character dialogue generation | Gemma 4 e4b-it (via Ollama) | Fast, cheap, runs locally |
| Converge trajectory decisions | Claude Haiku (via API) OR Qwen 2.5 72B (via Groq) | Requires dual-task reasoning |
| Emotion state updates | Gemma 4 e4b-it (structured output) | Simple instruction-following |
| Script diff generation | Python `difflib` | No LLM needed |

---

## 2. Folder Structure to Create

<!-- AI: Create this exact directory tree before writing any code. -->

```
friendsOS/
├── MASTER_INSTRUCTIONS.md          ← this file
├── .env                            ← API keys (DO NOT COMMIT)
├── .env.example                    ← committed template
├── .gitignore
├── docker-compose.yml
│
├── episode_scripts/                ← USER-PROVIDED: HTML episode files
│   ├── s01e01.html
│   ├── s01e02.html
│   └── ...
│
├── mockup_frames/                  ← USER-PROVIDED: Design mockup PNGs/HTMLs
│   ├── frame_name
│   │   ├── code.html
│   │   ├── screen.png
│   ├── frame_name
│   │   ├── code.html
│   │   ├── screen.png
│   ├── frame_name
│   │   ├── code.html
│   │   ├── screen.png
│   └── frame_name
│       ├── code.html
│       └── screen.png
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                     ← FastAPI entry point
│   ├── config.py                   ← settings, env loading
│   │
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── parser.py               ← HTML script → scene graph
│   │   ├── chunker.py              ← scene graph → ChromaDB chunks
│   │   └── run_ingest.py           ← CLI: python -m ingestion.run_ingest
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base_agent.py           ← BaseCharacterAgent class
│   │   ├── chandler.py
│   │   ├── monica.py
│   │   ├── ross.py
│   │   ├── rachel.py
│   │   ├── joey.py
│   │   ├── phoebe.py
│   │   └── identity/               ← character.md files
│   │       ├── chandler.md
│   │       ├── monica.md
│   │       ├── ross.md
│   │       ├── rachel.md
│   │       ├── joey.md
│   │       └── phoebe.md
│   │
│   ├── memory/
│   │   ├── __init__.py
│   │   ├── redis_client.py
│   │   └── chroma_client.py
│   │
│   ├── orchestrator/
│   │   ├── __init__.py
│   │   ├── graph.py                ← LangGraph definition
│   │   ├── what_if.py              ← What-If mode logic
│   │   └── converge.py             ← Converge mode trajectory logic
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── episodes.py
│   │   ├── agents.py
│   │   ├── stream.py               ← SSE endpoint
│   │   └── pivot.py                ← What-If / Converge triggers
│   │
│   └── dummy/
│       └── data.py                 ← Dummy responses for frontend testing
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── vite.config.ts
    ├── index.html
    │
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types/
        │   └── index.ts
        ├── store/
        │   └── useStore.ts         ← Zustand global state
        ├── hooks/
        │   ├── useSSE.ts
        │   └── useAgents.ts
        ├── lib/
        │   └── api.ts              ← axios client
        ├── dummy/
        │   └── mockData.ts         ← All dummy data for offline testing
        │
        └── pages/
            ├── CentralHub.tsx      ← Mockup frame 3
            ├── EpisodeArchive.tsx  ← Mockup frame 4
            ├── CastRoster.tsx      ← Mockup frame 5
            ├── AgentProfile.tsx    ← Mockup frame 6
            ├── EpisodeView.tsx     ← Mockup frame 2
            └── PivotPanel.tsx      ← Mockup frame 1
```

---

## 3. User Setup Manual (Read First)

> **This section is for you — the human. Read and complete all steps before feeding this file to the IDE.**

### Step 1 — Install Prerequisites

```bash
# macOS
brew install python@3.11 node redis ollama docker

# Verify
python3 --version    # must be 3.11+
node --version       # must be 18+
docker --version
ollama --version
```

```bash
# Windows (WSL2 recommended)
# Install WSL2 first, then run the macOS commands inside Ubuntu
```

### Step 2 — Pull the Local Model via Ollama

```bash
# Pull Gemma 4 for dialogue generation (requires ~6GB disk)
ollama pull gemma2:latest

# Verify it runs
ollama run gemma2:latest "Say hi as Chandler Bing"
```

> **Note**: If your machine has less than 8GB RAM, use `ollama pull mistral:7b` instead and update `OLLAMA_MODEL=mistral:7b` in your `.env` file.

### Step 3 — Get API Keys

You need **at least one** of the following:

| Service | Purpose | Where to get it | Cost |
|---|---|---|---|
| Anthropic API | Converge mode reasoning (Claude Haiku) | console.anthropic.com | ~$0.0025/1K tokens |
| Groq API | Alternative for Qwen 72B | console.groq.com | Free tier available |
| OpenAI API | GPT-4o alternative | platform.openai.com | Pay per use |

For the **Groq free tier** (recommended for getting started): sign up at `console.groq.com` → Create API key → copy it.

### Step 4 — Populate episode_scripts Folder

Place your Friends episode HTML scripts in `episode_scripts/`. The parser expects them named as `s01e01.html`, `s01e02.html`, etc.

**Reference source**: The Internet Archive hosts transcripts at `https://fangj.github.io/friends/` — download each episode HTML page and save it to `episode_scripts/`.

The parser handles the HTML structure from that site automatically (see Phase 1). If using a different source, check `backend/ingestion/parser.py` and update the CSS selectors.

### Step 5 — Copy `.env.example` to `.env`

```bash
cp .env.example .env
# Then fill in your keys (see Section 4)
```

### Step 6 — Run the Ingestion Pipeline

```bash
cd backend
pip install -r requirements.txt
python -m ingestion.run_ingest --scripts-dir ../episode_scripts --season 1
```

This populates ChromaDB with episode scene graphs. Run once per season.

### Step 7 — Start the Full Stack

```bash
# From project root
docker-compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- ChromaDB UI: `http://localhost:8001` (if enabled)

### Step 8 — Toggle Dummy Data Mode

To test the frontend without LLM calls, set in `.env`:

```
USE_DUMMY_DATA=true
```

All API endpoints will return pre-written dummy responses instead of calling any LLM. The frontend behaves identically. Switch back to `false` when your models are ready.

---

## 4. Environment & API Keys

<!-- AI: Create both .env.example (committed) and .env (gitignored) with these variables. -->

### `.env.example`

```env
# ─── Application ────────────────────────────────────────────
APP_ENV=development
USE_DUMMY_DATA=true         # Set to false when LLMs are ready

# ─── Ollama (local model for dialogue) ──────────────────────
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma2:latest

# ─── Anthropic (Converge mode reasoning) ────────────────────
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

# ─── Groq (alternative to Anthropic for Converge) ───────────
GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE
GROQ_MODEL=qwen2.5-72b-instruct

# ─── Which model to use for Converge decisions ──────────────
CONVERGE_MODEL_PROVIDER=groq    # Options: anthropic | groq | openai

# ─── OpenAI (optional fallback) ─────────────────────────────
OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE

# ─── Redis ──────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── ChromaDB ───────────────────────────────────────────────
CHROMA_HOST=localhost
CHROMA_PORT=8001
CHROMA_COLLECTION_NAME=friendsos_memory

# ─── LangSmith (optional, for tracing LangGraph runs) ───────
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=YOUR_LANGSMITH_API_KEY_HERE
LANGCHAIN_PROJECT=friendsos
```

### `.gitignore` additions

```
.env
__pycache__/
*.pyc
chroma_data/
redis_data/
node_modules/
dist/
```

---

## 5. Phase 1 — Script Ingestion Pipeline

<!-- AI: Implement backend/ingestion/ completely before any other backend work. -->

### Goal
Parse HTML episode scripts from `episode_scripts/` into structured scene graphs, then chunk and store them in ChromaDB with per-character embeddings.

### Reference: HTML Structure of Episode Scripts

The episode scripts at `fangj.github.io/friends/` follow this pattern:

```html
<!-- Example: s01e01.html structure -->
<html>
<head><title>The One Where Monica Gets A Roommate</title></head>
<body>
<p><b>Written by:</b> David Crane &amp; Marta Kauffman</p>
<hr>
<p><b>[Scene: Central Perk...]</b></p>
<p><b>Monica:</b> There's nothing to tell!</p>
<p><b>Rachel:</b> (running in) Okay, I just pulled out four eyelashes. That's not good!</p>
<p><em>(Scene description in italics or brackets)</em></p>
</body>
</html>
```

### `backend/ingestion/parser.py`

```python
"""
HTML Episode Script Parser
Converts raw HTML episode files into structured scene graph JSON.

Input:  episode_scripts/s01e01.html
Output: {
  "episode_id": "s01e01",
  "title": "The One Where Monica Gets A Roommate",
  "scenes": [
    {
      "scene_id": "s01e01_sc01",
      "location": "Central Perk",
      "time_of_day": "afternoon",
      "lines": [
        {
          "speaker": "Monica",
          "text": "There's nothing to tell!",
          "emotion_tags": ["defensive", "nervous"],
          "addressed_to": ["Rachel"]   # inferred from context
        }
      ],
      "scene_description": "The gang is sitting around the couch..."
    }
  ]
}
"""

from bs4 import BeautifulSoup
import json
import re
from pathlib import Path
from typing import Optional

# All recognized character names (expand as needed)
CHARACTERS = {
    "Monica", "Rachel", "Ross", "Chandler", "Joey", "Phoebe",
    "Gunther", "Janice", "Carol", "Susan", "Mr. Heckles", "Tag"
}

# Emotion keyword → tag mapping (extend freely)
EMOTION_KEYWORDS = {
    "laughing": "joy", "smiling": "joy", "excited": "joy", "happy": "joy",
    "crying": "sadness", "tearful": "sadness",
    "angry": "anger", "furious": "anger", "yelling": "anger",
    "nervous": "anxiety", "anxious": "anxiety", "worried": "anxiety",
    "sarcastic": "sarcasm", "sarcastically": "sarcasm",
    "confused": "confusion", "hesitant": "confusion"
}

LOCATION_PATTERNS = [
    r"\[Scene:?\s*(.+?)\]",
    r"\(Scene:?\s*(.+?)\)",
    r"INT\.\s+(.+?)\s*[-–]",
    r"EXT\.\s+(.+?)\s*[-–]"
]

def extract_emotion_tags(stage_direction: str) -> list[str]:
    tags = []
    direction_lower = stage_direction.lower()
    for keyword, emotion in EMOTION_KEYWORDS.items():
        if keyword in direction_lower and emotion not in tags:
            tags.append(emotion)
    return tags

def extract_location(text: str) -> Optional[str]:
    for pattern in LOCATION_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().rstrip(".")
    return None

def infer_addressee(text: str, speaker: str) -> list[str]:
    """Simple heuristic: if a character name appears in dialogue, they may be addressed."""
    mentioned = []
    for char in CHARACTERS:
        if char != speaker and re.search(r'\b' + char + r'\b', text, re.IGNORECASE):
            mentioned.append(char)
    return mentioned[:2]  # cap at 2 to avoid noise

def parse_episode(html_path: Path) -> dict:
    with open(html_path, "r", encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    episode_id = html_path.stem  # e.g. "s01e01"
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else episode_id

    paragraphs = soup.find_all("p")

    scenes = []
    current_scene = None
    current_location = None
    scene_counter = 0

    for p in paragraphs:
        raw = p.get_text(separator=" ", strip=True)
        if not raw:
            continue

        # Detect scene boundary
        loc = extract_location(raw)
        if loc or re.match(r'^\[Scene', raw, re.IGNORECASE):
            scene_counter += 1
            current_location = loc or current_location or "Unknown"
            current_scene = {
                "scene_id": f"{episode_id}_sc{scene_counter:02d}",
                "location": current_location,
                "time_of_day": "day",
                "lines": [],
                "scene_description": raw
            }
            scenes.append(current_scene)
            continue

        # Detect character dialogue: bold tag → character name
        bold = p.find("b")
        if bold:
            speaker_raw = bold.get_text(strip=True).rstrip(":")
            if speaker_raw in CHARACTERS:
                # Stage direction in parentheses before/after dialogue
                full_text = raw.replace(bold.get_text(), "").strip()
                stage_match = re.findall(r'\(([^)]+)\)', full_text)
                stage_text = " ".join(stage_match)
                dialogue = re.sub(r'\([^)]*\)', '', full_text).strip()
                emotion_tags = extract_emotion_tags(stage_text)

                if current_scene is None:
                    scene_counter += 1
                    current_scene = {
                        "scene_id": f"{episode_id}_sc{scene_counter:02d}",
                        "location": "Unknown",
                        "time_of_day": "day",
                        "lines": [],
                        "scene_description": ""
                    }
                    scenes.append(current_scene)

                current_scene["lines"].append({
                    "speaker": speaker_raw,
                    "text": dialogue,
                    "emotion_tags": emotion_tags,
                    "addressed_to": infer_addressee(dialogue, speaker_raw),
                    "stage_direction": stage_text
                })
                continue

        # Pure stage direction (italic text)
        em = p.find("em")
        if em and current_scene:
            current_scene["scene_description"] += " " + raw

    return {
        "episode_id": episode_id,
        "title": title,
        "scene_count": len(scenes),
        "scenes": scenes
    }

def parse_all(scripts_dir: Path) -> list[dict]:
    results = []
    for html_file in sorted(scripts_dir.glob("*.html")):
        print(f"Parsing {html_file.name}...")
        try:
            parsed = parse_episode(html_file)
            results.append(parsed)
            print(f"  → {parsed['scene_count']} scenes, {sum(len(s['lines']) for s in parsed['scenes'])} lines")
        except Exception as e:
            print(f"  ERROR: {e}")
    return results
```

### `backend/ingestion/chunker.py`

```python
"""
Chunker: Takes parsed scene graphs and stores them in ChromaDB.

Chunking strategy:
  - Per-character: each character's lines across a scene → one chunk
  - Per-scene: full scene dialogue → one chunk (for episode-level retrieval)
  - Metadata: episode_id, scene_id, speaker, emotion_tags, location
"""

import chromadb
from chromadb.utils import embedding_functions
from pathlib import Path
import json

EMBED_MODEL = "all-MiniLM-L6-v2"   # runs locally, no API key needed

def get_chroma_client(host: str = "localhost", port: int = 8001):
    return chromadb.HttpClient(host=host, port=port)

def get_or_create_collection(client, name: str):
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBED_MODEL
    )
    return client.get_or_create_collection(
        name=name,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )

def chunk_episode(episode: dict, collection) -> int:
    """Store all scene chunks for one episode. Returns number of chunks added."""
    chunks_added = 0
    ep_id = episode["episode_id"]

    for scene in episode["scenes"]:
        scene_id = scene["scene_id"]
        location = scene["location"]

        # Per-scene chunk (full dialogue)
        full_dialogue = "\n".join(
            f"{line['speaker']}: {line['text']}"
            for line in scene["lines"]
        )
        if full_dialogue.strip():
            collection.add(
                documents=[full_dialogue],
                ids=[f"{scene_id}_full"],
                metadatas=[{
                    "episode_id": ep_id,
                    "scene_id": scene_id,
                    "location": location,
                    "chunk_type": "scene",
                    "speakers": ",".join({l["speaker"] for l in scene["lines"]})
                }]
            )
            chunks_added += 1

        # Per-character chunks within scene
        speakers_in_scene = {l["speaker"] for l in scene["lines"]}
        for speaker in speakers_in_scene:
            char_lines = [l for l in scene["lines"] if l["speaker"] == speaker]
            char_text = "\n".join(
                f"[{','.join(l['emotion_tags']) or 'neutral'}] {l['text']}"
                for l in char_lines
            )
            if char_text.strip():
                emotions = list({e for l in char_lines for e in l["emotion_tags"]})
                collection.add(
                    documents=[char_text],
                    ids=[f"{scene_id}_{speaker.lower()}_lines"],
                    metadatas=[{
                        "episode_id": ep_id,
                        "scene_id": scene_id,
                        "location": location,
                        "chunk_type": "character",
                        "speaker": speaker,
                        "emotions": ",".join(emotions)
                    }]
                )
                chunks_added += 1

    return chunks_added

def chunk_all(episodes: list[dict], chroma_host: str, chroma_port: int, collection_name: str):
    client = get_chroma_client(chroma_host, chroma_port)
    collection = get_or_create_collection(client, collection_name)
    total = 0
    for ep in episodes:
        n = chunk_episode(ep, collection)
        print(f"  {ep['episode_id']}: {n} chunks stored")
        total += n
    print(f"\nTotal chunks: {total}")
    return total
```

### `backend/ingestion/run_ingest.py`

```python
"""
CLI entry point for ingestion.
Usage: python -m ingestion.run_ingest --scripts-dir ../episode_scripts
"""
import argparse
from pathlib import Path
from ingestion.parser import parse_all
from ingestion.chunker import chunk_all
import json
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scripts-dir", required=True)
    parser.add_argument("--season", default=None, help="Filter by season, e.g. 1")
    parser.add_argument("--chroma-host", default=os.getenv("CHROMA_HOST", "localhost"))
    parser.add_argument("--chroma-port", type=int, default=int(os.getenv("CHROMA_PORT", 8001)))
    parser.add_argument("--collection", default=os.getenv("CHROMA_COLLECTION_NAME", "friendsos_memory"))
    parser.add_argument("--output-json", default=None, help="Optional: save parsed JSON")
    args = parser.parse_args()

    scripts_dir = Path(args.scripts_dir)
    assert scripts_dir.exists(), f"Directory not found: {scripts_dir}"

    print(f"Parsing scripts from: {scripts_dir}")
    episodes = parse_all(scripts_dir)

    if args.season:
        prefix = f"s{int(args.season):02d}"
        episodes = [e for e in episodes if e["episode_id"].startswith(prefix)]
        print(f"Filtered to season {args.season}: {len(episodes)} episodes")

    if args.output_json:
        with open(args.output_json, "w") as f:
            json.dump(episodes, f, indent=2)
        print(f"Saved parsed JSON to {args.output_json}")

    print(f"\nStoring {len(episodes)} episodes to ChromaDB...")
    chunk_all(episodes, args.chroma_host, args.chroma_port, args.collection)
    print("Ingestion complete.")

if __name__ == "__main__":
    main()
```

---

## 6. Phase 2 — Character Agent System

<!-- AI: Implement backend/agents/ after Phase 1. -->

### Identity Files (`backend/agents/identity/*.md`)

Each character has a `character.md` identity file. This is both **read by the agent** on each LLM call and **written back** at the end of each episode to update emotion levels.

#### `backend/agents/identity/chandler.md`

```markdown
# Chandler Bing — Identity File
## Version: 1.0 | Status: ACTIVE

## Current Emotion Levels (0–10)
- Anxiety: 8
- Joy: 5
- Sarcasm: 9
- Loneliness: 6
- Anger: 3

## Dominant Memory Clusters
- [S01E01] First meeting with the friend group at Central Perk → Comfort, belonging
- [S01E04] Awkward work situation, uses humor to deflect → Anxiety spike

## Personality Anchors
- Deflects emotional discomfort with sarcasm and self-deprecating humor
- Deeply insecure about relationships, especially romantic ones
- Genuinely caring beneath the sarcasm — will show vulnerability rarely
- Obsessed with pointing out the absurdity of any situation
- Signature verbal tic: "Could this BE any more [adjective]?"

## Speech Patterns
- Mid-sentence stress emphasis for comedic effect
- Rhetorical questions as deflection
- References to his unusual job (Statistical analysis and data reconfiguration)
- Never speaks earnestly about feelings without immediately undermining it
```

#### Template for all other characters

<!-- AI: Create identity files for Monica, Ross, Rachel, Joey, Phoebe following this structure.
     Monica: Joy 7, Anger 5, Anxiety 8, Perfectionism 10. Anchors: competitive, nurturing, controlling about cleanliness.
     Ross: Anxiety 7, Joy 4, Loneliness 6. Anchors: dinosaurs, academia, catastrophizes in romance, over-explains.
     Rachel: Confidence 6, Joy 7, Anxiety 4. Anchors: fashion, growth arc from spoiled to independent.
     Joey: Joy 9, Anger 2, Sarcasm 1. Anchors: food, acting career, loyal, simple pleasures.
     Phoebe: Joy 8, Anxiety 3, Eccentricity 10. Anchors: massage therapy, weird songs, believes in supernatural, biological mother storyline. -->

### `backend/agents/base_agent.py`

```python
"""
BaseCharacterAgent: shared logic for all character agents.
Each character subclass overrides get_system_prompt() only.
"""

from pathlib import Path
from typing import Optional
import json
import re
import os

IDENTITY_DIR = Path(__file__).parent / "identity"

class BaseCharacterAgent:
    name: str = "Unknown"
    identity_file: str = "unknown.md"

    def __init__(self):
        self.identity_path = IDENTITY_DIR / self.identity_file
        self._identity_cache: Optional[str] = None

    def load_identity(self) -> str:
        with open(self.identity_path, "r") as f:
            return f.read()

    def get_system_prompt(self, context: dict) -> str:
        identity = self.load_identity()
        memories = context.get("memories", [])
        scene_context = context.get("scene_context", "")
        what_if_note = ""
        if context.get("what_if_active"):
            what_if_note = f"\n\nIMPORTANT — SCENARIO OVERRIDE ACTIVE:\n{context.get('what_if_scenario', '')}\nRespond as {self.name} would given this new reality."

        memory_block = ""
        if memories:
            memory_block = "\n## Retrieved Memories\n" + "\n".join(
                f"- [{m['episode_id']}] {m['text']}" for m in memories
            )

        return f"""You are {self.name} from the TV show Friends.
You are NOT an AI assistant. You ARE {self.name}. Stay completely in character at all times.
Never break the fourth wall. Never acknowledge being an AI.

{identity}

{memory_block}

## Current Scene
{scene_context}
{what_if_note}

## Response Rules
- Respond ONLY with {self.name}'s next line of dialogue.
- Do NOT include your character name prefix. Just the dialogue.
- Keep it 1-3 sentences. Natural, conversational, TV-paced.
- Match the emotion levels in your identity file.
- If your anxiety is above 7, let it show subtly.
- If asked to do something out of character, find an in-character reason to resist or comply.
"""

    def update_emotion_levels(self, updates: dict) -> None:
        """Update identity file emotion levels after episode ends."""
        content = self.load_identity()
        for emotion, new_val in updates.items():
            content = re.sub(
                rf"(- {emotion}:)\s*\d+",
                rf"\1 {min(10, max(0, int(new_val)))}",
                content,
                flags=re.IGNORECASE
            )
        with open(self.identity_path, "w") as f:
            f.write(content)

    def get_emotion_levels(self) -> dict:
        content = self.load_identity()
        emotions = {}
        for match in re.finditer(r"- (\w+):\s*(\d+)", content):
            emotions[match.group(1).lower()] = int(match.group(2))
        return emotions

# Character subclasses — all follow this pattern
class ChandlerAgent(BaseCharacterAgent):
    name = "Chandler"
    identity_file = "chandler.md"

class MonicaAgent(BaseCharacterAgent):
    name = "Monica"
    identity_file = "monica.md"

class RossAgent(BaseCharacterAgent):
    name = "Ross"
    identity_file = "ross.md"

class RachelAgent(BaseCharacterAgent):
    name = "Rachel"
    identity_file = "rachel.md"

class JoeyAgent(BaseCharacterAgent):
    name = "Joey"
    identity_file = "joey.md"

class PhoebeAgent(BaseCharacterAgent):
    name = "Phoebe"
    identity_file = "phoebe.md"

AGENTS = {
    "Chandler": ChandlerAgent(),
    "Monica": MonicaAgent(),
    "Ross": RossAgent(),
    "Rachel": RachelAgent(),
    "Joey": JoeyAgent(),
    "Phoebe": PhoebeAgent(),
}
```

---

## 7. Phase 3 — Memory Stack (Redis + ChromaDB)

<!-- AI: Implement backend/memory/ after Phase 2. -->

### `backend/memory/redis_client.py`

```python
"""
Redis: short-term in-episode working memory.
Stores the last N dialogue lines per character for context window injection.
"""

import redis
import json
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CONTEXT_WINDOW = 12  # number of recent lines to keep per episode session

class EpisodeMemory:
    def __init__(self, episode_id: str):
        self.r = redis.from_url(REDIS_URL, decode_responses=True)
        self.key = f"episode:{episode_id}:dialogue"
        self.episode_id = episode_id

    def add_line(self, speaker: str, text: str, scene_id: str):
        entry = json.dumps({"speaker": speaker, "text": text, "scene_id": scene_id})
        self.r.rpush(self.key, entry)
        self.r.ltrim(self.key, -CONTEXT_WINDOW, -1)
        self.r.expire(self.key, 3600)  # expire after 1 hour

    def get_recent(self, n: int = CONTEXT_WINDOW) -> list[dict]:
        raw = self.r.lrange(self.key, -n, -1)
        return [json.loads(r) for r in raw]

    def clear(self):
        self.r.delete(self.key)

    def format_for_prompt(self) -> str:
        lines = self.get_recent()
        return "\n".join(f"{l['speaker']}: {l['text']}" for l in lines)
```

### `backend/memory/chroma_client.py`

```python
"""
ChromaDB: long-term cross-episode semantic memory.
Query: given a character + current context, find relevant past memories.
"""

import chromadb
from chromadb.utils import embedding_functions
import os

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8001))
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "friendsos_memory")
EMBED_MODEL = "all-MiniLM-L6-v2"

_client = None
_collection = None

def get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=ef
        )
    return _collection

def query_character_memories(character: str, query_text: str, n_results: int = 5) -> list[dict]:
    """Get the most relevant past memories for a character given current scene context."""
    collection = get_collection()
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where={"speaker": character, "chunk_type": "character"}
    )
    memories = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        memories.append({
            "episode_id": meta.get("episode_id", ""),
            "text": doc[:300],  # truncate for prompt safety
            "emotions": meta.get("emotions", "")
        })
    return memories

def query_scene_context(location: str, query_text: str, n_results: int = 3) -> list[dict]:
    """Get past scenes at this location for environmental context."""
    collection = get_collection()
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where={"location": location, "chunk_type": "scene"}
    )
    return [
        {"episode_id": r["episode_id"], "text": d[:400]}
        for d, r in zip(results["documents"][0], results["metadatas"][0])
    ]
```

---

## 8. Phase 4 — LangGraph Orchestrator

<!-- AI: Implement backend/orchestrator/ after Phase 3. Requires langgraph, langchain installed. -->

### `backend/orchestrator/graph.py`

```python
"""
LangGraph scene execution graph.
State flows: scene_start → [character nodes] → scene_end → memory_update
"""

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator
import os
from agents.base_agent import AGENTS
from memory.redis_client import EpisodeMemory
from memory.chroma_client import query_character_memories

USE_DUMMY = os.getenv("USE_DUMMY_DATA", "true").lower() == "true"

# ── State definition ──────────────────────────────────────────────────────────

class SceneState(TypedDict):
    episode_id: str
    scene_id: str
    location: str
    script_lines: list[dict]          # original lines from parsed script
    generated_lines: Annotated[list, operator.add]  # LLM output accumulates here
    current_speaker_index: int
    what_if_active: bool
    what_if_scenario: str
    converge_active: bool
    target_ending: str
    mode: str                          # "what_if" | "converge" | "standard"

# ── LLM caller ────────────────────────────────────────────────────────────────

def call_ollama(system_prompt: str, user_message: str) -> str:
    """Call local Ollama model for dialogue generation."""
    if USE_DUMMY:
        from dummy.data import get_dummy_dialogue
        return get_dummy_dialogue(user_message)

    import requests
    url = f"{os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}/api/generate"
    response = requests.post(url, json={
        "model": os.getenv("OLLAMA_MODEL", "gemma2:latest"),
        "system": system_prompt,
        "prompt": user_message,
        "stream": False,
        "options": {"temperature": 0.85, "top_p": 0.92, "max_tokens": 200}
    })
    return response.json().get("response", "").strip()

# ── Character node factory ─────────────────────────────────────────────────────

def make_character_node(character_name: str):
    def node(state: SceneState) -> dict:
        agent = AGENTS[character_name]
        episode_memory = EpisodeMemory(state["episode_id"])
        recent_context = episode_memory.format_for_prompt()

        # Retrieve long-term memories relevant to current scene
        memories = query_character_memories(
            character=character_name,
            query_text=recent_context or state["location"],
            n_results=4
        )

        system_prompt = agent.get_system_prompt({
            "memories": memories,
            "scene_context": recent_context,
            "what_if_active": state["what_if_active"],
            "what_if_scenario": state["what_if_scenario"],
        })

        user_message = f"[The scene is: {state['location']}. Recent dialogue:\n{recent_context}\n\nNow respond as {character_name}.]"
        dialogue = call_ollama(system_prompt, user_message)

        # Store to Redis
        episode_memory.add_line(character_name, dialogue, state["scene_id"])

        new_line = {
            "speaker": character_name,
            "text": dialogue,
            "scene_id": state["scene_id"],
            "generated": True
        }
        return {"generated_lines": [new_line]}

    return node

# ── Router: which character speaks next ───────────────────────────────────────

def route_next_speaker(state: SceneState) -> str:
    idx = state["current_speaker_index"]
    lines = state["script_lines"]
    if idx >= len(lines):
        return "scene_end"
    next_speaker = lines[idx]["speaker"]
    if next_speaker not in AGENTS:
        return "scene_end"
    return next_speaker

def advance_speaker(state: SceneState) -> dict:
    return {"current_speaker_index": state["current_speaker_index"] + 1}

# ── Build graph ────────────────────────────────────────────────────────────────

def build_graph():
    g = StateGraph(SceneState)
    g.add_node("advance", advance_speaker)

    for name in AGENTS:
        g.add_node(name, make_character_node(name))
        g.add_edge(name, "advance")

    g.add_conditional_edges("advance", route_next_speaker,
        {name: name for name in AGENTS} | {"scene_end": END}
    )
    g.set_entry_point("advance")
    return g.compile()

SCENE_GRAPH = build_graph()

def run_scene(scene: dict, episode_id: str, what_if: dict | None = None, converge: dict | None = None) -> list[dict]:
    initial_state: SceneState = {
        "episode_id": episode_id,
        "scene_id": scene["scene_id"],
        "location": scene["location"],
        "script_lines": scene["lines"],
        "generated_lines": [],
        "current_speaker_index": 0,
        "what_if_active": bool(what_if),
        "what_if_scenario": what_if.get("scenario", "") if what_if else "",
        "converge_active": bool(converge),
        "target_ending": converge.get("target", "") if converge else "",
        "mode": "what_if" if what_if else ("converge" if converge else "standard")
    }
    result = SCENE_GRAPH.invoke(initial_state)
    return result["generated_lines"]
```

---

## 9. Phase 5 — FastAPI Backend

<!-- AI: Implement backend/main.py and all routers after Phase 4. -->

### `backend/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import episodes, agents, stream, pivot

app = FastAPI(title="FriendsOS API", version="1.0.0")

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"], allow_headers=["*"]
)

app.include_router(episodes.router, prefix="/api/episodes", tags=["episodes"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(stream.router, prefix="/api/stream", tags=["stream"])
app.include_router(pivot.router, prefix="/api/pivot", tags=["pivot"])

@app.get("/api/health")
def health():
    return {"status": "ok", "dummy_mode": True}
```

### `backend/routers/stream.py`

```python
"""
SSE streaming endpoint — pushes generated dialogue lines to the frontend in real time.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from orchestrator.graph import run_scene
import json, asyncio

router = APIRouter()

@router.get("/episode/{episode_id}/scene/{scene_id}")
async def stream_scene(episode_id: str, scene_id: str, what_if: str = "", converge_target: str = ""):
    # Load scene from ChromaDB / parsed cache — simplified here
    from memory.chroma_client import get_collection
    collection = get_collection()
    results = collection.get(ids=[f"{scene_id}_full"], include=["documents", "metadatas"])
    if not results["documents"]:
        return {"error": "Scene not found"}

    # Build a minimal scene dict
    scene = {
        "scene_id": scene_id,
        "location": results["metadatas"][0].get("location", "Unknown"),
        "lines": []  # orchestrator will generate fresh lines
    }

    async def event_generator():
        what_if_payload = {"scenario": what_if} if what_if else None
        converge_payload = {"target": converge_target} if converge_target else None
        lines = run_scene(scene, episode_id, what_if_payload, converge_payload)
        for line in lines:
            yield f"data: {json.dumps(line)}\n\n"
            await asyncio.sleep(0.8)  # pacing for dramatic effect
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### `backend/routers/agents.py`

```python
from fastapi import APIRouter
from agents.base_agent import AGENTS

router = APIRouter()

@router.get("/")
def list_agents():
    return [
        {
            "name": name,
            "emotions": agent.get_emotion_levels(),
            "identity_file": agent.identity_file
        }
        for name, agent in AGENTS.items()
    ]

@router.patch("/{name}/emotions")
def update_emotions(name: str, updates: dict):
    if name not in AGENTS:
        return {"error": "Agent not found"}
    AGENTS[name].update_emotion_levels(updates)
    return {"status": "updated", "emotions": AGENTS[name].get_emotion_levels()}
```

---

## 10. Phase 6 — React Frontend (Tailwind + TypeScript)

<!-- AI: After backend scaffolding is complete, build the frontend. Use Vite + React 18 + TypeScript + Tailwind CSS 3. -->

### Setup Commands

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install zustand axios framer-motion react-diff-viewer-continued react-router-dom
npm install -D @types/node
```

### `frontend/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Design system tokens from DESIGN.md
        surface: "#f5f6f8",
        "surface-container-low": "#eff1f3",
        "surface-container": "#e9ebee",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#2c2f31",
        "on-surface-variant": "#595c5e",
        primary: "#4640e3",
        "primary-container": "#9695ff",
        "on-primary-container": "#1a1770",
        secondary: "#6a5acd",
        "secondary-container": "#d4cfff",
        tertiary: "#0f6e56",
        "tertiary-container": "#9fe1cb",
        "outline-variant": "#c4c7c9",
        // Friends palette for characters
        "chandler-color": "#4640e3",
        "monica-color": "#0f6e56",
        "ross-color": "#ba7517",
        "rachel-color": "#d4537e",
        "joey-color": "#1d9e75",
        "phoebe-color": "#993556",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
      },
      backdropBlur: { glass: "12px" },
      boxShadow: {
        ambient: "0 8px 32px 0 rgba(44,47,49,0.06)",
        glass: "0 2px 16px 0 rgba(44,47,49,0.08)",
      },
      borderRadius: {
        chip: "9999px",
      }
    },
  },
  plugins: [],
} satisfies Config
```

### `frontend/src/types/index.ts`

```typescript
export type CharacterName = "Chandler" | "Monica" | "Ross" | "Rachel" | "Joey" | "Phoebe"

export interface EmotionLevels {
  joy?: number
  anger?: number
  anxiety?: number
  sarcasm?: number
  loneliness?: number
  [key: string]: number | undefined
}

export interface Agent {
  name: CharacterName
  emotions: EmotionLevels
  identity_file: string
  avatar?: string
  occupation?: string
}

export interface DialogueLine {
  speaker: CharacterName | string
  text: string
  scene_id: string
  generated: boolean
  emotion_tags?: string[]
  stage_direction?: string
}

export interface Scene {
  scene_id: string
  location: string
  lines: DialogueLine[]
  scene_description?: string
}

export interface Episode {
  episode_id: string
  title: string
  season: number
  episode: number
  status: "final" | "draft" | "what-if-branch"
  created_at: string
  scene_count: number
  thumbnail?: string
}

export interface PivotConfig {
  scenario: string
  chaos_level: number
  monica_cleanliness: number
  sarcasm_meter: number
}

export interface StreamEvent {
  speaker: string
  text: string
  scene_id: string
  generated: boolean
}
```

### `frontend/src/store/useStore.ts`

```typescript
import { create } from "zustand"
import type { Agent, Episode, DialogueLine, PivotConfig } from "../types"

interface AppState {
  // Navigation
  currentPage: string
  setCurrentPage: (page: string) => void

  // Agents
  agents: Agent[]
  setAgents: (agents: Agent[]) => void
  updateAgentEmotion: (name: string, emotion: string, value: number) => void

  // Episodes
  episodes: Episode[]
  setEpisodes: (episodes: Episode[]) => void
  activeEpisodeId: string | null
  setActiveEpisode: (id: string | null) => void

  // Live stream
  streamedLines: DialogueLine[]
  appendLine: (line: DialogueLine) => void
  clearStream: () => void
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void

  // What-If / Pivot
  pivotConfig: PivotConfig
  setPivotConfig: (config: Partial<PivotConfig>) => void
  whatIfActive: boolean
  setWhatIfActive: (v: boolean) => void

  // Mode
  mode: "standard" | "what_if" | "converge"
  setMode: (m: "standard" | "what_if" | "converge") => void
}

export const useStore = create<AppState>((set) => ({
  currentPage: "hub",
  setCurrentPage: (page) => set({ currentPage: page }),

  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgentEmotion: (name, emotion, value) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.name === name
          ? { ...a, emotions: { ...a.emotions, [emotion]: value } }
          : a
      ),
    })),

  episodes: [],
  setEpisodes: (episodes) => set({ episodes }),
  activeEpisodeId: null,
  setActiveEpisode: (id) => set({ activeEpisodeId: id }),

  streamedLines: [],
  appendLine: (line) => set((s) => ({ streamedLines: [...s.streamedLines, line] })),
  clearStream: () => set({ streamedLines: [] }),
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  pivotConfig: { scenario: "", chaos_level: 50, monica_cleanliness: 100, sarcasm_meter: 45 },
  setPivotConfig: (config) => set((s) => ({ pivotConfig: { ...s.pivotConfig, ...config } })),
  whatIfActive: false,
  setWhatIfActive: (v) => set({ whatIfActive: v }),

  mode: "standard",
  setMode: (m) => set({ mode: m }),
}))
```

---

## 11. Phase 7 — What-If Mode

<!-- AI: Implement after Phase 6 core pages are rendering with dummy data. -->

### How It Works

1. User opens "The Pivot" panel (Mockup Frame 1)
2. Types a scenario override (e.g. "A monkey steals the remote")
3. Adjusts Chaos Level, Monica Cleanliness, Sarcasm Meter sliders
4. Hits ACTION — sends config to `/api/pivot/what-if`
5. Backend re-runs the current scene graph with modified agent state
6. Frontend receives two streams: **original** (from parsed script) and **generated** (from LLM)
7. Both are rendered as a unified diff using `react-diff-viewer-continued`

### `backend/orchestrator/what_if.py`

```python
"""
What-If mode: modifies agent emotion levels for one run, compares outputs.
Does NOT permanently update identity files — changes are ephemeral.
"""

from agents.base_agent import AGENTS
from orchestrator.graph import run_scene
import copy

def run_what_if(scene: dict, episode_id: str, config: dict) -> dict:
    """
    config = {
      "scenario": "A monkey steals the remote",
      "chaos_level": 80,
      "monica_cleanliness": 100,
      "sarcasm_meter": 45
    }
    Returns: { "original": [...lines], "generated": [...lines], "diff": [...] }
    """
    # Get original lines from parsed script
    original_lines = [
        {"speaker": l["speaker"], "text": l["text"], "generated": False}
        for l in scene.get("lines", [])
    ]

    # Temporarily boost emotions based on chaos level
    chaos = config.get("chaos_level", 50) / 100
    emotion_overrides = {
        "Monica": {"anxiety": min(10, int(8 * config.get("monica_cleanliness", 100) / 100))},
        "Chandler": {"sarcasm": min(10, int(10 * config.get("sarcasm_meter", 45) / 100))},
    }
    for char, overrides in emotion_overrides.items():
        if char in AGENTS:
            AGENTS[char].update_emotion_levels(overrides)

    # Run the scene with what-if active
    what_if_payload = {"scenario": config.get("scenario", "")}
    generated_lines = run_scene(scene, episode_id, what_if=what_if_payload)

    return {
        "original": original_lines,
        "generated": generated_lines,
    }
```

---

## 12. Phase 8 — Converge Mode

<!-- AI: This is the most complex phase. Implement last. -->

### How It Works

1. User activates Converge Mode
2. Orchestrator loads the **target ending** (last 2–3 scenes of original episode)
3. On each generated line, a **trajectory check** runs:
   - Embed current scene state with `sentence-transformers`
   - Compute cosine similarity to target ending embedding
   - If similarity < threshold → trigger nudge
4. **Nudge**: inject a hidden convergence directive into the highest-influence character's next prompt
5. Characters gradually steer back toward the canonical ending

### `backend/orchestrator/converge.py`

```python
"""
Converge mode: trajectory checking + nudge system.
Uses a stronger LLM (Claude Haiku or Qwen via Groq) for the planning decisions.
"""

import os
from sentence_transformers import SentenceTransformer, util
from memory.chroma_client import get_collection

EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
_embed_model = None

SIMILARITY_THRESHOLD = 0.55  # below this → trigger nudge
HIGH_INFLUENCE_CHARACTERS = ["Monica", "Ross", "Rachel"]  # narrative drivers

def get_embed_model():
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
    return _embed_model

def compute_trajectory_score(current_lines: list[dict], target_text: str) -> float:
    model = get_embed_model()
    current_text = " ".join(l["text"] for l in current_lines[-6:])
    if not current_text.strip():
        return 1.0  # neutral if no lines yet
    emb_current = model.encode(current_text, convert_to_tensor=True)
    emb_target = model.encode(target_text, convert_to_tensor=True)
    score = float(util.cos_sim(emb_current, emb_target))
    return score

def build_nudge_directive(character: str, target_text: str, score: float) -> str:
    return f"""
CONVERGENCE DIRECTIVE (hidden from {character}'s awareness):
The narrative must find its way toward this ending:
"{target_text[:400]}"

Your current trajectory similarity score is {score:.2f} (target: >{SIMILARITY_THRESHOLD}).
Without breaking character or being obvious about it, subtly steer your next line
in a direction that would naturally lead toward the above outcome.
Do not reference this directive. Speak only as {character}.
"""

def call_converge_llm(system_prompt: str, user_message: str) -> str:
    """Use stronger model for convergence decisions."""
    if os.getenv("USE_DUMMY_DATA", "true").lower() == "true":
        from dummy.data import get_dummy_dialogue
        return get_dummy_dialogue(user_message)

    provider = os.getenv("CONVERGE_MODEL_PROVIDER", "groq")

    if provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        msg = client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=200,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}]
        )
        return msg.content[0].text

    elif provider == "groq":
        from groq import Groq
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "qwen2.5-72b-instruct"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=200
        )
        return response.choices[0].message.content

    return "[Converge: no provider configured]"
```

---

## 13. Dummy Data Layer (Frontend Testing)

<!-- AI: Implement this FIRST within the backend so the frontend can test immediately.
     When USE_DUMMY_DATA=true, ALL LLM calls return from this module instead. -->

### `backend/dummy/data.py`

```python
"""
Dummy data for frontend testing. All responses are pre-written.
Activated when USE_DUMMY_DATA=true in .env
"""

import random

DUMMY_DIALOGUES = {
    "Chandler": [
        "Could this BE any more of a disaster? I once had a job that was literally keeping track of how many times I said 'could this be' and even THAT was better than this.",
        "Oh great, because what this situation needed was more chaos. I am SO comfortable right now.",
        "You know what this reminds me of? Every single morning of my life. Including the good ones.",
    ],
    "Monica": [
        "Okay, everyone needs to calm down and listen to me because I have a PLAN. Step one: we organize.",
        "I just cleaned that! Could you please, for the love of everything, use a coaster?",
        "Fine. FINE. We'll do it YOUR way. But when it all falls apart, I want it on record that I had a better plan.",
    ],
    "Ross": [
        "Actually, and I think this is important, what we're experiencing right now is remarkably similar to the social dynamics of late Pleistocene hominid groups—",
        "Guys! You will not BELIEVE what just happened. It changes everything we know about— okay, I'll tell you later.",
        "I'm fine. I'm totally fine. This is fine. Everything is completely fine and I am not spiraling.",
    ],
    "Rachel": [
        "Oh my God, okay, this is like the most insane thing that has ever happened and I have been through some things.",
        "You know what? I am a STRONG, independent woman and I do not need this. I just want it, which is different.",
        "Wait, so you're saying I was wrong? Because I genuinely cannot process that right now.",
    ],
    "Joey": [
        "How YOU doin'?",
        "Okay but can we eat first? Because I cannot process any emotional content on an empty stomach.",
        "Man, that is MESSED up. You know what would help? Sandwiches. Always sandwiches.",
    ],
    "Phoebe": [
        "Oh, I totally understand. My psychic said something like this would happen. Well, she said 'beware of Tuesdays' but the vibration is the same.",
        "You guys, I feel like the universe is trying to tell us something, and I think it's saying 'have fun and eat more granola.'",
        "That is so beautiful and also kind of sad, like a bittersweet lullaby about a smelly cat.",
    ]
}

GENERIC_DIALOGUES = [
    "This is... a lot to take in.",
    "You know what, I think we're going to be okay.",
    "Did anyone else notice that, or is it just me?",
    "Okay, new plan. We pretend this never happened.",
]

def get_dummy_dialogue(context: str = "") -> str:
    # Try to detect speaker from context
    for character in DUMMY_DIALOGUES:
        if character.lower() in context.lower():
            return random.choice(DUMMY_DIALOGUES[character])
    return random.choice(GENERIC_DIALOGUES)

# ── Dummy REST responses ──────────────────────────────────────────────────────

DUMMY_AGENTS = [
    {"name": "Ross",     "emotions": {"joy": 2, "anger": 8, "sarcasm": 4, "anxiety": 7},  "occupation": "Paleontologist", "emoji": "😢"},
    {"name": "Joey",     "emotions": {"joy": 9, "anger": 1, "sarcasm": 2, "anxiety": 0},  "occupation": "Actor",          "emoji": "😂"},
    {"name": "Chandler", "emotions": {"joy": 4, "anger": 3, "sarcasm": 9, "anxiety": 8},  "occupation": "Transponster",   "emoji": "😐"},
    {"name": "Monica",   "emotions": {"joy": 7, "anger": 5, "sarcasm": 3, "anxiety": 8},  "occupation": "Chef",           "emoji": "😤"},
    {"name": "Rachel",   "emotions": {"joy": 7, "anger": 4, "sarcasm": 5, "anxiety": 4},  "occupation": "Fashion",        "emoji": "💅"},
    {"name": "Phoebe",   "emotions": {"joy": 8, "anger": 2, "sarcasm": 2, "anxiety": 2},  "occupation": "Musician",       "emoji": "🎸"},
]

DUMMY_EPISODES = [
    {"episode_id": "s01e01", "title": "The One Where It All Began",                 "status": "final",          "created_at": "Sept 22, 1994", "scene_count": 8},
    {"episode_id": "s01e02", "title": "The One with the Sonogram",                  "status": "draft",          "created_at": "Sept 29, 1994", "scene_count": 7},
    {"episode_id": "s01e03", "title": "The One with the Thumb",                     "status": "final",          "created_at": "Oct 6, 1994",   "scene_count": 9},
    {"episode_id": "s01e04", "title": "The One with George Stephanopoulos",         "status": "final",          "created_at": "Oct 13, 1994",  "scene_count": 6},
    {"episode_id": "s01e07", "title": "The One Where the Power Never Came Back",    "status": "what-if-branch", "created_at": "Oct 12, 1994",  "scene_count": 11},
]

DUMMY_STREAM_LINES = [
    {"speaker": "Chandler", "text": "Could this coffee BE any hotter? I think I just lost a layer of skin on my tongue.", "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Monica",   "text": "Well, if you didn't gulp it down like a pelican, maybe you'd be fine. And please use a coaster, I just wiped that table.", "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Ross",     "text": "Guys! You will not believe what they just unearthed at the museum. It changes everything we know about the late Cretaceous period!", "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Joey",     "text": "Cool. Can we eat? I haven't had anything since the pizza, the sandwich, and the leftover pizza.", "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Rachel",   "text": "Oh my God you guys, I just ran into Barry at the coffee shop. He was with his new— you know what, never mind. I'm FINE.", "scene_id": "s01e01_sc01", "generated": True},
    {"speaker": "Phoebe",   "text": "I had a dream about a pigeon last night and NOW I understand everything that's happening.", "scene_id": "s01e01_sc01", "generated": True},
]

DUMMY_WHAT_IF_DIFF = {
    "original": [
        {"speaker": "Chandler", "text": "Could this coffee BE any hotter?"},
        {"speaker": "Monica",   "text": "Please use a coaster."},
        {"speaker": "Ross",     "text": "It changes everything we know about the Cretaceous period!"},
    ],
    "generated": [
        {"speaker": "Chandler", "text": "A monkey just stole my coffee. I don't know how to feel about this."},
        {"speaker": "Monica",   "text": "That monkey better not have touched my table. Does anyone have a disinfectant?"},
        {"speaker": "Ross",     "text": "Actually, that species is indigenous to— wait, IS that Marcel??"},
    ]
}

DUMMY_CHANDLER_PROFILE = {
    "name": "Chandler",
    "subtitle": "Professional Sarcasm Engine",
    "version": "V1.2",
    "status": "ACTIVE",
    "quote": "I'm not great at advice. Can I interest you in a sarcastic comment? I thrive in environments where anxiety is high and social expectations are low.",
    "personality_matrix": {"neuroticism": 92, "sarcasm": 98, "anxiety": 85, "wit": 74},
    "recent_lines": [
        {"scene": "SCENE 04", "text": "And I just want a million dollars!", "time": "2m ago"},
        {"scene": "SCENE 07", "text": "You have to stop the Q-tip when there's resistance!", "time": "15m ago"},
        {"scene": "SCENE 12", "text": "I'm hopeless and awkward and desperate for love!", "time": "1h ago"},
    ],
    "relationships": [
        {"id": "MN", "x": 120, "y": 60,  "strength": "strong"},
        {"id": "RS", "x": 200, "y": 40,  "strength": "moderate"},
        {"id": "RC", "x": 80,  "y": 120, "strength": "moderate"},
        {"id": "JY", "x": 220, "y": 110, "strength": "strong"},
    ]
}
```

### `frontend/src/dummy/mockData.ts`

```typescript
// Mirror of backend dummy data for use when VITE_USE_DUMMY=true
// The frontend reads from here instead of making API calls

export const DUMMY_AGENTS = [
  { name: "Ross",     emotions: { joy: 20, anger: 85, sarcasm: 40, anxiety: 70 }, occupation: "Paleontologist", emoji: "😢", color: "#ba7517" },
  { name: "Joey",     emotions: { joy: 95, anger: 10, sarcasm: 15, anxiety:  5 }, occupation: "Actor",          emoji: "😂", color: "#1d9e75" },
  { name: "Chandler", emotions: { joy: 45, anger: 30, sarcasm: 99, anxiety: 85 }, occupation: "Transponster",   emoji: "😐", color: "#4640e3" },
  { name: "Monica",   emotions: { joy: 70, anger: 55, sarcasm: 30, anxiety: 80 }, occupation: "Chef",           emoji: "😤", color: "#0f6e56" },
  { name: "Rachel",   emotions: { joy: 70, anger: 40, sarcasm: 50, anxiety: 40 }, occupation: "Fashion",        emoji: "💅", color: "#d4537e" },
  { name: "Phoebe",   emotions: { joy: 80, anger: 25, sarcasm: 20, anxiety: 20 }, occupation: "Musician",       emoji: "🎸", color: "#993556" },
]

export const DUMMY_EPISODES = [
  { episode_id: "s01e01", title: "The One Where It All Began",              status: "final",          created_at: "Sept 22, 1994", scene_count: 8  },
  { episode_id: "s01e02", title: "The One with the Sonogram",               status: "draft",          created_at: "Sept 29, 1994", scene_count: 7  },
  { episode_id: "s01e03", title: "The One with the Thumb",                  status: "final",          created_at: "Oct 6, 1994",   scene_count: 9  },
  { episode_id: "s01e04", title: "The One with George Stephanopoulos",      status: "final",          created_at: "Oct 13, 1994",  scene_count: 6  },
  { episode_id: "s01e07", title: "The One Where the Power Never Came Back", status: "what-if-branch", created_at: "Oct 12, 1994",  scene_count: 11 },
]

export const DUMMY_STREAM_LINES = [
  { speaker: "Chandler", text: "Could this coffee BE any hotter? I think I just lost a layer of skin on my tongue.",                                     scene_id: "s01e01_sc01", generated: true },
  { speaker: "Monica",   text: "Well, if you didn't gulp it down like a pelican, maybe you'd be fine. And please use a coaster, I just wiped that table.", scene_id: "s01e01_sc01", generated: true },
  { speaker: "Ross",     text: "Guys! You will not believe what they just unearthed at the museum. It changes everything we know about the late Cretaceous!", scene_id: "s01e01_sc01", generated: true },
  { speaker: "Joey",     text: "Cool. Can we eat? I haven't had anything since the pizza, the sandwich, and the leftover pizza.",                         scene_id: "s01e01_sc01", generated: true },
  { speaker: "Rachel",   text: "Oh my God you guys, I just ran into Barry at the coffee shop. I'm FINE.",                                                  scene_id: "s01e01_sc01", generated: true },
  { speaker: "Phoebe",   text: "I had a dream about a pigeon last night and NOW I understand everything.",                                                  scene_id: "s01e01_sc01", generated: true },
]

export const DUMMY_PIVOT_BANNER = "Gunther drops a tray of mugs"

export const DUMMY_DIFF = {
  original: `CHANDLER: Could this coffee BE any hotter?\nMONICA: Please use a coaster.\nROSS: It changes everything we know about the Cretaceous period!`,
  generated: `CHANDLER: A monkey just stole my coffee. I don't know how to feel.\nMONICA: That monkey better not have touched my table.\nROSS: Actually, that species — wait, IS that Marcel??`
}

export const DUMMY_CHANDLER = {
  name: "Chandler",
  subtitle: "Professional Sarcasm Engine",
  version: "V1.2",
  status: "ACTIVE",
  quote: "I'm not great at advice. Can I interest you in a sarcastic comment?",
  personality: { Neuroticism: 92, Sarcasm: 98, Anxiety: 85, Wit: 74 },
  recentLines: [
    { scene: "SCENE 04", text: "And I just want a million dollars!", time: "2m ago" },
    { scene: "SCENE 07", text: "You have to stop the Q-tip when there's resistance!", time: "15m ago" },
    { scene: "SCENE 12", text: "I'm hopeless and awkward and desperate for love!", time: "1h ago" },
  ]
}

export const USE_DUMMY = import.meta.env.VITE_USE_DUMMY === "true"
```

---

## 14. Mockup Frame Reference

<!-- AI: Use these specs when building each React page. Match the mockup images in mockup_frames/ exactly. -->

### Frame 01 — The Pivot Panel (`PivotPanel.tsx`)

**Corresponds to**: `mockup_frames/01_pivot_panel.png`

```
Layout: Centered modal card, white bg, rounded corners, black offset shadow
Header: "The Pivot!" in purple bold + fork-road icon in yellow (top right)
Divider: black horizontal rule below header
Section 1 — "Scenario Override":
  - Label with pencil-edit icon
  - Textarea: cream/beige bg (#fff8f0), rounded border, placeholder "e.g., A monkey steals the remote..."
Divider: pink dashed line
Section 2 — "Tweak the Vibe":
  - Bold heading
  - 3 rows: [label] [yellow pill badge with percentage]
    • Chaos Level → 80%
    • Monica Cleanliness Level → 100%
    • Sarcasm Meter → 45%
  - Clicking a badge opens a slider
Divider: black horizontal rule
CTA Button: full-width, cyan/turquoise (#00d4cc), bold "ACTION! 🎬"
  - Small shadow offset below button
Warning text: red-pink italic "Warning: May cause timeline splits."
```

### Frame 02 — Episode View (`EpisodeView.tsx`)

**Corresponds to**: `mockup_frames/02_episode_view.png`

```
Background: cream (#fef9ec)
Top bar: "← Back to Hub" button (rounded, white bg, black border)
Main card: purple header bar (#7c3aed) with "👑 THE EPISODE" + "● Live Broadcast" pill (right)
  Content area: cream bg
  Scene description pill: centered, rounded, outlined — italic text in brackets
  Dialogue cards:
    - White bg, rounded corners, heavy black border, slight right offset shadow
    - Character name in BOLD PURPLE ALL CAPS
    - Dialogue text in dark body text
  Stage directions: centered italic text in coral/orange, between dialogue cards
  Pivot banner: bottom of card, yellow dashed border left+right,
    centered pill badge (yellow, black text): "⚡ PIVOT: [description]"
```

### Frame 03 — Central Hub (`CentralHub.tsx`)

**Corresponds to**: `mockup_frames/03_central_hub.png`

```
Background: cream (#fdf8ed)
Left sidebar (220px, cream bg):
  - App logo "SITCOM.OS" (bold, top left)
  - Nav: Studio (underlined/active), Scripts, Cast, Archive
  - User panel: avatar + "Narrative Engine" / "Vibe: Maximum Chaos"
  - Nav items: Dashboard, Agents (active/purple pill), Episodes, Logs, Settings
  - Bottom: "+ New Pilot" button (cyan, full-width pill)
Main area (3-column layout):
  Left panel — "Cast Roster" card:
    - "Active" green chip
    - List: avatar, name, status
    - Below: "LAUGHTER TRACK 87%" with progress bar (cyan fill)
  Center panel — "Live Script Stream" card:
    - Purple header "Live Script Stream" + "● RECORDING" badge
    - Monospace-style font for dialogue
    - Scene start marker: "[SCENE START] INT. CENTRAL PERK – DAY"
    - Character name centered bold, stage direction in italic below
    - Dialogue in rounded white card
    - Input bar at bottom: "Inject direction..." + purple send button
  Right panel — "The Pivot" card:
    - Fork icon + "The Pivot" header
    - Intro text
    - 3 action cards stacked:
      • Genre Swap (tags: Noir, Sci-Fi)
      • Surprise Entrance (purple active bg)
      • Prop Malfunction
```

### Frame 04 — Episode Archive (`EpisodeArchive.tsx`)

**Corresponds to**: `mockup_frames/04_episode_archive.png`

```
Background: cream
Left sidebar: "SITCOM COMMAND" logo, nav (Studio/Episodes/Characters/Script), settings
  Sub-nav: Director's Cut / Season 1
  Items: Dashboard, Archive (active/highlighted), Cast, Settings
  Bottom: user avatar + "C. GELLER"
Main content:
  Title: "Episode Archive" (very large, bold serif-style)
  Stats chips: "TOTAL: 24 EPISODES" (cyan bg) | "SEASON 1 ACTIVE" (pink/salmon bg)
  Grid: 3-column masonry/card layout
    Standard cards:
      - Image thumbnail (top portion)
      - Episode code (e.g. "S01E01") in pink/salmon + icon
      - Episode title (bold, large)
      - "CREATED: [date]" metadata at bottom
      - Status badge overlay (top-left): "FINAL" (yellow) | "DRAFT" (blue) | "WHAT-IF BRANCH" (purple)
    Featured card (expanded, rightmost):
      - Larger card with more detail
      - Episode code + lightning bolt icon
      - Big episode title
      - Description text
      - Metadata + "OPEN SCRIPT" button (yellow bg, black text)
    Create New card:
      - Cyan bg solid
      - "+" icon centered
      - "Create New Episode" title
      - "START SCRIPT" button (dark)
```

### Frame 05 — Cast Roster (`CastRoster.tsx`)

**Corresponds to**: `mockup_frames/05_cast_roster.png`

```
Background: cream (#f5f0e0)
Left sidebar: same as Central Hub
Title: "Cast Roster" (large, bold)
Subtitle: "Active personalities in the current simulation loop..."
Action buttons: "Filter" (outline) | "+ Cast Member" (dark teal, filled)
Character cards grid (3 columns):
  Each card:
    - White/off-white bg, heavy black rounded border
    - Slight offset shadow (bottom-right black)
    - Avatar: circular emoji placeholder (large)
    - Name (bold, large) + occupation chip (colored: teal for actor, pink for musician)
    - Three emotion bars:
      • Joy    → teal fill bar   + percentage
      • Anger  → coral/red fill bar + percentage
      • Sarcasm → purple fill bar + percentage
    - "⋮" menu icon (top right)
  Special card: "Synthesize New Agent"
    - Dashed border, cream bg
    - "+" icon in circle (outlined)
    - Label centered
```

### Frame 06 — Agent Profile (`AgentProfile.tsx`)

**Corresponds to**: `mockup_frames/06_agent_profile.png`

```
Left sidebar: "CHRONICLE" logo + "NARRATIVE CARTOGRAPHER V2.0"
  Nav: Character Graph, Agent Directory (active), Dialogue Trees, World State, Engine Logs
  Bottom: "+ New Agent" button (purple filled)
Main content breadcrumb: Directory › Chandler.ai
Header: "Agent Profile"
Layout: 2-column
  Left large card:
    - Character portrait (dark, dramatic photo)
    - Name: "CHANDLER.AI" (very large, bold)
    - Subtitle: "Professional Sarcasm Engine" (purple)
    - Quote card (outlined): italic first-person quote
  Right small card: "Agent Relationships" + "REAL-TIME GRAPH" badge
    - Mini relationship graph: circles with initials (MN, RS, CH, RC, JY)
    - CH = center, purple fill
    - Lines: strong/moderate legend
  Bottom left card: "Personality Matrix"
    - 4 bars: Neuroticism, Sarcasm, Anxiety, Wit
    - Blue progress bars with percentage
  Bottom right card: "Recent Script Lines"
    - "View All" link
    - 3 timeline items: scene badge + quote + time ago
Footer bar (dark, full-width): "DEPLOY AGENT?" + "CANCEL" + "🚀 PUSH TO PRODUCTION" button
```

---

## 15. Design System Reference

<!-- AI: Apply these tokens in Tailwind classes throughout all components. Never use 1px solid borders for section dividers. -->

### Core Rules from `DESIGN.md`

| Rule | Implementation |
|---|---|
| No 1px solid borders for sectioning | Use `bg-surface-container-low` shifts instead |
| Glass panels | `bg-white/85 backdrop-blur-glass shadow-glass` |
| Hero nodes gradient | `bg-gradient-to-b from-primary to-primary-container` |
| Never pure black text | Use `text-on-surface` (#2c2f31) |
| No standard drop shadows | Use `shadow-ambient` (32px blur, 6% opacity) |
| Connector lines | `border-outline-variant/50 border-[0.5px]` |
| Label metadata | `uppercase tracking-[0.05em] text-[11px]` |
| Chip buttons | `rounded-chip bg-surface-container-high text-on-surface-variant` |

### Character Color Map

```typescript
export const CHARACTER_COLORS: Record<string, string> = {
  Chandler: "#4640e3",  // primary
  Monica:   "#0f6e56",  // tertiary
  Ross:     "#ba7517",  // amber
  Rachel:   "#d4537e",  // pink
  Joey:     "#1d9e75",  // teal
  Phoebe:   "#993556",  // magenta
}
```

### Typography Scale (Plus Jakarta Sans)

```css
/* Add to index.css */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

.label-metadata {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-on-surface-variant);
}
```

---

## 16. Docker Compose & Infra

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redis_data:/data"]

  chromadb:
    image: chromadb/chroma:latest
    ports: ["8001:8000"]
    volumes: ["chroma_data:/chroma/chroma"]
    environment:
      - CHROMA_SERVER_HOST=0.0.0.0

  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes: ["./backend:/app", "./episode_scripts:/episode_scripts"]
    env_file: .env
    environment:
      - REDIS_URL=redis://redis:6379
      - CHROMA_HOST=chromadb
      - CHROMA_PORT=8000
    depends_on: [redis, chromadb]
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    volumes: ["./frontend:/app", "/app/node_modules"]
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_USE_DUMMY=true
    command: npm run dev -- --host

volumes:
  redis_data:
  chroma_data:
```

### `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `backend/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.30.0
python-dotenv==1.0.0
redis==5.0.4
chromadb==0.5.3
sentence-transformers==3.0.1
beautifulsoup4==4.12.3
langgraph==0.1.5
langchain==0.2.6
langchain-community==0.2.6
anthropic==0.28.0
groq==0.9.0
requests==2.32.3
```

### `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
```

---

## 17. Deployment Guide

### Frontend → Vercel

```bash
# From frontend/
npm run build
npx vercel --prod
# Set env var in Vercel dashboard:
# VITE_API_URL = https://your-backend.railway.app
# VITE_USE_DUMMY = false
```

### Backend → Railway

1. Push project to GitHub
2. Go to `railway.app` → New Project → Deploy from GitHub
3. Select the `backend/` directory (Railway detects Docker automatically)
4. Add a Redis plugin from the Railway dashboard (replaces local Redis)
5. Add environment variables from your `.env` file
6. For ChromaDB: add a second Railway service pointing to the `chromadb/chroma` Docker image with a volume

### Models → Ollama on Vast.ai (optional, for cloud GPU)

```bash
# On Vast.ai: rent a RTX 3080 instance (~$0.30/hr)
# SSH in, then:
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull gemma2:latest

# Update OLLAMA_BASE_URL in Railway env to point to your Vast.ai IP
```

---

## 18. Testing Checklist

<!-- AI: After building each phase, verify the following before moving to the next. -->

### Phase 1 (Ingestion)
- [ ] `python -m ingestion.run_ingest --scripts-dir ../episode_scripts` runs without errors
- [ ] At least one episode's scene graph is stored in ChromaDB
- [ ] Query `collection.get()` returns documents with correct metadata

### Phase 2–3 (Agents + Memory)
- [ ] `ChandlerAgent().get_system_prompt({})` returns a non-empty string
- [ ] `EpisodeMemory("s01e01").add_line("Chandler", "test", "sc01")` stores to Redis
- [ ] `query_character_memories("Chandler", "coffee")` returns results

### Phase 4 (LangGraph)
- [ ] With `USE_DUMMY_DATA=true`: `run_scene(dummy_scene, "s01e01")` returns 6 lines
- [ ] Each line has `speaker`, `text`, `scene_id`, `generated` fields

### Phase 5 (FastAPI)
- [ ] `GET /api/health` returns `{"status": "ok"}`
- [ ] `GET /api/agents/` returns all 6 agents with emotion levels
- [ ] `GET /api/stream/episode/s01e01/scene/s01e01_sc01` streams SSE events

### Phase 6 (Frontend — Dummy Mode)
- [ ] All 6 pages render without console errors
- [ ] Cast Roster shows all 6 character cards with emotion bars
- [ ] Episode Archive shows 5 episode cards with correct status badges
- [ ] Central Hub shows 3-column layout matching mockup frame 3
- [ ] Agent Profile shows Chandler's personality matrix and recent lines
- [ ] Pivot Panel sliders update Zustand store state
- [ ] Episode View renders streaming dummy lines with correct character colors

### Phase 7–8 (What-If + Converge)
- [ ] Clicking "ACTION!" in Pivot Panel triggers stream with modified scenario text
- [ ] Diff view shows original vs generated lines side by side
- [ ] Converge mode trajectory score appears in LangSmith traces

### Full Integration
- [ ] Set `USE_DUMMY_DATA=false` and `VITE_USE_DUMMY=false`
- [ ] A real episode plays in the Episode View page with live LLM output
- [ ] Emotion slider changes in Cast Roster persist across page navigations
- [ ] Injecting a direction in Central Hub affects the next generated line

---

## Appendix: Key External References

| Resource | URL | Used For |
|---|---|---|
| Friends episode transcripts | `https://fangj.github.io/friends/` | Source HTML for `episode_scripts/` |
| LangGraph docs | `https://langchain-ai.github.io/langgraph/` | Orchestrator graph wiring |
| ChromaDB docs | `https://docs.trychroma.com/` | Memory schema, query API |
| Ollama API reference | `https://github.com/ollama/ollama/blob/main/docs/api.md` | Local model calls |
| Groq console | `https://console.groq.com/` | Converge model API key |
| Anthropic console | `https://console.anthropic.com/` | Claude Haiku API key |
| react-diff-viewer | `https://github.com/praneshr/react-diff-viewer` | What-If diff UI |
| Framer Motion | `https://www.framer.com/motion/` | Node animations, transitions |
| Plus Jakarta Sans | `https://fonts.google.com/specimen/Plus+Jakarta+Sans` | Design system font |
| LangSmith | `https://smith.langchain.com/` | LangGraph run tracing |

---

*End of MASTER_INSTRUCTIONS.md — Feed this document to Antigravity IDE to begin building FriendsOS end-to-end.*
