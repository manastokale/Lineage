from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import config

from data.episode_repository import flatten_episode_lines, get_episode
from data.episode_repository import get_relevant_character_arc_summaries_with_debug
from data.episode_repository import get_relevant_character_interactions_with_debug


def _variant_dir() -> Path | None:
    path = Path("/tmp/lineage_script_variants") if config.IS_VERCEL else Path(config.PROJECT_ROOT) / ".run" / "script_variants"
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError:
        return None
    return path


def _variant_id(episode_id: str, line_index: int, edited_text: str) -> str:
    digest = hashlib.sha256(f"{episode_id}:{line_index}:{edited_text}:{time.time()}".encode("utf-8")).hexdigest()[:12]
    return f"{episode_id.lower()}-{line_index}-{digest}"


def _persist_variant_report(variant_id: str, report: dict) -> None:
    path = _variant_dir()
    if path is None:
        return
    try:
        (path / f"{variant_id}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    except OSError:
        # Impact analysis should still return even when runtime storage is read-only.
        return


def _line_at(episode_id: str, line_index: int) -> dict | None:
    for line in flatten_episode_lines(episode_id):
        if line.get("type") == "dialogue" and int(line.get("line_index", -1)) == line_index:
            return line
    return None


def _dialogue_lines(episode_id: str) -> list[dict]:
    return [line for line in flatten_episode_lines(episode_id) if line.get("type") == "dialogue"]


def _window_context(lines: list[dict], line_index: int, *, before: int = 6, after: int = 4) -> str:
    position = next((index for index, line in enumerate(lines) if int(line.get("line_index", -1)) == line_index), -1)
    if position < 0:
        return ""
    window = lines[max(0, position - before) : position + after + 1]
    return "\n".join(
        f"{entry.get('speaker', '')}: {entry.get('text', '')}"
        for entry in window
        if str(entry.get("speaker", "")).strip() and str(entry.get("text", "")).strip()
    )


def _downstream_context(lines: list[dict], line_index: int, *, limit: int = 36) -> str:
    future = [line for line in lines if int(line.get("line_index", -1)) > line_index][:limit]
    return "\n".join(
        f"{entry.get('speaker', '')}: {entry.get('text', '')}"
        for entry in future
        if str(entry.get("speaker", "")).strip() and str(entry.get("text", "")).strip()
    )


def _json_object_from_model_text(text: str) -> dict:
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
        if char != "{":
            continue
        try:
            payload, _ = decoder.raw_decode(raw[index:])
            return payload if isinstance(payload, dict) else {}
        except json.JSONDecodeError:
            continue
    return {}


def _estimate_tokens(*parts: str) -> int:
    return max(1, sum(max(1, len(part or "") // 4) for part in parts))


def _normalize_dialogue(text: str) -> str:
    return " ".join((text or "").split())


def _normalize_impact_payload(payload: dict) -> tuple[int, str, str, list[dict], list[dict]]:
    try:
        drift_score = int(payload.get("drift_score", 35))
    except (TypeError, ValueError):
        drift_score = 35
    drift_score = max(0, min(100, drift_score))
    drift_level = str(payload.get("drift_level", "")).strip().lower()
    if drift_level not in {"low", "medium", "high"}:
        drift_level = "high" if drift_score >= 70 else "medium" if drift_score >= 35 else "low"
    summary = str(payload.get("summary", "")).strip() or "The edit changes this line; review downstream beats before accepting it."

    plot_holes = payload.get("introduced_plot_holes", [])
    if not isinstance(plot_holes, list):
        plot_holes = []
    normalized_holes: list[dict] = []
    for index, item in enumerate(plot_holes[:5], start=1):
        if not isinstance(item, dict):
            continue
        normalized_holes.append(
            {
                "id": str(item.get("id", f"impact-{index}")),
                "severity": str(item.get("severity", "medium")).lower()
                if str(item.get("severity", "medium")).lower() in {"low", "medium", "high"}
                else "medium",
                "title": str(item.get("title", "Possible downstream continuity issue")).strip(),
                "explanation": str(item.get("explanation", "")).strip(),
                "line_index": item.get("line_index"),
            }
        )

    repair_suggestions = payload.get("repair_suggestions", [])
    if not isinstance(repair_suggestions, list):
        repair_suggestions = []
    normalized_repairs: list[dict] = []
    for index, item in enumerate(repair_suggestions[:5], start=1):
        if not isinstance(item, dict):
            continue
        normalized_repairs.append(
            {
                "id": str(item.get("id", f"repair-{index}")),
                "kind": str(item.get("kind", "repair")).strip() or "repair",
                "text": str(item.get("text", "")).strip(),
                "rationale": str(item.get("rationale", "")).strip(),
            }
        )
    return drift_score, drift_level, summary, normalized_holes, normalized_repairs


def analyze_edit_impact(episode_id: str, line_index: int, edited_text: str) -> dict:
    episode = get_episode(episode_id)
    line = _line_at(episode_id, line_index)
    if not episode or not line:
        return {"status": "missing_line"}

    lines = _dialogue_lines(episode_id)
    speaker = str(line.get("speaker", "")).strip()
    original_text = str(line.get("text", "")).strip()
    edited_text = edited_text.strip()
    if _normalize_dialogue(edited_text) == _normalize_dialogue(original_text):
        return {"status": "unchanged_line"}

    scene_context = _window_context(lines, line_index)
    downstream = _downstream_context(lines, line_index)
    retrieval_query = f"{speaker}: {edited_text}\nOriginal: {original_text}\n{scene_context}"
    history, _ = get_relevant_character_arc_summaries_with_debug(speaker, episode_id, retrieval_query, limit=5)
    interactions, _ = get_relevant_character_interactions_with_debug(speaker, episode_id, retrieval_query, limit=5)
    history_text = "\n".join(f"[{item['episode_id']}] {item['summary']}" for item in history)
    interaction_text = "\n".join(
        f"[{item['episode_id']}] {' / '.join(item.get('participants', []))}: {item['summary']}"
        for item in interactions
    )

    payload: dict[str, Any] = {}
    if not config.USE_DUMMY_DATA:
        try:
            from llm.providers import call_llm

            system_prompt = (
                "You are a continuity-impact editor for Friends. "
                "Compare a proposed line edit against prior memory, current scene context, and later dialogue. Return JSON only."
            )
            user_message = (
                "Return a JSON object with keys: drift_score 0-100, drift_level low|medium|high, summary, "
                "introduced_plot_holes array, repair_suggestions array. "
                "Repair suggestions can be alternative lines or small bridging dialogue. Be specific and concise.\n\n"
                f"Episode: {episode_id.upper()} {episode.get('title', '')}\n"
                f"Speaker: {speaker}\n"
                f"Original line: {original_text}\n"
                f"Edited line: {edited_text}\n\n"
                f"Prior memory:\n{history_text or '(none)'}\n\n"
                f"Prior interactions:\n{interaction_text or '(none)'}\n\n"
                f"Local scene context:\n{scene_context or '(none)'}\n\n"
                f"Downstream dialogue window:\n{downstream or '(none)'}"
            )
            payload = _json_object_from_model_text(
                call_llm(
                    system_prompt,
                    user_message,
                    role="summary",
                    normalize="multiline",
                    usage_metadata={"feature": "edit_impact", "characters": [speaker]},
                )
            )
        except Exception:
            payload = {}

    drift_score, drift_level, summary, plot_holes, repairs = _normalize_impact_payload(payload)
    if not payload:
        drift_score = 0
        drift_level = "low"
        summary = "Model impact analysis was unavailable, so no automated continuity judgment was made."
        plot_holes = []
        repairs = []

    variant_id = _variant_id(episode_id, line_index, edited_text)
    report = {
        "status": "ok" if payload else "unavailable",
        "variant_id": variant_id,
        "episode_id": episode_id,
        "line_index": line_index,
        "speaker": speaker,
        "original_text": original_text,
        "edited_text": edited_text,
        "drift_score": drift_score,
        "drift_level": drift_level,
        "summary": summary,
        "introduced_plot_holes": plot_holes,
        "repair_suggestions": repairs,
        "downstream_window": {
            "line_count": len([line for line in lines if int(line.get("line_index", -1)) > line_index][:36]),
            "mode": "next_36_dialogue_lines",
        },
        "token_estimate": {
            "estimated_input_tokens": _estimate_tokens(scene_context, downstream, history_text, interaction_text, edited_text, original_text),
            "estimated_output_tokens": 800,
            "mode": "impact_analysis",
        },
        "created_at": time.time(),
    }
    _persist_variant_report(variant_id, report)
    return report
