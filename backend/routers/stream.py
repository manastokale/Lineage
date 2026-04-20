"""
SSE streaming endpoint — pushes generated dialogue lines to the frontend in real time.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import json, asyncio, os

router = APIRouter()

@router.get("/episode/{episode_id}/scene/{scene_id}")
async def stream_scene(episode_id: str, scene_id: str, what_if: str = "", converge_target: str = ""):
    if os.getenv("USE_DUMMY_DATA", "true").lower() == "true":
        from dummy.data import DUMMY_STREAM_LINES

        async def dummy_generator():
            for line in DUMMY_STREAM_LINES:
                yield f"data: {json.dumps(line)}\n\n"
                await asyncio.sleep(0.8)
            yield "data: [DONE]\n\n"

        return StreamingResponse(dummy_generator(), media_type="text/event-stream")

    from orchestrator.graph import run_scene
    from memory.chroma_client import get_collection

    collection = get_collection()
    results = collection.get(ids=[f"{scene_id}_full"], include=["documents", "metadatas"])
    if not results["documents"]:
        return {"error": "Scene not found"}

    scene = {
        "scene_id": scene_id,
        "location": results["metadatas"][0].get("location", "Unknown"),
        "lines": []
    }

    async def event_generator():
        what_if_payload = {"scenario": what_if} if what_if else None
        converge_payload = {"target": converge_target} if converge_target else None
        lines = run_scene(scene, episode_id, what_if_payload, converge_payload)
        for line in lines:
            yield f"data: {json.dumps(line)}\n\n"
            await asyncio.sleep(0.8)  # pacing for dramatic effect
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
