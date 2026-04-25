from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
EPISODE_SCRIPTS_DIR = PROJECT_ROOT / "episode_scripts"
MARKDOWN_DIR = EPISODE_SCRIPTS_DIR / "markdown"


def build_episode_library(*, seasons: list[int] | None = None) -> dict[int, int]:
    sys.path.insert(0, str(PROJECT_ROOT / "backend"))
    from ingestion.parser import episode_to_markdown, parse_episode
    from memory.chroma_client import upsert_main_episode_chunks

    grouped: dict[int, list[dict]] = defaultdict(list)
    MARKDOWN_DIR.mkdir(parents=True, exist_ok=True)
    for html_path in sorted(EPISODE_SCRIPTS_DIR.glob("s??e??.html")):
        season = int(html_path.stem[1:3])
        if seasons is not None and season not in seasons:
            continue
        parsed = parse_episode(html_path)
        grouped[season].append(parsed)
        markdown_text = episode_to_markdown(parsed)
        markdown_path = MARKDOWN_DIR / f"{html_path.stem.lower()}.md"
        markdown_path.write_text(markdown_text, encoding="utf-8")
        upsert_main_episode_chunks(parsed, markdown_text)

    results: dict[int, int] = {}
    for season, episodes in sorted(grouped.items()):
        episodes.sort(key=lambda episode: episode.get("episode_id", ""))
        target = EPISODE_SCRIPTS_DIR / f"season{season}_parsed.json"
        target.write_text(json.dumps(episodes, ensure_ascii=False, indent=2), encoding="utf-8")
        results[season] = len(episodes)
        print(f"wrote {target.name} ({len(episodes)} episodes)")
    return results


if __name__ == "__main__":
    build_episode_library()
