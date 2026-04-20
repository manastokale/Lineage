"""
LangGraph scene execution graph.
State flows: scene_start → [character nodes] → scene_end → memory_update
"""

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator
import os
from agents.base_agent import AGENTS
from memory.redis_client import EpisodeMemory
from memory.chroma_client import query_character_memories
from llm.providers import call_llm

USE_DUMMY = os.getenv("USE_DUMMY_DATA", "true").lower() == "true"

# ── State definition ──────────────────────────────────────────────────────────

class SceneState(TypedDict):
    episode_id: str
    scene_id: str
    location: str
    script_lines: list[dict]          # original lines from parsed script
    generated_lines: Annotated[list, operator.add]  # LLM output accumulates here
    current_speaker_index: int
    what_if_active: bool
    what_if_scenario: str
    converge_active: bool
    target_ending: str
    mode: str                          # "what_if" | "converge" | "standard"

# ── Character node factory ─────────────────────────────────────────────────────

def make_character_node(character_name: str):
    def node(state: SceneState) -> dict:
        agent = AGENTS[character_name]
        episode_memory = EpisodeMemory(state["episode_id"])
        recent_context = episode_memory.format_for_prompt()

        memories = query_character_memories(
            character=character_name,
            query_text=recent_context or state["location"],
            n_results=4
        )

        system_prompt = agent.get_system_prompt({
            "memories": memories,
            "scene_context": recent_context,
            "what_if_active": state["what_if_active"],
            "what_if_scenario": state["what_if_scenario"],
        })

        user_message = f"[The scene is: {state['location']}. Recent dialogue:\n{recent_context}\n\nNow respond as {character_name}.]"
        dialogue = call_llm(system_prompt, user_message, role="dialogue")

        episode_memory.add_line(character_name, dialogue, state["scene_id"])

        new_line = {
            "speaker": character_name,
            "text": dialogue,
            "scene_id": state["scene_id"],
            "generated": True
        }
        return {"generated_lines": [new_line]}

    return node

# ── Router: which character speaks next ───────────────────────────────────────

def route_next_speaker(state: SceneState) -> str:
    idx = state["current_speaker_index"]
    lines = state["script_lines"]
    if idx >= len(lines):
        return "scene_end"
    next_speaker = lines[idx]["speaker"]
    if next_speaker not in AGENTS:
        return "scene_end"
    return next_speaker

def advance_speaker(state: SceneState) -> dict:
    return {"current_speaker_index": state["current_speaker_index"] + 1}

# ── Build graph ────────────────────────────────────────────────────────────────

def build_graph():
    g = StateGraph(SceneState)
    g.add_node("advance", advance_speaker)

    for name in AGENTS:
        g.add_node(name, make_character_node(name))
        g.add_edge(name, "advance")

    g.add_conditional_edges("advance", route_next_speaker,
        {name: name for name in AGENTS} | {"scene_end": END}
    )
    g.set_entry_point("advance")
    return g.compile()

SCENE_GRAPH = build_graph()

def run_scene(scene: dict, episode_id: str, what_if: dict | None = None, converge: dict | None = None) -> list[dict]:
    initial_state: SceneState = {
        "episode_id": episode_id,
        "scene_id": scene["scene_id"],
        "location": scene["location"],
        "script_lines": scene["lines"],
        "generated_lines": [],
        "current_speaker_index": 0,
        "what_if_active": bool(what_if),
        "what_if_scenario": what_if.get("scenario", "") if what_if else "",
        "converge_active": bool(converge),
        "target_ending": converge.get("target", "") if converge else "",
        "mode": "what_if" if what_if else ("converge" if converge else "standard")
    }
    result = SCENE_GRAPH.invoke(initial_state)
    return result["generated_lines"]
