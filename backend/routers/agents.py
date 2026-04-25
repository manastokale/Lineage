import re

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

import config

router = APIRouter()

_DIRECT_RECOLLECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bdo you remember\b",
        r"\bcan you remember\b",
        r"\bdo you recall\b",
        r"\bcan you recall\b",
        r"\brecollect\b",
        r"\bremind me\b",
        r"\bwhat happened (?:when|with|between|after|before)\b",
        r"\bwhen did you first\b",
        r"\bwhen was the last time\b",
        r"\bhave you ever\b",
        r"\bdid you ever\b",
        r"\bbefore this\b",
        r"\bpreviously\b",
        r"\bback when\b",
        r"\blast time\b",
        r"\bfirst time\b",
    )
]

_MEMORY_VERB_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bremember\b",
        r"\brecall\b",
        r"\brecollect\b",
        r"\bremind\b",
        r"\breference\b",
        r"\bthink back\b",
    )
]

_PAST_CONTEXT_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bearlier\b",
        r"\bbefore\b",
        r"\bprevious\b",
        r"\bpreviously\b",
        r"\blast time\b",
        r"\bfirst time\b",
        r"\bback then\b",
        r"\bused to\b",
        r"\bonce\b",
        r"\bever\b",
        r"\bwhen you and\b",
        r"\bbetween you and\b",
    )
]


class AgentAskRequest(BaseModel):
    episode_id: str
    scene_id: str
    anchor_line_index: int = Field(ge=0)
    question: str = Field(min_length=1, max_length=700)
    thread_messages: list[dict] = Field(default_factory=list)


AGENT_META = {
    "Ross": {"emoji": "😢", "occupation": "Paleontologist", "color": "#E17055"},
    "Joey": {"emoji": "😂", "occupation": "Actor", "color": "#00CEC9"},
    "Chandler": {"emoji": "😐", "occupation": "Office Worker", "color": "#6C5CE7"},
    "Monica": {"emoji": "😤", "occupation": "Chef", "color": "#00B894"},
    "Rachel": {"emoji": "💅", "occupation": "Fashion", "color": "#E84393"},
    "Phoebe": {"emoji": "🎸", "occupation": "Musician", "color": "#A29BFE"},
}


def _agents():
    from agents.base_agent import AGENTS

    return AGENTS


def _question_requests_memory_references(question: str) -> bool:
    text = (question or "").strip()
    if not text:
        return False
    if any(pattern.search(text) for pattern in _DIRECT_RECOLLECTION_PATTERNS):
        return True
    has_memory_verb = any(pattern.search(text) for pattern in _MEMORY_VERB_PATTERNS)
    has_past_context = any(pattern.search(text) for pattern in _PAST_CONTEXT_PATTERNS)
    return has_memory_verb and has_past_context


def _build_reference_metadata(history: list[dict], interactions: list[dict], *, limit: int = 6) -> list[dict]:
    references: list[dict] = []
    seen: set[tuple] = set()

    for item in history:
        key = ("character_arc", item.get("episode_id", ""), item.get("title", ""), item.get("summary", ""))
        if key in seen:
            continue
        seen.add(key)
        references.append(
            {
                "kind": "character_arc",
                "episode_id": item.get("episode_id", ""),
                "title": item.get("title", item.get("episode_id", "")),
            }
        )
        if len(references) >= limit:
            return references

    for item in interactions:
        participants = [str(name).strip() for name in item.get("participants", []) if str(name).strip()]
        key = ("interaction_arc", item.get("episode_id", ""), tuple(participants), item.get("summary", ""))
        if key in seen:
            continue
        seen.add(key)
        references.append(
            {
                "kind": "interaction_arc",
                "episode_id": item.get("episode_id", ""),
                "title": item.get("title", item.get("episode_id", "")),
                "participants": participants,
            }
        )
        if len(references) >= limit:
            break

    return references


@router.get("/")
def list_agents():
    agents = _agents()
    results = []
    for name, agent in agents.items():
        meta = AGENT_META.get(name, {})
        results.append(
            {
                "name": name,
                "emotions": agent.get_emotion_levels(),
                "emoji": meta.get("emoji", "🔵"),
                "occupation": meta.get("occupation", "Unknown"),
                "color": meta.get("color", "#6C5CE7"),
            }
        )
    return results


@router.post("/{name}/ask")
def ask_agent(name: str, req: AgentAskRequest, x_lineage_device: str | None = Header(default=None)):
    agents = _agents()
    if config.USE_DUMMY_DATA:
        return {"name": name, "reply": f"{name} says: {req.question}"}

    from data.character_focus import get_character_focus
    from data.episode_repository import flatten_episode_lines
    from data.episode_repository import (
        get_relevant_character_arc_summaries_with_debug,
        get_relevant_character_interactions_with_debug,
    )
    from debug_state import record_rerank_trace
    from llm.providers import call_llm
    from session_state import append_thread_messages, get_thread_messages, normalize_device_id

    device_id = normalize_device_id(x_lineage_device)
    if not device_id:
        raise HTTPException(status_code=400, detail="Missing or invalid device session id.")

    profile = get_character_focus(name, req.episode_id)
    if name not in agents and not profile:
        raise HTTPException(status_code=404, detail="Agent not found")

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    timeline = flatten_episode_lines(req.episode_id)
    dialogue_context = [line for line in timeline if line.get("type") == "dialogue"]
    anchor_line = next(
        (
            line
            for line in dialogue_context
            if int(line.get("line_index", -1)) == req.anchor_line_index and str(line.get("scene_id", "")) == req.scene_id
        ),
        None,
    )
    if not anchor_line:
        raise HTTPException(status_code=400, detail="Selected script anchor is invalid.")

    live_context_lines = []
    for line in [line for line in dialogue_context if int(line.get("line_index", -1)) <= req.anchor_line_index][-8:]:
        speaker = str(line.get("speaker", "")).strip()
        text = str(line.get("text", "")).strip()
        if speaker and text:
            live_context_lines.append(f"{speaker}: {text}")
    live_context = "\n".join(live_context_lines)

    if req.thread_messages:
        thread_messages = []
        for item in req.thread_messages[-10:]:
            kind = str(item.get("type", "")).strip()
            speaker = str(item.get("speaker", "")).strip()
            text = str(item.get("text", "")).strip()
            if kind not in {"user_question", "agent_reply"} or not text:
                continue
            thread_messages.append({"type": kind, "speaker": speaker, "text": text[:700]})
    else:
        thread_messages = get_thread_messages(device_id, req.episode_id, req.anchor_line_index)
    thread_history_lines = []
    for line in thread_messages[-10:]:
        speaker = str(line.get("speaker", "")).strip() or ("You" if line.get("type") == "user_question" else name)
        text = str(line.get("text", "")).strip()
        if speaker and text:
            thread_history_lines.append(f"{speaker}: {text}")
    thread_history = "\n".join(thread_history_lines)

    retrieval_query = f"{question}\n{live_context}"
    history, arc_debug = get_relevant_character_arc_summaries_with_debug(
        name,
        req.episode_id,
        retrieval_query,
        limit=5,
    )
    interactions, interaction_debug = get_relevant_character_interactions_with_debug(
        name,
        req.episode_id,
        retrieval_query,
        limit=6,
    )
    include_references = _question_requests_memory_references(question)
    history_text = "\n".join(f"[{item['episode_id']}] {item['summary']}" for item in history)
    interaction_text = "\n".join(
        f"[{item['episode_id']}] {' / '.join(item.get('participants', []))}: {item['summary']}"
        for item in interactions
    )
    if name in agents:
        system_prompt = (
            agents[name].get_system_prompt(
                {
                    "memories": [
                        *[{"episode_id": item["episode_id"], "text": item["summary"]} for item in history[:5]],
                        *[
                            {
                                "episode_id": item["episode_id"],
                                "text": f"{' / '.join(item.get('participants', []))}: {item['summary']}",
                            }
                            for item in interactions[:5]
                        ],
                    ],
                    "scene_context": live_context,
                }
            )
            + "\nThe user is not a character inside the episode. They are an external viewer/writer crossing the fourth wall and asking about this moment from outside the scene. "
            "Do not treat the user as physically present in the room or as someone the characters already know in-universe unless the question explicitly frames that as a hypothetical. "
            "Answer the user's question in character using only the provided recent scene context, prior-episode history, and prior conversation turns from this same selected moment. "
            "If the question asks about events that have not happened yet for you, say so naturally and stay in character."
        )
    else:
        occupation = profile.get("occupation", "Recurring character") if profile else "Recurring character"
        system_prompt = (
            f"You are {name} from Friends. "
            f"Stay in character, sound natural, and answer briefly and conversationally. "
            f"Known role or occupation: {occupation}. "
            "The user is an external viewer/writer crossing the fourth wall, not someone physically present in the scene. "
            "Do not assume the user exists inside the episode world unless they explicitly ask a hypothetical. "
            "Use only the provided prior-episode history, the very recent scene context right before the question, and the prior conversation turns from this same selected moment. "
            "Do not invent spoilers or facts that are not supported by the provided material. "
            "If asked about something that has not happened yet, answer naturally that you would not know that yet."
        )

    user_message = (
        "Question source: an external viewer/writer asking from outside the scene.\n\n"
        f"Past context:\n{history_text or '(none)'}\n\n"
        f"Shared interactions you were part of:\n{interaction_text or '(none)'}\n\n"
        f"Current scene context:\n{live_context or '(none)'}\n\n"
        f"Previous conversation in this thread:\n{thread_history or '(none)'}\n\n"
        f"Question for {name}: {question}"
    )
    reply = call_llm(system_prompt, user_message, role="ask", usage_metadata={"characters": [name]})
    append_thread_messages(
        device_id,
        req.episode_id,
        req.anchor_line_index,
        [
            {"type": "user_question", "speaker": "You", "text": question},
            {"type": "agent_reply", "speaker": name, "text": reply},
        ],
    )
    payload = {"name": name, "reply": reply}
    if include_references:
        references = _build_reference_metadata(history, interactions)
        if references:
            payload["references"] = references
    if config.LINEAGE_DEBUG_RERANK:
        record_rerank_trace(
            {
                "kind": "ask",
                "character": name,
                "episode_id": req.episode_id,
                "scene_id": req.scene_id,
                "anchor_line_index": req.anchor_line_index,
                "question": question,
                "retrieval_query": retrieval_query,
                "arc_candidates": arc_debug,
                "interaction_candidates": interaction_debug,
            }
        )
    return payload
