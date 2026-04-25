import { useEffect, useRef, useState } from "react"

import Layout from "../components/Layout"
import { fetchStatsOverview } from "../lib/api"
import type { StatsOverview } from "../types"

function StatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" }) {
  const toneClass =
    tone === "good" ? "bg-[#dcfce7]" : tone === "bad" ? "bg-[#fee2e2]" : "bg-white"
  return (
    <div className={`border-2 border-black p-4 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">{label}</div>
      <div className="mt-2 text-lg font-black uppercase">{value}</div>
    </div>
  )
}

function UsageBar({
  label,
  value,
  limit,
  color,
}: {
  label: string
  value: number
  limit: number
  color: string
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
        <span>{label}</span>
        <span>
          {value}/{limit}
        </span>
      </div>
      <div className="mt-1 h-3 border border-black bg-white">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export default function UsageDashboard() {
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [lastUpdated, setLastUpdated] = useState("")
  const [refreshIn, setRefreshIn] = useState(3)
  const [loadError, setLoadError] = useState("")
  const loadingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (loadingRef.current) return
      loadingRef.current = true
      try {
        const next = await fetchStatsOverview()
        if (cancelled) return
        setOverview(next)
        setLastUpdated(new Date().toLocaleTimeString())
        setLoadError("")
        setRefreshIn(3)
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load stats.")
        }
      } finally {
        loadingRef.current = false
      }
    }
    void load()
    const timer = window.setInterval(() => {
      if (document.hidden) return
      setRefreshIn((current) => {
        if (current <= 1) {
          void load()
          return 3
        }
        return current - 1
      })
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <Layout
      headerContent={
        <div>
          <div className="font-headline text-4xl leading-none md:text-5xl">Usage</div>
          <div className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-black/65">
            Health Dashboard {lastUpdated ? `· Refreshed ${lastUpdated}` : ""} · Next refresh in {refreshIn}s
          </div>
        </div>
      }
    >
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="grid min-h-0 grid-rows-[auto_1fr] border-4 border-black bg-white shadow-hard-sm">
          <div className="border-b-4 border-black bg-accent px-4 py-3">
            <div className="font-black uppercase tracking-[0.18em]">System Health</div>
          </div>
          <div className="min-h-0 overflow-y-auto p-4">
            {loadError ? (
              <div className="mb-4 border-2 border-black bg-[#fee2e2] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Stats Fetch Error</div>
                <div className="mt-2 text-sm font-bold text-black">{loadError}</div>
              </div>
            ) : null}

            <div className="mb-4 border-2 border-black bg-cream p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">About Lineage</div>
              <div className="mt-2 text-sm font-bold leading-6 text-black/80">
                Lineage is a screenplay intelligence workspace for exploring episode transcripts, querying characters from an exact point in time, and tracking canon-safe character memory across episodes.
              </div>
              <div className="mt-3 text-sm font-bold leading-6 text-black/75">
                It solves a real continuity problem: writers, analysts, and fans can inspect what a character actually knows at a given moment instead of relying on vague recap memory or spoiler-prone summaries.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <StatCard label="API Status" value={overview?.status?.toUpperCase() || "LOADING"} tone={overview?.status === "ok" ? "good" : "default"} />
              <StatCard
                label={overview?.chroma.mode === "readonly_json" ? "Memory Store" : "ChromaDB"}
                value={overview?.chroma.connected ? "CONNECTED" : "DISCONNECTED"}
                tone={overview ? (overview.chroma.connected ? "good" : "bad") : "default"}
              />
              <StatCard label="Mode" value={overview?.chroma.mode?.toUpperCase() || "—"} />
              <StatCard label="Episodes Loaded" value={String(overview?.library.episodes_loaded || 0)} />
              <StatCard label="Seasons Loaded" value={String(overview?.library.seasons_loaded || 0)} />
              <StatCard label="Dummy Mode" value={overview?.dummy_mode ? "ON" : "OFF"} tone={overview?.dummy_mode ? "bad" : "good"} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="border-2 border-black bg-cream p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Collections</div>
                <div className="mt-3 space-y-3">
                  <div className="border border-black bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">{overview?.chroma.memory_collection.name || "memory"}</div>
                    <div className="mt-1 text-base font-black">{overview?.chroma.memory_collection.count || 0} docs</div>
                  </div>
                  <div className="border border-black bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">{overview?.chroma.main_script_collection.name || "main_script"}</div>
                    <div className="mt-1 text-base font-black">{overview?.chroma.main_script_collection.count || 0} docs</div>
                  </div>
                </div>
              </div>

              <div className="border-2 border-black bg-cream p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Providers</div>
                <div className="mt-3 space-y-3">
                  <div className="border border-black bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">Dialogue</div>
                    <div className="mt-1 text-sm font-black">{overview?.dialogue_provider || "—"} · {overview?.dialogue_model || "—"}</div>
                  </div>
                  <div className="border border-black bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">Summaries</div>
                    <div className="mt-1 text-sm font-black">{overview?.summary_model || "—"}</div>
                    <div className="mt-1 text-sm font-black">{overview?.arc_summary_model || "—"}</div>
                  </div>
                  <div className="border border-black bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">Ask</div>
                    <div className="mt-1 text-sm font-black">{overview?.ask_model || "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            {overview?.debug?.rerank_enabled ? (
              <div className="mt-4 border-2 border-black bg-cream p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Ask Retrieval Debug</div>
                  <div className="border border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                    Dev Only
                  </div>
                </div>
                <div className="mt-3 space-y-4">
                  {(overview.debug.recent_rerank_traces || []).length ? (
                    overview.debug.recent_rerank_traces.map((trace, index) => (
                      <div key={`${trace.recorded_at}-${trace.character}-${index}`} className="border border-black bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-black uppercase">
                            {trace.character} · {trace.episode_id.toUpperCase()}
                          </div>
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                            {new Date(trace.recorded_at * 1000).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="mt-2 text-xs font-bold leading-5 text-black/80">
                          <span className="font-black uppercase text-black/55">Question:</span> {trace.question}
                        </div>
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">Reranked Character Arcs</div>
                            <div className="mt-2 space-y-2">
                              {trace.arc_candidates.length ? (
                                trace.arc_candidates.map((candidate, candidateIndex) => (
                                  <div key={`${trace.recorded_at}-arc-${candidate.episode_id}-${candidateIndex}`} className="border border-black/20 bg-cream px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-black/60">
                                      <span>{candidate.episode_id.toUpperCase()}</span>
                                      <span>Score {candidate.score.toFixed(3)}</span>
                                    </div>
                                    <div className="mt-1 text-xs font-black">{candidate.title}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs font-bold text-black/55">No arc candidates recorded.</div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">Reranked Interactions</div>
                            <div className="mt-2 space-y-2">
                              {trace.interaction_candidates.length ? (
                                trace.interaction_candidates.map((candidate, candidateIndex) => (
                                  <div key={`${trace.recorded_at}-interaction-${candidate.episode_id}-${candidateIndex}`} className="border border-black/20 bg-cream px-3 py-2">
                                    <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-black/60">
                                      <span>{candidate.episode_id.toUpperCase()}</span>
                                      <span>Score {candidate.score.toFixed(3)}</span>
                                    </div>
                                    <div className="mt-1 text-xs font-black">{candidate.title}</div>
                                    {candidate.participants?.length ? (
                                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-black/55">
                                        {candidate.participants.join(" / ")}
                                      </div>
                                    ) : null}
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs font-bold text-black/55">No interaction candidates recorded.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm font-bold text-black/65">
                      No Ask rerank traces have been recorded in this backend session yet. Ask a character to inspect which chunks were chosen.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid min-h-0 grid-rows-[auto_auto_1fr] border-4 border-black bg-white shadow-hard-sm">
          <div className="border-b-4 border-black bg-[#f8d58a] px-4 py-3">
            <div className="font-black uppercase tracking-[0.18em]">Live Model Usage</div>
          </div>
          <div className="border-b-2 border-black bg-white p-4">
            <div className="grid gap-3">
              {(overview?.usage.models || []).length ? (
                (overview?.usage.models || []).map((model) => {
                  const totals = overview?.usage.totals[model] || {}
                  const windows = overview?.usage.window_totals[model] || {}
                  const limits = overview?.usage.limits[model] || {}
                  const rpm = windows.requests_per_minute || 0
                  const tpm = windows.tokens_per_minute || 0
                  const rpd = windows.requests_per_day || 0
                  return (
                    <div key={model} className="border-2 border-black bg-cream p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black uppercase">{model}</div>
                          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                            Total {totals.requests || 0} req · {totals.tokens || 0} tok · {rpd} req/day
                          </div>
                        </div>
                        <div className="border border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                          Live
                        </div>
                      </div>
                      <div className="mt-3 space-y-3">
                        <UsageBar label="Requests / Min" value={rpm} limit={limits.rpm || 1} color="#f59e0b" />
                        <UsageBar label="Tokens / Min" value={tpm} limit={limits.tpm || 1} color="#2563eb" />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="border-2 border-black bg-cream p-4 text-sm font-bold text-black/70">
                  No model traffic has been recorded in this backend session yet. Ask a character or load summaries to populate live usage.
                </div>
              )}
            </div>
          </div>
          <div className="border-b-4 border-black bg-primary px-4 py-3">
            <div className="font-black uppercase tracking-[0.18em]">Season Coverage</div>
          </div>
          <div className="min-h-0 overflow-y-auto p-4">
            <div className="space-y-3">
              {(overview?.seasons || []).map((season) => {
                const transcriptPct = season.expected_episodes ? Math.round((season.parsed_episodes / season.expected_episodes) * 100) : 0
                const arcPct = season.expected_arcs ? Math.round((season.covered_arcs / season.expected_arcs) * 100) : 0
                return (
                  <div key={season.season} className="border-2 border-black bg-cream p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black uppercase">Season {String(season.season).padStart(2, "0")}</div>
                      <div className={`border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${season.arc_ready ? "bg-[#dcfce7]" : "bg-[#fef3c7]"}`}>
                        {season.arc_ready ? "Arcs Ready" : "Arcs Pending"}
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                          <span>Transcripts</span>
                          <span>{season.parsed_episodes}/{season.expected_episodes}</span>
                        </div>
                        <div className="mt-1 h-3 border border-black bg-white">
                          <div className="h-full bg-[#1d4ed8]" style={{ width: `${transcriptPct}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                          <span>Character Arcs</span>
                          <span>{season.covered_arcs}/{season.expected_arcs}</span>
                        </div>
                        <div className="mt-1 h-3 border border-black bg-white">
                          <div className="h-full bg-[#111827]" style={{ width: `${arcPct}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black/60">
                        <div>Stored: {season.stored_arcs}</div>
                        <div>Overflow: {season.overflow_arcs}</div>
                        <div>Covered Episodes: {season.fully_covered_episodes}</div>
                        <div>Transcript Ready: {season.transcript_ready ? "Yes" : "No"}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  )
}
