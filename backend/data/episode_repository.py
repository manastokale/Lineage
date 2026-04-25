from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

import config

EXPECTED_SEASON_EPISODE_COUNTS = {
    1: 24,
    2: 24,
    3: 25,
    4: 24,
    5: 24,
    6: 25,
    7: 24,
    8: 24,
    9: 24,
    10: 18,
}

_RERANK_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "did",
    "do",
    "does",
    "for",
    "from",
    "had",
    "has",
    "have",
    "he",
    "her",
    "hers",
    "him",
    "his",
    "how",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "ours",
    "she",
    "that",
    "the",
    "their",
    "them",
    "they",
    "this",
    "to",
    "up",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "who",
    "why",
    "with",
    "would",
    "you",
    "your",
    "yours",
}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\n", " ")).strip()


def _normalize_speaker_name(name: str) -> str:
    text = _normalize_text(name)
    if not text:
        return ""
    return " ".join(part.capitalize() for part in re.split(r"\s+", text))

def _season_data_candidates(season: int) -> list[Path]:
    base = Path(config.EPISODE_SCRIPTS_DIR)
    return [
        base / f"season{season}_parsed.json",
        base / f"season{season:02d}_parsed.json",
    ]


def _episode_markdown_dir() -> Path:
    return Path(config.EPISODE_SCRIPTS_DIR) / "markdown"


def _episode_markdown_path(episode_id: str) -> Path:
    return _episode_markdown_dir() / f"{episode_id.lower()}.md"


def _season_data_path(season: int) -> Path:
    for candidate in _season_data_candidates(season):
        if candidate.exists():
            return candidate
    return _season_data_candidates(season)[0]
def _arc_summary_raw_output_dir() -> Path:
    path = Path(config.PROJECT_ROOT) / ".run" / "arc_summary_raw"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _generated_script_output_dir() -> Path:
    path = Path(config.PROJECT_ROOT) / ".run" / "generated_episode_script"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _summary_instructions_path() -> Path:
    return Path(config.PROJECT_ROOT) / "summary_instructions.md"


@lru_cache(maxsize=1)
def _load_summary_instructions() -> str:
    path = _summary_instructions_path()
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _episode_html_path(episode_id: str) -> Path:
    return Path(config.EPISODE_SCRIPTS_DIR) / f"{episode_id.lower()}.html"


def _load_episode_html(episode_id: str) -> str:
    path = _episode_html_path(episode_id)
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _write_arc_summary_raw_output(episode_id: str, raw: str, suffix: str = "combined") -> None:
    if not raw.strip():
        return
    (_arc_summary_raw_output_dir() / f"{episode_id.lower()}.{suffix}.json").write_text(raw, encoding="utf-8")


def _generated_script_path(episode_id: str) -> Path:
    return _generated_script_output_dir() / f"{episode_id.lower()}.script.json"


def _write_generated_script_payload(episode_id: str, payload: dict) -> None:
    _generated_script_path(episode_id).write_text(json.dumps(payload, indent=2), encoding="utf-8")

@lru_cache(maxsize=12)
def _load_episodes_for_season(season: int) -> list[dict]:
    markdown_dir = _episode_markdown_dir()
    if markdown_dir.exists():
        markdown_files = sorted(markdown_dir.glob(f"s{season:02d}e??.md"))
        if markdown_files:
            from ingestion.parser import parse_episode_markdown

            return [parse_episode_markdown(path) for path in markdown_files]
    path = _season_data_path(season)
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, list) else []

def _episodes_for_season(season: int) -> list[dict]:
    return sorted(_load_episodes_for_season(season), key=_episode_sort_key)


@lru_cache(maxsize=1)
def _load_all_episodes() -> list[dict]:
    episodes: list[dict] = []
    for season in range(1, 11):
        episodes.extend(_load_episodes_for_season(season))
    return sorted(episodes, key=_episode_sort_key)


def list_all_episodes() -> list[dict]:
    return list(_load_all_episodes())


def _episode_sort_key(episode: dict) -> tuple[int, int]:
    episode_id = episode.get("episode_id", "")
    match = re.match(r"s(\d{2})e(\d{2})", episode_id, re.IGNORECASE)
    if match:
        return int(match.group(1)), int(match.group(2))
    return int(episode.get("season", 1) or 1), int(episode.get("episode", 0) or 0)


def _episode_numbers(episode_id: str) -> tuple[int, int]:
    match = re.match(r"s(\d{2})e(\d{2})", episode_id, re.IGNORECASE)
    if not match:
        return (1, 0)
    return int(match.group(1)), int(match.group(2))


def _tokenize_for_rerank(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9']+", (text or "").lower())
        if len(token) > 2 and token not in _RERANK_STOPWORDS
    }


def _episode_distance(from_episode_id: str, to_episode_id: str) -> int:
    from_season, from_number = _episode_numbers(from_episode_id)
    to_season, to_number = _episode_numbers(to_episode_id)
    return max(0, (to_season * 100 + to_number) - (from_season * 100 + from_number))


def _rerank_memory_chunks(
    items: list[dict],
    query_text: str,
    through_episode_id: str,
    *,
    participant_focus: set[str] | None = None,
    limit: int = 5,
) -> list[dict]:
    if not items:
        return []

    query = _normalize_text(query_text).lower()
    query_tokens = _tokenize_for_rerank(query_text)
    participant_focus = {name for name in (participant_focus or set()) if name}
    ranked: list[tuple[float, tuple[int, int], dict]] = []

    for item in items:
        summary = _normalize_text(str(item.get("summary", "")))
        title = _normalize_text(str(item.get("title", "")))
        combined = f"{title} {summary}".lower()
        summary_tokens = _tokenize_for_rerank(combined)
        overlap = len(query_tokens & summary_tokens)
        title_overlap = len(query_tokens & _tokenize_for_rerank(title))
        phrase_bonus = 0.0
        if query and len(query) >= 16 and query in combined:
            phrase_bonus += 3.0

        participant_bonus = 0.0
        participants = {str(name).strip() for name in item.get("participants", []) if str(name).strip()}
        if participant_focus and participants:
            participant_bonus += 1.5 * len(participant_focus & participants)

        query_name_hits = 0
        for name in participant_focus or set():
            normalized = name.lower()
            if normalized and normalized in combined:
                query_name_hits += 1

        distance = _episode_distance(str(item.get("episode_id", "")), through_episode_id)
        recency_bonus = 1.0 / (1.0 + distance / 2.0)

        score = (
            overlap * 3.5
            + title_overlap * 1.5
            + phrase_bonus
            + participant_bonus
            + query_name_hits * 1.2
            + recency_bonus
        )
        ranked.append((score, _episode_sort_key(item), item))

    ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
    deduped: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for _, _, item in ranked:
        key = (
            str(item.get("episode_id", "")),
            str(item.get("title", "")),
            str(item.get("summary", "")),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
        if len(deduped) >= limit:
            break
    return deduped


def _rerank_memory_chunks_with_debug(
    items: list[dict],
    query_text: str,
    through_episode_id: str,
    *,
    participant_focus: set[str] | None = None,
    limit: int = 5,
) -> tuple[list[dict], list[dict]]:
    if not items:
        return [], []

    query = _normalize_text(query_text).lower()
    query_tokens = _tokenize_for_rerank(query_text)
    participant_focus = {name for name in (participant_focus or set()) if name}
    ranked: list[tuple[float, tuple[int, int], dict, dict]] = []

    for item in items:
        summary = _normalize_text(str(item.get("summary", "")))
        title = _normalize_text(str(item.get("title", "")))
        combined = f"{title} {summary}".lower()
        summary_tokens = _tokenize_for_rerank(combined)
        overlap = len(query_tokens & summary_tokens)
        title_overlap = len(query_tokens & _tokenize_for_rerank(title))
        phrase_bonus = 0.0
        if query and len(query) >= 16 and query in combined:
            phrase_bonus += 3.0

        participant_bonus = 0.0
        participants = [str(name).strip() for name in item.get("participants", []) if str(name).strip()]
        participants_set = set(participants)
        if participant_focus and participants_set:
            participant_bonus += 1.5 * len(participant_focus & participants_set)

        query_name_hits = 0
        for name in participant_focus or set():
            normalized = name.lower()
            if normalized and normalized in combined:
                query_name_hits += 1

        distance = _episode_distance(str(item.get("episode_id", "")), through_episode_id)
        recency_bonus = 1.0 / (1.0 + distance / 2.0)

        score = (
            overlap * 3.5
            + title_overlap * 1.5
            + phrase_bonus
            + participant_bonus
            + query_name_hits * 1.2
            + recency_bonus
        )
        debug = {
            "episode_id": str(item.get("episode_id", "")),
            "title": title or str(item.get("episode_id", "")),
            "participants": participants,
            "score": round(score, 3),
            "overlap": overlap,
            "title_overlap": title_overlap,
            "phrase_bonus": round(phrase_bonus, 3),
            "participant_bonus": round(participant_bonus, 3),
            "query_name_hits": query_name_hits,
            "recency_bonus": round(recency_bonus, 3),
        }
        ranked.append((score, _episode_sort_key(item), item, debug))

    ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
    deduped: list[dict] = []
    debug_rows: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for _, _, item, debug in ranked:
        key = (
            str(item.get("episode_id", "")),
            str(item.get("title", "")),
            str(item.get("summary", "")),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
        debug_rows.append(debug)
        if len(deduped) >= limit:
            break
    return deduped, debug_rows

def list_episode_summaries() -> list[dict]:
    results = []
    for episode in sorted(list_all_episodes(), key=_episode_sort_key):
        source = episode
        season, number = _episode_numbers(source["episode_id"])
        results.append(
            {
                "episode_id": source["episode_id"],
                "title": source["title"],
                "season": season,
                "episode": number,
                "status": source.get("status", "final"),
                "created_at": source.get("created_at", source["episode_id"].upper()),
                "scene_count": len(source.get("scenes", [])),
            }
        )
    return results

def get_episode(episode_id: str) -> dict | None:
    season, _ = _episode_numbers(episode_id)
    for episode in _episodes_for_season(season):
        if episode.get("episode_id") == episode_id:
            season, number = _episode_numbers(episode_id)
            copy = dict(episode)
            copy.setdefault("season", season)
            copy.setdefault("episode", number)
            copy.setdefault("status", "final")
            copy.setdefault("created_at", episode_id.upper())
            return copy
    return None


def get_scene(episode_id: str, scene_id: str) -> dict | None:
    episode = get_episode(episode_id)
    if not episode:
        return None
    for scene in episode.get("scenes", []):
        if scene.get("scene_id") == scene_id:
            return scene
    return None


def flatten_episode_lines(episode_id: str) -> list[dict]:
    episode = get_episode(episode_id)
    if not episode:
        return []
    flattened: list[dict] = []
    global_line_index = 0
    for scene in episode.get("scenes", []):
        flattened.append(
            {
                "type": "scene_start",
                "scene_id": scene["scene_id"],
                "location": scene.get("location", "Unknown"),
                "text": _display_scene_text(scene),
                "generated": False,
            }
        )
        for line in scene.get("lines", []):
            flattened.append(
                {
                    "type": "dialogue",
                    "scene_id": scene["scene_id"],
                    # Keep line numbering global across the whole episode so it
                    # matches the screenplay viewer's selected anchor index.
                    "line_index": global_line_index,
                    "speaker": line.get("speaker", ""),
                    "text": _normalize_text(line.get("text", "")),
                    "generated": False,
                    "emotion_tags": line.get("emotion_tags", []),
                    "stage_direction": line.get("stage_direction", ""),
                    "location": scene.get("location", "Unknown"),
                }
            )
            global_line_index += 1
    return flattened

def _display_scene_text(scene: dict) -> str:
    description = _normalize_text(scene.get("scene_description", ""))
    location = _normalize_text(scene.get("location", ""))
    marker = re.search(r"(\[(?:Scene|SCENE)[^\]]+\]|\((?:Scene|SCENE)[^)]+\))", description, re.IGNORECASE)
    if marker:
        extracted = _normalize_text(marker.group(1))
        extracted = re.sub(r"^[\[(]\s*scene:?\s*", "", extracted, flags=re.IGNORECASE)
        extracted = re.sub(r"[\])]\s*$", "", extracted).strip()
        extracted = re.sub(r"^\s*scene:?\s*", "", extracted, flags=re.IGNORECASE).strip("[]() ")
        if extracted and "unknown" not in extracted.lower():
            return extracted
    if description and "scene unknown" not in description.lower() and description.lower() not in {"scene", "[scene]", "[scene: unknown]"}:
        return re.sub(r"^[\[(]\s*scene:?\s*", "", description, flags=re.IGNORECASE).strip("[]() ")
    if location and location.lower() != "unknown":
        return location
    return "Scene continues"


def relationship_graph(episode_id: str) -> dict:
    episode = get_episode(episode_id)
    if not episode:
        return {"nodes": [], "edges": []}
    counts = Counter()
    edge_counts: dict[tuple[str, str], Counter[str]] = defaultdict(Counter)
    for scene in episode.get("scenes", []):
        speakers = [line["speaker"] for line in scene.get("lines", []) if line.get("speaker")]
        for speaker in speakers:
            counts[speaker] += 1
        unique = list(dict.fromkeys(speakers))
        for index, source in enumerate(unique):
            for target in unique[index + 1:]:
                pair = tuple(sorted((source, target)))
                edge_counts[pair]["neutral"] += 1
                for line in scene.get("lines", []):
                    if line.get("speaker") in pair:
                        for emotion in line.get("emotion_tags", []) or []:
                            edge_counts[pair][emotion] += 1
    nodes = [
        {
            "id": name,
            "label": name,
            "importance": min(1.0, count / max(counts.values() or [1])),
            "line_count": count,
            "emotion": "neutral",
        }
        for name, count in counts.items()
    ]
    edges = []
    max_strength = max((sum(counter.values()) for counter in edge_counts.values()), default=1)
    for (source, target), counter in edge_counts.items():
        emotion = counter.most_common(1)[0][0] if counter else "neutral"
        strength = sum(counter.values()) / max_strength
        edges.append(
            {
                "source": source,
                "target": target,
                "weight": sum(counter.values()),
                "strength": round(strength, 3),
                "distance": round(1 - strength, 3),
                "emotion": emotion,
            }
        )
    return {"nodes": nodes, "edges": edges}


def _prior_episodes_until(episode_id: str) -> list[dict]:
    season, number = _episode_numbers(episode_id)
    episodes = []
    for episode in _load_all_episodes():
        ep_season, ep_number = _episode_numbers(episode["episode_id"])
        if (ep_season, ep_number) >= (season, number):
            break
        episodes.append(episode)
    return episodes

def _full_episode_transcript(episode: dict) -> str:
    transcript_lines: list[str] = []
    for scene in episode.get("scenes", []):
        scene_header = _display_scene_text(scene)
        if scene_header:
            transcript_lines.append(scene_header)
        for line in scene.get("lines", []):
            speaker = line.get("speaker")
            text = _normalize_text(line.get("text", ""))
            if not speaker or not text:
                continue
            transcript_lines.append(f"{speaker}: {text}")
    return "\n".join(transcript_lines)

def _arc_summary_looks_generic(summary: str, character: str) -> bool:
    text = _normalize_text(summary).lower()
    if not text:
        return True
    generic_markers = [
        "goes from",
        "beats around",
        "spends this episode dealing with moments like",
        "is involved throughout this episode",
        "key beats that build on the story",
        "appears briefly in this episode",
        "small but noticeable contribution",
    ]
    if any(marker in text for marker in generic_markers):
        return True
    if len(text.split()) < 10:
        return True
    if character.lower() not in text and not text.startswith(("he ", "she ", "they ")):
        return True
    return False

def _notify_arc_progress(progress_callback, **event) -> None:
    if not progress_callback:
        return
    progress_callback(event)


def _extract_json_object_after_key(raw: str, key: str) -> dict | None:
    key_match = re.search(rf'"{re.escape(key)}"\s*:\s*\{{', raw)
    if not key_match:
        return None
    start = raw.find("{", key_match.start())
    if start < 0:
        return None
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(raw)):
        ch = raw[index]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(raw[start : index + 1])
                except Exception:
                    return None
    return None


def _extract_partial_episode_summary_payload(raw: str, episode: dict) -> dict | None:
    episode_id_match = re.search(r'"episode_id"\s*:\s*"([^"]+)"', raw)
    title_match = re.search(r'"title"\s*:\s*"([^"]+)"', raw)
    scene_count_match = re.search(r'"scene_count"\s*:\s*"?(\d+)"?', raw)
    arcs = _extract_json_object_after_key(raw, "character_arcs")
    if not arcs:
        return None
    payload: dict = {
        "episode_id": episode_id_match.group(1) if episode_id_match else episode["episode_id"],
        "title": title_match.group(1) if title_match else episode["title"],
        "scene_count": int(scene_count_match.group(1)) if scene_count_match else len(episode.get("scenes", [])),
        "character_arcs": arcs,
        "scenes": episode.get("scenes", []),
    }
    return payload


def _parse_episode_summary_payload(raw: str, episode: dict) -> tuple[list[dict], dict | None]:
    if not raw.strip():
        return [], None
    try:
        payload = json.loads(raw)
    except Exception:
        payload = _extract_partial_episode_summary_payload(raw, episode)
        if not payload:
            return [], None
    arcs = payload.get("character_arcs")
    if not isinstance(arcs, dict):
        return [], None
    docs: list[dict] = []
    for character, summary in arcs.items():
        character_name = _normalize_speaker_name(character)
        summary_text = _normalize_text(str(summary or ""))
        if not character_name or not summary_text or _arc_summary_looks_generic(summary_text, character_name):
            continue
        docs.append(
            {
                "episode_id": episode["episode_id"],
                "title": episode["title"],
                "character": character_name,
                "summary": summary_text,
            }
        )
    normalized_payload = {
        "episode_id": payload.get("episode_id", episode["episode_id"]),
        "title": payload.get("title", episode["title"]),
        "scene_count": int(payload.get("scene_count", len(payload.get("scenes") or [])) or 0),
        "status": "final",
        "created_at": episode["episode_id"].upper(),
        "scenes": payload.get("scenes") or episode.get("scenes", []),
    }
    return docs, normalized_payload


def _parse_episode_script_payload(raw: str, episode: dict) -> dict | None:
    if not raw.strip():
        return None
    try:
        payload = json.loads(raw)
    except Exception:
        return None
    scenes = payload.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        return None
    return {
        "episode_id": payload.get("episode_id", episode["episode_id"]),
        "title": payload.get("title", episode["title"]),
        "scene_count": int(payload.get("scene_count", len(scenes)) or len(scenes)),
        "status": "final",
        "created_at": episode["episode_id"].upper(),
        "scenes": scenes,
    }


def _parse_character_arc_payload(raw: str, episode: dict) -> list[dict]:
    docs, _ = _parse_episode_summary_payload(raw, episode)
    return docs


def _generate_arc_summaries_for_episode_json(
    episode: dict,
    *,
    model_override: str | None = None,
    progress_callback=None,
) -> list[dict]:
    if config.USE_DUMMY_DATA:
        return []
    instructions = _load_summary_instructions()
    html = _load_episode_html(episode["episode_id"])
    if not instructions or not html:
        return []
    season, number = _episode_numbers(episode["episode_id"])
    try:
        from llm.providers import call_llm

        prompt = (
            f"SEASON {season} EPISODE {number}\n"
            "===TRANSCRIPT_START===\n"
            f"{html}\n"
            "===TRANSCRIPT_END==="
        )
        _notify_arc_progress(
            progress_callback,
            phase="script_prompt_preparing",
            step_message=f"Preparing annotated script generation for {episode['episode_id'].upper()} from its raw HTML transcript.",
            current_episode=episode["episode_id"],
        )
        _notify_arc_progress(
            progress_callback,
            phase="script_prompt_sent",
            step_message=f"Annotated script prompt sent for {episode['episode_id'].upper()} using {model_override or 'the configured arc-summary model'}.",
            current_episode=episode["episode_id"],
        )
        script_raw = call_llm(
            instructions,
            prompt,
            role="arc_summary",
            normalize="multiline",
            usage_metadata={"characters": _episode_characters_with_lines(episode)},
            model_override=model_override,
        )
        _write_arc_summary_raw_output(episode["episode_id"], script_raw, "script")
        _notify_arc_progress(
            progress_callback,
            phase="script_output_received",
            step_message=f"Annotated script output received for {episode['episode_id'].upper()}.",
            current_episode=episode["episode_id"],
        )
        _notify_arc_progress(
            progress_callback,
            phase="script_parsing",
            step_message=f"Parsing annotated script JSON for {episode['episode_id'].upper()}.",
            current_episode=episode["episode_id"],
        )
        normalized_payload = _parse_episode_script_payload(script_raw, episode)
        if not normalized_payload:
            _notify_arc_progress(
                progress_callback,
                phase="episode_failed",
                step_message=f"Annotated script parsing failed for {episode['episode_id'].upper()}.",
                current_episode=episode["episode_id"],
            )
            return []
        _write_generated_script_payload(episode["episode_id"], normalized_payload)
        _notify_arc_progress(
            progress_callback,
            phase="script_parsed",
            step_message=f"Annotated script parsed and saved for {episode['episode_id'].upper()}.",
            current_episode=episode["episode_id"],
        )
        arcs_system_prompt = (
            "You are writing episode-specific Friends character arc summaries from an annotated episode JSON. "
            "Return a single valid JSON object with exactly these keys: "
            '{"episode_id":"sXXeYY","character_arcs":{"Character":"1-2 sentence summary"}}. '
            "Do not include markdown or extra text. Each summary must be human-readable, story-like, specific to this episode, "
            "and describe what the character actually does, goes through, wants, struggles with, and resolves. "
            "Do not quote dialogue. Do not be generic."
        )
        arcs_prompt = (
            f"EPISODE JSON FOR {episode['episode_id'].upper()}:\n"
            f"{json.dumps(normalized_payload, ensure_ascii=False)}"
        )
        _notify_arc_progress(
            progress_callback,
            phase="arcs_prompt_sent",
            step_message=f"Character arc prompt sent for {episode['episode_id'].upper()}.",
            current_episode=episode["episode_id"],
        )
        arcs_raw = call_llm(
            arcs_system_prompt,
            arcs_prompt,
            role="arc_summary",
            normalize="multiline",
            usage_metadata={"characters": _episode_characters_with_lines(episode)},
            model_override=model_override,
        )
        _write_arc_summary_raw_output(episode["episode_id"], arcs_raw, "arcs")
        _notify_arc_progress(
            progress_callback,
            phase="arcs_output_received",
            step_message=f"Character arc output received for {episode['episode_id'].upper()}.",
            current_episode=episode["episode_id"],
        )
        docs = _parse_character_arc_payload(arcs_raw, episode)
        _notify_arc_progress(
            progress_callback,
            phase="arcs_parsed",
            step_message=f"Parsed {len(docs)} character arc summaries for {episode['episode_id'].upper()}.",
            current_episode=episode["episode_id"],
        )
        return docs
    except Exception:
        _notify_arc_progress(
            progress_callback,
            phase="episode_failed",
            step_message=f"Episode-level summary generation failed for {episode['episode_id'].upper()}.",
            current_episode=episode["episode_id"],
        )
        return []


def episode_data_matrix(season: int, *, arc_counts_by_episode: dict[str, int] | None = None) -> list[dict]:
    episodes = {episode["episode_id"]: episode for episode in _episodes_for_season(season)}
    rows: list[dict] = []
    try:
        from memory.chroma_client import character_arc_counts_by_episode
    except Exception:
        character_arc_counts_by_episode = lambda: {}  # type: ignore
    counts = arc_counts_by_episode if arc_counts_by_episode is not None else character_arc_counts_by_episode()

    for number in range(1, EXPECTED_SEASON_EPISODE_COUNTS.get(season, 0) + 1):
        episode_id = f"s{season:02d}e{number:02d}"
        parsed_episode = episodes.get(episode_id)
        source = parsed_episode or {}
        html_exists = _episode_html_path(episode_id).exists()
        script_ready = bool(parsed_episode) and html_exists
        chroma_count = int(counts.get(episode_id, 0))
        rows.append(
            {
                "episode_id": episode_id,
                "season": season,
                "episode": number,
                "title": source.get("title") or episode_id.upper(),
                "script_ready": script_ready,
                "chroma_ready": chroma_count > 0,
                "arc_count": chroma_count,
                "expected_arc_count": len(_episode_characters_with_lines(parsed_episode)) if parsed_episode else 0,
                "html_exists": html_exists,
                "regenerated": False,
            }
        )
    return rows


def season_arc_health(season: int, *, arc_counts_by_episode: dict[str, int] | None = None) -> dict:
    rows = episode_data_matrix(season, arc_counts_by_episode=arc_counts_by_episode)
    expected_episodes = len(rows)
    parsed_episodes = sum(1 for row in rows if row.get("script_ready"))
    stored_arcs = sum(int(row.get("arc_count") or 0) for row in rows)
    expected_arcs = sum(int(row.get("expected_arc_count") or 0) for row in rows)
    covered_arcs = sum(min(int(row.get("arc_count") or 0), int(row.get("expected_arc_count") or 0)) for row in rows)
    overflow_arcs = max(0, stored_arcs - covered_arcs)
    fully_covered_episodes = sum(
        1
        for row in rows
        if int(row.get("expected_arc_count") or 0) > 0
        and int(row.get("arc_count") or 0) >= int(row.get("expected_arc_count") or 0)
    )
    return {
        "season": season,
        "parsed_episodes": parsed_episodes,
        "expected_episodes": expected_episodes,
        "stored_arcs": stored_arcs,
        "expected_arcs": expected_arcs,
        "covered_arcs": covered_arcs,
        "overflow_arcs": overflow_arcs,
        "fully_covered_episodes": fully_covered_episodes,
        "transcript_ready": expected_episodes > 0 and parsed_episodes >= expected_episodes,
        "arc_ready": expected_arcs > 0 and covered_arcs >= expected_arcs,
    }


def _episode_characters_with_lines(episode: dict) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for scene in episode.get("scenes", []):
        for line in scene.get("lines", []):
            speaker = line.get("speaker")
            if not speaker or speaker in seen or not _normalize_text(line.get("text", "")):
                continue
            seen.add(speaker)
            ordered.append(speaker)
    return ordered


def parsed_episode_count_for_season(season: int) -> int:
    return len(_episodes_for_season(season))


def expected_arc_summary_count_for_season(season: int) -> int:
    return sum(len(_episode_characters_with_lines(episode)) for episode in _episodes_for_season(season))

def ensure_arc_summaries_for_season(
    season: int,
    progress_callback=None,
    *,
    force: bool = False,
    model_override: str | None = None,
) -> dict[str, int]:
    episodes = _episodes_for_season(season)
    total = max(len(episodes), 1)
    expected = sum(len(_episode_characters_with_lines(episode)) for episode in episodes)
    _notify_arc_progress(
        progress_callback,
        phase="initializing",
        step_message=f"Preparing season {season:02d} transcript bundle from locally parsed scripts.",
        processed=0,
        total=total,
    )
    try:
        from memory.chroma_client import count_arc_summary_documents_for_season

        if not force and count_arc_summary_documents_for_season(season) >= expected:
            return {"total": expected, "generated": expected, "stored": expected}
    except Exception:
        pass

    if not episodes or config.USE_DUMMY_DATA:
        return {"total": 0, "generated": 0, "stored": 0}

    try:
        from memory.chroma_client import purge_arc_summary_documents, upsert_arc_summary_documents

        if force:
            _notify_arc_progress(
                progress_callback,
                phase="purging_existing",
                step_message=f"Purging any existing season {season:02d} arc summaries before regeneration.",
                processed=0,
                total=total,
            )
            purge_arc_summary_documents(season=season)
        generated_total = 0
        stored_total = 0
        for index, episode in enumerate(episodes, start=1):
            _notify_arc_progress(
                progress_callback,
                phase="episode_start",
                step_message=f"Generating annotated script and character arcs for {episode['episode_id'].upper()}.",
                processed=index - 1,
                total=total,
                generated=generated_total,
                stored=stored_total,
                current_episode=episode["episode_id"],
            )
            docs = _generate_arc_summaries_for_episode_json(
                episode,
                model_override=model_override,
                progress_callback=progress_callback,
            )
            if not docs:
                _notify_arc_progress(
                    progress_callback,
                    phase="episode_incomplete",
                    step_message=f"No usable character arcs were produced for {episode['episode_id'].upper()}.",
                    processed=index,
                    total=total,
                    generated=generated_total,
                    stored=stored_total,
                    current_episode=episode["episode_id"],
                )
                continue
            _notify_arc_progress(
                progress_callback,
                phase="writing_to_chroma",
                step_message=f"Writing {len(docs)} character arcs for {episode['episode_id'].upper()} to Chroma.",
                processed=index - 1,
                total=total,
                generated=generated_total + len(docs),
                stored=stored_total,
                current_episode=episode["episode_id"],
            )
            stored_now = upsert_arc_summary_documents(docs)
            generated_total += len(docs)
            stored_total += max(0, stored_now)
            _notify_arc_progress(
                progress_callback,
                phase="episode_complete",
                step_message=f"Stored {stored_now} character arcs for {episode['episode_id'].upper()}.",
                processed=index,
                total=total,
                generated=generated_total,
                stored=stored_total,
                current_episode=episode["episode_id"],
            )
    except Exception as exc:
        _notify_arc_progress(
            progress_callback,
            phase="error",
            step_message=str(exc),
            processed=0,
            total=total,
        )
        raise
    get_character_arc_summaries.cache_clear()
    return {"total": expected, "generated": generated_total, "stored": stored_total}


def ensure_all_arc_summaries_generated(progress_callback=None, *, force: bool = False, model_override: str | None = None) -> dict[str, int]:
    return ensure_arc_summaries_for_season(1, progress_callback=progress_callback, force=force, model_override=model_override)


def ensure_arc_summaries_for_episode(
    episode_id: str,
    *,
    characters: list[str] | None = None,
    progress_callback=None,
    force: bool = False,
    model_override: str | None = None,
) -> dict[str, int]:
    season, _ = _episode_numbers(episode_id)
    return ensure_arc_summaries_for_season(season, progress_callback=progress_callback, force=force, model_override=model_override)


@lru_cache(maxsize=512)
def get_character_arc_summaries(character: str, through_episode_id: str) -> list[dict]:
    try:
        from memory.chroma_client import get_character_arc_summaries_before_episode

        return get_character_arc_summaries_before_episode(character, through_episode_id)
    except Exception:
        return []


def get_relevant_character_arc_summaries(
    character: str,
    through_episode_id: str,
    query_text: str,
    limit: int = 5,
) -> list[dict]:
    return get_relevant_character_arc_summaries_with_debug(
        character,
        through_episode_id,
        query_text,
        limit=limit,
    )[0]


def get_relevant_character_arc_summaries_with_debug(
    character: str,
    through_episode_id: str,
    query_text: str,
    limit: int = 5,
) -> tuple[list[dict], list[dict]]:
    candidates: list[dict] = []
    try:
        from memory.chroma_client import query_relevant_arc_summaries

        summaries = query_relevant_arc_summaries(character, through_episode_id, query_text, n_results=limit)
        if summaries:
            candidates.extend(summaries)
    except Exception:
        pass
    fallback = get_character_arc_summaries(character, through_episode_id)
    if fallback:
        candidates.extend(fallback[-max(limit * 3, limit):])
    return _rerank_memory_chunks_with_debug(
        candidates,
        query_text,
        through_episode_id,
        participant_focus={character},
        limit=limit,
    )


@lru_cache(maxsize=512)
def get_character_interaction_summaries(character: str, through_episode_id: str) -> list[dict]:
    try:
        from memory.chroma_client import get_interaction_summaries_before_episode

        return get_interaction_summaries_before_episode([character], through_episode_id)
    except Exception:
        return []


def get_interaction_summaries_for_selection(characters: list[str], through_episode_id: str) -> list[dict]:
    try:
        from memory.chroma_client import get_interaction_summaries_before_episode

        return get_interaction_summaries_before_episode(characters, through_episode_id)
    except Exception:
        return []


def get_relevant_character_interactions(
    character: str,
    through_episode_id: str,
    query_text: str,
    limit: int = 8,
) -> list[dict]:
    return get_relevant_character_interactions_with_debug(
        character,
        through_episode_id,
        query_text,
        limit=limit,
    )[0]


def get_relevant_character_interactions_with_debug(
    character: str,
    through_episode_id: str,
    query_text: str,
    limit: int = 8,
) -> tuple[list[dict], list[dict]]:
    interactions = get_character_interaction_summaries(character, through_episode_id)
    return _rerank_memory_chunks_with_debug(
        interactions,
        query_text,
        through_episode_id,
        participant_focus={character},
        limit=limit,
    )


def get_recent_lines_for_character(name: str, limit: int = 5, through_episode_id: str | None = None) -> list[dict]:
    episodes = _prior_episodes_until(through_episode_id) if through_episode_id else _load_all_episodes()
    results: list[dict] = []
    for episode in reversed(list(episodes)):
        for scene in reversed(episode.get("scenes", [])):
            for line in reversed(scene.get("lines", [])):
                if line.get("speaker") != name:
                    continue
                results.append(
                    {
                        "scene": scene["scene_id"],
                        "text": _normalize_text(line.get("text", "")),
                        "time": episode["episode_id"].upper(),
                    }
                )
                if len(results) >= limit:
                    return results
    return results


def prior_episode_context(episode_id: str, name: str, limit: int = 6) -> list[dict]:
    summaries = get_character_arc_summaries(name, episode_id)
    return [{"episode_id": item["episode_id"], "text": item["summary"]} for item in summaries[-limit:]]
