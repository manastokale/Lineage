from __future__ import annotations

from collections import Counter

from agents.base_agent import AGENTS
from data.episode_repository import get_recent_lines_for_character, list_all_episodes


_MAIN_CAST_OCCUPATIONS = {
    "Chandler": "Statistical analysis and data reconfiguration",
    "Joey": "Actor",
    "Monica": "Chef",
    "Phoebe": "Musician",
    "Rachel": "Fashion",
    "Ross": "Paleontologist",
}


def _episode_sort_key(episode_id: str) -> tuple[int, int]:
    try:
        return int(episode_id[1:3]), int(episode_id[4:6])
    except Exception:
        return (99, 99)


def _character_episodes(name: str, through_episode_id: str | None = None) -> list[dict]:
    results: list[dict] = []
    cutoff = _episode_sort_key(through_episode_id) if through_episode_id else None
    for episode in list_all_episodes():
        if cutoff and _episode_sort_key(episode["episode_id"]) > cutoff:
            continue
        scenes = []
        for scene in episode.get("scenes", []):
            relevant = [line for line in scene.get("lines", []) if line.get("speaker") == name]
            if relevant:
                scenes.append({"scene": scene, "lines": relevant})
        if scenes:
            results.append({"episode": episode, "scenes": scenes})
    return results


def _infer_occupation(name: str, appearances: list[dict]) -> str:
    if name in _MAIN_CAST_OCCUPATIONS:
        return _MAIN_CAST_OCCUPATIONS[name]
    locations = Counter()
    for item in appearances:
        for scene in item["scenes"]:
            location = scene["scene"].get("location") or ""
            if location:
                locations[location] += 1
    if not locations:
        return "Recurring character"
    top = locations.most_common(1)[0][0]
    if "perk" in top.lower():
        return "Central Perk regular"
    return f"Seen around {top}"


def get_character_focus(name: str, episode_id: str | None = None) -> dict | None:
    appearances = _character_episodes(name, through_episode_id=episode_id)
    if len(appearances) < 2 and name not in AGENTS:
        return None

    recent_lines = get_recent_lines_for_character(name, limit=6, through_episode_id=episode_id)
    arc_summaries = []
    interaction_summaries = []
    if appearances:
        try:
            from memory.chroma_client import get_character_arc_summaries_before_episode
            from memory.chroma_client import get_interaction_summaries_before_episode

            arc_summaries = get_character_arc_summaries_before_episode(name, episode_id or appearances[-1]["episode"]["episode_id"])
            interaction_summaries = get_interaction_summaries_before_episode([name], episode_id or appearances[-1]["episode"]["episode_id"])
        except Exception:
            arc_summaries = []
            interaction_summaries = []
    total_lines = sum(len(scene["lines"]) for item in appearances for scene in item["scenes"])
    return {
        "name": name,
        "subtitle": name,
        "version": "V1.0",
        "status": "ACTIVE" if appearances else "LIMITED",
        "quote": "",
        "emoji": "",
        "color": "#F59E0B" if name not in AGENTS else None,
        "occupation": _infer_occupation(name, appearances),
        "personality": {},
        "recentLines": recent_lines,
        "arcSummaries": arc_summaries,
        "interactionSummaries": interaction_summaries,
        "episodeCount": len(appearances),
        "lineCount": total_lines,
        "relationships": [],
    }
