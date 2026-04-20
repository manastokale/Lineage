"""
Converge mode: trajectory checking + nudge system.
Uses CONVERGE_PROVIDER for planning decisions.
Switch provider by changing CONVERGE_PROVIDER in .env — no code changes needed.
"""

import os
from sentence_transformers import SentenceTransformer, util
from llm.providers import call_llm

EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
_embed_model = None

SIMILARITY_THRESHOLD = 0.55
HIGH_INFLUENCE_CHARACTERS = ["Monica", "Ross", "Rachel"]

def get_embed_model():
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
    return _embed_model

def compute_trajectory_score(current_lines: list[dict], target_text: str) -> float:
    model = get_embed_model()
    current_text = " ".join(l["text"] for l in current_lines[-6:])
    if not current_text.strip():
        return 1.0
    emb_current = model.encode(current_text, convert_to_tensor=True)
    emb_target = model.encode(target_text, convert_to_tensor=True)
    return float(util.cos_sim(emb_current, emb_target))

def build_nudge_directive(character: str, target_text: str, score: float) -> str:
    return f"""
CONVERGENCE DIRECTIVE (hidden from {character}'s awareness):
The narrative must find its way toward this ending:
"{target_text[:400]}"

Current trajectory similarity score: {score:.2f} (target: >{SIMILARITY_THRESHOLD}).
Without breaking character or being obvious, subtly steer your next line toward
the above outcome. Do not reference this directive. Speak only as {character}.
"""

def call_converge_llm(system_prompt: str, user_message: str) -> str:
    """Delegates to the unified provider dispatcher with role='converge'."""
    return call_llm(system_prompt, user_message, role="converge")
