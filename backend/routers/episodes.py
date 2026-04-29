"""Episode and line-analysis API routes."""

from fastapi import APIRouter, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

import config
from security import client_rate_key, require_episode_id, require_rate_limit, require_safe_name

router = APIRouter()


class LineImpactRequest(BaseModel):
    edited_text: str = Field(min_length=1, max_length=1200)


@router.get("/")
def list_episodes():
    if config.USE_DUMMY_DATA:
        from dummy.data import DUMMY_EPISODES

        return DUMMY_EPISODES
    from data.episode_repository import list_episode_summaries

    return list_episode_summaries()


@router.get("/{episode_id}")
def get_episode(episode_id: str):
    episode_id = require_episode_id(episode_id)
    if config.USE_DUMMY_DATA:
        from dummy.data import DUMMY_EPISODES

        for episode in DUMMY_EPISODES:
            if episode["episode_id"] == episode_id:
                return episode
        raise HTTPException(status_code=404, detail="Episode not found")

    from data.episode_repository import get_episode as get_real_episode

    episode = get_real_episode(episode_id)
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode


@router.get("/{episode_id}/timeline")
def get_episode_timeline(episode_id: str):
    episode_id = require_episode_id(episode_id)
    from data.episode_repository import flatten_episode_lines

    return flatten_episode_lines(episode_id)


@router.get("/{episode_id}/graph")
def get_episode_graph(episode_id: str):
    episode_id = require_episode_id(episode_id)
    from data.episode_repository import relationship_graph

    return relationship_graph(episode_id)


@router.get("/{episode_id}/continuity")
def get_episode_continuity(
    episode_id: str,
    request: Request,
    refresh: bool = Query(default=False),
    x_lineage_device: str | None = Header(default=None),
):
    episode_id = require_episode_id(episode_id)
    require_rate_limit(
        client_rate_key(request, x_lineage_device),
        "continuity",
        max_requests=18,
        window_seconds=60,
    )
    if config.USE_DUMMY_DATA:
        return {
            "episode_id": episode_id,
            "status": "dummy_mode",
            "flags": [],
            "candidate_count": 0,
            "cached": False,
        }

    from data.continuity import analyze_episode_continuity

    result = analyze_episode_continuity(episode_id, refresh=refresh)
    if result.get("status") == "missing_episode":
        raise HTTPException(status_code=404, detail="Episode not found")
    return result


@router.post("/{episode_id}/lines/{line_index}/impact")
def analyze_episode_line_impact(
    episode_id: str,
    line_index: int,
    req: LineImpactRequest,
    request: Request,
    x_lineage_device: str | None = Header(default=None),
):
    episode_id = require_episode_id(episode_id)
    if line_index < 0:
        raise HTTPException(status_code=400, detail="Line index must be non-negative.")
    require_rate_limit(
        client_rate_key(request, x_lineage_device),
        "edit_impact",
        max_requests=24,
        window_seconds=60,
    )
    if config.USE_DUMMY_DATA:
        return {
            "status": "ok",
            "variant_id": f"{episode_id}-{line_index}-dummy",
            "episode_id": episode_id,
            "line_index": line_index,
            "speaker": "Character",
            "original_text": "",
            "edited_text": req.edited_text,
            "drift_score": 0,
            "drift_level": "low",
            "summary": "Dummy mode cannot analyze downstream impact.",
            "introduced_plot_holes": [],
            "repair_suggestions": [],
            "downstream_window": {"line_count": 0, "mode": "dummy"},
            "token_estimate": {"estimated_input_tokens": 1, "estimated_output_tokens": 1, "mode": "dummy"},
        }

    from data.script_variants import analyze_edit_impact

    result = analyze_edit_impact(episode_id, line_index, req.edited_text)
    if result.get("status") == "missing_line":
        raise HTTPException(status_code=404, detail="Line not found")
    if result.get("status") == "unchanged_line":
        raise HTTPException(status_code=400, detail="Change the dialogue before analyzing impact.")
    return result


@router.get("/{episode_id}/characters/{name}")
def get_character_focus(episode_id: str, name: str):
    episode_id = require_episode_id(episode_id)
    name = require_safe_name(name, label="character name")
    if config.USE_DUMMY_DATA:
        raise HTTPException(status_code=404, detail="Character history doesn't exist in dummy mode.")

    from data.character_focus import get_character_focus

    profile = get_character_focus(name, episode_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Character history doesn't exist yet.")
    return profile


@router.get("/{episode_id}/interactions")
def get_interactions(episode_id: str, characters: str = Query(max_length=500)):
    episode_id = require_episode_id(episode_id)
    names = [require_safe_name(item, label="character name") for item in characters.split(",") if item.strip()]
    names = list(dict.fromkeys(names))[:8]
    if not names:
        raise HTTPException(status_code=400, detail="At least one character is required.")

    from data.episode_repository import get_interaction_summaries_for_selection

    return get_interaction_summaries_for_selection(names, episode_id)
