from __future__ import annotations

import math
import re
import threading
import time
from collections import deque
from collections.abc import Hashable

from fastapi import HTTPException, Request

from session_state import normalize_device_id

_EPISODE_ID_RE = re.compile(r"^s\d{2}e\d{2}$", re.IGNORECASE)
_SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9 ._'&-]{1,80}$")

_RATE_LOCK = threading.RLock()
_RATE_WINDOWS: dict[tuple[Hashable, ...], deque[float]] = {}
_MAX_RATE_BUCKETS = 2048


def normalize_episode_id(value: str) -> str | None:
    normalized = (value or "").strip().lower()
    if not _EPISODE_ID_RE.fullmatch(normalized):
        return None
    return normalized


def require_episode_id(value: str) -> str:
    normalized = normalize_episode_id(value)
    if not normalized:
        raise HTTPException(status_code=400, detail="Episode id must use the sXXeYY format.")
    return normalized


def require_safe_name(value: str, *, label: str = "name") -> str:
    raw = value or ""
    if any(ord(char) < 32 for char in raw):
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    normalized = " ".join(raw.strip().split())
    if not normalized or not _SAFE_NAME_RE.fullmatch(normalized):
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized


def clip_text(value: object, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: max(limit - 1, 0)].rstrip() + "…"


def client_rate_key(request: Request, device_id: str | None) -> str:
    normalized = normalize_device_id(device_id)
    if normalized:
        return f"device:{normalized}"
    host = request.client.host if request.client else "unknown"
    return f"ip:{host}"


def require_rate_limit(
    client_key: str,
    bucket: str,
    *,
    max_requests: int,
    window_seconds: int,
) -> None:
    """Small in-process limiter for LLM-cost endpoints.

    This is a local safety guard, not a replacement for edge/API-gateway rate
    limiting in a multi-process or hosted deployment.
    """

    now = time.monotonic()
    cutoff = now - window_seconds
    key = (bucket, client_key)
    with _RATE_LOCK:
        if len(_RATE_WINDOWS) > _MAX_RATE_BUCKETS:
            for stale_key, events in list(_RATE_WINDOWS.items()):
                while events and events[0] < cutoff:
                    events.popleft()
                if not events:
                    _RATE_WINDOWS.pop(stale_key, None)

        events = _RATE_WINDOWS.setdefault(key, deque())
        while events and events[0] < cutoff:
            events.popleft()
        if len(events) >= max_requests:
            retry_after = max(1, math.ceil(window_seconds - (now - events[0])))
            raise HTTPException(
                status_code=429,
                detail=f"Too many {bucket.replace('_', ' ')} requests. Try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )
        events.append(now)
