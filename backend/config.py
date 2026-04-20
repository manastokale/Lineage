"""
FriendsOS Backend Configuration.
Loads environment variables from .env file.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# Application
APP_ENV = os.getenv("APP_ENV", "development")
USE_DUMMY_DATA = os.getenv("USE_DUMMY_DATA", "true").lower() == "true"

# Provider Selection
DIALOGUE_PROVIDER = os.getenv("DIALOGUE_PROVIDER", "ollama")
CONVERGE_PROVIDER = os.getenv("CONVERGE_PROVIDER", "ollama")

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
REDIS_MODE = os.getenv("REDIS_MODE", "redis")

# ChromaDB
CHROMA_MODE = os.getenv("CHROMA_MODE", "embedded")
CHROMA_PERSIST_PATH = os.getenv("CHROMA_PERSIST_PATH", "./chroma_data")
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8001))
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "friendsos_memory")
