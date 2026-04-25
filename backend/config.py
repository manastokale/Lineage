from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    def load_dotenv(*_args, **_kwargs):
        return False


PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=True)

IS_VERCEL = bool(os.getenv("VERCEL"))
APP_ENV = os.getenv("APP_ENV", "production" if IS_VERCEL else "development")
USE_DUMMY_DATA = os.getenv("USE_DUMMY_DATA", "false").lower() == "true"
LINEAGE_DEBUG_RERANK = os.getenv("LINEAGE_DEBUG_RERANK", "true" if APP_ENV == "development" else "false").lower() == "true"
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
LINEAGE_MEMORY_BACKEND = os.getenv("LINEAGE_MEMORY_BACKEND", "readonly_json" if IS_VERCEL else "chroma").strip().lower()
LINEAGE_JSON_MEMORY_DIR = str(PROJECT_ROOT / os.getenv("LINEAGE_JSON_MEMORY_DIR", "./memory_data"))

EPISODE_SCRIPTS_DIR = PROJECT_ROOT / os.getenv("EPISODE_SCRIPTS_DIR", "./episode_scripts")

CHROMA_MODE = os.getenv("CHROMA_MODE", "embedded")
CHROMA_PERSIST_PATH = str(PROJECT_ROOT / os.getenv("CHROMA_PERSIST_PATH", "./chroma_data"))
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8001"))
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "friendsos_memory")

FRIENDSOS_RESPONSE_DELAY_MS = int(os.getenv("FRIENDSOS_RESPONSE_DELAY_MS", "6800"))

DIALOGUE_PROVIDER = os.getenv("DIALOGUE_PROVIDER", "gemini").lower()
SUMMARY_PROVIDER = os.getenv("SUMMARY_PROVIDER", "gemini").lower()
ARC_SUMMARY_PROVIDER = os.getenv("ARC_SUMMARY_PROVIDER", "gemini").lower()
ASK_PROVIDER = os.getenv("ASK_PROVIDER", "gemini").lower()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_DIALOGUE_MODEL = os.getenv("GEMINI_DIALOGUE_MODEL", "gemini-3.1-flash-lite-preview")
GEMINI_DIALOGUE_FALLBACK_MODEL = os.getenv("GEMINI_DIALOGUE_FALLBACK_MODEL", "gemini-2.5-flash-lite")
GEMINI_SUMMARY_MODEL = os.getenv("GEMINI_SUMMARY_MODEL", "gemini-3-flash-preview")
GEMINI_ARC_SUMMARY_MODEL = os.getenv("GEMINI_ARC_SUMMARY_MODEL", GEMINI_SUMMARY_MODEL)
GEMINI_ARC_SUMMARY_FALLBACK_MODEL = os.getenv("GEMINI_ARC_SUMMARY_FALLBACK_MODEL", "gemini-2.5-flash-lite")
GEMINI_ARC_SUMMARY_MODEL_POOL = [
    model.strip()
    for model in os.getenv(
        "GEMINI_ARC_SUMMARY_MODEL_POOL",
        "gemini-3.1-flash-lite-preview,gemini-2.5-flash,gemini-2.5-flash-lite,gemini-3-flash-preview",
    ).split(",")
    if model.strip()
]
GEMINI_ARC_SUMMARY_ROTATION_SECONDS = int(os.getenv("GEMINI_ARC_SUMMARY_ROTATION_SECONDS", "15"))
GEMINI_ASK_MODEL = os.getenv("GEMINI_ASK_MODEL", "gemini-2.5-flash-lite")
GEMINI_ASK_FALLBACK_MODEL = os.getenv("GEMINI_ASK_FALLBACK_MODEL", GEMINI_DIALOGUE_FALLBACK_MODEL)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_DIALOGUE_MODEL = os.getenv("GROQ_DIALOGUE_MODEL", "llama-3.1-8b-instant")
GROQ_SUMMARY_MODEL = os.getenv("GROQ_SUMMARY_MODEL", "llama-3.3-70b-versatile")
GROQ_ARC_SUMMARY_MODEL = os.getenv("GROQ_ARC_SUMMARY_MODEL", GROQ_SUMMARY_MODEL)
GROQ_ASK_MODEL = os.getenv("GROQ_ASK_MODEL", GROQ_DIALOGUE_MODEL)
GROQ_MAX_RETRIES = int(os.getenv("GROQ_MAX_RETRIES", "2"))

NODE_RECOMMENDED_VERSION = os.getenv("NODE_RECOMMENDED_VERSION", "22.12.0")
