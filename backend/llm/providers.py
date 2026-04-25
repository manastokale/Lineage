from __future__ import annotations

import json
import time
from collections import Counter, defaultdict
from typing import Any

import config

_ROLE_PROVIDER = {
    "dialogue": config.DIALOGUE_PROVIDER,
    "summary": config.SUMMARY_PROVIDER,
    "arc_summary": config.ARC_SUMMARY_PROVIDER,
    "ask": config.ASK_PROVIDER,
}

_ROLE_MODEL = {
    ("gemini", "dialogue"): config.GEMINI_DIALOGUE_MODEL,
    ("gemini", "summary"): config.GEMINI_SUMMARY_MODEL,
    ("gemini", "arc_summary"): config.GEMINI_ARC_SUMMARY_MODEL,
    ("gemini", "ask"): config.GEMINI_ASK_MODEL,
    ("groq", "dialogue"): config.GROQ_DIALOGUE_MODEL,
    ("groq", "summary"): config.GROQ_SUMMARY_MODEL,
    ("groq", "arc_summary"): config.GROQ_ARC_SUMMARY_MODEL,
    ("groq", "ask"): config.GROQ_ASK_MODEL,
}

_usage_totals: dict[str, Counter[str]] = defaultdict(Counter)
_role_usage: dict[str, dict[str, Counter[str]]] = defaultdict(lambda: defaultdict(Counter))
_character_usage: dict[str, Counter[str]] = defaultdict(Counter)
_usage_events: dict[str, list[dict[str, Any]]] = defaultdict(list)
_MODEL_LIMITS: dict[str, dict[str, int]] = {
    "gemini-2.5-flash": {"rpm": 5, "tpm": 250000},
    "gemini-2.5-flash-lite": {"rpm": 10, "tpm": 250000},
    "gemini-3-flash": {"rpm": 5, "tpm": 250000},
    "gemini-3-flash-preview": {"rpm": 5, "tpm": 250000},
    "gemini-3.1-flash-lite": {"rpm": 15, "tpm": 250000},
    "gemini-3.1-flash-lite-preview": {"rpm": 15, "tpm": 250000},
}

_GEMINI_MODEL_ALIASES = {
    "gemini-3.1-flash-lite": "gemini-3.1-flash-lite-preview",
    "gemini-3-flash": "gemini-3-flash-preview",
}


def _provider_for_role(role: str) -> str:
    return _ROLE_PROVIDER.get(role, _ROLE_PROVIDER["dialogue"])


def _model_for_role(provider: str, role: str) -> str:
    return _ROLE_MODEL.get((provider, role), _ROLE_MODEL[(provider, "dialogue")])


def _estimate_tokens(*texts: str) -> int:
    return max(1, sum(len(text or "") for text in texts) // 4)


def _normalize_gemini_model_name(model: str) -> str:
    normalized = (model or "").strip()
    return _GEMINI_MODEL_ALIASES.get(normalized, normalized)


def _max_output_tokens_for_role(role: str) -> int:
    if role == "arc_summary":
        return 32768
    if role == "summary":
        return 1400
    return 900


def _normalize_text(text: str, normalize: str) -> str:
    value = (text or "").strip()
    if normalize == "multiline":
        return value
    if normalize == "text":
        return " ".join(value.split())
    return value


def _record_usage(model: str, role: str, estimated_tokens: int, usage_metadata: dict[str, Any] | None) -> None:
    timestamp = time.time()
    _usage_totals[model]["requests"] += 1
    _usage_totals[model]["tokens"] += estimated_tokens
    _role_usage[model][role]["requests"] += 1
    _role_usage[model][role]["tokens"] += estimated_tokens
    _usage_events[model].append({"ts": timestamp, "role": role, "tokens": estimated_tokens})
    metadata = usage_metadata or {}
    character_weights = metadata.get("character_weights")
    if isinstance(character_weights, dict) and character_weights:
        total_weight = sum(max(float(weight), 0.0) for weight in character_weights.values()) or 1.0
        for character, weight in character_weights.items():
            _character_usage[model][character] += int(round(estimated_tokens * (max(float(weight), 0.0) / total_weight)))
        return
    characters = [character for character in metadata.get("characters", []) if character]
    if characters:
        per_character = max(1, int(round(estimated_tokens / len(characters))))
        for character in characters:
            _character_usage[model][character] += per_character


def _window_totals(model: str) -> dict[str, int]:
    now = time.time()
    minute_ago = now - 60
    day_ago = now - 86400
    events = _usage_events[model]
    recent_requests = 0
    recent_tokens = 0
    daily_requests = 0
    pruned = []
    for event in events:
        ts = event["ts"]
        if ts >= day_ago:
            pruned.append(event)
            daily_requests += 1
            if ts >= minute_ago:
                recent_requests += 1
                recent_tokens += int(event["tokens"])
    _usage_events[model] = pruned
    return {
        "requests_per_minute": recent_requests,
        "tokens_per_minute": recent_tokens,
        "requests_per_day": daily_requests,
    }


def _limit_key_for_model(model: str) -> str:
    normalized = (model or "").strip()
    if normalized in _MODEL_LIMITS:
        return normalized
    if normalized.startswith("gemini-3-flash"):
        return "gemini-3-flash"
    if normalized.startswith("gemini-3.1-flash-lite"):
        return "gemini-3.1-flash-lite"
    if normalized.startswith("gemini-2.5-flash-lite"):
        return "gemini-2.5-flash-lite"
    if normalized.startswith("gemini-2.5-flash"):
        return "gemini-2.5-flash"
    return normalized


def _quota_wait_seconds(model: str, reserved_tokens: int) -> float:
    limit_key = _limit_key_for_model(model)
    limits = _MODEL_LIMITS.get(limit_key)
    if not limits:
        return 0.0

    now = time.time()
    minute_ago = now - 60
    events = [event for event in _usage_events[model] if event["ts"] >= minute_ago]
    if not events:
        return 0.0

    requests = len(events)
    tokens = sum(int(event["tokens"]) for event in events)
    rpm = limits["rpm"]
    tpm = limits["tpm"]
    waits = [0.0]

    if requests >= rpm:
        oldest = min(event["ts"] for event in events)
        waits.append(max(0.0, 60 - (now - oldest) + 0.05))

    if tokens + reserved_tokens > tpm:
        sorted_events = sorted(events, key=lambda event: event["ts"])
        running_tokens = tokens
        wait = 0.0
        for event in sorted_events:
            if running_tokens + reserved_tokens <= tpm:
                break
            running_tokens -= int(event["tokens"])
            wait = max(wait, 60 - (now - event["ts"]) + 0.05)
        if running_tokens + reserved_tokens > tpm:
            waits.append(max(wait, 0.25))
        else:
            waits.append(max(wait, 0.0))

    return max(waits)


def _pick_gemini_model_with_quota(models: list[str], reserved_tokens: int) -> tuple[str, float]:
    best_model = models[0]
    best_wait = _quota_wait_seconds(best_model, reserved_tokens)
    for model in models:
        wait = _quota_wait_seconds(model, reserved_tokens)
        if wait <= 0:
            return model, 0.0
        if wait < best_wait:
            best_model = model
            best_wait = wait
    return best_model, best_wait


def _call_groq(system_prompt: str, user_message: str, model: str, *, max_output_tokens: int) -> str:
    import requests

    if not config.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured")
    url = "https://api.groq.com/openai/v1/chat/completions"
    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {config.GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.7,
            "max_tokens": max_output_tokens,
        },
        timeout=90,
    )
    response.raise_for_status()
    payload = response.json()
    return payload["choices"][0]["message"]["content"].strip()


def _call_gemini(system_prompt: str, user_message: str, model: str, *, max_output_tokens: int) -> str:
    import requests

    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    model = _normalize_gemini_model_name(model)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    response = requests.post(
        url,
        params={"key": config.GEMINI_API_KEY},
        headers={"Content-Type": "application/json"},
        json={
            "systemInstruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_message}],
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "candidateCount": 1,
                "maxOutputTokens": max_output_tokens,
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    candidates = payload.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {json.dumps(payload)[:500]}")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise RuntimeError(f"Gemini returned empty content: {json.dumps(payload)[:500]}")
    return text


def probe_groq() -> dict[str, Any]:
    if not config.GROQ_API_KEY:
        return {"ok": False, "error": "GROQ_API_KEY missing"}
    try:
        start = time.time()
        _call_groq("Reply with OK.", "OK", config.GROQ_DIALOGUE_MODEL)
        return {"ok": True, "latency_ms": int((time.time() - start) * 1000)}
    except Exception as exc:  # pragma: no cover - health probe
        return {"ok": False, "error": str(exc)}


def call_llm(
    system_prompt: str,
    user_message: str,
    role: str = "dialogue",
    *,
    normalize: str = "text",
    usage_metadata: dict[str, Any] | None = None,
    model_override: str | None = None,
) -> str:
    if config.USE_DUMMY_DATA:
        from dummy.data import get_dummy_dialogue
        return get_dummy_dialogue(user_message)

    provider = _provider_for_role(role)
    model = _model_for_role(provider, role)
    input_tokens = _estimate_tokens(system_prompt, user_message)
    max_output_tokens = _max_output_tokens_for_role(role)
    last_error: Exception | None = None

    try_models = [model_override] if model_override else [model]
    if provider == "gemini" and role == "dialogue":
        fallback = config.GEMINI_DIALOGUE_FALLBACK_MODEL
        if fallback and fallback != model:
            try_models.append(fallback)
    if provider == "gemini" and role == "ask":
        for candidate in [
            config.GEMINI_ASK_FALLBACK_MODEL,
            config.GEMINI_DIALOGUE_MODEL,
            config.GEMINI_DIALOGUE_FALLBACK_MODEL,
            config.GEMINI_SUMMARY_MODEL,
        ]:
            if candidate and candidate not in try_models:
                try_models.append(candidate)
    if provider == "gemini" and role == "arc_summary" and not model_override:
        pool = [candidate for candidate in config.GEMINI_ARC_SUMMARY_MODEL_POOL if candidate]
        if pool:
            slot = int(time.time() // max(config.GEMINI_ARC_SUMMARY_ROTATION_SECONDS, 1))
            start_index = slot % len(pool)
            pool = pool[start_index:] + pool[:start_index]
        for candidate in pool:
            if candidate not in try_models:
                try_models.append(candidate)
        fallback = config.GEMINI_ARC_SUMMARY_FALLBACK_MODEL
        if fallback and fallback not in try_models:
            try_models.append(fallback)

    if provider == "gemini" and try_models:
        reserved_tokens = input_tokens + max_output_tokens
        seen: set[str] = set()
        unique_models = [model_name for model_name in try_models if not (model_name in seen or seen.add(model_name))]
        ordered_models: list[str] = []
        remaining = list(unique_models)
        while remaining:
            current_model, wait_seconds = _pick_gemini_model_with_quota(remaining, reserved_tokens)
            ordered_models.append(current_model)
            remaining.remove(current_model)
            if wait_seconds <= 0:
                break
        if not ordered_models:
            ordered_models = unique_models
        best_wait = _quota_wait_seconds(ordered_models[0], reserved_tokens)
        if best_wait > 0:
            time.sleep(best_wait)
        try_models = ordered_models + [model_name for model_name in unique_models if model_name not in ordered_models]

    for current_model in try_models:
        try:
            if provider == "gemini":
                output = _call_gemini(system_prompt, user_message, current_model, max_output_tokens=max_output_tokens)
            elif provider == "groq":
                output = _call_groq(system_prompt, user_message, current_model, max_output_tokens=max_output_tokens)
            else:
                raise ValueError(f"Unsupported provider for active repo: {provider}")
            total_tokens = input_tokens + _estimate_tokens(output)
            _record_usage(current_model, role, total_tokens, usage_metadata)
            return _normalize_text(output, normalize)
        except Exception as exc:
            last_error = exc
            continue

    raise RuntimeError(f"LLM call failed for role={role}, provider={provider}: {last_error}")


def active_providers() -> dict[str, Any]:
    return {
        "dialogue_provider": _provider_for_role("dialogue"),
        "dialogue_model": _model_for_role(_provider_for_role("dialogue"), "dialogue"),
        "summary_provider": _provider_for_role("summary"),
        "summary_model": _model_for_role(_provider_for_role("summary"), "summary"),
        "arc_summary_provider": _provider_for_role("arc_summary"),
        "arc_summary_model": _model_for_role(_provider_for_role("arc_summary"), "arc_summary"),
        "ask_provider": _provider_for_role("ask"),
        "ask_model": _model_for_role(_provider_for_role("ask"), "ask"),
        "dummy_mode": config.USE_DUMMY_DATA,
        "gemini_configured": bool(config.GEMINI_API_KEY),
        "groq_configured": bool(config.GROQ_API_KEY),
        "response_delay_seconds": round(config.FRIENDSOS_RESPONSE_DELAY_MS / 1000, 2),
    }


def usage_snapshot() -> dict[str, Any]:
    models = sorted(set(_usage_totals) | set(_role_usage) | set(_character_usage))
    provider_snapshot = active_providers()
    return {
        "models": models,
        "limits": {
            model: _MODEL_LIMITS.get(_limit_key_for_model(model), {})
            for model in models
        },
        "active_roles": {
            "dialogue_provider": provider_snapshot.get("dialogue_provider"),
            "dialogue_model": provider_snapshot.get("dialogue_model"),
            "summary_model": provider_snapshot.get("summary_model"),
            "arc_summary_model": provider_snapshot.get("arc_summary_model"),
            "ask_model": provider_snapshot.get("ask_model"),
            "response_delay_seconds": provider_snapshot.get("response_delay_seconds"),
        },
        "totals": {
            model: dict(_usage_totals[model])
            for model in models
        },
        "role_breakdown": {
            model: {
                role: dict(counters)
                for role, counters in _role_usage[model].items()
            }
            for model in models
        },
        "character_breakdown": {
            model: dict(_character_usage[model])
            for model in models
        },
        "window_totals": {
            model: _window_totals(model)
            for model in models
        },
    }
