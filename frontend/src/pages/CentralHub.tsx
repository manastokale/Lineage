import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import Layout from "../components/Layout"
import { askAgent, fetchCharacterFocus, fetchEpisode } from "../lib/api"
import { useStore } from "../store/useStore"
import { CHARACTER_COLORS, type CharacterFocusProfile, type Episode, type TimelineEntry } from "../types"

const MAIN_CAST_ORDER = ["Rachel", "Monica", "Phoebe", "Ross", "Chandler", "Joey"] as const

type SelectedLine = {
  lineIndex: number
  scene_id: string
  speaker: string
  text: string
  sceneLabel: string
}

type ScriptSceneBlock = {
  sceneId: string
  label: string
  lines: Array<{
    key: string
    speaker: string
    text: string
    lineIndex: number
    emotion_tags?: string[]
    stage_direction?: string
  }>
}

type AskMessage = {
  id: string
  kind: "user" | "reply"
  speaker: string
  text: string
  references?: Array<{
    kind: "character_arc" | "interaction_arc"
    episode_id: string
    title: string
    participants?: string[]
  }>
}

function sceneLabel(text: string) {
  const normalized = (text || "").trim()
  let label = normalized
    .replace(/^\[?\s*scene\s*:\s*/i, "")
    .replace(/\]?$/, "")
    .replace(/^\[?\s*scene\s+/i, "")
    .trim()
  if (!label) label = normalized
  return `SCENE : ${label}`
}

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

function CastThumbnail({ name, season, className }: { name: string; season: number; className: string }) {
  const src = thumbnailFor(name, season)
  if (!src) return null
  return (
    <img
      src={src}
      className={className}
      loading="lazy"
      onError={(event) => {
        const target = event.currentTarget
        const fallback = thumbnailFor(name, 1)
        const fallbackUrl = fallback ? new URL(fallback, window.location.origin).href : ""
        if (fallback && target.src !== fallbackUrl) {
          target.src = fallback
          return
        }
        target.style.display = "none"
      }}
    />
  )
}

export default function CentralHub() {
  const navigate = useNavigate()
  const { episodes, activeEpisodeId, activeSeason, setActiveEpisode, setActiveSeason } = useStore()
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [askText, setAskText] = useState("")
  const [askError, setAskError] = useState<string | null>(null)
  const [askThreads, setAskThreads] = useState<Record<number, AskMessage[]>>({})
  const [episodeMenuOpen, setEpisodeMenuOpen] = useState(false)
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false)
  const [expandedCastName, setExpandedCastName] = useState<string | null>(null)
  const [castProfiles, setCastProfiles] = useState<Record<string, CharacterFocusProfile | null>>({})
  const [selectedLine, setSelectedLine] = useState<SelectedLine | null>(null)
  const [openScenes, setOpenScenes] = useState<Record<string, boolean>>({})
  const [writerInfoOpen, setWriterInfoOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [mobileLensOpen, setMobileLensOpen] = useState(false)
  const [mobileCastOpen, setMobileCastOpen] = useState(false)
  const scriptScrollRef = useRef<HTMLDivElement>(null)
  const askScrollRef = useRef<HTMLDivElement>(null)
  const askInputRef = useRef<HTMLInputElement>(null)
  const sceneAnchorRefs = useRef<Record<string, HTMLElement | null>>({})
  const lineAnchorRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const [sceneInViewId, setSceneInViewId] = useState("")
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const scriptTimeline = useMemo(() => {
    if (!episode?.scenes?.length) return [] as TimelineEntry[]
    const entries: TimelineEntry[] = []
    let lineIndex = 0
    for (const scene of episode.scenes) {
      entries.push({
        type: "scene_start",
        scene_id: scene.scene_id,
        text: scene.scene_description || scene.location || "Scene continues",
        generated: false,
        location: scene.location,
      })
      for (const line of scene.lines || []) {
        if (!line.speaker || !line.text) continue
        entries.push({
          type: "dialogue",
          scene_id: scene.scene_id,
          text: line.text,
          generated: Boolean(line.generated),
          speaker: line.speaker,
          line_index: lineIndex,
          location: scene.location,
          emotion_tags: line.emotion_tags,
          stage_direction: line.stage_direction,
        })
        lineIndex += 1
      }
    }
    return entries
  }, [episode])

  const scriptScenes = useMemo(() => {
    if (!episode?.scenes?.length) return [] as ScriptSceneBlock[]
    const blocks: ScriptSceneBlock[] = []
    let lineIndex = 0
    for (const scene of episode.scenes) {
      const block: ScriptSceneBlock = {
        sceneId: scene.scene_id,
        label: sceneLabel(scene.scene_description || scene.location || "Scene continues"),
        lines: [],
      }
      for (const line of scene.lines || []) {
        if (!line.speaker || !line.text) continue
        block.lines.push({
          key: `${scene.scene_id}-${line.speaker}-${lineIndex}`,
          speaker: line.speaker,
          text: line.text,
          lineIndex,
          emotion_tags: line.emotion_tags,
          stage_direction: line.stage_direction,
        })
        lineIndex += 1
      }
      blocks.push(block)
    }
    return blocks
  }, [episode])

  const selectedSceneId = selectedLine?.scene_id || scriptScenes[0]?.sceneId || ""
  const selectedSceneCast = useMemo(
    () =>
      new Set(
        scriptTimeline
          .filter((entry) => entry.type === "dialogue" && entry.scene_id === selectedSceneId && entry.speaker)
          .map((entry) => entry.speaker as string),
      ),
    [scriptTimeline, selectedSceneId],
  )

  const castMembers = useMemo(() => {
    const names = Array.from(
      new Set(
        scriptTimeline
          .filter((entry) => entry.type === "dialogue" && entry.speaker)
          .map((entry) => entry.speaker as string),
      ),
    )
    return names.sort((left, right) => {
      const leftMainIndex = MAIN_CAST_ORDER.indexOf(left as (typeof MAIN_CAST_ORDER)[number])
      const rightMainIndex = MAIN_CAST_ORDER.indexOf(right as (typeof MAIN_CAST_ORDER)[number])
      const leftIsMain = leftMainIndex !== -1
      const rightIsMain = rightMainIndex !== -1
      if (leftIsMain && rightIsMain) return leftMainIndex - rightMainIndex
      if (leftIsMain !== rightIsMain) return leftIsMain ? -1 : 1
      const leftActive = selectedSceneCast.has(left) ? 1 : 0
      const rightActive = selectedSceneCast.has(right) ? 1 : 0
      if (leftActive !== rightActive) return rightActive - leftActive
      return left.localeCompare(right)
    })
  }, [scriptTimeline, selectedSceneCast])

  const flatLines = useMemo(
    () =>
      scriptScenes.flatMap((scene) =>
        scene.lines.map((line) => ({
          ...line,
          sceneId: scene.sceneId,
          sceneLabel: scene.label,
        })),
      ),
    [scriptScenes],
  )

  const sceneIndexById = useMemo(
    () => Object.fromEntries(scriptScenes.map((scene, index) => [scene.sceneId, index])),
    [scriptScenes],
  )

  const askMessages = useMemo(() => (selectedLine ? askThreads[selectedLine.lineIndex] || [] : []), [askThreads, selectedLine])

  const availableSeasons = useMemo(
    () => Array.from(new Set(episodes.map((item) => item.season || 1))).sort((left, right) => left - right),
    [episodes],
  )
  const season = activeSeason || episode?.season || availableSeasons[0] || 1
  const seasonEpisodes = useMemo(
    () =>
      episodes
        .filter((item) => (item.season || season) === season)
        .sort((a, b) => (a.episode || 0) - (b.episode || 0)),
    [episodes, season],
  )

  useEffect(() => {
    const syncViewport = () => setIsMobileViewport(window.innerWidth < 768)
    syncViewport()
    window.addEventListener("resize", syncViewport)
    return () => window.removeEventListener("resize", syncViewport)
  }, [])

  useEffect(() => {
    if (!activeEpisodeId) return
    let cancelled = false
    const loadEpisode = async () => {
      try {
        setEpisode(null)
        setAskThreads({})
        setAskError(null)
        setExpandedCastName(null)
        setCastProfiles({})
        setSceneInViewId("")
        setMobileCastOpen(false)
        setMobileLensOpen(false)
        const nextEpisode = await fetchEpisode(activeEpisodeId)
        if (cancelled) return
        setEpisode(nextEpisode)
        if (nextEpisode.season) {
          setActiveSeason(nextEpisode.season)
        }
        setEpisodeMenuOpen(false)
      } catch (error) {
        console.error(error)
      }
    }
    void loadEpisode()
    return () => {
      cancelled = true
    }
  }, [activeEpisodeId, setActiveSeason])

  useEffect(() => {
    if (!scriptScenes.length) {
      setSelectedLine(null)
      return
    }
    setOpenScenes((current) => {
      const next = { ...current }
      for (const scene of scriptScenes) {
        if (next[scene.sceneId] === undefined) next[scene.sceneId] = true
      }
      return next
    })
    const firstLine = scriptScenes.flatMap((scene) => scene.lines.map((line) => ({ scene, line })))[0]
    if (!firstLine) {
      setSelectedLine(null)
      return
    }
    setSelectedLine({
      lineIndex: firstLine.line.lineIndex,
      scene_id: firstLine.scene.sceneId,
      speaker: firstLine.line.speaker,
      text: firstLine.line.text,
      sceneLabel: firstLine.scene.label,
    })
    setSceneInViewId(firstLine.scene.sceneId)
  }, [scriptScenes])

  useEffect(() => {
    if (!selectedLine) return
    const lineNode = lineAnchorRefs.current[selectedLine.lineIndex]
    const container = scriptScrollRef.current
    if (!lineNode || !container) return
    const containerRect = container.getBoundingClientRect()
    const lineRect = lineNode.getBoundingClientRect()
    const tooHigh = lineRect.top < containerRect.top + 80
    const tooLow = lineRect.bottom > containerRect.bottom - 80
    if (tooHigh || tooLow) {
      lineNode.scrollIntoView({ block: "center", behavior: "smooth" })
    }
    setSceneInViewId(selectedLine.scene_id)
  }, [selectedLine])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) return
      if (!flatLines.length) return

      if (event.key === "Enter") {
        event.preventDefault()
        askInputRef.current?.focus()
        return
      }

      const key = event.key
      if (key !== "ArrowDown" && key !== "ArrowUp") return
      event.preventDefault()

      const currentIndex = Math.max(
        0,
        flatLines.findIndex((line) => line.lineIndex === selectedLine?.lineIndex),
      )

      if (event.shiftKey) {
        const currentSceneIndex = Math.max(0, sceneIndexById[selectedLine?.scene_id || flatLines[0].sceneId] ?? 0)
        const nextSceneIndex =
          key === "ArrowDown"
            ? Math.min(scriptScenes.length - 1, currentSceneIndex + 1)
            : Math.max(0, currentSceneIndex - 1)
        const scene = scriptScenes[nextSceneIndex]
        if (!scene?.lines.length) return
        const firstLine = scene.lines[0]
        setOpenScenes((current) => ({ ...current, [scene.sceneId]: true }))
        setSelectedLine({
          lineIndex: firstLine.lineIndex,
          scene_id: scene.sceneId,
          speaker: firstLine.speaker,
          text: firstLine.text,
          sceneLabel: scene.label,
        })
        return
      }

      const nextLine =
        key === "ArrowDown"
          ? flatLines[Math.min(flatLines.length - 1, currentIndex + 1)]
          : flatLines[Math.max(0, currentIndex - 1)]
      if (!nextLine) return
      setOpenScenes((current) => ({ ...current, [nextLine.sceneId]: true }))
      setSelectedLine({
        lineIndex: nextLine.lineIndex,
        scene_id: nextLine.sceneId,
        speaker: nextLine.speaker,
        text: nextLine.text,
        sceneLabel: nextLine.sceneLabel,
      })
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [flatLines, sceneIndexById, scriptScenes, selectedLine])

  useEffect(() => {
    if (!activeEpisodeId || !expandedCastName || castProfiles[expandedCastName] !== undefined) return
    let cancelled = false
    fetchCharacterFocus(activeEpisodeId, expandedCastName)
      .then((profile) => {
        if (!cancelled) {
          setCastProfiles((current) => ({ ...current, [expandedCastName]: profile }))
        }
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) {
          setCastProfiles((current) => ({ ...current, [expandedCastName]: null }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeEpisodeId, castProfiles, expandedCastName])

  useEffect(() => {
    const container = askScrollRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: askMessages.length < 2 ? "auto" : "smooth" })
  }, [askMessages])

  const syncSceneInView = () => {
    const container = scriptScrollRef.current
    if (!container || !scriptScenes.length) return
    const containerRect = container.getBoundingClientRect()
    const probeTop = containerRect.top + 120
    let activeSceneId = scriptScenes[0].sceneId
    let bestDistance = Number.POSITIVE_INFINITY
    for (const scene of scriptScenes) {
      const anchor = sceneAnchorRefs.current[scene.sceneId]
      if (!anchor) continue
      const anchorRect = anchor.getBoundingClientRect()
      const distance = Math.abs(anchorRect.top - probeTop)
      const visible = anchorRect.bottom >= containerRect.top && anchorRect.top <= containerRect.bottom
      if (!visible) continue
      if (anchorRect.top <= probeTop && distance <= bestDistance) {
        activeSceneId = scene.sceneId
        bestDistance = distance
        continue
      }
      if (bestDistance === Number.POSITIVE_INFINITY || distance < bestDistance) {
        activeSceneId = scene.sceneId
        bestDistance = distance
      }
    }
    setSceneInViewId(activeSceneId)
  }

  useEffect(() => {
    syncSceneInView()
  }, [scriptScenes])

  useEffect(() => {
    const container = scriptScrollRef.current
    if (!container) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncSceneInView)
    }
    const onResize = () => syncSceneInView()
    container.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [scriptScenes])

  const jumpToScene = (sceneId: string) => {
    setOpenScenes((current) => ({ ...current, [sceneId]: true }))
    const container = scriptScrollRef.current
    const anchor = sceneAnchorRefs.current[sceneId]
    if (!container || !anchor) return
    container.scrollTo({ top: anchor.offsetTop - 12, behavior: "smooth" })
    setSceneInViewId(sceneId)
  }

  const appendAskThreadMessage = (contextIndex: number, message: AskMessage) => {
    setAskThreads((current) => ({
      ...current,
      [contextIndex]: [...(current[contextIndex] || []), message],
    }))
  }

  const handleAsk = async () => {
    if (!episode || !selectedLine) return
    const threadKey = selectedLine.lineIndex
    const rawQuestion = askText.trim()
    const question = rawQuestion.replace(/@[a-zA-Z]+/g, "").trim()
    const mentionNames = Array.from(askText.matchAll(/@([a-zA-Z]+)/g)).map((match) => match[1])
    const knownNames = new Map(Array.from(new Set(castMembers)).map((name) => [name.toLowerCase(), name]))
    const targets = mentionNames.length
      ? mentionNames
          .map((item) => knownNames.get(item.toLowerCase()) || (item.charAt(0).toUpperCase() + item.slice(1).toLowerCase()))
          .filter(Boolean)
      : [selectedLine.speaker]
    const uniqueTargets = Array.from(new Set(targets))
    if (!question) {
      setAskError("Select a line and enter a question.")
      return
    }
    if (!uniqueTargets.length) {
      setAskError("No valid character targets were found for this moment.")
      return
    }

    setAskError(null)
    const userId = `${Date.now()}-user`
    appendAskThreadMessage(threadKey, {
      id: userId,
      kind: "user",
      speaker: "You",
      text: rawQuestion,
    })
    setAskText("")

    for (const target of uniqueTargets) {
      try {
        const reply = await askAgent(target, {
          episode_id: episode.episode_id,
          scene_id: selectedLine.scene_id,
          anchor_line_index: selectedLine.lineIndex,
          question,
          thread_messages: (askThreads[threadKey] || []).map((message) => ({
            type: message.kind === "user" ? "user_question" : "agent_reply",
            speaker: message.speaker,
            text: message.text,
          })),
        })
        appendAskThreadMessage(threadKey, {
          id: `${Date.now()}-${reply.name}`,
          kind: "reply",
          speaker: reply.name,
          text: reply.reply,
          references: reply.references,
        })
      } catch (error) {
        console.error(error)
        const message =
          error instanceof Error
            ? error.message.replace(/^API \d+\s+\S+:\s*/, "").trim() || "Couldn't respond right now."
            : "Couldn't respond right now."
        setAskError(message)
        appendAskThreadMessage(threadKey, {
          id: `${Date.now()}-${target}`,
          kind: "reply",
          speaker: target,
          text: message,
        })
      }
    }
  }

  const handleSeasonSelect = async (nextSeason: number) => {
    setActiveSeason(nextSeason)
    const nextEpisodeId = episodes.find((item) => item.season === nextSeason)?.episode_id || episodes[0]?.episode_id || null
    setActiveEpisode(nextEpisodeId)
    setSeasonMenuOpen(false)
  }

  const castPaneContent = (
    <section className="grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden bg-white">
      <div className="border-b-4 border-black bg-accent px-4 py-3">
        <div className="font-black uppercase tracking-[0.18em]">Episode Cast</div>
      </div>
      <div className="min-h-0 overflow-y-auto p-2">
        <div className="flex flex-col gap-3">
          {castMembers.map((name) => {
            const isActiveInScene = selectedSceneCast.has(name)
            const isExpanded = expandedCastName === name
            const profile = castProfiles[name]
            return (
              <div key={name} className={`border-2 border-black p-3 text-left ${isActiveInScene ? "bg-highlight" : "bg-cream"}`}>
                <button
                  onClick={() => setExpandedCastName((current) => (current === name ? null : name))}
                  className="flex w-full items-center gap-3 text-left"
                >
                  {thumbnailFor(name, season) ? (
                    <CastThumbnail name={name} season={season} className="h-12 w-12 border-2 border-black object-cover object-top" />
                  ) : (
                    <div className="h-12 w-12 border-2 border-black" style={{ backgroundColor: CHARACTER_COLORS[name] || "#ddd" }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-black uppercase">{name}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
                      {isActiveInScene ? "In Scene" : "Episode Cast"}
                    </div>
                  </div>
                  <div className="text-sm font-black">{isExpanded ? "−" : "+"}</div>
                </button>

                {isExpanded ? (
                  <div className="mt-3 border-t-2 border-black pt-3">
                    <div className="flex items-start gap-3">
                      {thumbnailFor(name, season) ? (
                        <CastThumbnail name={name} season={season} className="h-24 w-24 border-2 border-black object-cover object-top" />
                      ) : (
                        <div className="h-24 w-24 border-2 border-black" style={{ backgroundColor: CHARACTER_COLORS[name] || "#ddd" }} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-black/60">
                          {profile?.occupation || "Character"}
                        </div>
                        <div className="mt-2 text-sm font-bold leading-5 text-black/80">
                          {profile?.subtitle || `${name} appears in this episode's transcript.`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate("/graph", { state: { selectedCharacter: name } })}
                      className="mt-3 w-full border-2 border-black bg-black px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                    >
                      Open In Graph
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )

  const sidebarCastPane = <div className="h-full">{castPaneContent}</div>

  const characterLensPaneContent = (
    <section className="grid h-full min-h-0 grid-rows-[auto_auto_1fr_auto] border-4 border-black bg-white shadow-hard-sm">
      <div className="relative border-b-4 border-black bg-primary px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-black uppercase tracking-[0.18em]">Character Lens</div>
          <button
            type="button"
            aria-label="Show Character Lens guidance"
            onClick={() => setWriterInfoOpen((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white text-sm font-black text-black shadow-hard-xs"
          >
            i
          </button>
        </div>
        {writerInfoOpen ? (
          <div className="absolute right-4 top-[calc(100%+0.75rem)] z-20 w-80 max-w-[calc(100vw-2rem)] border-4 border-black bg-white p-4 shadow-hard">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Writer Lens</div>
                <div className="mt-2 text-sm font-bold leading-6 text-black/75">
                  Use Character Lens to pressure-test what each character can truthfully know at this exact script moment.
                </div>
                <div className="mt-3 text-sm font-bold leading-6 text-black/75">
                  Ask the selected speaker directly, or use <span className="font-black">@mentions</span> to compare perspectives from the same point in time.
                </div>
              </div>
              <button
                type="button"
                aria-label="Close Character Lens guidance"
                onClick={() => setWriterInfoOpen(false)}
                className="shrink-0 border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="border-b-2 border-black bg-cream px-4 py-3">
        {selectedLine ? (
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">{selectedLine.sceneLabel}</div>
            <div className="mt-2 text-sm font-bold leading-6 text-black/75">
              Asking from <span style={{ color: CHARACTER_COLORS[selectedLine.speaker] || "#111827" }}>{selectedLine.speaker}</span>'s selected line.
            </div>
          </div>
        ) : (
          <div className="text-sm font-bold text-black/60">Select a line in the script to ask from that exact point in time.</div>
        )}
      </div>

      <div ref={askScrollRef} className="min-h-0 overflow-y-auto bg-[#f3f8ff] p-4">
        {askMessages.length ? (
          <div className="flex flex-col gap-3">
            {askMessages.map((message) => (
              <div key={message.id} className={`flex ${message.kind === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-full border-2 border-[#60a5fa] bg-[#dbeafe] p-3 text-left text-[#0f172a] sm:max-w-[88%]">
                  <div className="text-xs font-black uppercase" style={{ color: message.kind === "user" ? "#0f172a" : CHARACTER_COLORS[message.speaker] || "#111827" }}>
                    {message.speaker}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap font-bold">{message.text}</div>
                  {message.kind === "reply" && message.references?.length ? (
                    <div className="mt-3 border-t border-[#60a5fa] pt-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1e3a8a]/70">Referenced Memory</div>
                      <div className="mt-2 flex flex-col gap-2">
                        {message.references.map((reference, index) => (
                          <div key={`${message.id}-${reference.episode_id}-${reference.kind}-${index}`} className="border border-[#60a5fa]/40 bg-white/65 px-2 py-2 text-xs font-bold leading-5 text-[#0f172a]/80">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1e3a8a]/65">
                              {reference.episode_id.toUpperCase()} · {reference.kind === "interaction_arc" ? "Interaction" : "Character Arc"}
                            </div>
                            <div className="mt-1">{reference.title}</div>
                            {reference.kind === "interaction_arc" && reference.participants?.length ? (
                              <div className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#1e3a8a]/60">
                                {reference.participants.join(" / ")}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm font-bold leading-6 text-black/55">
            Click any dialogue line in the screenplay, then ask that speaker directly, or use @mentions to ask someone else from the same point in the script.
          </div>
        )}
      </div>

      <div className="border-t-4 border-black bg-primary p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={askInputRef}
            value={askText}
            onChange={(event) => setAskText(event.target.value)}
            maxLength={700}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void handleAsk()
              }
            }}
            className="min-w-0 flex-1 border-2 border-black bg-cream px-3 py-2 font-bold"
            placeholder={selectedLine ? `Ask ${selectedLine.speaker} from this moment…` : "@ross what are you thinking?"}
          />
          <button onClick={() => void handleAsk()} className="border-2 border-black bg-black px-4 py-2 font-black uppercase text-white sm:shrink-0">
            Ask
          </button>
        </div>
        {askError ? <div className="mt-2 text-xs font-black uppercase text-red-700">{askError}</div> : null}
      </div>
    </section>
  )

  const headerPane = (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-start gap-3">
        <div className="relative">
          <button
            onClick={() => setSeasonMenuOpen((value) => !value)}
            className="border-2 border-black bg-[#1d4ed8] px-4 py-3 text-left text-white shadow-hard-xs"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">Season</div>
            <div className="mt-1 text-base font-black uppercase md:text-lg">S{String(season).padStart(2, "0")}</div>
          </button>
          {seasonMenuOpen ? (
            <div className="absolute left-0 top-full z-30 mt-2 max-h-80 w-44 overflow-y-auto border-4 border-black bg-white shadow-hard">
              {availableSeasons.map((value) => (
                <button
                  key={value}
                  onClick={() => void handleSeasonSelect(value)}
                  className="block w-full border-b-2 border-black bg-white px-4 py-3 text-left hover:bg-primary"
                >
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/60">Season {value}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative">
          <button
            onClick={() => setEpisodeMenuOpen((value) => !value)}
            className="max-w-full border-2 border-black bg-black px-4 py-3 text-left text-white shadow-hard-xs"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">
              {episode?.episode_id?.toUpperCase() || "EPISODE"}
            </div>
            <div className="mt-1 max-w-[16rem] truncate text-base font-black uppercase md:max-w-[24rem] md:text-lg">
              {episode?.title || "Loading…"}
            </div>
          </button>
          {episodeMenuOpen ? (
            <div className="absolute left-0 top-full z-30 mt-2 max-h-80 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-4 border-black bg-white shadow-hard">
              {seasonEpisodes.map((item) => (
                <button
                  key={item.episode_id}
                  onClick={() => setActiveEpisode(item.episode_id)}
                  className={`block w-full border-b-2 border-black px-4 py-3 text-left ${
                    item.episode_id === activeEpisodeId ? "bg-highlight" : "bg-white hover:bg-cream"
                  }`}
                >
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/60">{item.episode_id.toUpperCase()}</div>
                  <div className="mt-1 font-black uppercase">{item.title}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-2 border-black bg-white px-4 py-3 text-left shadow-hard-xs lg:ml-auto lg:text-right">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/60">View</div>
        <div className="mt-1 text-base font-black uppercase md:text-lg">Screenplay</div>
      </div>
    </div>
  )

  return (
    <Layout headerContent={headerPane} sidebarExtra={sidebarCastPane}>
      <div
        className="grid h-full min-h-0 gap-4 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_420px] xl:overflow-hidden"
        onTouchStart={(event) => {
          if (!isMobileViewport) return
          const touch = event.changedTouches[0]
          touchStartRef.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={(event) => {
          if (!isMobileViewport || !touchStartRef.current) return
          const touch = event.changedTouches[0]
          const deltaX = touch.clientX - touchStartRef.current.x
          const deltaY = touch.clientY - touchStartRef.current.y
          touchStartRef.current = null
          if (Math.abs(deltaX) < 70 || Math.abs(deltaY) > 50) return
          if (deltaX > 0) {
            setMobileCastOpen(false)
            setMobileLensOpen((current) => !current)
            return
          }
          setMobileLensOpen(false)
          setMobileCastOpen((current) => !current)
        }}
      >
        <section className="grid h-full min-h-[34rem] min-h-0 grid-rows-[auto_1fr] border-4 border-black bg-white shadow-hard-sm xl:min-h-0">
          <div className="flex flex-col gap-3 border-b-4 border-black bg-accent px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="font-black uppercase tracking-[0.18em]">Episode Script</div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/60">
                {(scriptScenes.reduce((sum, scene) => sum + scene.lines.length, 0) || 0).toString()} lines
              </div>
              <span className="hidden md:inline-flex border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black/60">
                Up/Down Move Lines
              </span>
              <span className="hidden md:inline-flex border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black/60">
                Shift+Up/Down Jump Scenes
              </span>
              <span className="hidden md:inline-flex border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black/60">
                Enter Focus Ask
              </span>
              <button
                type="button"
                onClick={() => {
                  setMobileCastOpen((current) => !current)
                  setMobileLensOpen(false)
                }}
                className="border border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] md:hidden"
              >
                Cast
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileLensOpen((current) => !current)
                  setMobileCastOpen(false)
                }}
                className="border border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] md:hidden"
              >
                Lens
              </button>
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-1 bg-[#f8f2e7] md:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 border-b-4 border-black bg-[#efe5d4] p-3 md:block md:border-b-0 md:border-r-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-black/60">Scene Outline</div>
                <button
                  onClick={() =>
                    setOpenScenes(
                      Object.fromEntries(
                        scriptScenes.map((scene) => [scene.sceneId, false]),
                      ),
                    )
                  }
                  className="border border-black px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                >
                  Collapse
                </button>
              </div>
              <div className="flex max-h-56 min-h-0 flex-col gap-2 overflow-y-auto pr-1 md:h-[calc(100%-2rem)] md:max-h-none">
                {scriptScenes.map((scene, index) => {
                  const active = sceneInViewId === scene.sceneId
                  const expanded = openScenes[scene.sceneId] !== false
                  return (
                    <div key={scene.sceneId} className="border-2 border-black bg-white">
                      <button
                        onClick={() => jumpToScene(scene.sceneId)}
                        className={`block w-full px-3 py-3 text-left ${active ? "bg-[#1d4ed8] text-white" : "bg-white hover:bg-cream"}`}
                      >
                        <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${active ? "text-white/75" : "text-black/55"}`}>Scene {index + 1}</div>
                        <div className="mt-1 line-clamp-3 text-xs font-black uppercase leading-5">{scene.label}</div>
                      </button>
                      <button
                        onClick={() => setOpenScenes((current) => ({ ...current, [scene.sceneId]: !expanded }))}
                        className="flex w-full items-center justify-between border-t-2 border-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]"
                      >
                        <span>{scene.lines.length} lines</span>
                        <span>{expanded ? "Hide" : "Show"}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </aside>

            <div ref={scriptScrollRef} className="relative min-h-0 max-h-[70vh] overflow-y-auto p-4 sm:p-5 md:max-h-none">
              <div className="mx-auto flex max-w-4xl flex-col gap-8">
                {scriptScenes.map((scene) => {
                  const expanded = openScenes[scene.sceneId] !== false
                  return (
                    <section
                      key={scene.sceneId}
                      ref={(node) => {
                        sceneAnchorRefs.current[scene.sceneId] = node
                      }}
                      className="border-b border-black/10 pb-6"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <button
                          onClick={() => setOpenScenes((current) => ({ ...current, [scene.sceneId]: !expanded }))}
                          className="min-w-0 flex-1 text-center font-mono text-sm font-black uppercase tracking-[0.22em] text-black/70"
                        >
                          {scene.label}
                        </button>
                        <button
                          onClick={() => setOpenScenes((current) => ({ ...current, [scene.sceneId]: !expanded }))}
                          className="shrink-0 border border-black px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                        >
                          {expanded ? "Collapse" : "Expand"}
                        </button>
                      </div>

                      {expanded ? (
                        <div className="flex flex-col gap-3">
                          {scene.lines.map((line) => {
                            const isSelected = selectedLine?.lineIndex === line.lineIndex
                            return (
                              <button
                                key={line.key}
                                ref={(node) => {
                                  lineAnchorRefs.current[line.lineIndex] = node
                                }}
                                onClick={() => {
                                  setOpenScenes((current) => ({ ...current, [scene.sceneId]: true }))
                                  setSelectedLine({
                                    lineIndex: line.lineIndex,
                                    scene_id: scene.sceneId,
                                    speaker: line.speaker,
                                    text: line.text,
                                    sceneLabel: scene.label,
                                  })
                                  if (isMobileViewport) {
                                    setMobileCastOpen(false)
                                    setMobileLensOpen(true)
                                  }
                                }}
                                className={`w-full rounded-sm border-2 px-4 py-3 text-left transition ${
                                  isSelected
                                    ? "border-black bg-highlight shadow-hard-xs"
                                    : "border-transparent bg-white/55 hover:border-black/30 hover:bg-white/80"
                                }`}
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                                  <div className="w-full shrink-0 font-mono text-xs font-black uppercase tracking-[0.16em] sm:w-32" style={{ color: CHARACTER_COLORS[line.speaker] || "#111827" }}>
                                    {line.speaker}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="whitespace-pre-wrap text-[15px] font-bold leading-7 text-black sm:text-[16px]">{line.text}</div>
                                    {line.stage_direction ? (
                                      <div className="mt-2 text-xs italic text-black/55">{line.stage_direction}</div>
                                    ) : null}
                                    {line.emotion_tags?.length ? (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {line.emotion_tags.map((tag) => (
                                          <span key={`${line.key}-${tag}`} className="border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black/60">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-black/20 bg-white/40 px-4 py-4 text-center text-xs font-black uppercase tracking-[0.16em] text-black/45">
                          Scene collapsed
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="min-h-[20rem] overflow-hidden border-4 border-black bg-white shadow-hard-sm md:hidden">
          {castPaneContent}
        </div>

        <aside className="hidden min-h-0 overflow-hidden md:block">
          {characterLensPaneContent}
        </aside>
      </div>

      <div className={`fixed inset-0 z-40 bg-black/25 transition-opacity md:hidden ${mobileCastOpen || mobileLensOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
        <button
          type="button"
          aria-label="Close mobile panels"
          className="absolute inset-0"
          onClick={() => {
            setMobileCastOpen(false)
            setMobileLensOpen(false)
          }}
        />
        <div className={`absolute inset-y-0 left-0 w-[88vw] max-w-sm transform transition-transform ${mobileCastOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="h-full border-r-4 border-black bg-white shadow-hard">
            {castPaneContent}
          </div>
        </div>
        <div className={`absolute inset-y-0 right-0 w-[92vw] max-w-md transform transition-transform ${mobileLensOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="h-full bg-white shadow-hard">
            {characterLensPaneContent}
          </div>
        </div>
      </div>
    </Layout>
  )
}
