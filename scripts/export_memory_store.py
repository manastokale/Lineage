#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from memory.chroma_client import (  # noqa: E402
    _is_character_arc_metadata,
    _is_interaction_arc_metadata,
    _metadata_character,
    _metadata_participants,
    get_collection,
)


def main() -> int:
    collection = get_collection()
    results = collection.get(include=["documents", "metadatas"])
    documents = results.get("documents") or []
    metadatas = results.get("metadatas") or []

    character_arcs: list[dict] = []
    interactions: list[dict] = []
    for document, metadata in zip(documents, metadatas):
        summary = str(document or "").strip()
        if not summary:
            continue
        episode_id = str((metadata or {}).get("episode_id", "")).lower()
        title = str((metadata or {}).get("episode_title", episode_id))
        if _is_character_arc_metadata(metadata):
            character = _metadata_character(metadata)
            if episode_id and character:
                character_arcs.append(
                    {
                        "episode_id": episode_id,
                        "title": title,
                        "character": character,
                        "summary": summary,
                    }
                )
        elif _is_interaction_arc_metadata(metadata):
            participants = _metadata_participants(metadata)
            if episode_id and len(participants) >= 2:
                interactions.append(
                    {
                        "episode_id": episode_id,
                        "title": title,
                        "participants": participants,
                        "summary": summary,
                    }
                )

    memory_dir = ROOT / "memory_data"
    memory_dir.mkdir(parents=True, exist_ok=True)
    (memory_dir / "character_arcs.json").write_text(json.dumps(character_arcs, ensure_ascii=False, indent=2), encoding="utf-8")
    (memory_dir / "interactions.json").write_text(json.dumps(interactions, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        json.dumps(
            {
                "character_arcs": len(character_arcs),
                "interactions": len(interactions),
                "output_dir": str(memory_dir),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
