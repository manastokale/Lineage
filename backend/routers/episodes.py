"""
Episodes router — list, get details, manage episode metadata.
In dummy mode, returns pre-written episode data.
"""

from fastapi import APIRouter
import os

router = APIRouter()

@router.get("/")
def list_episodes():
    if os.getenv("USE_DUMMY_DATA", "true").lower() == "true":
        from dummy.data import DUMMY_EPISODES
        return DUMMY_EPISODES
    # TODO: load from ChromaDB / database
    return []

@router.get("/{episode_id}")
def get_episode(episode_id: str):
    if os.getenv("USE_DUMMY_DATA", "true").lower() == "true":
        from dummy.data import DUMMY_EPISODES
        for ep in DUMMY_EPISODES:
            if ep["episode_id"] == episode_id:
                return ep
        return {"error": "Episode not found"}
    return {"error": "Not implemented without dummy data"}
