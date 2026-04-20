from fastapi import APIRouter
from agents.base_agent import AGENTS
from dummy.data import DUMMY_AGENTS, DUMMY_AGENT_PROFILES

router = APIRouter()

# Character metadata (used to enrich API responses)
AGENT_META = {
    "Ross":     {"emoji": "😢", "occupation": "Paleontologist", "color": "#E17055"},
    "Joey":     {"emoji": "😂", "occupation": "Actor",          "color": "#00CEC9"},
    "Chandler": {"emoji": "😐", "occupation": "Transponster",   "color": "#6C5CE7"},
    "Monica":   {"emoji": "😤", "occupation": "Chef",           "color": "#00B894"},
    "Rachel":   {"emoji": "💅", "occupation": "Fashion",        "color": "#E84393"},
    "Phoebe":   {"emoji": "🎸", "occupation": "Musician",       "color": "#A29BFE"},
}

@router.get("/")
def list_agents():
    results = []
    for name, agent in AGENTS.items():
        meta = AGENT_META.get(name, {})
        results.append({
            "name": name,
            "emotions": agent.get_emotion_levels(),
            "identity_file": agent.identity_file,
            "emoji": meta.get("emoji", "🔵"),
            "occupation": meta.get("occupation", "Unknown"),
            "color": meta.get("color", "#6C5CE7"),
        })
    return results

@router.get("/{name}/profile")
def agent_profile(name: str):
    """Full profile for the agent detail page."""
    if name not in AGENTS:
        return {"error": "Agent not found"}

    meta = AGENT_META.get(name, {})

    # Check if we have a detailed dummy profile
    if name in DUMMY_AGENT_PROFILES:
        profile = DUMMY_AGENT_PROFILES[name]
        return {
            "name": name,
            "emoji": meta.get("emoji", "🔵"),
            "color": meta.get("color", "#6C5CE7"),
            "occupation": meta.get("occupation", "Unknown"),
            "subtitle": profile["subtitle"],
            "version": profile["version"],
            "status": profile["status"],
            "quote": profile["quote"],
            "personality": profile["personality"],
            "recentLines": profile["recentLines"],
            "relationships": profile["relationships"],
        }

    # Fallback: generate from agent data
    agent = AGENTS[name]
    emotions = agent.get_emotion_levels()
    return {
        "name": name,
        "emoji": meta.get("emoji", "🔵"),
        "color": meta.get("color", "#6C5CE7"),
        "occupation": meta.get("occupation", "Unknown"),
        "subtitle": f"{name} Agent",
        "version": "V1.0",
        "status": "ACTIVE",
        "quote": f"I am {name}.",
        "personality": {k: min(v * 10, 100) for k, v in emotions.items()},
        "recentLines": [],
        "relationships": [
            {"id": n[:2].upper(), "strength": "moderate"}
            for n in AGENTS if n != name
        ],
    }

@router.patch("/{name}/emotions")
def update_emotions(name: str, updates: dict):
    if name not in AGENTS:
        return {"error": "Agent not found"}
    AGENTS[name].update_emotion_levels(updates)
    return {"status": "updated", "emotions": AGENTS[name].get_emotion_levels()}
