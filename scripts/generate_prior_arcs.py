#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT / ".venv311" / "bin" / "python"

if VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    try:
        import chromadb  # type: ignore  # noqa: F401
    except Exception:
        os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]])

sys.path.insert(0, str(ROOT / "backend"))

from data.episode_repository import list_all_episodes  # noqa: E402
from llm.providers import call_llm  # noqa: E402
from memory.chroma_client import (  # noqa: E402
    count_arc_summary_documents_for_episode,
    count_interaction_summary_documents_for_episode,
    purge_arc_summary_documents,
    upsert_arc_summary_documents,
    purge_interaction_summary_documents,
    upsert_interaction_summary_documents,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate prior character arc summaries and store them in Chroma.")
    parser.add_argument("--season", type=int, action="append", help="Only process the given season. Can be repeated.")
    parser.add_argument("--model", help="Force one specific model instead of using the configured arc_summary rotation.")
    parser.add_argument("--force", action="store_true", help="Purge existing arc summaries for the targeted episodes before regenerating.")
    return parser.parse_args()


def scene_text(scene: dict) -> str:
    description = re.sub(r"\s+", " ", str(scene.get("scene_description", "") or "")).strip()
    description = re.sub(r"^[\[(]?\s*scene\s*:?\s*", "", description, flags=re.IGNORECASE).strip("[]() ")
    if description:
        return description
    location = re.sub(r"\s+", " ", str(scene.get("location", "") or "")).strip()
    return location or "Scene continues"


def transcript_for_episode(episode: dict) -> str:
    chunks: list[str] = []
    for scene in episode.get("scenes", []):
        chunks.append(f"SCENE: {scene_text(scene)}")
        for line in scene.get("lines", []):
            speaker = str(line.get("speaker", "") or "").strip()
            text = re.sub(r"\s+", " ", str(line.get("text", "") or "")).strip()
            if speaker and text:
                chunks.append(f"{speaker}: {text}")
    return "\n".join(chunks).strip()


def speaking_characters(episode: dict) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for scene in episode.get("scenes", []):
        for line in scene.get("lines", []):
            speaker = str(line.get("speaker", "") or "").strip()
            text = str(line.get("text", "") or "").strip()
            if not speaker or not text or speaker in seen:
                continue
            seen.add(speaker)
            ordered.append(speaker)
    return ordered


def extract_json(raw: str) -> dict | None:
    raw = raw.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        pass
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, re.DOTALL | re.IGNORECASE)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except Exception:
            return None
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return None
    return None


def docs_from_payload(payload: dict, episode: dict) -> list[dict]:
    episode_id = episode["episode_id"]
    title = episode["title"]
    expected_characters = set(speaking_characters(episode))
    entries = payload.get("character_arcs")
    if not isinstance(entries, list):
        return []
    docs: list[dict] = []
    for item in entries:
        if not isinstance(item, dict):
            continue
        character = re.sub(r"\s+", " ", str(item.get("character", "") or "")).strip()
        summary = re.sub(r"\s+", " ", str(item.get("summary", "") or "")).strip()
        if not character or not summary:
            continue
        if expected_characters and character not in expected_characters:
            continue
        docs.append(
            {
                "episode_id": episode_id,
                "title": title,
                "character": character,
                "summary": summary,
            }
        )
    return docs


def interaction_docs_from_payload(payload: dict, episode: dict) -> list[dict]:
    episode_id = episode["episode_id"]
    title = episode["title"]
    expected_characters = set(speaking_characters(episode))
    entries = payload.get("interactions")
    if not isinstance(entries, list):
        return []
    docs: list[dict] = []
    for item in entries:
        if not isinstance(item, dict):
            continue
        focal_character = re.sub(r"\s+", " ", str(item.get("character", "") or "")).strip()
        participants = [
            re.sub(r"\s+", " ", str(name or "")).strip()
            for name in item.get("participants", [])
            if re.sub(r"\s+", " ", str(name or "")).strip()
        ]
        participants = sorted(dict.fromkeys(participants))
        summary = re.sub(r"\s+", " ", str(item.get("summary", "") or "")).strip()
        if len(participants) < 2 or not summary:
            continue
        if len(set(participants)) < 2:
            continue
        if focal_character and focal_character not in participants:
            participants = sorted(dict.fromkeys([focal_character, *participants]))
        if expected_characters and any(name not in expected_characters for name in participants):
            continue
        docs.append(
            {
                "episode_id": episode_id,
                "title": title,
                "character": focal_character,
                "participants": participants,
                "summary": summary,
            }
        )
    return docs


def render_progress(current: int, total: int, *, stored: int, skipped: int, failed: int, episode_id: str, phase: str, started_at: float) -> None:
    width = 28
    filled = int(width * current / max(total, 1))
    bar = "#" * filled + "-" * (width - filled)
    elapsed = max(0.0, time.time() - started_at)
    rate = current / elapsed if elapsed > 0 and current > 0 else 0.0
    remaining = max(total - current, 0)
    eta = int(remaining / rate) if rate > 0 else 0
    line = (
        f"\r[{bar}] {current}/{total} episodes"
        f" | stored {stored}"
        f" | skipped {skipped}"
        f" | failed {failed}"
        f" | {episode_id:<8}"
        f" | {phase:<18}"
        f" | eta {eta:>4}s"
    )
    print(line, end="", flush=True)


def main() -> int:
    args = parse_args()
    raw_dir = ROOT / ".run" / "arc_summary_raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    episodes = list_all_episodes()
    if args.season:
        allowed = set(args.season)
        episodes = [episode for episode in episodes if int(str(episode["episode_id"])[1:3]) in allowed]
    if not episodes:
        print("No episodes matched the requested selection.")
        return 1

    total = len(episodes)
    stored_total = 0
    skipped_total = 0
    failed_total = 0
    started_at = time.time()

    for index, episode in enumerate(episodes, start=1):
        time.sleep(4) #Wait for 4 seconds to avoid overall timeout due to exceeding RPM
        episode_id = episode["episode_id"]
        expected = len(speaking_characters(episode))
        existing = count_arc_summary_documents_for_episode(episode_id)
        interaction_existing = count_interaction_summary_documents_for_episode(episode_id)
        if args.force:
            purge_arc_summary_documents(episode_id=episode_id)
            purge_interaction_summary_documents(episode_id=episode_id)
            existing = 0
            interaction_existing = 0
        elif existing >= expected and expected > 0 and interaction_existing > 0:
            skipped_total += 1
            render_progress(index, total, stored=stored_total, skipped=skipped_total, failed=failed_total, episode_id=episode_id, phase="already present", started_at=started_at)
            continue

        render_progress(index, total, stored=stored_total, skipped=skipped_total, failed=failed_total, episode_id=episode_id, phase="calling llm", started_at=started_at)
        transcript = transcript_for_episode(episode)
        system_prompt = (
            "You are generating prior character arc summaries for one Friends episode.\n"
            "Return one valid JSON object only. No markdown. No prose outside JSON.\n"
            'Format exactly as {"episode_id":"sXXeYY","character_arcs":[{"character":"Name","summary":"..."}],"interactions":[{"character":"Name","participants":["Name A","Name B"],"summary":"..."}]}.\n'
            "Each summary must be 1-2 sentences, human-readable, and specific about what that character does, goes through, wants, struggles with, and where they land by the end of the episode.\n"
            "Each interaction summary must describe one character's interaction with everyone present in that scene or beat.\n"
            "For each interaction item, set `character` to the focal character whose experience is being summarized, and set `participants` to that character plus every speaking character present in that scene or exchange.\n"
            "The `participants` array may contain more than two names when the interaction happened in a group scene.\n"
            "Include only characters who actually speak in the transcript. Do not invent characters. Do not use placeholders.\n"
            "Do not include events a character would not personally know or experience. The interaction summaries should only cover things all listed participants were present for."
        )
        user_message = (
            f"EPISODE_ID: {episode_id}\n"
            f"TITLE: {episode['title']}\n"
            f"SPEAKING_CHARACTERS: {', '.join(speaking_characters(episode))}\n"
            "TRANSCRIPT:\n"
            f"{transcript}"
        )
        try:
            raw = call_llm(
                system_prompt,
                user_message,
                role="arc_summary",
                normalize="multiline",
                usage_metadata={"feature": "prior_memory_generation", "characters": speaking_characters(episode)},
                model_override=args.model,
            )
            (raw_dir / f"{episode_id}.prior_arcs.json").write_text(raw, encoding="utf-8")
            render_progress(index, total, stored=stored_total, skipped=skipped_total, failed=failed_total, episode_id=episode_id, phase="parsing", started_at=started_at)
            payload = extract_json(raw)
            docs = docs_from_payload(payload or {}, episode)
            interaction_docs = interaction_docs_from_payload(payload or {}, episode)
            if not docs:
                failed_total += 1
                render_progress(index, total, stored=stored_total, skipped=skipped_total, failed=failed_total, episode_id=episode_id, phase="parse failed", started_at=started_at)
                continue
            render_progress(index, total, stored=stored_total, skipped=skipped_total, failed=failed_total, episode_id=episode_id, phase="writing chroma", started_at=started_at)
            stored_now = upsert_arc_summary_documents(docs)
            stored_now += upsert_interaction_summary_documents(interaction_docs)
            if stored_now <= 0:
                failed_total += 1
                render_progress(index, total, stored=stored_total, skipped=skipped_total, failed=failed_total, episode_id=episode_id, phase="write failed", started_at=started_at)
                continue
            stored_total += stored_now
            render_progress(index, total, stored=stored_total, skipped=skipped_total, failed=failed_total, episode_id=episode_id, phase="done", started_at=started_at)
        except Exception as exc:
            failed_total += 1
            (raw_dir / f"{episode_id}.prior_arcs.error.txt").write_text(str(exc), encoding="utf-8")
            render_progress(index, total, stored=stored_total, skipped=skipped_total, failed=failed_total, episode_id=episode_id, phase="error", started_at=started_at)

    print()
    print(
        json.dumps(
            {
                "episodes_total": total,
                "stored_docs": stored_total,
                "skipped_episodes": skipped_total,
                "failed_episodes": failed_total,
                "elapsed_seconds": int(time.time() - started_at),
                "model_override": args.model,
            },
            indent=2,
        )
    )
    return 0 if failed_total == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
