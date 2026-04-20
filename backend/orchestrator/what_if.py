"""
What-If mode: modifies agent emotion levels for one run, compares outputs.
Does NOT permanently update identity files — changes are ephemeral.
"""

from agents.base_agent import AGENTS
from orchestrator.graph import run_scene
import copy

def run_what_if(scene: dict, episode_id: str, config: dict) -> dict:
    """
    config = {
      "scenario": "A monkey steals the remote",
      "chaos_level": 80,
      "monica_cleanliness": 100,
      "sarcasm_meter": 45
    }
    Returns: { "original": [...lines], "generated": [...lines] }
    """
    original_lines = [
        {"speaker": l["speaker"], "text": l["text"], "generated": False}
        for l in scene.get("lines", [])
    ]

    chaos = config.get("chaos_level", 50) / 100
    emotion_overrides = {
        "Monica": {"anxiety": min(10, int(8 * config.get("monica_cleanliness", 100) / 100))},
        "Chandler": {"sarcasm": min(10, int(10 * config.get("sarcasm_meter", 45) / 100))},
    }
    for char, overrides in emotion_overrides.items():
        if char in AGENTS:
            AGENTS[char].update_emotion_levels(overrides)

    what_if_payload = {"scenario": config.get("scenario", "")}
    generated_lines = run_scene(scene, episode_id, what_if=what_if_payload)

    return {
        "original": original_lines,
        "generated": generated_lines,
    }
