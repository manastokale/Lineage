import { useEffect, useMemo, useState } from "react"

import Layout from "../components/Layout"
import { fetchBootstrapStatus, fetchHealth } from "../lib/api"
import { useStore } from "../store/useStore"
import type { BootstrapStatus, HealthSnapshot } from "../types"

const INITIAL_BOOTSTRAP_STATE: BootstrapStatus = {
  bootstrapped: false,
  dummy_mode: false,
  status: "idle",
  selected_episode_id: null,
  selected_episode_ready: false,
  selected_episode_progress_percent: 0,
  selected_episode_message: "Waiting to prepare current episode",
  current_stage: "waiting",
  message: "Waiting to start",
  progress_percent: 0,
  completed_steps: 0,
  total_steps: 0,
  episode_count: 0,
  current_episode: null,
  current_character: null,
  stored_chunks: 0,
  arc_summaries_total: 0,
  arc_summaries_done: 0,
  arc_summaries_stored: 0,
  eta_seconds: null,
  error: null,
}

export default function LoadingDashboard() {
  const { episodes } = useStore()
  const [bootstrap, setBootstrap] = useState<BootstrapStatus>(INITIAL_BOOTSTRAP_STATE)
  const [health, setHealth] = useState<HealthSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [nextHealth, nextBootstrap] = await Promise.all([fetchHealth(), fetchBootstrapStatus()])
        if (cancelled) return
        setHealth(nextHealth)
        setBootstrap(nextBootstrap)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load startup progress.")
      }
    }

    void load()
    const interval = window.setInterval(load, 3000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const dataKinds = useMemo(
    () => [
      {
        label: "Selected Episode Prep",
        value: bootstrap.selected_episode_ready ? "Ready" : bootstrap.selected_episode_id?.toUpperCase() || "Waiting",
        detail: bootstrap.selected_episode_message || "Current episode dependencies are prepared first for immediate use.",
        progress: bootstrap.selected_episode_progress_percent || 0,
      },
      {
        label: "Backend Connection",
        value: health ? "Connected" : error ? "Unavailable" : "Connecting",
        detail: health ? `Status: ${health.status}` : "Waiting for backend health response.",
        progress: health ? 100 : 10,
      },
      {
        label: "Episode Index",
        value: `${episodes.length || 0} loaded`,
        detail:
          bootstrap.episode_count > 0
            ? `${episodes.length}/${bootstrap.episode_count} episodes available to the frontend shell`
            : "Episode list is loading in the background.",
        progress:
          bootstrap.episode_count > 0
            ? Math.min(100, Math.round((episodes.length / Math.max(bootstrap.episode_count, 1)) * 100))
            : episodes.length
              ? 100
              : 5,
      },
      {
        label: "Prior Character Arcs",
        value: `${bootstrap.arc_summaries_done || 0} ready`,
        detail:
          (bootstrap.arc_summaries_total || 0) > 0
            ? `${bootstrap.arc_summaries_done || 0}/${bootstrap.arc_summaries_total || 0} summaries generated${bootstrap.arc_summaries_stored ? ` · ${bootstrap.arc_summaries_stored} stored in Chroma` : ""}`
            : "Prior arc summaries are being prepared for instant reuse later.",
        progress:
          (bootstrap.arc_summaries_total || 0) > 0
            ? Math.min(100, Math.round(((bootstrap.arc_summaries_done || 0) / Math.max(bootstrap.arc_summaries_total || 1, 1)) * 100))
            : bootstrap.current_stage === "generating_arc_summaries"
              ? Math.max(12, bootstrap.progress_percent || 0)
              : bootstrap.bootstrapped
                ? 100
                : 0,
      },
      {
        label: "Metadata Bootstrap",
        value: bootstrap.current_stage || "waiting",
        detail: bootstrap.message || "Preparing parsed metadata and retrieval state.",
        progress: bootstrap.progress_percent || 0,
      },
    ],
    [bootstrap, episodes.length, health, error],
  )

  const overallProgress = Math.max(
    bootstrap.progress_percent || 0,
    health ? 20 : 0,
    episodes.length ? 25 : 0,
  )

  return (
    <Layout title="Loading Progress">
      <div className="space-y-6">
        <section className="border-4 border-black bg-white p-6 shadow-hard-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-headline text-4xl">Loading Episodes And Metadata</div>
              <div className="mt-2 text-sm font-black uppercase tracking-[0.18em] text-black/60">
                Track what is loaded, what is still running, and how long the rest should take.
              </div>
            </div>
            <div className="border-2 border-black bg-black px-4 py-3 text-white">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">ETA</div>
              <div className="mt-1 text-lg font-black">
                {bootstrap.bootstrapped ? "Ready" : `${Math.max(1, bootstrap.eta_seconds ?? 1)} sec`}
              </div>
            </div>
          </div>
          <div className="mt-5 h-6 border-2 border-black bg-cream">
            <div className="h-full bg-highlight transition-all" style={{ width: `${Math.max(8, overallProgress)}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.18em] text-black/60">
            <span>{bootstrap.completed_steps}/{bootstrap.total_steps || 1} background steps complete</span>
            <span>
              {bootstrap.current_character
                ? `${bootstrap.current_character} · ${bootstrap.current_episode?.toUpperCase() || "loading"}`
                : bootstrap.current_episode
                  ? `Current episode: ${bootstrap.current_episode.toUpperCase()}`
                  : "Waiting for next indexing step"}
            </span>
          </div>
          {error ? <div className="mt-4 border-2 border-red-600 bg-red-50 px-4 py-3 font-bold text-red-700">{error}</div> : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {dataKinds.map((item) => (
            <div key={item.label} className="border-4 border-black bg-white p-5 shadow-hard-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-black/60">{item.label}</div>
              <div className="mt-2 text-2xl font-black uppercase">{item.value}</div>
                </div>
                <div className="text-sm font-black uppercase text-black/55">{item.progress}%</div>
              </div>
              <div className="mt-4 h-4 border-2 border-black bg-cream">
                <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(6, item.progress)}%` }} />
              </div>
              <div className="mt-3 text-sm font-bold text-black/70">{item.detail}</div>
            </div>
          ))}
        </section>

        <section className="border-4 border-black bg-white p-6 shadow-hard-sm">
          <div className="font-black uppercase tracking-[0.2em]">Runtime Details</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="border-2 border-black bg-cream p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Bootstrap Status</div>
              <div className="mt-2 text-lg font-black uppercase">{bootstrap.status}</div>
            </div>
            <div className="border-2 border-black bg-cream p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Current Stage</div>
              <div className="mt-2 text-lg font-black uppercase">{bootstrap.current_stage || "waiting"}</div>
            </div>
            <div className="border-2 border-black bg-cream p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Summary Model</div>
              <div className="mt-2 text-lg font-black">{health?.summary_model || "Loading..."}</div>
            </div>
            <div className="border-2 border-black bg-cream p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Branch Scene Model</div>
              <div className="mt-2 text-lg font-black">{health?.branch_scene_model || "Loading..."}</div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}
