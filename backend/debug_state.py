from __future__ import annotations

import threading
import time
from copy import deepcopy

_MAX_RERANK_TRACES = 8
_MAX_DEBUG_TEXT_CHARS = 900
_lock = threading.RLock()
_rerank_traces: list[dict] = []


def _clip_debug_payload(value):
    if isinstance(value, str):
        if len(value) <= _MAX_DEBUG_TEXT_CHARS:
            return value
        return value[: _MAX_DEBUG_TEXT_CHARS - 1].rstrip() + "…"
    if isinstance(value, list):
        return [_clip_debug_payload(item) for item in value]
    if isinstance(value, dict):
        return {key: _clip_debug_payload(item) for key, item in value.items()}
    return value


def record_rerank_trace(trace: dict) -> None:
    if not trace:
        return
    payload = _clip_debug_payload(deepcopy(trace))
    payload["recorded_at"] = int(time.time())
    with _lock:
        _rerank_traces.append(payload)
        del _rerank_traces[:-_MAX_RERANK_TRACES]


def recent_rerank_traces(limit: int = 5) -> list[dict]:
    with _lock:
        return deepcopy(list(reversed(_rerank_traces[-max(limit, 0) :])))
