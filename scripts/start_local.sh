#!/bin/bash
set -e

echo "🎬 Starting FriendsOS local services..."

# ── Redis ──────────────────────────────────────────────────────────────────────
if brew services list | grep -q "redis.*started"; then
  echo "✓ Redis already running"
else
  echo "▶ Starting Redis..."
  brew services start redis
  sleep 1
fi

# ── Ollama ─────────────────────────────────────────────────────────────────────
if pgrep -x "ollama" > /dev/null; then
  echo "✓ Ollama already running"
else
  echo "▶ Starting Ollama..."
  ollama serve &
  sleep 3
fi

# ── Verify model is available ──────────────────────────────────────────────────
MODEL=${OLLAMA_DIALOGUE_MODEL:-llama3.1:8b}
if ! ollama list | grep -q "$MODEL"; then
  echo "⬇ Pulling model: $MODEL"
  ollama pull "$MODEL"
fi

echo ""
echo "✅ Local services ready."
echo "   Redis:  redis://localhost:6379"
echo "   Ollama: http://localhost:11434"
echo "   ChromaDB: embedded (./chroma_data)"
echo ""
echo "Next steps:"
echo "  Backend:  cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
echo "  Frontend: cd frontend && npm run dev"
