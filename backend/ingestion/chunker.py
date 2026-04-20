"""
Chunker: Takes parsed scene graphs and stores them in ChromaDB.

Chunking strategy:
  - Per-character: each character's lines across a scene → one chunk
  - Per-scene: full scene dialogue → one chunk (for episode-level retrieval)
  - Metadata: episode_id, scene_id, speaker, emotion_tags, location
"""

import chromadb
from chromadb.utils import embedding_functions
from pathlib import Path
import json
import os

EMBED_MODEL = "all-MiniLM-L6-v2"   # runs locally, no API key needed

def get_chroma_client():
    mode = os.getenv("CHROMA_MODE", "embedded")
    if mode == "embedded":
        persist_path = os.getenv("CHROMA_PERSIST_PATH", "./chroma_data")
        return chromadb.PersistentClient(path=persist_path)
    else:
        host = os.getenv("CHROMA_HOST", "localhost")
        port = int(os.getenv("CHROMA_PORT", 8001))
        return chromadb.HttpClient(host=host, port=port)

def get_or_create_collection(client, name: str):
    try:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=EMBED_MODEL
        )
    except (ValueError, ImportError):
        print("  ⚠ sentence-transformers not installed, using ChromaDB default embeddings")
        ef = embedding_functions.DefaultEmbeddingFunction()
    return client.get_or_create_collection(
        name=name,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )

def chunk_episode(episode: dict, collection) -> int:
    """Store all scene chunks for one episode. Returns number of chunks added."""
    chunks_added = 0
    ep_id = episode["episode_id"]

    for scene in episode["scenes"]:
        scene_id = scene["scene_id"]
        location = scene["location"]

        # Per-scene chunk (full dialogue)
        full_dialogue = "\n".join(
            f"{line['speaker']}: {line['text']}"
            for line in scene["lines"]
        )
        if full_dialogue.strip():
            collection.add(
                documents=[full_dialogue],
                ids=[f"{scene_id}_full"],
                metadatas=[{
                    "episode_id": ep_id,
                    "scene_id": scene_id,
                    "location": location,
                    "chunk_type": "scene",
                    "speakers": ",".join({l["speaker"] for l in scene["lines"]})
                }]
            )
            chunks_added += 1

        # Per-character chunks within scene
        speakers_in_scene = {l["speaker"] for l in scene["lines"]}
        for speaker in speakers_in_scene:
            char_lines = [l for l in scene["lines"] if l["speaker"] == speaker]
            char_text = "\n".join(
                f"[{','.join(l['emotion_tags']) or 'neutral'}] {l['text']}"
                for l in char_lines
            )
            if char_text.strip():
                emotions = list({e for l in char_lines for e in l["emotion_tags"]})
                collection.add(
                    documents=[char_text],
                    ids=[f"{scene_id}_{speaker.lower()}_lines"],
                    metadatas=[{
                        "episode_id": ep_id,
                        "scene_id": scene_id,
                        "location": location,
                        "chunk_type": "character",
                        "speaker": speaker,
                        "emotions": ",".join(emotions)
                    }]
                )
                chunks_added += 1

    return chunks_added

def chunk_all(episodes: list[dict], collection_name: str):
    client = get_chroma_client()
    collection = get_or_create_collection(client, collection_name)
    total = 0
    for ep in episodes:
        n = chunk_episode(ep, collection)
        print(f"  {ep['episode_id']}: {n} chunks stored")
        total += n
    print(f"\nTotal chunks: {total}")
    return total
