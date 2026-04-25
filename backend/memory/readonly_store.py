from __future__ import annotations

import json
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

import config


def _memory_dir() -> Path:
    return Path(config.LINEAGE_JSON_MEMORY_DIR)


def _character_arcs_path() -> Path:
    return _memory_dir() / "character_arcs.json"


def _interactions_path() -> Path:
    return _memory_dir() / "interactions.json"


def _episode_sort_key(episode_id: str) -> tuple[int, int]:
    match = re.match(r"s(\d{2})e(\d{2})", episode_id or "", re.IGNORECASE)
    if not match:
        return (99, 99)
    return int(match.group(1)), int(match.group(2))


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _normalize_name(value: str) -> str:
    return " ".join(part.capitalize() for part in re.split(r"\s+", _normalize_text(value)) if part)


def _load_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    return payload if isinstance(payload, list) else []


@lru_cache(maxsize=1)
def load_character_arcs() -> list[dict]:
    items: list[dict] = []
    for item in _load_json(_character_arcs_path()):
        episode_id = str(item.get("episode_id", "")).lower()
        character = _normalize_name(str(item.get("character", "")))
        summary = _normalize_text(str(item.get("summary", "")))
        if not episode_id or not character or not summary:
            continue
        items.append(
            {
                "episode_id": episode_id,
                "title": str(item.get("title", episode_id)),
                "character": character,
                "summary": summary,
            }
        )
    items.sort(key=lambda item: (_episode_sort_key(item["episode_id"]), item["character"]))
    return items


@lru_cache(maxsize=1)
def load_interactions() -> list[dict]:
    items: list[dict] = []
    for item in _load_json(_interactions_path()):
        episode_id = str(item.get("episode_id", "")).lower()
        participants = sorted(
            {
                _normalize_name(str(name))
                for name in item.get("participants", [])
                if _normalize_name(str(name))
            }
        )
        summary = _normalize_text(str(item.get("summary", "")))
        if not episode_id or len(participants) < 2 or not summary:
            continue
        items.append(
            {
                "episode_id": episode_id,
                "title": str(item.get("title", episode_id)),
                "participants": participants,
                "summary": summary,
            }
        )
    items.sort(key=lambda item: (_episode_sort_key(item["episode_id"]), "||".join(item["participants"])))
    return items


def clear_cache() -> None:
    load_character_arcs.cache_clear()
    load_interactions.cache_clear()


def memory_available() -> bool:
    return _character_arcs_path().exists() and _interactions_path().exists()


def character_arc_counts_by_episode() -> dict[str, int]:
    counts: Counter[str] = Counter()
    for item in load_character_arcs():
        counts[item["episode_id"]] += 1
    return dict(counts)


def count_arc_summary_documents_for_episode(episode_id: str) -> int:
    return character_arc_counts_by_episode().get(episode_id.lower(), 0)


def count_interaction_summary_documents_for_episode(episode_id: str) -> int:
    episode_id = episode_id.lower()
    return sum(1 for item in load_interactions() if item["episode_id"] == episode_id)


def total_memory_documents() -> int:
    return len(load_character_arcs()) + len(load_interactions())


def count_main_script_documents() -> int:
    from data.episode_repository import list_all_episodes

    total = 0
    for episode in list_all_episodes():
        total += 1
        total += len(episode.get("scenes", []))
    return total


def get_character_arc_summaries_before_episode(character: str, episode_id: str) -> list[dict]:
    baseline = _episode_sort_key(episode_id.lower())
    normalized_character = _normalize_name(character)
    return [
        {
            "episode_id": item["episode_id"],
            "title": item["title"],
            "summary": item["summary"],
        }
        for item in load_character_arcs()
        if item["character"] == normalized_character and _episode_sort_key(item["episode_id"]) < baseline
    ]


def get_interaction_summaries_before_episode(characters: list[str], episode_id: str) -> list[dict]:
    baseline = _episode_sort_key(episode_id.lower())
    selected = {_normalize_name(name) for name in characters if _normalize_name(name)}
    if not selected:
        return []
    results = []
    for item in load_interactions():
        if _episode_sort_key(item["episode_id"]) >= baseline:
            continue
        participants = set(item["participants"])
        if not selected.issubset(participants):
            continue
        results.append(
            {
                "episode_id": item["episode_id"],
                "title": item["title"],
                "participants": item["participants"],
                "summary": item["summary"],
            }
        )
    return results


def query_relevant_arc_summaries(character: str, episode_id: str, query_text: str, n_results: int = 5) -> list[dict]:
    candidates = get_character_arc_summaries_before_episode(character, episode_id)
    if not candidates:
        return []
    query_terms = {
        token
        for token in re.findall(r"[a-z0-9']+", (query_text or "").lower())
        if len(token) > 2
    }
    ranked = []
    for item in candidates:
        summary_terms = set(re.findall(r"[a-z0-9']+", item["summary"].lower()))
        overlap = len(query_terms & summary_terms)
        ranked.append((overlap, _episode_sort_key(item["episode_id"]), item))
    ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
    return [item for _, _, item in ranked[:n_results]]
