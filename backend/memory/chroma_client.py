"""
ChromaDB: long-term cross-episode semantic memory.
Supports embedded mode (default, no server) and HTTP mode (separate server).
"""

import os
import re
from pathlib import Path

try:
    import chromadb
    from chromadb.config import Settings
except Exception:  # pragma: no cover - optional in readonly deployments
    chromadb = None
    Settings = None

from memory.embeddings import LocalHashEmbeddingFunction
from memory import readonly_store
import config

CHROMA_MODE = os.getenv("CHROMA_MODE", "embedded")
CHROMA_PERSIST_PATH = os.getenv("CHROMA_PERSIST_PATH", str(Path(config.PROJECT_ROOT) / "chroma_data"))
CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8001))
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "friendsos_memory")
MAIN_SCRIPT_COLLECTION_NAME = os.getenv("CHROMA_MAIN_SCRIPT_COLLECTION_NAME", "friendsos_main_script")
_client = None
_collection = None
CHARACTER_ARC_CHUNK_TYPE = "character_arc"
INTERACTION_ARC_CHUNK_TYPE = "interaction_arc"
LEGACY_CHARACTER_ARC_CHUNK_TYPE = "arc_summary"
LEGACY_INTERACTION_ARC_CHUNK_TYPE = "interaction_summary"
MEMORY_SUMMARY_VERSION = 1

if chromadb is not None:
    chromadb.configure(anonymized_telemetry=False)


def _use_readonly_memory() -> bool:
    return config.LINEAGE_MEMORY_BACKEND == "readonly_json"


def _make_client():
    if _use_readonly_memory():
        raise RuntimeError("Readonly JSON memory backend does not expose a Chroma client.")
    if chromadb is None or Settings is None:
        raise RuntimeError("chromadb is not installed for the current runtime.")
    settings = Settings(anonymized_telemetry=False)
    if CHROMA_MODE == "embedded":
        return chromadb.PersistentClient(path=CHROMA_PERSIST_PATH, settings=settings)
    return chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT, settings=settings)

def _embedding_function():
    return LocalHashEmbeddingFunction()


def _is_character_arc_metadata(metadata: dict | None) -> bool:
    return str((metadata or {}).get("chunk_type", "")) in {CHARACTER_ARC_CHUNK_TYPE, LEGACY_CHARACTER_ARC_CHUNK_TYPE}


def _is_interaction_arc_metadata(metadata: dict | None) -> bool:
    return str((metadata or {}).get("chunk_type", "")) in {INTERACTION_ARC_CHUNK_TYPE, LEGACY_INTERACTION_ARC_CHUNK_TYPE}


def _metadata_character(metadata: dict | None) -> str:
    return str((metadata or {}).get("character") or (metadata or {}).get("speaker") or "").strip()


def _metadata_participants(metadata: dict | None) -> list[str]:
    csv = str((metadata or {}).get("participants_csv", "")).strip()
    if csv:
        return [name.strip() for name in csv.split("||") if name.strip()]
    direct = (metadata or {}).get("participants")
    if isinstance(direct, list):
        return [str(name).strip() for name in direct if str(name).strip()]
    participants = []
    for key in ("participant_a", "participant_b"):
        value = str((metadata or {}).get(key, "")).strip()
        if value:
            participants.append(value)
    return participants


def get_collection(name: str | None = None):
    if _use_readonly_memory():
        raise RuntimeError("Readonly JSON memory backend does not expose raw collections.")
    global _client, _collection
    collection_name = name or COLLECTION_NAME
    if _collection is None or (_collection.name != collection_name):
        _client = _make_client()
        _collection = _client.get_or_create_collection(
            name=collection_name,
            embedding_function=_embedding_function(),
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def arc_summary_storage_available(collection_name: str | None = None) -> bool:
    if _use_readonly_memory():
        return readonly_store.memory_available()
    try:
        get_collection(collection_name)
        return True
    except Exception:
        return False


def collection_stats() -> dict:
    if _use_readonly_memory():
        return {"name": COLLECTION_NAME, "count": readonly_store.total_memory_documents()}
    try:
        collection = get_collection()
    except Exception:
        return {"name": COLLECTION_NAME, "count": 0}
    return {"name": collection.name, "count": collection.count()}


def count_collection_documents(collection_name: str) -> int:
    if _use_readonly_memory():
        if collection_name == MAIN_SCRIPT_COLLECTION_NAME:
            return readonly_store.count_main_script_documents()
        return readonly_store.total_memory_documents()
    try:
        return get_collection(collection_name).count()
    except Exception:
        return 0


def ensure_collection_populated(
    episodes: list[dict],
    collection_name: str | None = None,
    progress_callback=None,
) -> int:
    if _use_readonly_memory():
        if progress_callback:
            progress_callback(0, len(episodes), None, 0, True)
        return 0
    collection = get_collection(collection_name)
    if collection.count() > 0:
        if progress_callback:
            progress_callback(0, len(episodes), None, 0, True)
        return 0

    from ingestion.chunker import chunk_episode

    total = 0
    episode_total = len(episodes)
    for index, episode in enumerate(episodes, start=1):
        added = chunk_episode(episode, collection)
        total += added
        if progress_callback:
            progress_callback(index, episode_total, episode.get("episode_id"), total, False)
    return total


def _scene_markdown_chunk(scene: dict) -> str:
    parts = []
    description = (scene.get("scene_description") or "").strip()
    if description:
        parts.append(description)
    for line in scene.get("lines", []):
        speaker = line.get("speaker")
        text = (line.get("text") or "").strip()
        if not speaker or not text:
            continue
        parts.append(f"{speaker}: {text}")
    return "\n".join(parts).strip()


def upsert_main_episode_chunks(episode: dict, markdown_text: str, collection_name: str | None = None) -> int:
    if _use_readonly_memory():
        return 0
    collection = get_collection(collection_name or MAIN_SCRIPT_COLLECTION_NAME)
    total = 0
    season_match = re.match(r"s(\d{2})e(\d{2})", episode.get("episode_id", ""), re.IGNORECASE)
    season = int(season_match.group(1)) if season_match else 0
    episode_number = int(season_match.group(2)) if season_match else 0
    collection.upsert(
        documents=[markdown_text],
            ids=[f"main_markdown::{episode['episode_id']}"],
            metadatas=[{
                "episode_id": episode["episode_id"],
                "season": season,
                "episode": episode_number,
                "chunk_type": "episode_markdown",
            }],
        )
    total += 1
    for scene_index, scene in enumerate(episode.get("scenes", []), start=1):
        chunk = _scene_markdown_chunk(scene)
        if not chunk:
            continue
        collection.upsert(
            documents=[chunk],
            ids=[f"main_scene::{episode['episode_id']}::{scene.get('scene_id')}"],
            metadatas=[{
                "episode_id": episode["episode_id"],
                "season": season,
                "episode": episode_number,
                "scene_id": scene.get("scene_id"),
                "scene_index": scene_index,
                "location": scene.get("location", "Unknown"),
                "chunk_type": "scene_markdown",
            }],
        )
        total += 1
    return total


def upsert_arc_summary_documents(items: list[dict], collection_name: str | None = None) -> int:
    if _use_readonly_memory():
        return 0
    if not items:
        return 0
    try:
        collection = get_collection(collection_name)
    except Exception:
        return 0
    total = 0
    for item in items:
        character = item.get("character", "")
        episode_id = item.get("episode_id", "")
        title = item.get("title", episode_id)
        summary = (item.get("summary") or "").strip()
        if not character or not episode_id or not summary:
            continue
        collection.upsert(
            documents=[summary],
            ids=[f"character_arc::{episode_id}::{character.lower().replace(' ', '_')}"],
            metadatas=[{
                "episode_id": episode_id,
                "season": int(str(episode_id)[1:3]) if str(episode_id).startswith("s") else 0,
                "episode": int(str(episode_id)[4:6]) if str(episode_id).startswith("s") else 0,
                "episode_title": title,
                "character": character,
                "participants_csv": character,
                "scope": "episode",
                "chunk_type": CHARACTER_ARC_CHUNK_TYPE,
                "summary_type": "prior_arc",
                "spoiler_floor_episode": episode_id,
                "spoiler_ceiling_episode": episode_id,
                "query_safe_for": "character_only",
                "source_kind": "llm_summary",
                "summary_version": MEMORY_SUMMARY_VERSION,
            }],
        )
        total += 1
    return total


def upsert_interaction_summary_documents(items: list[dict], collection_name: str | None = None) -> int:
    if _use_readonly_memory():
        return 0
    if not items:
        return 0
    try:
        collection = get_collection(collection_name)
    except Exception:
        return 0
    total = 0
    for item in items:
        episode_id = item.get("episode_id", "")
        title = item.get("title", episode_id)
        focal_character = str(item.get("character", "") or "").strip()
        participants = [str(name).strip() for name in item.get("participants", []) if str(name).strip()]
        summary = (item.get("summary") or "").strip()
        if not episode_id or len(participants) < 2 or not summary:
            continue
        normalized = sorted(dict.fromkeys(participants))
        if len(normalized) < 2:
            continue
        participants_key = "||".join(normalized)
        doc_id = f"interaction_arc::{episode_id}::{participants_key.lower().replace(' ', '_')}"
        metadata = {
            "episode_id": episode_id,
            "season": int(str(episode_id)[1:3]) if str(episode_id).startswith("s") else 0,
            "episode": int(str(episode_id)[4:6]) if str(episode_id).startswith("s") else 0,
            "episode_title": title,
            "chunk_type": INTERACTION_ARC_CHUNK_TYPE,
            "summary_type": "prior_interaction",
            "participants_key": participants_key,
            "participants_csv": "||".join(normalized),
            "participant_a": normalized[0],
            "participant_b": normalized[1] if len(normalized) > 1 else "",
            "character": focal_character,
            "scope": "scene_group",
            "spoiler_floor_episode": episode_id,
            "spoiler_ceiling_episode": episode_id,
            "query_safe_for": "participants_only",
            "source_kind": "llm_summary",
            "summary_version": MEMORY_SUMMARY_VERSION,
        }
        collection.upsert(documents=[summary], ids=[doc_id], metadatas=[metadata])
        total += 1
    return total


def purge_arc_summary_documents(
    season: int | None = None,
    episode_id: str | None = None,
    collection_name: str | None = None,
) -> int:
    if _use_readonly_memory():
        return 0
    try:
        collection = get_collection(collection_name)
    except Exception:
        return 0
    try:
        results = collection.get(include=["metadatas"])
    except Exception:
        return 0
    ids = results.get("ids") or []
    metadatas = results.get("metadatas") or []
    if episode_id is not None:
        ids = [
            doc_id
            for doc_id, metadata in zip(ids, metadatas)
            if _is_character_arc_metadata(metadata) and str((metadata or {}).get("episode_id", "")) == episode_id
        ]
    elif season is not None:
        filtered_ids = []
        for doc_id, metadata in zip(ids, metadatas):
            if not _is_character_arc_metadata(metadata):
                continue
            source_episode_id = str((metadata or {}).get("episode_id", ""))
            match = re.match(r"s(\d{2})e\d{2}", source_episode_id, re.IGNORECASE)
            if match and int(match.group(1)) == season:
                filtered_ids.append(doc_id)
        ids = filtered_ids
    else:
        ids = [doc_id for doc_id, metadata in zip(ids, metadatas) if _is_character_arc_metadata(metadata)]
    if not ids:
        return 0
    collection.delete(ids=ids)
    return len(ids)


def purge_interaction_summary_documents(
    season: int | None = None,
    episode_id: str | None = None,
    collection_name: str | None = None,
) -> int:
    if _use_readonly_memory():
        return 0
    try:
        collection = get_collection(collection_name)
    except Exception:
        return 0
    try:
        results = collection.get(include=["metadatas"])
    except Exception:
        return 0
    ids = results.get("ids") or []
    metadatas = results.get("metadatas") or []
    if episode_id is not None:
        ids = [
            doc_id
            for doc_id, metadata in zip(ids, metadatas)
            if _is_interaction_arc_metadata(metadata) and str((metadata or {}).get("episode_id", "")) == episode_id
        ]
    elif season is not None:
        filtered_ids = []
        for doc_id, metadata in zip(ids, metadatas):
            if not _is_interaction_arc_metadata(metadata):
                continue
            source_episode = str((metadata or {}).get("episode_id", ""))
            match = re.match(r"s(\d{2})e\d{2}", source_episode, re.IGNORECASE)
            if match and int(match.group(1)) == season:
                filtered_ids.append(doc_id)
        ids = filtered_ids
    else:
        ids = [doc_id for doc_id, metadata in zip(ids, metadatas) if _is_interaction_arc_metadata(metadata)]
    if not ids:
        return 0
    collection.delete(ids=ids)
    return len(ids)


def count_arc_summary_documents_for_season(season: int, collection_name: str | None = None) -> int:
    counts = character_arc_counts_by_episode(collection_name)
    total = 0
    for episode_id, count in counts.items():
        match = re.match(r"s(\d{2})e\d{2}", episode_id, re.IGNORECASE)
        if match and int(match.group(1)) == season:
            total += count
    return total


def character_arc_counts_by_episode(collection_name: str | None = None) -> dict[str, int]:
    if _use_readonly_memory():
        return readonly_store.character_arc_counts_by_episode()
    try:
        collection = get_collection(collection_name)
    except Exception:
        return {}
    counts: dict[str, int] = {}
    for chunk_type in (CHARACTER_ARC_CHUNK_TYPE, LEGACY_CHARACTER_ARC_CHUNK_TYPE):
        try:
            results = collection.get(where={"chunk_type": chunk_type}, include=["metadatas"])
        except Exception:
            continue
        for metadata in results.get("metadatas") or []:
            episode_id = str((metadata or {}).get("episode_id", ""))
            if not episode_id:
                continue
            counts[episode_id] = counts.get(episode_id, 0) + 1
    return counts


def count_arc_summary_documents_for_episode(episode_id: str, collection_name: str | None = None) -> int:
    if _use_readonly_memory():
        return readonly_store.count_arc_summary_documents_for_episode(episode_id)
    return character_arc_counts_by_episode(collection_name).get(episode_id, 0)


def count_interaction_summary_documents_for_episode(episode_id: str, collection_name: str | None = None) -> int:
    if _use_readonly_memory():
        return readonly_store.count_interaction_summary_documents_for_episode(episode_id)
    try:
        collection = get_collection(collection_name)
    except Exception:
        return 0
    try:
        results = collection.get(include=["metadatas"])
    except Exception:
        return 0
    total = 0
    for metadata in results.get("metadatas") or []:
        if _is_interaction_arc_metadata(metadata) and str((metadata or {}).get("episode_id", "")) == episode_id:
            total += 1
    return total


def get_character_arc_summaries_before_episode(character: str, episode_id: str) -> list[dict]:
    if _use_readonly_memory():
        return readonly_store.get_character_arc_summaries_before_episode(character, episode_id)
    try:
        collection = get_collection()
    except Exception:
        return []
    try:
        results = collection.get(include=["documents", "metadatas"])
    except Exception:
        return []

    documents = results.get("documents") or []
    metadatas = results.get("metadatas") or []
    arc_summaries: list[dict] = []
    baseline = _episode_sort_key(episode_id)
    for document, metadata in zip(documents, metadatas):
        if not _is_character_arc_metadata(metadata):
            continue
        if _metadata_character(metadata) != character:
            continue
        source_episode = metadata.get("episode_id", "")
        if _episode_sort_key(source_episode) >= baseline:
            continue
        arc_summaries.append(
            {
                "episode_id": source_episode,
                "title": metadata.get("episode_title", source_episode),
                "summary": (document or "").strip(),
            }
        )
    arc_summaries.sort(key=lambda item: _episode_sort_key(item["episode_id"]))
    return arc_summaries


def get_interaction_summaries_before_episode(characters: list[str], episode_id: str) -> list[dict]:
    if _use_readonly_memory():
        return readonly_store.get_interaction_summaries_before_episode(characters, episode_id)
    normalized = sorted(dict.fromkeys(name.strip() for name in characters if name and name.strip()))
    if not normalized:
        return []
    try:
        collection = get_collection()
    except Exception:
        return []
    try:
        results = collection.get(include=["documents", "metadatas"])
    except Exception:
        return []

    baseline = _episode_sort_key(episode_id)
    documents = results.get("documents") or []
    metadatas = results.get("metadatas") or []
    selected = set(normalized)
    interactions: list[dict] = []
    for document, metadata in zip(documents, metadatas):
        if not _is_interaction_arc_metadata(metadata):
            continue
        source_episode = str((metadata or {}).get("episode_id", ""))
        if _episode_sort_key(source_episode) >= baseline:
            continue
        participants = _metadata_participants(metadata)
        participant_set = set(participants)
        if not selected.issubset(participant_set):
            continue
        interactions.append(
            {
                "episode_id": source_episode,
                "title": metadata.get("episode_title", source_episode),
                "participants": participants,
                "summary": (document or "").strip(),
            }
        )
    interactions.sort(key=lambda item: _episode_sort_key(item["episode_id"]))
    return interactions


def query_relevant_arc_summaries(
    character: str,
    episode_id: str,
    query_text: str,
    n_results: int = 5,
) -> list[dict]:
    if _use_readonly_memory():
        return readonly_store.query_relevant_arc_summaries(character, episode_id, query_text, n_results=n_results)
    try:
        collection = get_collection()
    except Exception:
        return get_character_arc_summaries_before_episode(character, episode_id)[-n_results:]
    try:
        results = collection.query(
            query_texts=[query_text or character],
            n_results=max(n_results * 3, n_results),
            where={"$and": [{"character": character}, {"chunk_type": CHARACTER_ARC_CHUNK_TYPE}]},
        )
    except Exception:
        try:
            results = collection.query(
                query_texts=[query_text or character],
                n_results=max(n_results * 3, n_results),
                where={"$and": [{"speaker": character}, {"chunk_type": LEGACY_CHARACTER_ARC_CHUNK_TYPE}]},
            )
        except Exception:
            return get_character_arc_summaries_before_episode(character, episode_id)[-n_results:]

    arc_summaries: list[dict] = []
    baseline = _episode_sort_key(episode_id)
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    for document, metadata in zip(documents, metadatas):
        source_episode = metadata.get("episode_id", "")
        if _episode_sort_key(source_episode) >= baseline:
            continue
        arc_summaries.append(
            {
                "episode_id": source_episode,
                "title": metadata.get("episode_title", source_episode),
                "summary": (document or "").strip(),
            }
        )
        if len(arc_summaries) >= n_results:
            break
    if arc_summaries:
        arc_summaries.sort(key=lambda item: _episode_sort_key(item["episode_id"]))
        return arc_summaries
    return get_character_arc_summaries_before_episode(character, episode_id)[-n_results:]


def query_character_memories(character: str, query_text: str, n_results: int = 5) -> list[dict]:
    """Get the most relevant past memories for a character given current scene context."""
    if _use_readonly_memory():
        return []
    collection = get_collection()
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where={"$and": [{"speaker": character}, {"chunk_type": "character"}]},
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


def _episode_sort_key(episode_id: str) -> tuple[int, int]:
    match = re.match(r"s(\d{2})e(\d{2})", episode_id or "", re.IGNORECASE)
    if not match:
        return (99, 99)
    return int(match.group(1)), int(match.group(2))


def query_character_memories_before_episode(
    character: str,
    query_text: str,
    episode_id: str,
    n_results: int = 5,
) -> list[dict]:
    if _use_readonly_memory():
        return []
    baseline = _episode_sort_key(episode_id)
    collection = get_collection()
    results = collection.query(
        query_texts=[query_text],
        n_results=max(n_results * 3, n_results),
        where={"$and": [{"speaker": character}, {"chunk_type": "character"}]},
    )
    memories = []
    for i, doc in enumerate(results.get("documents", [[]])[0]):
        meta = results["metadatas"][0][i]
        source_episode = meta.get("episode_id", "")
        if _episode_sort_key(source_episode) >= baseline:
            continue
        memories.append(
            {
                "episode_id": source_episode,
                "text": doc[:300],
                "emotions": meta.get("emotions", ""),
            }
        )
        if len(memories) >= n_results:
            break
    return memories


def query_scene_context(location: str, query_text: str, n_results: int = 3) -> list[dict]:
    """Get past scenes at this location for environmental context."""
    if _use_readonly_memory():
        return []
    collection = get_collection()
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where={"$and": [{"location": location}, {"chunk_type": "scene_window"}]},
    )
    return [
        {"episode_id": r["episode_id"], "text": d[:400]}
        for d, r in zip(results["documents"][0], results["metadatas"][0])
    ]
