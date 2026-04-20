import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { useStore } from "./store/useStore"
import { fetchAgents, fetchEpisodes, fetchHealth } from "./lib/api"
import CentralHub from "./pages/CentralHub"
import EpisodeView from "./pages/EpisodeView"
import EpisodeArchive from "./pages/EpisodeArchive"
import CastRoster from "./pages/CastRoster"
import AgentProfile from "./pages/AgentProfile"
import PivotPanel from "./pages/PivotPanel"

function App() {
  const { setAgents, setEpisodes } = useStore()
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [apiInfo, setApiInfo] = useState("")

  useEffect(() => {
    async function init() {
      try {
        const health = await fetchHealth()
        const [agents, episodes] = await Promise.all([fetchAgents(), fetchEpisodes()])
        setAgents(agents)
        setEpisodes(episodes)
        setApiInfo(
          health.dummy_mode
            ? "Dummy Mode"
            : `Live · ${health.dialogue_provider}`
        )
        setStatus("ok")
      } catch (err) {
        console.error("Failed to connect to backend:", err)
        setApiInfo(
          `Cannot reach backend at ${import.meta.env.VITE_API_URL || "http://localhost:8000"}`
        )
        setStatus("error")
      }
    }
    init()
  }, [setAgents, setEpisodes])

  if (status === "loading") {
    return (
      <div className="bg-cream min-h-screen flex items-center justify-center">
        <div className="neo-card p-12 text-center">
          <div className="flex gap-2 justify-center mb-6">
            <div className="w-4 h-4 bg-black animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-4 h-4 bg-black animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-4 h-4 bg-black animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <h1 className="font-headline text-4xl text-ink mb-2">Connecting...</h1>
          <p className="font-bold text-black/60">Reaching the backend</p>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="bg-cream min-h-screen flex items-center justify-center p-4">
        <div className="neo-card p-12 text-center max-w-lg">
          <span className="material-symbols-outlined text-6xl text-sitcom-muted mb-4">cloud_off</span>
          <h1 className="font-headline text-4xl text-ink mb-4">No Backend</h1>
          <p className="font-bold text-black/70 mb-6">{apiInfo}</p>
          <div className="bg-cream border-2 border-black p-4 text-left">
            <p className="font-black text-sm uppercase mb-2">Start the backend:</p>
            <pre className="text-xs font-mono bg-white p-3 border-2 border-black overflow-x-auto">
{`# Local (dummy mode):
cd backend && source .venv/bin/activate
uvicorn main:app --port 8000

# Or connect to Colab:
# Set VITE_API_URL in frontend/.env`}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 bg-black text-white px-8 py-3 font-black uppercase border-2 border-black shadow-hard-sm hover:bg-highlight hover:text-black transition-colors btn-press"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CentralHub apiInfo={apiInfo} />} />
        <Route path="/episode/:id" element={<EpisodeView />} />
        <Route path="/archive" element={<EpisodeArchive />} />
        <Route path="/cast" element={<CastRoster />} />
        <Route path="/agent/:name" element={<AgentProfile />} />
        <Route path="/pivot" element={<PivotPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
