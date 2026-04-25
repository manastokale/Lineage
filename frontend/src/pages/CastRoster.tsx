import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"

import Layout from "../components/Layout"
import { fetchCharacterFocus, fetchEpisode, fetchEpisodeGraph, fetchInteractionFocus } from "../lib/api"
import { useStore } from "../store/useStore"
import type { CharacterFocusProfile, Episode, EpisodeGraph } from "../types"

function thumbnailFor(name: string, season = 1) {
  const map: Record<string, string> = {
    Rachel: "rachel",
    Chandler: "chandler",
    Joey: "joey",
    Monica: "monica",
    Phoebe: "phoebe",
    Ross: "ross",
  }
  const slug = map[name]
  if (!slug) return null
  return `/cast_thumbnails/${slug}/s${String(season).padStart(2, "0")}.webp`
}

function nodeThumbnailFor(name: string, season = 1) {
  return thumbnailFor(name, season) || thumbnailFor(name, 1)
}

function initialsFor(label: string) {
  const words = label.split(/\s+/).filter(Boolean)
  if (!words.length) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase()
}

export default function CastRoster() {
  const location = useLocation()
  const { activeEpisodeId } = useStore()
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [graph, setGraph] = useState<EpisodeGraph>({ nodes: [], edges: [] })
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([])
  const [profile, setProfile] = useState<CharacterFocusProfile | null>(null)
  const [sharedInteractions, setSharedInteractions] = useState<{ episode_id: string; title: string; participants: string[]; summary: string }[]>([])
  const [openSeasons, setOpenSeasons] = useState<Record<string, boolean>>({})
  const [pulseTime, setPulseTime] = useState(() => Date.now())

  useEffect(() => {
    if (!activeEpisodeId) return
    let cancelled = false
    const loadGraph = async () => {
      try {
        const [nextEpisode, nextGraph] = await Promise.all([
          fetchEpisode(activeEpisodeId),
          fetchEpisodeGraph(activeEpisodeId),
        ])
        if (cancelled) return
        setEpisode(nextEpisode)
        setGraph(nextGraph)
        setSelectedCharacters((current) => {
          const routedSelection = location.state && typeof location.state === "object" ? (location.state as { selectedCharacter?: string }).selectedCharacter : null
          if (routedSelection && nextGraph.nodes.some((node) => node.id === routedSelection)) {
            return [routedSelection]
          }
          return current.length ? current : (nextGraph.nodes[0]?.id ? [nextGraph.nodes[0].id] : [])
        })
      } catch (error) {
        console.error(error)
      }
    }
    void loadGraph()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void loadGraph()
      }
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeEpisodeId, location.state])

  useEffect(() => {
    if (!activeEpisodeId || selectedCharacters.length !== 1) {
      setProfile(null)
      return
    }
    let cancelled = false
    const loadProfile = async () => {
      try {
        const nextProfile = await fetchCharacterFocus(activeEpisodeId, selectedCharacters[0])
        if (!cancelled) setProfile(nextProfile)
      } catch (error) {
        console.error(error)
        if (!cancelled) setProfile(null)
      }
    }
    void loadProfile()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void loadProfile()
      }
    }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeEpisodeId, selectedCharacters])

  useEffect(() => {
    if (!activeEpisodeId || selectedCharacters.length < 2) {
      setSharedInteractions([])
      return
    }
    let cancelled = false
    const loadInteractions = async () => {
      try {
        const nextInteractions = await fetchInteractionFocus(activeEpisodeId, selectedCharacters)
        if (!cancelled) setSharedInteractions(nextInteractions)
      } catch (error) {
        console.error(error)
        if (!cancelled) setSharedInteractions([])
      }
    }
    void loadInteractions()
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void loadInteractions()
      }
    }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeEpisodeId, selectedCharacters])

  const positionedNodes = useMemo(() => {
    const width = 620
    const height = 320
    const centerX = width / 2
    const centerY = height / 2
    const orbitRadius = Math.min(width, height) * 0.4
    const totalLines = graph.nodes.reduce((sum, node) => sum + Math.max(node.line_count || 0, 0), 0) || 1
    return graph.nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(graph.nodes.length, 1) - Math.PI / 2
      const share = Math.max((node.line_count || 0) / totalLines, 0.04)
      const baseX = centerX + Math.cos(angle) * orbitRadius
      const baseY = centerY + Math.sin(angle) * orbitRadius
      const phase = pulseTime / 2200 + index * 0.75
      const drift = 5 + share * 8
      return {
        ...node,
        x: baseX + Math.cos(phase * 1.05) * drift,
        y: baseY + Math.sin(phase * 1.2) * drift * 0.75,
        share,
        radius: 16 + share * 90,
        pulseScale: 1 + Math.sin(phase) * 0.02,
        pulseRotation: Math.sin(phase * 0.9) * 2.8,
      }
    })
  }, [graph.nodes, pulseTime])

  const nodeById = useMemo(
    () => Object.fromEntries(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  )

  const groupedArcSummaries = useMemo(() => {
    const groups = new Map<string, { seasonLabel: string; items: NonNullable<CharacterFocusProfile["arcSummaries"]> }>()
    for (const item of profile?.arcSummaries || []) {
      const seasonNumber = Number(item.episode_id.slice(1, 3)) || 0
      const key = `season-${seasonNumber}`
      if (!groups.has(key)) {
        groups.set(key, { seasonLabel: `Season ${String(seasonNumber).padStart(2, "0")}`, items: [] })
      }
      groups.get(key)!.items.push(item)
    }
    return Array.from(groups.entries()).map(([key, value]) => ({
      key,
      seasonLabel: value.seasonLabel,
      items: value.items,
    }))
  }, [profile])

  const groupedInteractionSummaries = useMemo(() => {
    const source = selectedCharacters.length > 1 ? sharedInteractions : []
    const groups = new Map<string, { seasonLabel: string; items: typeof source }>()
    for (const item of source) {
      const seasonNumber = Number(item.episode_id.slice(1, 3)) || 0
      const key = `interaction-season-${seasonNumber}`
      if (!groups.has(key)) {
        groups.set(key, { seasonLabel: `Season ${String(seasonNumber).padStart(2, "0")}`, items: [] as typeof source })
      }
      groups.get(key)!.items.push(item)
    }
    return Array.from(groups.entries()).map(([key, value]) => ({ key, seasonLabel: value.seasonLabel, items: value.items }))
  }, [selectedCharacters.length, sharedInteractions])

  useEffect(() => {
    if (!groupedArcSummaries.length && !groupedInteractionSummaries.length) return
    setOpenSeasons((current) => {
      const next = { ...current }
      for (const group of [...groupedArcSummaries, ...groupedInteractionSummaries]) {
        if (next[group.key] === undefined) {
          next[group.key] = true
        }
      }
      return next
    })
  }, [groupedArcSummaries, groupedInteractionSummaries])

  useEffect(() => {
    const timer = window.setInterval(() => setPulseTime(Date.now()), 120)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Layout
      headerContent={
        <div>
          <div className="font-headline text-4xl leading-none md:text-5xl">Character Graph</div>
          <div className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-black/65">
            {episode ? `${episode.episode_id.toUpperCase()} · ${episode.title}` : "Loading episode graph…"}
          </div>
        </div>
      }
    >
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid min-h-0 grid-rows-[1fr_auto] border-4 border-black bg-white shadow-hard-sm">
          <div className="min-h-0 overflow-hidden p-4">
            <div className="h-full rounded-sm border-2 border-black bg-[#fffaf1] p-3">
              <svg viewBox="0 0 620 320" className="h-full w-full">
                <defs>
                  {positionedNodes.map((node) => (
                    <clipPath key={`clip-${node.id}`} id={`graph-node-clip-${node.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}>
                      <circle r={node.radius - 2} />
                    </clipPath>
                  ))}
                </defs>
                {graph.edges.map((edge, index) => {
                  const source = nodeById[edge.source]
                  const target = nodeById[edge.target]
                  if (!source || !target) return null
                  return (
                    <line
                      key={`${edge.source}-${edge.target}-${index}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="#111"
                      strokeOpacity={Math.max(0.15, edge.strength)}
                      strokeWidth={1 + edge.strength * 5}
                    />
                  )
                })}
                {positionedNodes.map((node) => (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey) {
                        setSelectedCharacters((current) =>
                          current.includes(node.id) ? current.filter((item) => item !== node.id) : [...current, node.id],
                        )
                        return
                      }
                      setSelectedCharacters([node.id])
                    }}
                    className="cursor-pointer"
                  >
                    <title>{node.label}</title>
                    <g transform={`rotate(${node.pulseRotation}) scale(${node.pulseScale})`}>
                      <circle
                        r={node.radius}
                        fill={selectedCharacters.includes(node.id) ? "#f5c542" : "#fff"}
                        stroke="#111"
                        strokeWidth="2"
                      />
                      {nodeThumbnailFor(node.label, episode?.season || 1) ? (
                        <image
                          href={nodeThumbnailFor(node.label, episode?.season || 1) || ""}
                          x={-node.radius + 2}
                          y={-node.radius + 2}
                          width={(node.radius - 2) * 2}
                          height={(node.radius - 2) * 2}
                          preserveAspectRatio="xMidYMid slice"
                          clipPath={`url(#graph-node-clip-${node.id.replace(/[^a-zA-Z0-9_-]/g, "-")})`}
                        />
                      ) : (
                        <text
                          y={node.radius > 34 ? 4 : 3}
                          textAnchor="middle"
                          fontSize={node.radius > 36 ? 12 : 10}
                          fontWeight="800"
                          fill="#111"
                          style={{ textTransform: "uppercase", pointerEvents: "none" }}
                        >
                          {initialsFor(node.label)}
                        </text>
                      )}
                    </g>
                  </g>
                ))}
              </svg>
            </div>
          </div>
          <div className="border-t-4 border-black bg-primary p-3">
            <div className="flex flex-wrap gap-2">
              {graph.nodes.map((node) => (
                <button
                  key={node.id}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey) {
                      setSelectedCharacters((current) =>
                        current.includes(node.id) ? current.filter((item) => item !== node.id) : [...current, node.id],
                      )
                      return
                    }
                    setSelectedCharacters([node.id])
                  }}
                  className={`rounded-full border-2 px-3 py-2 text-xs font-black uppercase shadow-hard-xs ${
                    selectedCharacters.includes(node.id) ? "border-black bg-highlight" : "border-black bg-white"
                  }`}
                >
                  {node.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="grid min-h-0 grid-rows-[auto_1fr] border-4 border-black bg-white shadow-hard-sm">
          <div className="border-b-4 border-black bg-accent px-4 py-3">
            <div className="font-black uppercase tracking-[0.18em]">
              {selectedCharacters.length > 1 ? "Shared Prior Interactions" : "Prior Character Arcs"}
            </div>
          </div>
          {selectedCharacters.length > 1 ? (
            <div className="grid min-h-0 grid-rows-[auto_1fr]">
              <div className="border-b-2 border-black p-4">
                <div className="border-2 border-black bg-cream p-3">
                  <div className="text-lg font-black uppercase">{selectedCharacters.join(" + ")}</div>
                  <div className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-black/60">
                    Showing only prior interactions between selected nodes
                  </div>
                </div>
              </div>
              <div className="min-h-0 overflow-y-auto p-4">
                <div className="space-y-3">
                  {groupedInteractionSummaries.length ? (
                    groupedInteractionSummaries.map((group) => (
                      <div key={group.key} className="border-2 border-black bg-[#fffaf1]">
                        <button
                          onClick={() =>
                            setOpenSeasons((current) => ({
                              ...current,
                              [group.key]: !(current[group.key] ?? true),
                            }))
                          }
                          className="flex w-full items-center justify-between gap-3 border-b-2 border-black px-3 py-3 text-left text-xs font-black uppercase tracking-[0.16em]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{group.seasonLabel}</span>
                            <span className="text-black/55">{group.items.length} interactions</span>
                          </div>
                          <span>{openSeasons[group.key] ?? true ? "−" : "+"}</span>
                        </button>
                        {openSeasons[group.key] ?? true ? (
                          <div className="space-y-3 p-3">
                            {group.items.map((item) => (
                              <div key={`${item.episode_id}-${item.participants.join("-")}`} className="border-2 border-black bg-white p-3">
                                <div className="text-xs font-black uppercase tracking-[0.16em] text-black/60">
                                  {item.episode_id.toUpperCase()} · {item.title}
                                </div>
                                <div className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-black/55">
                                  {item.participants.join(" / ")}
                                </div>
                                <div className="mt-2 text-sm font-bold leading-6">{item.summary}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="border-2 border-black bg-[#fffaf1] p-3 text-sm font-bold">
                      No prior interactions were found between the selected characters before this episode.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : profile ? (
            <div className="grid min-h-0 grid-rows-[auto_1fr]">
              <div className="border-b-2 border-black p-4">
                <div className="flex items-start gap-3 border-2 border-black bg-cream p-3">
                  {thumbnailFor(profile.name, episode?.season || 1) ? (
                    <img
                      src={thumbnailFor(profile.name, episode?.season || 1) || ""}
                      className="h-16 w-16 border-2 border-black object-cover object-top"
                    />
                  ) : (
                    <div className="h-16 w-16 border-2 border-black bg-white" />
                  )}
                  <div>
                    <div className="text-lg font-black uppercase">{profile.name}</div>
                    <div className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-black/60">
                      {profile.occupation || "Recurring Character"}
                    </div>
                    <div className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-black/55">
                      {profile.episodeCount || 0} episodes · {profile.lineCount || 0} lines
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto p-4">
                <div className="space-y-3">
                  {groupedInteractionSummaries.length ? (
                    groupedInteractionSummaries.map((group) => (
                      <div key={group.key} className="border-2 border-black bg-[#eef6ff]">
                        <button
                          onClick={() =>
                            setOpenSeasons((current) => ({
                              ...current,
                              [group.key]: !(current[group.key] ?? true),
                            }))
                          }
                          className="flex w-full items-center justify-between gap-3 border-b-2 border-black px-3 py-3 text-left text-xs font-black uppercase tracking-[0.16em]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{group.seasonLabel} Interactions</span>
                            <span className="text-black/55">{group.items.length}</span>
                          </div>
                          <span>{openSeasons[group.key] ?? true ? "−" : "+"}</span>
                        </button>
                        {openSeasons[group.key] ?? true ? (
                          <div className="space-y-3 p-3">
                            {group.items.map((item) => (
                              <div key={`${item.episode_id}-${item.participants.join("-")}`} className="border-2 border-black bg-white p-3">
                                <div className="text-xs font-black uppercase tracking-[0.16em] text-black/60">
                                  {item.episode_id.toUpperCase()} · {item.title}
                                </div>
                                <div className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-black/55">
                                  {item.participants.join(" / ")}
                                </div>
                                <div className="mt-2 text-sm font-bold leading-6">{item.summary}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : null}
                  {groupedArcSummaries.length ? (
                    groupedArcSummaries.map((group) => (
                      <div key={group.key} className="border-2 border-black bg-[#fffaf1]">
                        <button
                          onClick={() =>
                            setOpenSeasons((current) => ({
                              ...current,
                              [group.key]: !(current[group.key] ?? true),
                            }))
                          }
                          className="flex w-full items-center justify-between gap-3 border-b-2 border-black px-3 py-3 text-left text-xs font-black uppercase tracking-[0.16em]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{group.seasonLabel}</span>
                            <span className="text-black/55">{group.items.length} arcs</span>
                          </div>
                          <span>{openSeasons[group.key] ?? true ? "−" : "+"}</span>
                        </button>
                        {openSeasons[group.key] ?? true ? (
                          <div className="space-y-3 p-3">
                            {group.items.map((item) => (
                              <div key={`${item.episode_id}-${item.title}`} className="border-2 border-black bg-white p-3">
                                <div className="text-xs font-black uppercase tracking-[0.16em] text-black/60">
                                  {item.episode_id.toUpperCase()} · {item.title}
                                </div>
                                <div className="mt-2 text-sm font-bold leading-6">{item.summary}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="border-2 border-black bg-[#fffaf1] p-3 text-sm font-bold">
                      No prior arcs were found for this character before the current episode.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="border-2 border-black bg-[#fffaf1] p-3 text-sm font-bold">
                Select a character node to inspect their prior arc summaries.
              </div>
            </div>
          )}
        </aside>
      </div>
    </Layout>
  )
}
