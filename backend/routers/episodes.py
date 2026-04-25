"""Minimal episodes router for the transcript player."""

from fastapi import APIRouter, HTTPException

import config

router = APIRouter()


@router.get("/")
def list_episodes():
    if config.USE_DUMMY_DATA:
      from dummy.data import DUMMY_EPISODES
      return DUMMY_EPISODES
    from data.episode_repository import list_episode_summaries

    return list_episode_summaries()


@router.get("/{episode_id}")
def get_episode(episode_id: str):
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
    from data.episode_repository import flatten_episode_lines

    return flatten_episode_lines(episode_id)


@router.get("/{episode_id}/graph")
def get_episode_graph(episode_id: str):
    from data.episode_repository import relationship_graph

    return relationship_graph(episode_id)


@router.get("/{episode_id}/characters/{name}")
def get_character_focus(episode_id: str, name: str):
    if config.USE_DUMMY_DATA:
        raise HTTPException(status_code=404, detail="Character history doesn't exist in dummy mode.")

    from data.character_focus import get_character_focus

    profile = get_character_focus(name, episode_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Character history doesn't exist yet.")
    return profile


@router.get("/{episode_id}/interactions")
def get_interactions(episode_id: str, characters: str):
    names = [item.strip() for item in characters.split(",") if item.strip()]
    if not names:
        raise HTTPException(status_code=400, detail="At least one character is required.")

    from data.episode_repository import get_interaction_summaries_for_selection

    return get_interaction_summaries_for_selection(names, episode_id)
