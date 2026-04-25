# Vercel Deployment

This repo is set up so Vercel can deploy:

- the frontend from `frontend/`
- the FastAPI backend from `api/`
- read-only transcript and memory data from the repo itself

## Runtime shape

Vercel runs this app in a serverless/read-only mode:

- episode transcript data is served from `episode_scripts/season*_parsed.json`
- prior character arcs and interactions are served from `memory_data/*.json`
- local Chroma persistence is **not** used in production on Vercel

If you regenerate arcs locally, run this before pushing:

```bash
./.venv311/bin/python scripts/export_memory_store.py
```

## Required Vercel env vars

- `GEMINI_API_KEY`

Optional:

- `APP_ENV=production`
- `LINEAGE_MEMORY_BACKEND=readonly_json`
- `DIALOGUE_PROVIDER=gemini`
- `SUMMARY_PROVIDER=gemini`
- `ARC_SUMMARY_PROVIDER=gemini`
- `ASK_PROVIDER=gemini`

`LINEAGE_MEMORY_BACKEND` already defaults to `readonly_json` on Vercel.

## Notes

- The app is deployed as a single-origin frontend + API setup, so `VITE_API_URL` is not required on Vercel.
- Device-local UI/session state is kept in browser `localStorage`.
- Ask thread continuity is sent from the client with each request, so it still works under serverless instances.
- Python is pinned via `.python-version` so Vercel uses a deterministic runtime during deploys.
