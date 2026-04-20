#!/bin/bash
echo "🛑 Stopping FriendsOS local services..."
brew services stop redis 2>/dev/null && echo "✓ Redis stopped" || echo "Redis was not running"
pkill -f "ollama serve" 2>/dev/null && echo "✓ Ollama stopped" || echo "Ollama was not running"
echo "Done."
