import { useEffect, useState } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Analytics } from "@vercel/analytics/react"

import { fetchEpisodes } from "./lib/api"
import CastRoster from "./pages/CastRoster"
import CentralHub from "./pages/CentralHub"
import UsageDashboard from "./pages/UsageDashboard"
import { useStore } from "./store/useStore"

function AppShellMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6 text-ink">
      <div className="w-full max-w-xl border-4 border-black bg-white p-8 shadow-hard">
        <div className="font-headline text-4xl">{title}</div>
        <div className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-black/60">{detail}</div>
      </div>
    </div>
  )
}

export default function App() {
  const { episodes, activeEpisodeId, activeSeason, setEpisodes, setActiveEpisode } = useStore()
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadEpisodes() {
      try {
        const nextEpisodes = await fetchEpisodes()
        if (cancelled) return
        setEpisodes(nextEpisodes)
        if (!activeEpisodeId) {
          setActiveEpisode(
            nextEpisodes.find((episode) => (episode.season || 0) === activeSeason)?.episode_id || nextEpisodes[0]?.episode_id || null,
          )
        }
        setStatus("ready")
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setStatus("error")
          setErrorMessage(error instanceof Error ? error.message : "Failed to load episodes.")
        }
      }
    }

    void loadEpisodes()
    return () => {
      cancelled = true
    }
  }, [activeEpisodeId, activeSeason, setActiveEpisode, setEpisodes])

  if (status === "loading" && episodes.length === 0) {
    return <AppShellMessage title="Lineage" detail="Loading episode library…" />
  }

  if (status === "error" && episodes.length === 0) {
    return <AppShellMessage title="Lineage" detail={errorMessage || "The backend did not respond."} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CentralHub />} />
        <Route path="/graph" element={<CastRoster />} />
        <Route path="/usage" element={<UsageDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  )
}
