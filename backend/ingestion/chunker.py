"""
Chunker: Takes parsed scene graphs and stores them in ChromaDB.

Chunking strategy:
  - Per-character: each character's lines across a scene → one chunk
  - Per-scene-window: overlapping windows for retrieval fidelity on longer scenes
  - Per-scene: full scene dialogue chunk for broad lookup
"""

import chromadb
from chromadb.utils import embedding_functions
import os

EMBED_MODEL = "all-MiniLM-L6-v2"   # runs locally, no API key needed
SCENE_WINDOW_SIZE = int(os.getenv("SCENE_WINDOW_SIZE", 12))
SCENE_WINDOW_OVERLAP = int(os.getenv("SCENE_WINDOW_OVERLAP", 4))

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


def _ordered_unique_speakers(lines: list[dict]) -> list[str]:
    seen = set()
    ordered = []
    for line in lines:
        speaker = line["speaker"]
        if speaker in seen:
            continue
        seen.add(speaker)
        ordered.append(speaker)
    return ordered


def _scene_windows(lines: list[dict]) -> list[tuple[int, list[dict]]]:
    if not lines:
        return []

    step = max(1, SCENE_WINDOW_SIZE - SCENE_WINDOW_OVERLAP)
    windows = []
    for start in range(0, len(lines), step):
        window = lines[start:start + SCENE_WINDOW_SIZE]
        if not window:
            continue
        windows.append((start, window))
        if start + SCENE_WINDOW_SIZE >= len(lines):
            break
    return windows


def chunk_episode(episode: dict, collection) -> int:
    """Store all scene chunks for one episode. Returns number of chunks added."""
    chunks_added = 0
    ep_id = episode["episode_id"]
    title = episode.get("title", ep_id)

    for scene in episode["scenes"]:
        scene_id = scene["scene_id"]
        location = scene["location"]
        lines = scene["lines"]

        for window_idx, (start_idx, window_lines) in enumerate(_scene_windows(lines), start=1):
            window_text = "\n".join(
                f"{line['speaker']}: {line['text']}"
                for line in window_lines
            )
            collection.upsert(
                documents=[window_text],
                ids=[f"{scene_id}_window_{window_idx:02d}"],
                metadatas=[{
                    "episode_id": ep_id,
                    "episode_title": title,
                    "scene_id": scene_id,
                    "location": location,
                    "chunk_type": "scene_window",
                    "start_line": start_idx,
                    "end_line": start_idx + len(window_lines) - 1,
                    "line_count": len(window_lines),
                    "speakers": ",".join(_ordered_unique_speakers(window_lines)),
                }],
            )
            chunks_added += 1

        # Per-scene chunk (full dialogue)
        full_dialogue = "\n".join(
            f"{line['speaker']}: {line['text']}"
            for line in lines
        )
        if full_dialogue.strip():
            collection.upsert(
                documents=[full_dialogue],
                ids=[f"{scene_id}_full"],
                metadatas=[{
                    "episode_id": ep_id,
                    "episode_title": title,
                    "scene_id": scene_id,
                    "location": location,
                    "chunk_type": "scene",
                    "line_count": len(lines),
                    "speakers": ",".join(_ordered_unique_speakers(lines)),
                }]
            )
            chunks_added += 1

        # Per-character chunks within scene
        speakers_in_scene = _ordered_unique_speakers(lines)
        for speaker in speakers_in_scene:
            char_lines = [l for l in lines if l["speaker"] == speaker]
            char_text = "\n".join(
                f"[{','.join(l['emotion_tags']) or 'neutral'}] {l['text']}"
                for l in char_lines
            )
            if char_text.strip():
                emotions = list({e for l in char_lines for e in l["emotion_tags"]})
                collection.upsert(
                    documents=[char_text],
                    ids=[f"{scene_id}_{speaker.lower()}_lines"],
                    metadatas=[{
                        "episode_id": ep_id,
                        "episode_title": title,
                        "scene_id": scene_id,
                        "location": location,
                        "chunk_type": "character",
                        "speaker": speaker,
                        "line_count": len(char_lines),
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
