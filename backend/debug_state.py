from __future__ import annotations

import threading
import time
from copy import deepcopy

_MAX_RERANK_TRACES = 8
_lock = threading.RLock()
_rerank_traces: list[dict] = []


def record_rerank_trace(trace: dict) -> None:
    if not trace:
        return
    payload = deepcopy(trace)
    payload["recorded_at"] = int(time.time())
    with _lock:
        _rerank_traces.append(payload)
        del _rerank_traces[:-_MAX_RERANK_TRACES]


def recent_rerank_traces(limit: int = 5) -> list[dict]:
    with _lock:
        return deepcopy(list(reversed(_rerank_traces[-max(limit, 0) :])))
