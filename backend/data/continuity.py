from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import config

from data.episode_repository import flatten_episode_lines, get_episode
from data.episode_repository import get_relevant_character_arc_summaries_with_debug
from data.episode_repository import get_relevant_character_interactions_with_debug

ContinuityFlag = dict[str, Any]

_CACHE_VERSION = 2
_MAX_CLAIMS_PER_BATCH = 18
_MAX_REFERENCES = 6
_SCENES_PER_EXTRACTION_BATCH = 3


def _cache_dir() -> Path:
    path = Path(config.PROJECT_ROOT) / ".run" / "continuity_flags"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _cache_path(episode_id: str) -> Path:
    return _cache_dir() / f"{episode_id.lower()}.json"


def _episode_key(episode_id: str) -> tuple[int, int]:
    value = (episode_id or "").lower()
    try:
        if len(value) >= 6 and value[0] == "s" and value[3] == "e":
            return int(value[1:3]), int(value[4:6])
    except ValueError:
        pass
    return (0, 0)


def _json_from_model_text(text: str) -> Any:
    raw = (text or "").strip()
    if raw.startswith("```"):
        first_newline = raw.find("\n")
        if first_newline >= 0:
            raw = raw[first_newline + 1 :]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    decoder = json.JSONDecoder()
    for index, char in enumerate(raw):
        if char not in "[{":
            continue
        try:
            payload, _ = decoder.raw_decode(raw[index:])
            return payload
        except json.JSONDecodeError:
            continue
    return []


def _scene_label(entry: dict) -> str:
    location = str(entry.get("location", "")).strip()
    scene_id = str(entry.get("scene_id", "")).strip()
    return location or scene_id


def _reference_from_item(item: dict) -> dict:
    return {
        "episode_id": str(item.get("episode_id", "")),
        "title": str(item.get("title", item.get("episode_title", item.get("episode_id", "")))),
        "summary": str(item.get("summary", item.get("text", ""))),
    }


def _dedupe_references(items: list[dict], limit: int = _MAX_REFERENCES) -> list[dict]:
    references: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for item in items:
        reference = _reference_from_item(item)
        if not reference["episode_id"] or not reference["summary"]:
            continue
        key = (reference["episode_id"].lower(), reference["summary"])
        if key in seen:
            continue
        seen.add(key)
        references.append(reference)
        if len(references) >= limit:
            break
    return references


def _scene_batches(episode_id: str) -> list[list[dict]]:
    timeline = flatten_episode_lines(episode_id)
    scene_map: dict[str, dict] = {}
    ordered_scene_ids: list[str] = []

    for entry in timeline:
        scene_id = str(entry.get("scene_id", "")).strip()
        if not scene_id:
            continue
        if scene_id not in scene_map:
            scene_map[scene_id] = {
                "scene_id": scene_id,
                "scene_label": _scene_label(entry),
                "lines": [],
            }
            ordered_scene_ids.append(scene_id)
        if entry.get("type") != "dialogue":
            continue
        speaker = str(entry.get("speaker", "")).strip()
        text = str(entry.get("text", "")).strip()
        if not speaker or not text:
            continue
        scene_map[scene_id]["lines"].append(
            {
                "line_index": int(entry.get("line_index", -1)),
                "speaker": speaker,
                "text": text,
                "stage_direction": str(entry.get("stage_direction", "")).strip(),
            }
        )

    scenes = [scene_map[scene_id] for scene_id in ordered_scene_ids if scene_map[scene_id]["lines"]]
    return [scenes[index : index + _SCENES_PER_EXTRACTION_BATCH] for index in range(0, len(scenes), _SCENES_PER_EXTRACTION_BATCH)]


def _scene_batch_prompt(batch: list[dict]) -> str:
    scene_payload = []
    for scene in batch:
        scene_payload.append(
            {
                "scene_id": scene["scene_id"],
                "scene_label": scene["scene_label"],
                "lines": [
                    {
                        "line_index": line["line_index"],
                        "speaker": line["speaker"],
                        "text": line["text"],
                        "stage_direction": line["stage_direction"],
                    }
                    for line in scene["lines"]
                ],
            }
        )
    return json.dumps(scene_payload, ensure_ascii=True)


def _normalize_claims(episode_id: str, raw_payload: Any, scene_lookup: dict[str, dict]) -> list[dict]:
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    raw_claims = payload.get("claims", [])
    if not isinstance(raw_claims, list):
        return []

    claims: list[dict] = []
    for raw in raw_claims:
        if not isinstance(raw, dict):
            continue
        scene_id = str(raw.get("scene_id", "")).strip()
        scene = scene_lookup.get(scene_id)
        if not scene:
            continue
        try:
            line_index = int(raw.get("line_index", -1))
        except (TypeError, ValueError):
            continue
        line = next((item for item in scene["lines"] if item["line_index"] == line_index), None)
        if not line:
            continue
        claim = str(raw.get("claim", "")).strip()
        query = str(raw.get("query", "")).strip() or claim
        if not claim or not query:
            continue
        subjects = raw.get("subjects", [])
        if not isinstance(subjects, list):
            subjects = []
        speaker = str(raw.get("speaker", line["speaker"])).strip() or line["speaker"]
        claims.append(
            {
                "id": f"{episode_id}-{line_index}-claim-{len(claims) + 1}",
                "episode_id": episode_id,
                "scene_id": scene_id,
                "scene_label": scene["scene_label"],
                "line_index": line_index,
                "speaker": speaker,
                "claim": claim,
                "query": query,
                "category": str(raw.get("category", "continuity")).strip() or "continuity",
                "title": str(raw.get("title", "Continuity check")).strip() or "Continuity check",
                "current_text": str(raw.get("current_text", line["text"])).strip() or line["text"],
                "subjects": [str(subject).strip() for subject in subjects if str(subject).strip()],
            }
        )
        if len(claims) >= _MAX_CLAIMS_PER_BATCH:
            break
    return claims


def _extract_claims_with_llm(episode_id: str) -> list[dict]:
    if config.USE_DUMMY_DATA:
        return []

    try:
        from llm.providers import call_llm
    except Exception:
        return []

    claims: list[dict] = []
    for batch in _scene_batches(episode_id):
        scene_lookup = {scene["scene_id"]: scene for scene in batch}
        system_prompt = (
            "You are a continuity-analysis planner for Friends. "
            "Read scenes and extract only story claims worth checking against earlier episodes. "
            "Do not use keyword rules. Infer claims semantically. Include subtle continuity-sensitive facts such as character knowledge, "
            "relationship status, timeline ordering, learned behavior, skills, motivations, promises, objects, locations, and callbacks. "
            "Do not decide whether anything is a plot hole yet. Return JSON only."
        )
        user_message = (
            "Return a JSON object with key claims. claims must be an array. "
            "Each claim must have: scene_id, line_index, speaker, claim, category, title, current_text, query, subjects. "
            "Use the line_index of the line that best anchors the claim. "
            "The query should be a natural-language retrieval query for earlier Friends context. "
            "If there are no continuity-checkable claims, return {\"claims\":[]}.\n\n"
            f"Episode: {episode_id.upper()}\n"
            f"Scenes:\n{_scene_batch_prompt(batch)}"
        )
        try:
            raw = call_llm(
                system_prompt,
                user_message,
                role="summary",
                normalize="multiline",
                usage_metadata={"feature": "continuity_claim_extraction"},
            )
        except Exception:
            continue
        claims.extend(_normalize_claims(episode_id, _json_from_model_text(raw), scene_lookup))
    return claims


def _query_prior_script_chunks(query_text: str, through_episode_id: str, *, limit: int = 4) -> list[dict]:
    if config.USE_DUMMY_DATA:
        return []
    try:
        from memory.chroma_client import MAIN_SCRIPT_COLLECTION_NAME, get_collection

        collection = get_collection(MAIN_SCRIPT_COLLECTION_NAME)
        results = collection.query(query_texts=[query_text], n_results=max(limit * 4, limit))
    except Exception:
        return []

    baseline = _episode_key(through_episode_id)
    chunks: list[dict] = []
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    for document, metadata in zip(documents, metadatas):
        episode_id = str((metadata or {}).get("episode_id", ""))
        if _episode_key(episode_id) >= baseline:
            continue
        chunk_type = str((metadata or {}).get("chunk_type", ""))
        if chunk_type not in {"scene_markdown", "episode_markdown", "scene", "scene_window"}:
            continue
        chunks.append(
            {
                "episode_id": episode_id,
                "title": str((metadata or {}).get("episode_title", episode_id)),
                "summary": str(document or "")[:900],
            }
        )
        if len(chunks) >= limit:
            break
    return chunks


def _retrieval_names_for_claim(claim: dict) -> list[str]:
    names = []
    for value in [claim.get("speaker"), *(claim.get("subjects") or [])]:
        name = str(value or "").strip()
        if not name or name in names:
            continue
        names.append(name)
    return names[:4]


def _references_for_claim(claim: dict, episode_id: str) -> list[dict]:
    query = str(claim.get("query") or claim.get("claim") or "").strip()
    if not query:
        return []

    references: list[dict] = []
    references.extend(_query_prior_script_chunks(query, episode_id))
    for name in _retrieval_names_for_claim(claim):
        history, _ = get_relevant_character_arc_summaries_with_debug(name, episode_id, query, limit=3)
        interactions, _ = get_relevant_character_interactions_with_debug(name, episode_id, query, limit=3)
        references.extend(history)
        references.extend(interactions)
    return _dedupe_references(references)


def _build_candidate_flags(episode_id: str) -> list[ContinuityFlag]:
    claims = _extract_claims_with_llm(episode_id)
    candidates: list[ContinuityFlag] = []

    for claim in claims:
        references = _references_for_claim(claim, episode_id)
        if not references:
            continue
        candidates.append(
            {
                "id": claim["id"],
                "episode_id": episode_id,
                "scene_id": claim["scene_id"],
                "scene_label": claim["scene_label"],
                "line_index": claim["line_index"],
                "speaker": claim["speaker"],
                "severity": "medium",
                "category": claim["category"],
                "title": claim["title"],
                "explanation": "Model-extracted continuity claim awaiting validation against retrieved prior context.",
                "current_text": claim["current_text"],
                "claim": claim["claim"],
                "query": claim["query"],
                "references": references,
                "status": "candidate",
            }
        )
    return candidates


def _normalize_llm_flags(candidates: list[ContinuityFlag], raw_flags: Any) -> list[ContinuityFlag]:
    flags_payload = raw_flags if isinstance(raw_flags, list) else []
    by_id = {flag["id"]: flag for flag in candidates}
    normalized: list[ContinuityFlag] = []
    for raw in flags_payload:
        if not isinstance(raw, dict):
            continue
        candidate_id = str(raw.get("id", ""))
        base = by_id.get(candidate_id)
        if not base:
            continue
        is_plot_hole = raw.get("is_plot_hole", True)
        if is_plot_hole is False:
            continue
        severity = str(raw.get("severity", base["severity"])).lower()
        if severity not in {"low", "medium", "high"}:
            severity = base["severity"]
        explanation = str(raw.get("explanation", "")).strip() or base["explanation"]
        title = str(raw.get("title", "")).strip() or base["title"]
        category = str(raw.get("category", base["category"])).strip() or base["category"]
        normalized.append(
            {
                **base,
                "severity": severity,
                "category": category,
                "title": title,
                "explanation": explanation,
                "status": "flagged",
            }
        )
    return normalized


def _validate_with_llm(candidates: list[ContinuityFlag]) -> list[ContinuityFlag]:
    if not candidates or config.USE_DUMMY_DATA:
        return []

    try:
        from llm.providers import call_llm
    except Exception:
        return []

    prompt_payload = [
        {
            "id": item["id"],
            "speaker": item["speaker"],
            "claim": item.get("claim", item["current_text"]),
            "current_text": item["current_text"],
            "category_hint": item["category"],
            "references": item["references"],
        }
        for item in candidates
    ]
    system_prompt = (
        "You are a strict but nuanced continuity editor for Friends. "
        "Given model-extracted current-scene claims and retrieved prior context, decide which are true continuity risks. "
        "A risk can be a hard contradiction or a softer continuity tension. Do not flag callbacks, deliberate jokes, or compatible facts. "
        "Only flag when the supplied references support the issue. Return JSON only."
    )
    user_message = (
        "Return a JSON array. Each item must have: id, is_plot_hole, severity, category, title, explanation. "
        "Use high only for direct contradictions. Use medium or low for subtle continuity tension. "
        "Return [] if none are supported by the references.\n\n"
        + json.dumps(prompt_payload, ensure_ascii=True)
    )
    try:
        raw = call_llm(
            system_prompt,
            user_message,
            role="summary",
            normalize="multiline",
            usage_metadata={"feature": "continuity_validation"},
        )
    except Exception:
        return []
    return _normalize_llm_flags(candidates, _json_from_model_text(raw))


def _read_cache(episode_id: str) -> dict | None:
    path = _cache_path(episode_id)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if payload.get("cache_version") != _CACHE_VERSION:
        return None
    return payload


def _write_cache(episode_id: str, payload: dict) -> None:
    _cache_path(episode_id).write_text(json.dumps(payload, indent=2), encoding="utf-8")


def analyze_episode_continuity(episode_id: str, *, refresh: bool = False) -> dict:
    episode = get_episode(episode_id)
    if not episode:
        return {
            "episode_id": episode_id,
            "status": "missing_episode",
            "flags": [],
            "generated_at": time.time(),
            "cache_version": _CACHE_VERSION,
        }

    if not refresh:
        cached = _read_cache(episode_id)
        if cached is not None:
            return {**cached, "cached": True}

    candidates = _build_candidate_flags(episode_id)
    flags = _validate_with_llm(candidates)
    payload = {
        "episode_id": episode_id,
        "status": "llm_validated" if flags else "no_validated_flags",
        "generated_at": time.time(),
        "cache_version": _CACHE_VERSION,
        "candidate_count": len(candidates),
        "flags": flags,
    }
    _write_cache(episode_id, payload)
    return {**payload, "cached": False}
