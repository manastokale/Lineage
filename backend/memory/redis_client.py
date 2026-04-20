"""
Redis: short-term in-episode working memory.
Stores the last N dialogue lines per character for context window injection.
Supports REDIS_MODE=fakeredis for zero-dependency local testing.
"""

import json
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_MODE = os.getenv("REDIS_MODE", "redis")
CONTEXT_WINDOW = 12  # number of recent lines to keep per episode session

def _get_client():
    if REDIS_MODE == "fakeredis":
        import fakeredis
        return fakeredis.FakeRedis(decode_responses=True)
    import redis
    return redis.from_url(REDIS_URL, decode_responses=True)

class EpisodeMemory:
    def __init__(self, episode_id: str):
        self.r = _get_client()
        self.key = f"episode:{episode_id}:dialogue"
        self.episode_id = episode_id

    def add_line(self, speaker: str, text: str, scene_id: str):
        entry = json.dumps({"speaker": speaker, "text": text, "scene_id": scene_id})
        self.r.rpush(self.key, entry)
        self.r.ltrim(self.key, -CONTEXT_WINDOW, -1)
        self.r.expire(self.key, 3600)  # expire after 1 hour

    def get_recent(self, n: int = CONTEXT_WINDOW) -> list[dict]:
        raw = self.r.lrange(self.key, -n, -1)
        return [json.loads(r) for r in raw]

    def clear(self):
        self.r.delete(self.key)

    def format_for_prompt(self) -> str:
        lines = self.get_recent()
        return "\n".join(f"{l['speaker']}: {l['text']}" for l in lines)
