from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import episodes, agents, stream, pivot
from llm.providers import active_providers

app = FastAPI(title="FriendsOS API", version="1.0.0")

# Allow all origins — required for ngrok tunnelling and local dev
app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(episodes.router, prefix="/api/episodes", tags=["episodes"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(stream.router, prefix="/api/stream", tags=["stream"])
app.include_router(pivot.router, prefix="/api/pivot", tags=["pivot"])

@app.get("/api/health")
def health():
    return {"status": "ok", **active_providers()}
