"""
ChromaDB: long-term cross-episode semantic memory.
Supports embedded mode (default, no server) and HTTP mode (separate server).
"""

import chromadb
from chromadb.utils import embedding_functions
import os

CHROMA_MODE = os.getenv("CHROMA_MODE", "embedded")
CHROMA_PERSIST_PATH = os.getenv("CHROMA_PERSIST_PATH", "./chroma_data")
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8001))
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "friendsos_memory")
EMBED_MODEL = "all-MiniLM-L6-v2"

_client = None
_collection = None

def _make_client():
    if CHROMA_MODE == "embedded":
        return chromadb.PersistentClient(path=CHROMA_PERSIST_PATH)
    return chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)

def get_collection():
    global _client, _collection
    if _collection is None:
        _client = _make_client()
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=ef
        )
    return _collection

def query_character_memories(character: str, query_text: str, n_results: int = 5) -> list[dict]:
    """Get the most relevant past memories for a character given current scene context."""
    collection = get_collection()
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where={"speaker": character, "chunk_type": "character"}
    )
    memories = []
    for i, doc in enumerate(results["documents"][0]):
        meta = results["metadatas"][0][i]
        memories.append({
            "episode_id": meta.get("episode_id", ""),
            "text": doc[:300],  # truncate for prompt safety
            "emotions": meta.get("emotions", "")
        })
    return memories

def query_scene_context(location: str, query_text: str, n_results: int = 3) -> list[dict]:
    """Get past scenes at this location for environmental context."""
    collection = get_collection()
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where={"location": location, "chunk_type": "scene"}
    )
    return [
        {"episode_id": r["episode_id"], "text": d[:400]}
        for d, r in zip(results["documents"][0], results["metadatas"][0])
    ]
