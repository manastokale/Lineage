"""
Pivot router — What-If and Converge mode triggers.
"""

from fastapi import APIRouter
from pydantic import BaseModel
import os

router = APIRouter()

class WhatIfRequest(BaseModel):
    episode_id: str = "s01e01"
    scene_id: str = "s01e01_sc01"
    scenario: str = ""
    chaos_level: int = 50
    monica_cleanliness: int = 100
    sarcasm_meter: int = 45

class ConvergeRequest(BaseModel):
    episode_id: str = "s01e01"
    scene_id: str = "s01e01_sc01"
    target_ending: str = ""

@router.post("/what-if")
def trigger_what_if(req: WhatIfRequest):
    if os.getenv("USE_DUMMY_DATA", "true").lower() == "true":
        from dummy.data import DUMMY_WHAT_IF_DIFF
        return DUMMY_WHAT_IF_DIFF

    from orchestrator.what_if import run_what_if
    scene = {"scene_id": req.scene_id, "location": "Central Perk", "lines": []}
    config = {
        "scenario": req.scenario,
        "chaos_level": req.chaos_level,
        "monica_cleanliness": req.monica_cleanliness,
        "sarcasm_meter": req.sarcasm_meter,
    }
    return run_what_if(scene, req.episode_id, config)

@router.post("/converge")
def trigger_converge(req: ConvergeRequest):
    return {"status": "converge mode triggered", "target": req.target_ending}
