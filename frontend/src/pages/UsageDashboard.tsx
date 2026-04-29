import { useEffect, useMemo, useRef, useState } from "react"

import Layout from "../components/Layout"
import { fetchStatsOverview } from "../lib/api"
import type { StatsOverview } from "../types"

type UsageCounter = { requests?: number; tokens?: number }
type BreakdownRow = { key: string; label: string; requests: number; tokens: number }

const ROLE_LABELS: Record<string, string> = {
  dialogue: "Dialogue",
  summary: "Summaries",
  arc_summary: "Arc summaries",
  ask: "Ask role",
}

const FEATURE_LABELS: Record<string, string> = {
  ask: "Ask",
  ask_guardrail_retry: "Ask guardrail retries",
  edit_impact: "Edit impact",
  continuity_claim_extraction: "Continuity claim scans",
  continuity_validation: "Continuity validation",
  annotated_script_generation: "Annotated scripts",
  character_arc_generation: "Character arcs",
  prior_memory_generation: "Prior memories",
}

const BREAKDOWN_COLORS = ["#f59e0b", "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#0891b2", "#111827", "#db2777"]

function formatNumber(value?: number) {
  return new Intl.NumberFormat().format(Math.round(value || 0))
}

function labelize(key: string, labels: Record<string, string>) {
  if (labels[key]) return labels[key]
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function rowsFromBreakdown(
  breakdown: Record<string, Record<string, UsageCounter>> | undefined,
  labels: Record<string, string>,
  model?: string,
): BreakdownRow[] {
  const totals = new Map<string, { requests: number; tokens: number }>()
  const source = model ? { [model]: breakdown?.[model] || {} } : breakdown || {}
  Object.values(source).forEach((byKey) => {
    Object.entries(byKey || {}).forEach(([key, counters]) => {
      const current = totals.get(key) || { requests: 0, tokens: 0 }
      current.requests += counters.requests || 0
      current.tokens += counters.tokens || 0
      totals.set(key, current)
    })
  })
  return Array.from(totals.entries())
    .map(([key, counters]) => ({
      key,
      label: labelize(key, labels),
      requests: counters.requests,
      tokens: counters.tokens,
    }))
    .filter((row) => row.requests > 0 || row.tokens > 0)
    .sort((left, right) => right.requests - left.requests || right.tokens - left.tokens || left.label.localeCompare(right.label))
}

function sumRows(rows: BreakdownRow[], key: "requests" | "tokens") {
  return rows.reduce((sum, row) => sum + row[key], 0)
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined
}

function providerConfigured(provider: string | undefined, overview: StatsOverview | null) {
  const normalized = provider?.toLowerCase()
  if (!normalized || !overview) return undefined
  if (normalized === "gemini") return Boolean(overview.gemini_configured)
  if (normalized === "groq") return Boolean(overview.groq_configured)
  return true
}

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

function CompactMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border-2 border-black bg-white p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
      {detail ? <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/45">{detail}</div> : null}
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
  limit?: number
  color: string
}) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
        <span>{label}</span>
        <span>{limit && limit > 0 ? `${formatNumber(value)}/${formatNumber(limit)}` : formatNumber(value)}</span>
      </div>
      <div className="mt-1 h-3 border border-black bg-white">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function BreakdownList({
  title,
  rows,
  totalRequests,
  totalTokens,
  emptyText,
}: {
  title: string
  rows: BreakdownRow[]
  totalRequests: number
  totalTokens: number
  emptyText: string
}) {
  return (
    <div className="border-2 border-black bg-cream p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">{title}</div>
      <div className="mt-3 space-y-3">
        {rows.length ? (
          rows.map((row, index) => {
            const requestPct = totalRequests > 0 ? Math.round((row.requests / totalRequests) * 100) : 0
            const tokenPct = totalTokens > 0 ? Math.round((row.tokens / totalTokens) * 100) : 0
            return (
              <div key={row.key}>
                <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-black/60">
                  <span>{row.label}</span>
                  <span>{requestPct}% req · {tokenPct}% tok</span>
                </div>
                <div className="mt-1 h-3 border border-black bg-white">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${requestPct}%`, backgroundColor: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length] }}
                  />
                </div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/45">
                  {formatNumber(row.requests)} requests · {formatNumber(row.tokens)} tokens
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-sm font-bold text-black/65">{emptyText}</div>
        )}
      </div>
    </div>
  )
}

function ProviderRoute({
  title,
  provider,
  model,
  purpose,
  configured,
}: {
  title: string
  provider?: string
  model?: string
  purpose: string
  configured?: boolean
}) {
  const statusClass = configured === false ? "bg-[#fee2e2]" : configured === true ? "bg-[#dcfce7]" : "bg-white"
  const statusText = configured === false ? "Key missing" : configured === true ? "Configured" : "Unknown"
  return (
    <div className="border border-black bg-white p-3 text-black">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">{title}</div>
          <div className="mt-1 text-sm font-black">{provider || "—"} · {model || "—"}</div>
        </div>
        <div className={`border border-black px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass}`}>
          {statusText}
        </div>
      </div>
      <div className="mt-2 text-xs font-bold leading-5 text-black/65">{purpose}</div>
    </div>
  )
}

function ModelUsageCard({ model, overview }: { model: string; overview: StatsOverview }) {
  const totals = overview.usage.totals[model] || {}
  const windows = overview.usage.window_totals[model] || {}
  const limits = overview.usage.limits[model] || {}
  const roleRows = rowsFromBreakdown(overview.usage.role_breakdown, ROLE_LABELS, model)
  const featureRows = rowsFromBreakdown(overview.usage.feature_breakdown, FEATURE_LABELS, model)
  const totalRequests = totals.requests || sumRows(roleRows, "requests")
  const totalTokens = totals.tokens || sumRows(roleRows, "tokens")
  const rpm = windows.requests_per_minute || 0
  const tpm = windows.tokens_per_minute || 0
  const rpd = windows.requests_per_day || 0

  return (
    <div className="border-2 border-black bg-white p-4 shadow-hard-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black uppercase">{model}</div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
            {formatNumber(totalRequests)} lifetime requests · {formatNumber(totalTokens)} tokens
          </div>
        </div>
        <div className="border border-black bg-cream px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
          {formatNumber(rpd)} RPD
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <CompactMetric label="RPM" value={formatNumber(rpm)} detail={`limit ${formatNumber(limits.rpm || 0)}`} />
        <CompactMetric label="TPM" value={formatNumber(tpm)} detail={`limit ${formatNumber(limits.tpm || 0)}`} />
        <CompactMetric label="RPD" value={formatNumber(rpd)} detail="rolling 24h" />
      </div>

      <div className="mt-4 space-y-3">
        <UsageBar label="Requests / Min" value={rpm} limit={limits.rpm || 0} color="#f59e0b" />
        <UsageBar label="Tokens / Min" value={tpm} limit={limits.tpm || 0} color="#2563eb" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <BreakdownList
          title="Feature Spread"
          rows={featureRows}
          totalRequests={totalRequests}
          totalTokens={totalTokens}
          emptyText="No feature-tagged model traffic yet."
        />
        <BreakdownList
          title="Role Spread"
          rows={roleRows}
          totalRequests={totalRequests}
          totalTokens={totalTokens}
          emptyText="No role traffic yet."
        />
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

  const activeRoles = overview?.usage.active_roles || {}
  const dialogueProvider = overview?.dialogue_provider || stringValue(activeRoles.dialogue_provider)
  const summaryProvider = overview?.summary_provider || stringValue(activeRoles.summary_provider)
  const arcSummaryProvider = overview?.arc_summary_provider || stringValue(activeRoles.arc_summary_provider)
  const askProvider = overview?.ask_provider || stringValue(activeRoles.ask_provider)
  const dialogueModel = overview?.dialogue_model || stringValue(activeRoles.dialogue_model)
  const summaryModel = overview?.summary_model || stringValue(activeRoles.summary_model)
  const arcSummaryModel = overview?.arc_summary_model || stringValue(activeRoles.arc_summary_model)
  const askModel = overview?.ask_model || stringValue(activeRoles.ask_model)
  const featureRows = useMemo(() => rowsFromBreakdown(overview?.usage.feature_breakdown, FEATURE_LABELS), [overview])
  const roleRows = useMemo(() => rowsFromBreakdown(overview?.usage.role_breakdown, ROLE_LABELS), [overview])
  const totalRequests = useMemo(
    () => Object.values(overview?.usage.totals || {}).reduce((sum, counters) => sum + (counters.requests || 0), 0),
    [overview],
  )
  const totalTokens = useMemo(
    () => Object.values(overview?.usage.totals || {}).reduce((sum, counters) => sum + (counters.tokens || 0), 0),
    [overview],
  )
  const totalRpd = useMemo(
    () => Object.values(overview?.usage.window_totals || {}).reduce((sum, counters) => sum + (counters.requests_per_day || 0), 0),
    [overview],
  )

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
      <div className="grid h-full min-h-0 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)] lg:overflow-hidden">
        <section className="grid h-full min-h-[30rem] min-h-0 grid-rows-[auto_1fr] border-4 border-black bg-white shadow-hard-sm lg:min-h-0">
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

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="API Status" value={overview?.status?.toUpperCase() || "LOADING"} tone={overview?.status === "ok" ? "good" : "default"} />
              <StatCard
                label={overview?.chroma.mode === "readonly_json" ? "Memory Store" : "ChromaDB"}
                value={overview?.chroma.connected ? "CONNECTED" : "DISCONNECTED"}
                tone={overview ? (overview.chroma.connected ? "good" : "bad") : "default"}
              />
              <StatCard label="Mode" value={overview?.chroma.mode?.toUpperCase() || "—"} />
              <StatCard label="Episodes Loaded" value={String(overview?.library.episodes_loaded || 0)} />
              <StatCard label="Models Active" value={String(overview?.usage.models.length || 0)} />
              <StatCard label="Dummy Mode" value={overview?.dummy_mode ? "ON" : "OFF"} tone={overview?.dummy_mode ? "bad" : "good"} />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="border-2 border-black bg-cream p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Collections</div>
                <div className="mt-3 space-y-3">
                  <div className="border border-black bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">{overview?.chroma.memory_collection.name || "memory"}</div>
                    <div className="mt-1 text-base font-black">{formatNumber(overview?.chroma.memory_collection.count || 0)} docs</div>
                  </div>
                  <div className="border border-black bg-white p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">{overview?.chroma.main_script_collection.name || "main_script"}</div>
                    <div className="mt-1 text-base font-black">{formatNumber(overview?.chroma.main_script_collection.count || 0)} docs</div>
                  </div>
                </div>
              </div>

              <div className="border-2 border-black bg-[#111827] p-4 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Provider Routes</div>
                    <div className="mt-1 text-lg font-black uppercase">Runtime LLM Map</div>
                  </div>
                  <div className="border border-white/70 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black">
                    Delay {overview?.response_delay_seconds ?? "—"}s
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <ProviderRoute
                    title="Ask"
                    provider={askProvider}
                    model={askModel}
                    configured={providerConfigured(askProvider, overview)}
                    purpose="Character replies, focused continuity explanations, and guardrail retries."
                  />
                  <ProviderRoute
                    title="Summaries"
                    provider={summaryProvider}
                    model={summaryModel}
                    configured={providerConfigured(summaryProvider, overview)}
                    purpose="Continuity scanner extraction, validation, and edit-impact analysis."
                  />
                  <ProviderRoute
                    title="Arc Summaries"
                    provider={arcSummaryProvider}
                    model={arcSummaryModel}
                    configured={providerConfigured(arcSummaryProvider, overview)}
                    purpose="Episode memory generation and annotated script/arc regeneration."
                  />
                  <ProviderRoute
                    title="Dialogue"
                    provider={dialogueProvider}
                    model={dialogueModel}
                    configured={providerConfigured(dialogueProvider, overview)}
                    purpose="Configured route retained for dialogue generation; currently idle in the live UI."
                  />
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
                        <div className="mt-3 grid gap-3 2xl:grid-cols-2">
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

        <section className="grid h-full min-h-[28rem] min-h-0 grid-rows-[auto_1fr] border-4 border-black bg-white shadow-hard-sm lg:min-h-0">
          <div className="border-b-4 border-black bg-[#f8d58a] px-4 py-3">
            <div className="font-black uppercase tracking-[0.18em]">Live Model Usage</div>
          </div>
          <div className="min-h-0 overflow-y-auto p-4">
            {overview && overview.usage.models.length ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <CompactMetric label="Requests" value={formatNumber(totalRequests)} detail="backend session" />
                  <CompactMetric label="Tokens" value={formatNumber(totalTokens)} detail="estimated" />
                  <CompactMetric label="RPD" value={formatNumber(totalRpd)} detail="rolling 24h" />
                  <CompactMetric label="Models" value={formatNumber(overview?.usage.models.length || 0)} detail="with traffic" />
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <BreakdownList
                    title="Feature Consumption"
                    rows={featureRows}
                    totalRequests={totalRequests || sumRows(featureRows, "requests")}
                    totalTokens={totalTokens || sumRows(featureRows, "tokens")}
                    emptyText="No feature-tagged traffic yet. New calls will show Ask, edit impact, summaries, continuity scans, and generation separately."
                  />
                  <BreakdownList
                    title="Role Consumption"
                    rows={roleRows}
                    totalRequests={totalRequests || sumRows(roleRows, "requests")}
                    totalTokens={totalTokens || sumRows(roleRows, "tokens")}
                    emptyText="No role traffic has been recorded yet."
                  />
                </div>

                <div className="mt-4 space-y-4">
                  {overview.usage.models.map((model) => (
                    <ModelUsageCard key={model} model={model} overview={overview} />
                  ))}
                </div>
              </>
            ) : (
              <div className="border-2 border-black bg-cream p-4 text-sm font-bold text-black/70">
                No model traffic has been recorded in this backend session yet. Ask a character, run edit impact, run continuity scanning, or regenerate summaries to populate live usage.
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  )
}
