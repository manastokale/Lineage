from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import time

import config
from llm.providers import active_providers, usage_snapshot
from routers import agents, episodes

app = FastAPI(title="Lineage API", version="1.0.0")

allow_origins = config.CORS_ALLOWED_ORIGINS or []
allow_origin_regex = None
if not allow_origins and config.APP_ENV == "development":
    allow_origin_regex = r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$"
if "*" in allow_origins:
    allow_origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins or [],
    allow_origin_regex=allow_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(episodes.router, prefix="/api/episodes", tags=["episodes"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])

_STATS_CACHE_TTL_SECONDS = 2.0
_stats_cache: dict | None = None
_stats_cache_at = 0.0


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "dummy_mode": config.USE_DUMMY_DATA,
        "response_delay_seconds": round(config.FRIENDSOS_RESPONSE_DELAY_MS / 1000, 2),
    }


@app.get("/api/stats/overview")
def stats_overview():
    global _stats_cache, _stats_cache_at
    now = time.monotonic()
    if _stats_cache is not None and (now - _stats_cache_at) < _STATS_CACHE_TTL_SECONDS:
        return _stats_cache

    from data.episode_repository import EXPECTED_SEASON_EPISODE_COUNTS, list_all_episodes
    from debug_state import recent_rerank_traces
    from memory.chroma_client import (
        CHROMA_MODE,
        COLLECTION_NAME,
        MAIN_SCRIPT_COLLECTION_NAME,
        arc_summary_storage_available,
        count_collection_documents,
    )

    provider_snapshot = active_providers()
    episodes = list_all_episodes()
    parsed_seasons = sorted({int(str(item.get("episode_id", ""))[1:3]) for item in episodes if str(item.get("episode_id", "")).startswith("s")})
    chroma_connected = arc_summary_storage_available()
    expose_debug = config.LINEAGE_DEBUG_RERANK and config.LINEAGE_EXPOSE_DEBUG_STATS
    payload = {
        "status": "ok",
        "dialogue_provider": provider_snapshot.get("dialogue_provider"),
        "dialogue_model": provider_snapshot.get("dialogue_model"),
        "summary_provider": provider_snapshot.get("summary_provider"),
        "summary_model": provider_snapshot.get("summary_model"),
        "arc_summary_provider": provider_snapshot.get("arc_summary_provider"),
        "arc_summary_model": provider_snapshot.get("arc_summary_model"),
        "ask_provider": provider_snapshot.get("ask_provider"),
        "ask_model": provider_snapshot.get("ask_model"),
        "gemini_configured": provider_snapshot.get("gemini_configured"),
        "groq_configured": provider_snapshot.get("groq_configured"),
        "response_delay_seconds": provider_snapshot.get("response_delay_seconds"),
        "dummy_mode": config.USE_DUMMY_DATA,
        "chroma": {
            "connected": chroma_connected,
            "mode": config.LINEAGE_MEMORY_BACKEND if config.LINEAGE_MEMORY_BACKEND == "readonly_json" else CHROMA_MODE,
            "memory_collection": {
                "name": COLLECTION_NAME,
                "count": count_collection_documents(COLLECTION_NAME) if chroma_connected else 0,
            },
            "main_script_collection": {
                "name": MAIN_SCRIPT_COLLECTION_NAME,
                "count": count_collection_documents(MAIN_SCRIPT_COLLECTION_NAME) if chroma_connected else 0,
            },
        },
        "library": {
            "episodes_loaded": len(episodes),
            "seasons_loaded": len(parsed_seasons),
            "parsed_seasons": parsed_seasons,
            "expected_seasons": sorted(EXPECTED_SEASON_EPISODE_COUNTS.keys()),
        },
        "usage": usage_snapshot(),
        "debug": {
            "rerank_enabled": expose_debug,
            "recent_rerank_traces": recent_rerank_traces(5) if expose_debug else [],
        },
    }
    _stats_cache = payload
    _stats_cache_at = now
    return payload
