"""
CLI entry point for ingestion.
Usage: python -m ingestion.run_ingest --scripts-dir ../episode_scripts
"""
import argparse
from pathlib import Path
from ingestion.parser import parse_all
from ingestion.chunker import chunk_all
import json
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scripts-dir", required=True)
    parser.add_argument("--season", default=None, help="Filter by season, e.g. 1")
    parser.add_argument("--collection", default=os.getenv("CHROMA_COLLECTION_NAME", "friendsos_memory"))
    parser.add_argument("--output-json", default=None, help="Optional: save parsed JSON")
    args = parser.parse_args()

    scripts_dir = Path(args.scripts_dir)
    assert scripts_dir.exists(), f"Directory not found: {scripts_dir}"

    print(f"Parsing scripts from: {scripts_dir}")
    episodes = parse_all(scripts_dir)

    if args.season:
        prefix = f"s{int(args.season):02d}"
        episodes = [e for e in episodes if e["episode_id"].startswith(prefix)]
        print(f"Filtered to season {args.season}: {len(episodes)} episodes")

    if args.output_json:
        with open(args.output_json, "w") as f:
            json.dump(episodes, f, indent=2)
        print(f"Saved parsed JSON to {args.output_json}")

    print(f"\nStoring {len(episodes)} episodes to ChromaDB...")
    chunk_all(episodes, args.collection)
    print("Ingestion complete.")

if __name__ == "__main__":
    main()
