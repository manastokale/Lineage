import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import Layout from "../components/Layout"
import { fetchEpisodes, fetchSeasonState, generateEpisodeFromPrompt, selectSeason } from "../lib/api"
import { useStore } from "../store/useStore"

export default function EpisodeArchive() {
  const navigate = useNavigate()
  const { episodes, setEpisodes, setActiveEpisode, addEpisode } = useStore()
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([1])
  const [activeSeason, setActiveSeason] = useState(1)

  useEffect(() => {
    fetchSeasonState()
      .then((state) => {
        setAvailableSeasons(state.available_seasons)
        setActiveSeason(state.active_season)
      })
      .catch(console.error)
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<number, typeof episodes>()
    episodes.forEach((episode) => {
      const season = episode.season || 1
      map.set(season, [...(map.get(season) || []), episode])
    })
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [episodes])

  const handleSeasonSelect = async (season: number) => {
    const state = await selectSeason(season)
    setAvailableSeasons(state.available_seasons)
    setActiveSeason(state.active_season)
    const refreshed = await fetchEpisodes()
    setEpisodes(refreshed)
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    try {
      const episode = await generateEpisodeFromPrompt(prompt)
      addEpisode(episode)
      setPrompt("")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Layout title="Archive">
      <div className="space-y-8">
        <section className="flex flex-wrap gap-3">
          {availableSeasons.map((season) => (
            <button
              key={season}
              onClick={() => handleSeasonSelect(season).catch(console.error)}
              className={`border-2 px-4 py-2 font-black uppercase ${
                activeSeason === season ? "border-black bg-highlight" : "border-black bg-white"
              }`}
            >
              Season {season}
            </button>
          ))}
        </section>
        {grouped.map(([season, seasonEpisodes]) => (
          <section key={season} className="space-y-4">
            <div className="font-headline text-3xl">Season {season}</div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {seasonEpisodes.map((episode) => (
                <button
                  key={episode.episode_id}
                  onClick={() => {
                    setActiveEpisode(episode.episode_id)
                    navigate("/")
                  }}
                  className="border-4 border-black bg-white p-5 text-left shadow-hard-sm"
                >
                  <div className="font-black uppercase text-accent">{episode.episode_id.toUpperCase()}</div>
                  <div className="mt-2 font-headline text-2xl">{episode.title}</div>
                  <div className="mt-3 text-sm font-bold text-black/60">{episode.scene_count} scenes</div>
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="border-4 border-black bg-white p-6 shadow-hard-sm">
          <div className="font-headline text-3xl">Generate Script</div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            className="mt-4 w-full border-2 border-black bg-cream p-3 font-bold"
            placeholder="Write a short premise for a lightweight draft."
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="mt-4 border-2 border-black bg-black px-5 py-3 font-black uppercase text-white disabled:opacity-50"
          >
            {isGenerating ? "Generating…" : "Generate"}
          </button>
        </section>
      </div>
    </Layout>
  )
}
