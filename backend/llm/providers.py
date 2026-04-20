"""
Unified multi-provider LLM dispatcher.
Reads DIALOGUE_PROVIDER and CONVERGE_PROVIDER from env to route calls.

Supported providers:  ollama | anthropic | openai | groq
All providers share the same call signature:
    call_llm(system_prompt, user_message, role="dialogue") -> str

role="dialogue"  → uses DIALOGUE_PROVIDER + its model env var
role="converge"  → uses CONVERGE_PROVIDER + its model env var
"""

import os

# ── Provider resolution ────────────────────────────────────────────────────────

def _provider(role: str) -> str:
    if role == "converge":
        return os.getenv("CONVERGE_PROVIDER", "ollama").lower()
    return os.getenv("DIALOGUE_PROVIDER", "ollama").lower()

def _model(provider: str, role: str) -> str:
    key_map = {
        ("ollama",    "dialogue"): ("OLLAMA_DIALOGUE_MODEL",    "llama3.1:8b"),
        ("ollama",    "converge"): ("OLLAMA_CONVERGE_MODEL",    "llama3.1:8b"),
        ("anthropic", "dialogue"): ("ANTHROPIC_DIALOGUE_MODEL", "claude-haiku-4-5-20251001"),
        ("anthropic", "converge"): ("ANTHROPIC_CONVERGE_MODEL", "claude-sonnet-4-6"),
        ("openai",    "dialogue"): ("OPENAI_DIALOGUE_MODEL",    "gpt-4o-mini"),
        ("openai",    "converge"): ("OPENAI_CONVERGE_MODEL",    "gpt-4o"),
        ("groq",      "dialogue"): ("GROQ_DIALOGUE_MODEL",      "llama-3.3-70b-versatile"),
        ("groq",      "converge"): ("GROQ_CONVERGE_MODEL",      "qwen2.5-72b-instruct"),
    }
    env_key, default = key_map.get((provider, role), ("", ""))
    return os.getenv(env_key, default) if env_key else default

# ── Provider implementations ───────────────────────────────────────────────────

def _call_ollama(system_prompt: str, user_message: str, model: str) -> str:
    import requests
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    response = requests.post(
        f"{base_url}/api/chat",
        json={
            "model": model,
            "stream": False,
            "options": {"temperature": 0.85, "num_predict": 300},
            "messages": [
                {"role": "system",  "content": system_prompt},
                {"role": "user",    "content": user_message}
            ]
        },
        timeout=90
    )
    response.raise_for_status()
    return response.json()["message"]["content"].strip()

def _call_anthropic(system_prompt: str, user_message: str, model: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model=model,
        max_tokens=300,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}]
    )
    return message.content[0].text.strip()

def _call_openai(system_prompt: str, user_message: str, model: str) -> str:
    import openai
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message}
        ],
        max_tokens=300,
        temperature=0.85
    )
    return response.choices[0].message.content.strip()

def _call_groq(system_prompt: str, user_message: str, model: str) -> str:
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message}
        ],
        max_tokens=300,
        temperature=0.85
    )
    return response.choices[0].message.content.strip()

# ── Public interface ───────────────────────────────────────────────────────────

_DISPATCH = {
    "ollama":    _call_ollama,
    "anthropic": _call_anthropic,
    "openai":    _call_openai,
    "groq":      _call_groq,
}

def call_llm(system_prompt: str, user_message: str, role: str = "dialogue") -> str:
    """
    Main entry point. Called by graph.py and converge.py.
    """
    if os.getenv("USE_DUMMY_DATA", "true").lower() == "true":
        from dummy.data import get_dummy_dialogue
        return get_dummy_dialogue(user_message)

    provider = _provider(role)
    model    = _model(provider, role)
    fn       = _DISPATCH.get(provider)

    if fn is None:
        raise ValueError(
            f"Unknown provider '{provider}'. "
            f"Set {'CONVERGE_PROVIDER' if role == 'converge' else 'DIALOGUE_PROVIDER'} "
            f"to one of: ollama | anthropic | openai | groq"
        )

    return fn(system_prompt, user_message, model)

def active_providers() -> dict:
    """Returns the currently configured providers — used by /api/health."""
    return {
        "dialogue_provider": _provider("dialogue"),
        "dialogue_model":    _model(_provider("dialogue"), "dialogue"),
        "converge_provider": _provider("converge"),
        "converge_model":    _model(_provider("converge"), "converge"),
        "dummy_mode":        os.getenv("USE_DUMMY_DATA", "true").lower() == "true",
    }
