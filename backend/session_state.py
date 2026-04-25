from __future__ import annotations

import re
import threading
import time

_DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")
_THREAD_TTL_SECONDS = 7 * 24 * 60 * 60
_MAX_THREAD_MESSAGES = 20

_lock = threading.RLock()
_threads: dict[str, dict[str, object]] = {}


def normalize_device_id(value: str | None) -> str | None:
    normalized = (value or "").strip()
    if not normalized:
        return None
    if not _DEVICE_ID_RE.fullmatch(normalized):
        return None
    return normalized


def _thread_key(device_id: str, episode_id: str, anchor_line_index: int) -> str:
    return f"{device_id}::{episode_id.lower()}::{anchor_line_index}"


def _prune_expired(now: float) -> None:
    expired = [
        key
        for key, payload in _threads.items()
        if (now - float(payload.get("updated_at", 0))) > _THREAD_TTL_SECONDS
    ]
    for key in expired:
        _threads.pop(key, None)


def get_thread_messages(device_id: str, episode_id: str, anchor_line_index: int) -> list[dict]:
    now = time.time()
    with _lock:
        _prune_expired(now)
        payload = _threads.get(_thread_key(device_id, episode_id, anchor_line_index), {})
        return list(payload.get("messages", []))


def append_thread_messages(device_id: str, episode_id: str, anchor_line_index: int, messages: list[dict]) -> None:
    if not messages:
        return
    now = time.time()
    with _lock:
        _prune_expired(now)
        key = _thread_key(device_id, episode_id, anchor_line_index)
        payload = _threads.setdefault(key, {"messages": [], "updated_at": now})
        merged = list(payload.get("messages", []))
        for message in messages:
            kind = str(message.get("type", "")).strip()
            speaker = str(message.get("speaker", "")).strip()
            text = str(message.get("text", "")).strip()
            if kind not in {"user_question", "agent_reply"} or not speaker or not text:
                continue
            merged.append({"type": kind, "speaker": speaker, "text": text})
        payload["messages"] = merged[-_MAX_THREAD_MESSAGES:]
        payload["updated_at"] = now
