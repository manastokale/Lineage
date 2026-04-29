import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

import Layout from "../components/Layout"
import TutorialGuide from "../components/TutorialGuide"
import { analyzeLineImpact, askAgent, fetchCharacterFocus, fetchEpisode, fetchEpisodeContinuity } from "../lib/api"
import { useStore } from "../store/useStore"
import {
  CHARACTER_COLORS,
  type CharacterFocusProfile,
  type ContinuityFlag,
  type EditImpactReport,
  type Episode,
  type TimelineEntry,
} from "../types"

const MAIN_CAST_ORDER = ["Rachel", "Monica", "Phoebe", "Ross", "Chandler", "Joey"] as const
const CONTINUITY_AUTO_QUESTION = "Why is this a continuity error from your point of view?"
const ASK_CLIENT_RATE_LIMIT = 36
const ASK_CLIENT_RATE_WINDOW_MS = 60_000
const CONTINUITY_SEVERITY_STYLES = {
  low: "border-[#60a5fa] bg-[#dbeafe] text-[#0f172a]",
  medium: "border-[#f59e0b] bg-[#fef3c7] text-[#451a03]",
  high: "border-[#ef4444] bg-[#fee2e2] text-[#450a0a]",
} as const

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

type AskSubmission = {
  selected: SelectedLine
  rawQuestion: string
  question?: string
  targets?: string[]
  continuityFlag?: ContinuityFlag
  clearInput?: boolean
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

function formatContinuityCategory(category: string) {
  return category.replace(/_/g, " ")
}

function continuitySeverityClass(severity: ContinuityFlag["severity"]) {
  return CONTINUITY_SEVERITY_STYLES[severity] || CONTINUITY_SEVERITY_STYLES.medium
}

function normalizeDialogueText(text: string) {
  return text.trim().replace(/\s+/g, " ")
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
  const [askCooldownUntil, setAskCooldownUntil] = useState(0)
  const [askCooldownSeconds, setAskCooldownSeconds] = useState(0)
  const [askThreads, setAskThreads] = useState<Record<number, AskMessage[]>>({})
  const [episodeMenuOpen, setEpisodeMenuOpen] = useState(false)
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false)
  const [expandedCastName, setExpandedCastName] = useState<string | null>(null)
  const [castProfiles, setCastProfiles] = useState<Record<string, CharacterFocusProfile | null>>({})
  const [selectedLine, setSelectedLine] = useState<SelectedLine | null>(null)
  const [activeInlineLineIndex, setActiveInlineLineIndex] = useState<number | null>(null)
  const [continuityFlagsByLine, setContinuityFlagsByLine] = useState<Record<number, ContinuityFlag[]>>({})
  const [continuityLoadState, setContinuityLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [lineEdits, setLineEdits] = useState<Record<number, string>>({})
  const [editDrafts, setEditDrafts] = useState<Record<number, string>>({})
  const [impactReports, setImpactReports] = useState<Record<number, EditImpactReport>>({})
  const [impactLoadingLine, setImpactLoadingLine] = useState<number | null>(null)
  const [openScenes, setOpenScenes] = useState<Record<string, boolean>>({})
  const [writerInfoOpen, setWriterInfoOpen] = useState(false)
  const scriptScrollRef = useRef<HTMLDivElement>(null)
  const askScrollRef = useRef<HTMLDivElement>(null)
  const askInputRef = useRef<HTMLInputElement>(null)
  const askRequestTimestampsRef = useRef<number[]>([])
  const pendingContinuityAskLinesRef = useRef<Set<number>>(new Set())
  const sceneAnchorRefs = useRef<Record<string, HTMLElement | null>>({})
  const lineAnchorRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const [sceneInViewId, setSceneInViewId] = useState("")

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
    const orderWithinGroup = (groupNames: string[]) => {
      const mainCast = MAIN_CAST_ORDER.filter((name) => groupNames.includes(name))
      const others = groupNames.filter((name) => !MAIN_CAST_ORDER.includes(name as (typeof MAIN_CAST_ORDER)[number]))
      return [...mainCast, ...others]
    }
    const inScene = names.filter((name) => selectedSceneCast.has(name))
    const outOfScene = names.filter((name) => !selectedSceneCast.has(name))
    return [...orderWithinGroup(inScene), ...orderWithinGroup(outOfScene)]
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

  const originalTextByLineIndex = useMemo(
    () => Object.fromEntries(flatLines.map((line) => [line.lineIndex, line.text])),
    [flatLines],
  )

  const continuityFlagCount = useMemo(
    () => Object.values(continuityFlagsByLine).reduce((sum, flags) => sum + flags.length, 0),
    [continuityFlagsByLine],
  )

  const continuityLineIndexes = useMemo(
    () => flatLines.map((line) => line.lineIndex).filter((lineIndex) => (continuityFlagsByLine[lineIndex] || []).length > 0),
    [continuityFlagsByLine, flatLines],
  )

  const sceneIndexById = useMemo(
    () => Object.fromEntries(scriptScenes.map((scene, index) => [scene.sceneId, index])),
    [scriptScenes],
  )

  const activeAskMessages = useMemo(
    () => (activeInlineLineIndex !== null ? askThreads[activeInlineLineIndex] || [] : []),
    [activeInlineLineIndex, askThreads],
  )

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
    if (!activeEpisodeId) return
    let cancelled = false
    const loadEpisode = async () => {
      try {
        setEpisode(null)
        setAskThreads({})
        setAskError(null)
        setAskText("")
        setExpandedCastName(null)
        setCastProfiles({})
        setActiveInlineLineIndex(null)
        setLineEdits({})
        setEditDrafts({})
        setImpactReports({})
        setImpactLoadingLine(null)
        setSceneInViewId("")
        setContinuityFlagsByLine({})
        setContinuityLoadState("idle")
        pendingContinuityAskLinesRef.current.clear()
        const nextEpisode = await fetchEpisode(activeEpisodeId)
        if (cancelled) return
        setEpisode(nextEpisode)
        if (nextEpisode.season) {
          setActiveSeason(nextEpisode.season)
        }
        setEpisodeMenuOpen(false)
        setContinuityLoadState("loading")
        fetchEpisodeContinuity(activeEpisodeId)
          .then((report) => {
            if (cancelled) return
            const nextFlagsByLine = (report.flags || []).reduce<Record<number, ContinuityFlag[]>>((accumulator, flag) => {
              const lineIndex = Number(flag.line_index)
              if (!Number.isFinite(lineIndex)) return accumulator
              accumulator[lineIndex] = [...(accumulator[lineIndex] || []), flag]
              return accumulator
            }, {})
            setContinuityFlagsByLine(nextFlagsByLine)
            setContinuityLoadState("ready")
          })
          .catch((error) => {
            console.error(error)
            if (!cancelled) {
              setContinuityFlagsByLine({})
              setContinuityLoadState("error")
            }
          })
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
    if (!askCooldownUntil) {
      setAskCooldownSeconds(0)
      return
    }

    const updateCooldown = () => {
      const seconds = Math.max(0, Math.ceil((askCooldownUntil - Date.now()) / 1000))
      setAskCooldownSeconds(seconds)
      if (seconds <= 0) {
        setAskCooldownUntil(0)
        pruneAskRequestTimestamps()
      }
    }

    updateCooldown()
    const timer = window.setInterval(updateCooldown, 250)
    return () => window.clearInterval(timer)
  }, [askCooldownUntil])

  const focusAskInput = (lineIndex = selectedLine?.lineIndex) => {
    if (lineIndex !== undefined) {
      setActiveInlineLineIndex(lineIndex)
    }
    window.setTimeout(() => {
      askInputRef.current?.focus({ preventScroll: true })
    }, 0)
  }

  function appendAskThreadMessage(contextIndex: number, message: AskMessage) {
    setAskThreads((current) => ({
      ...current,
      [contextIndex]: [...(current[contextIndex] || []), message],
    }))
  }

  function pruneAskRequestTimestamps(now = Date.now()) {
    const cutoff = now - ASK_CLIENT_RATE_WINDOW_MS
    askRequestTimestampsRef.current = askRequestTimestampsRef.current.filter((timestamp) => timestamp > cutoff)
    return askRequestTimestampsRef.current
  }

  function askLimitWaitMs(requestCount: number) {
    const now = Date.now()
    const timestamps = pruneAskRequestTimestamps(now)
    if (timestamps.length + requestCount <= ASK_CLIENT_RATE_LIMIT) return 0
    const releaseIndex = Math.max(0, timestamps.length + requestCount - ASK_CLIENT_RATE_LIMIT - 1)
    return Math.max(1, timestamps[releaseIndex] + ASK_CLIENT_RATE_WINDOW_MS - now)
  }

  function reserveAskCapacity(requestCount: number) {
    const waitMs = askLimitWaitMs(requestCount)
    if (waitMs > 0) {
      setAskCooldownUntil(Date.now() + waitMs)
      setAskCooldownSeconds(Math.max(1, Math.ceil(waitMs / 1000)))
      return waitMs
    }
    const now = Date.now()
    askRequestTimestampsRef.current = [...pruneAskRequestTimestamps(now), ...Array.from({ length: requestCount }, () => now)]
    return 0
  }

  function askLimitMessage(seconds = askCooldownSeconds) {
    return `Ask is cooling down. Try again in ${Math.max(1, seconds)}s.`
  }

  async function submitAsk({
    selected,
    rawQuestion,
    question: explicitQuestion,
    targets,
    continuityFlag,
    clearInput = true,
  }: AskSubmission) {
    if (!episode) return
    const threadKey = selected.lineIndex
    const question = (explicitQuestion ?? rawQuestion.replace(/@[a-zA-Z]+/g, "")).trim()
    const mentionNames = Array.from(rawQuestion.matchAll(/@([a-zA-Z]+)/g)).map((match) => match[1])
    const knownNames = new Map(Array.from(new Set(castMembers)).map((name) => [name.toLowerCase(), name]))
    const resolvedTargets = targets?.length
      ? targets
      : mentionNames.length
        ? mentionNames
            .map((item) => knownNames.get(item.toLowerCase()) || (item.charAt(0).toUpperCase() + item.slice(1).toLowerCase()))
            .filter(Boolean)
        : [selected.speaker]
    const uniqueTargets = Array.from(new Set(resolvedTargets))
    if (!question) {
      setAskError("Select a line and enter a question.")
      return
    }
    if (!uniqueTargets.length) {
      setAskError("No valid character targets were found for this moment.")
      return
    }
    const waitMs = reserveAskCapacity(uniqueTargets.length)
    if (waitMs > 0) {
      setAskError(askLimitMessage(Math.ceil(waitMs / 1000)))
      focusAskInput(selected.lineIndex)
      return
    }

    setAskError(null)
    appendAskThreadMessage(threadKey, {
      id: `${Date.now()}-user`,
      kind: "user",
      speaker: "You",
      text: rawQuestion,
    })
    if (clearInput) {
      setAskText("")
    }
    focusAskInput(selected.lineIndex)

    for (const target of uniqueTargets) {
      try {
        const reply = await askAgent(target, {
          episode_id: episode.episode_id,
          scene_id: selected.scene_id,
          anchor_line_index: selected.lineIndex,
          question,
          continuity_flag: continuityFlag,
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
        const rawMessage = error instanceof Error ? error.message : ""
        const message =
          error instanceof Error
            ? error.message.replace(/^API \d+\s+\S+:\s*/, "").trim() || "Couldn't respond right now."
            : "Couldn't respond right now."
        if (/^API 429\b/.test(rawMessage) || /too many ask requests/i.test(message)) {
          const seconds = Number(message.match(/(\d+)s/i)?.[1] || 60)
          setAskCooldownUntil(Date.now() + seconds * 1000)
          setAskCooldownSeconds(seconds)
          setAskError(askLimitMessage(seconds))
          focusAskInput(selected.lineIndex)
          break
        }
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

  function handleAsk(line = selectedLine) {
    if (!line) return
    void submitAsk({
      selected: line,
      rawQuestion: askText.trim(),
    })
  }

  function startContinuityExplanation(line: SelectedLine, explicitFlag?: ContinuityFlag) {
    const flag = explicitFlag || continuityFlagsByLine[line.lineIndex]?.[0]
    if (!flag || pendingContinuityAskLinesRef.current.has(line.lineIndex)) {
      return Boolean(flag)
    }

    pendingContinuityAskLinesRef.current.add(line.lineIndex)
    void submitAsk({
      selected: line,
      rawQuestion: CONTINUITY_AUTO_QUESTION,
      question: CONTINUITY_AUTO_QUESTION,
      targets: [line.speaker],
      continuityFlag: flag,
      clearInput: false,
    }).finally(() => {
      pendingContinuityAskLinesRef.current.delete(line.lineIndex)
    })
    return true
  }

  function currentLineText(lineIndex: number, fallback: string) {
    return lineEdits[lineIndex] ?? fallback
  }

  function updateEditDraft(lineIndex: number, value: string) {
    setEditDrafts((current) => ({ ...current, [lineIndex]: value }))
    setImpactReports((current) => {
      const next = { ...current }
      delete next[lineIndex]
      return next
    })
  }

  function acceptLineEdit(line: SelectedLine, value: string) {
    const nextText = value.trim()
    if (!nextText) return
    setLineEdits((current) => ({ ...current, [line.lineIndex]: nextText }))
    setEditDrafts((current) => ({ ...current, [line.lineIndex]: nextText }))
    setSelectedLine({ ...line, text: nextText })
  }

  async function requestImpact(line: SelectedLine) {
    if (!episode) return
    const editedText = (editDrafts[line.lineIndex] ?? lineEdits[line.lineIndex] ?? line.text).trim()
    if (!editedText) return
    const originalText = originalTextByLineIndex[line.lineIndex] ?? line.text
    if (normalizeDialogueText(editedText) === normalizeDialogueText(originalText)) {
      setAskError("Change the dialogue before analyzing impact.")
      return
    }
    setImpactLoadingLine(line.lineIndex)
    try {
      const report = await analyzeLineImpact(episode.episode_id, line.lineIndex, { edited_text: editedText })
      setImpactReports((current) => ({ ...current, [line.lineIndex]: report }))
    } catch (error) {
      console.error(error)
      setAskError(error instanceof Error ? error.message.replace(/^API \d+\s+\S+:\s*/, "").trim() : "Could not analyze edit impact.")
    } finally {
      setImpactLoadingLine(null)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) return
      if (!flatLines.length) return

      const key = event.key
      if (key === "Enter" && selectedLine) {
        if (target?.dataset.lineButton === "true") return
        event.preventDefault()
        if (startContinuityExplanation(selectedLine)) {
          return
        }
        focusAskInput()
        return
      }
      if (key !== "ArrowDown" && key !== "ArrowUp") return
      event.preventDefault()

      const currentIndex = Math.max(
        0,
        flatLines.findIndex((line) => line.lineIndex === selectedLine?.lineIndex),
      )

      if (event.metaKey || event.ctrlKey) {
        if (!continuityLineIndexes.length) return
        const currentLineIndex = selectedLine?.lineIndex ?? flatLines[currentIndex].lineIndex
        let nextFlagLineIndex = continuityLineIndexes[0]
        if (key === "ArrowDown") {
          nextFlagLineIndex =
            continuityLineIndexes.find((lineIndex) => lineIndex > currentLineIndex) ||
            continuityLineIndexes[continuityLineIndexes.length - 1]
        } else {
          nextFlagLineIndex =
            [...continuityLineIndexes].reverse().find((lineIndex) => lineIndex < currentLineIndex) ||
            continuityLineIndexes[0]
        }
        const nextLine = flatLines.find((line) => line.lineIndex === nextFlagLineIndex)
        if (!nextLine) return
        setOpenScenes((current) => ({ ...current, [nextLine.sceneId]: true }))
        setSelectedLine({
          lineIndex: nextLine.lineIndex,
          scene_id: nextLine.sceneId,
          speaker: nextLine.speaker,
          text: currentLineText(nextLine.lineIndex, nextLine.text),
          sceneLabel: nextLine.sceneLabel,
        })
        return
      }

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
          text: currentLineText(firstLine.lineIndex, firstLine.text),
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
        text: currentLineText(nextLine.lineIndex, nextLine.text),
        sceneLabel: nextLine.sceneLabel,
      })
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [continuityLineIndexes, flatLines, sceneIndexById, scriptScenes, selectedLine])

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
    container.scrollTo({ top: container.scrollHeight, behavior: activeAskMessages.length < 2 ? "auto" : "smooth" })
  }, [activeAskMessages])

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

  const activateLine = ({
    lineIndex,
    sceneId,
    speaker,
    text,
    sceneLabel,
    openInline = false,
    focusAsk = false,
  }: {
    lineIndex: number
    sceneId: string
    speaker: string
    text: string
    sceneLabel: string
    openInline?: boolean
    focusAsk?: boolean
  }) => {
    setOpenScenes((current) => ({ ...current, [sceneId]: true }))
    setSelectedLine({
      lineIndex,
      scene_id: sceneId,
      speaker,
      text,
      sceneLabel,
    })
    if (openInline || focusAsk) {
      setActiveInlineLineIndex(lineIndex)
      setEditDrafts((current) => ({
        ...current,
        [lineIndex]: current[lineIndex] ?? lineEdits[lineIndex] ?? text,
      }))
    }
    if (focusAsk) {
      focusAskInput(lineIndex)
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

  const renderInlineWorkbench = (line: SelectedLine, lineContinuityFlags: ContinuityFlag[]) => {
    const messages = askThreads[line.lineIndex] || []
    const draft = editDrafts[line.lineIndex] ?? currentLineText(line.lineIndex, line.text)
    const impactReport = impactReports[line.lineIndex]
    const isImpactLoading = impactLoadingLine === line.lineIndex
    const isAskLimited = askCooldownSeconds > 0
    const originalText = originalTextByLineIndex[line.lineIndex] ?? line.text
    const hasDialogueChange = Boolean(draft.trim()) && normalizeDialogueText(draft) !== normalizeDialogueText(originalText)

    return (
      <div className="border-x-2 border-b-2 border-black bg-[#f3f8ff] text-left shadow-hard-xs">
        <div className="relative border-b-2 border-black bg-primary px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Line Workbench</div>
              <div className="mt-1 text-sm font-black uppercase">
                Ask, edit, and impact-check <span style={{ color: CHARACTER_COLORS[line.speaker] || "#111827" }}>{line.speaker}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Show Line Workbench guidance"
                onClick={() => setWriterInfoOpen((current) => !current)}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white text-sm font-black text-black shadow-hard-xs"
              >
                i
              </button>
              <button
                type="button"
                onClick={() => setActiveInlineLineIndex(null)}
                className="border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]"
              >
                Close
              </button>
            </div>
          </div>
          {writerInfoOpen ? (
            <div className="absolute right-4 top-[calc(100%+0.75rem)] z-20 w-80 max-w-[calc(100vw-2rem)] border-4 border-black bg-white p-4 shadow-hard">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Writer Lens</div>
              <div className="mt-2 text-sm font-bold leading-6 text-black/75">
                Ask from this exact moment, edit the selected line, then check whether the change drifts from prior memory or later episode beats.
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
          <div className="min-w-0">
            <div ref={askScrollRef} className="max-h-72 overflow-y-auto border-2 border-[#60a5fa] bg-white/70 p-3">
              {messages.length ? (
                <div className="flex flex-col gap-3">
                  {messages.map((message) => (
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
                  Ask {line.speaker} from this exact line, or use @mentions to compare another character's point of view.
                </div>
              )}
            </div>

            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                if (isAskLimited) {
                  setAskError(askLimitMessage())
                  return
                }
                handleAsk(line)
              }}
            >
              <input
                ref={askInputRef}
                value={askText}
                onChange={(event) => setAskText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isAskLimited) {
                    event.preventDefault()
                    setAskError(askLimitMessage())
                  }
                }}
                maxLength={700}
                aria-disabled={isAskLimited}
                className={`min-w-0 flex-1 border-2 border-black px-3 py-2 font-bold ${
                  isAskLimited ? "bg-black/10 text-black/45" : "bg-cream"
                }`}
                placeholder={isAskLimited ? `Ask cooling down for ${askCooldownSeconds}s...` : `Ask ${line.speaker} from this moment...`}
              />
              <button
                type="submit"
                disabled={isAskLimited}
                className={`border-2 border-black px-4 py-2 font-black uppercase sm:shrink-0 ${
                  isAskLimited ? "bg-black/20 text-black/45" : "bg-black text-white"
                }`}
              >
                {isAskLimited ? `${askCooldownSeconds}s` : "Ask"}
              </button>
            </form>
            {isAskLimited ? (
              <div className="mt-2 border border-black/25 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/60">
                Ask limit reached. Enter is paused until the cooldown ends.
              </div>
            ) : null}
            {lineContinuityFlags.length ? (
              <button
                type="button"
                onClick={() => startContinuityExplanation(line, lineContinuityFlags[0])}
                className="mt-3 border-2 border-black bg-[#fef3c7] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#78350f]"
              >
                Explain Flag From POV
              </button>
            ) : null}
            {askError ? <div className="mt-2 text-xs font-black uppercase text-red-700">{askError}</div> : null}
          </div>

          <div className="min-w-0 border-2 border-black bg-cream p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Edit + Continuity Impact</div>
            <textarea
              value={draft}
              onChange={(event) => updateEditDraft(line.lineIndex, event.target.value)}
              className="mt-3 min-h-28 w-full resize-y border-2 border-black bg-white px-3 py-2 text-sm font-bold leading-6"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => acceptLineEdit(line, draft)}
                className="border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]"
              >
                Accept Local Edit
              </button>
              <button
                type="button"
                onClick={() => void requestImpact(line)}
                disabled={!hasDialogueChange || isImpactLoading}
                className={`border-2 border-black px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                  hasDialogueChange && !isImpactLoading ? "bg-black text-white" : "cursor-not-allowed bg-black/20 text-black/45"
                }`}
              >
                {isImpactLoading ? "Checking..." : "Analyze Impact"}
              </button>
            </div>
            {!hasDialogueChange ? (
              <div className="mt-2 border border-black/25 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/60">
                Edit the dialogue before analyzing impact.
              </div>
            ) : null}

            {impactReport ? (
              <div className="mt-4 border-2 border-black bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-black bg-cream px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                    Drift {impactReport.drift_score}/100
                  </span>
                  <span className="border border-black bg-cream px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                    {impactReport.drift_level}
                  </span>
                  {impactReport.token_estimate ? (
                    <span className="border border-black bg-cream px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                      ~{impactReport.token_estimate.estimated_input_tokens + impactReport.token_estimate.estimated_output_tokens} tokens
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 text-sm font-bold leading-6 text-black/75">{impactReport.summary}</div>
                {impactReport.introduced_plot_holes.length ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {impactReport.introduced_plot_holes.map((issue) => (
                      <div key={issue.id} className={`border-2 px-3 py-2 text-xs font-bold leading-5 ${continuitySeverityClass(issue.severity)}`}>
                        <div className="font-black uppercase">{issue.title}</div>
                        <div className="mt-1">{issue.explanation}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {impactReport.repair_suggestions.length ? (
                  <div className="mt-3 border-t-2 border-black pt-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-black/60">Repairs</div>
                    <div className="mt-2 flex flex-col gap-2">
                      {impactReport.repair_suggestions.map((repair) => (
                        <button
                          key={repair.id}
                          type="button"
                          onClick={() => updateEditDraft(line.lineIndex, repair.text)}
                          className="border-2 border-black bg-cream px-3 py-2 text-left text-xs font-bold leading-5"
                        >
                          <div className="font-black uppercase">{repair.kind}</div>
                          <div className="mt-1">{repair.text}</div>
                          <div className="mt-1 text-black/55">{repair.rationale}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

          </div>
        </div>
      </div>
    )
  }

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
      <TutorialGuide
        className="border-2 border-black bg-[#dcfce7] px-4 py-3 text-left shadow-hard-xs hover:bg-highlight lg:ml-auto lg:text-right"
        triggerContent={
          <>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-black/60">Guide</div>
            <div className="mt-1 text-base font-black uppercase md:text-lg">Start Here</div>
          </>
        }
      />
    </div>
  )

  return (
    <Layout headerContent={headerPane} sidebarExtra={sidebarCastPane}>
      <div
        className="grid min-h-0 gap-4 overflow-y-auto overflow-x-hidden min-[1450px]:h-full"
      >
        <section className="grid min-h-[34rem] grid-rows-[auto_1fr] border-4 border-black bg-white shadow-hard-sm md:h-[calc(100dvh-141px)] min-[1450px]:h-full min-[1450px]:min-h-0">
          <div className="flex min-h-0 items-center gap-3 border-b-4 border-black bg-accent px-3 py-2">
            <div className="shrink-0 whitespace-nowrap text-sm font-black uppercase tracking-[0.18em] md:text-base">Episode Script</div>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap py-1 md:justify-end">
              <div className="shrink-0 border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/60">
                {scriptScenes.reduce((sum, scene) => sum + scene.lines.length, 0) || 0} lines
              </div>
              <span
                className={`hidden shrink-0 border border-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] md:inline-flex ${
                  continuityLoadState === "error"
                    ? "bg-[#fee2e2] text-[#991b1b]"
                    : continuityFlagCount
                      ? "bg-[#fef3c7] text-[#92400e]"
                      : "bg-white/70 text-black/60"
                }`}
              >
                {continuityLoadState === "loading"
                  ? "Scanning Continuity"
                  : continuityLoadState === "error"
                    ? "Continuity Offline"
                    : `${continuityFlagCount} Continuity Risks`}
              </span>
              <span className="hidden shrink-0 border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/60 md:inline-flex">
                Up/Down Lines
              </span>
              <span className="hidden shrink-0 border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/60 md:inline-flex">
                Shift Scenes
              </span>
              <span className="hidden shrink-0 border border-black/20 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/60 md:inline-flex">
                Enter Ask
              </span>
              <button
                type="button"
                onClick={() => document.getElementById("mobile-cast-pane")?.scrollIntoView({ block: "start", behavior: "smooth" })}
                className="shrink-0 border border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] md:hidden"
              >
                Cast
              </button>
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-1 bg-[#f8f2e7] md:grid-cols-[76px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 border-b-4 border-black bg-[#efe5d4] px-2 py-3 md:grid md:grid-rows-[auto_1fr] md:border-b-0 md:border-r-4">
              <div className="text-center text-[9px] font-black uppercase tracking-[0.18em] text-black/55">Scenes</div>
              <div className="mt-3 flex min-h-0 snap-y flex-col gap-2 overflow-y-auto px-1">
                {scriptScenes.map((scene, index) => {
                  const active = sceneInViewId === scene.sceneId
                  return (
                    <button
                      key={scene.sceneId}
                      type="button"
                      title={`${scene.label} · ${scene.lines.length} lines`}
                      onClick={() => jumpToScene(scene.sceneId)}
                      className={`group relative flex h-12 w-full snap-start items-center justify-center border-2 text-sm font-black shadow-hard-xs transition ${
                        active ? "border-black bg-[#1d4ed8] text-white" : "border-black bg-white text-black hover:bg-highlight"
                      }`}
                    >
                      {index + 1}
                    </button>
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
                            const displayText = currentLineText(line.lineIndex, line.text)
                            const inlineLine: SelectedLine = {
                              lineIndex: line.lineIndex,
                              scene_id: scene.sceneId,
                              speaker: line.speaker,
                              text: displayText,
                              sceneLabel: scene.label,
                            }
                            const isInlineOpen = activeInlineLineIndex === line.lineIndex
                            const lineContinuityFlags = continuityFlagsByLine[line.lineIndex] || []
                            return (
                              <div key={line.key}>
                                <button
                                  type="button"
                                  data-line-button="true"
                                  ref={(node) => {
                                    lineAnchorRefs.current[line.lineIndex] = node
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      activateLine({
                                        lineIndex: inlineLine.lineIndex,
                                        sceneId: inlineLine.scene_id,
                                        speaker: inlineLine.speaker,
                                        text: inlineLine.text,
                                        sceneLabel: inlineLine.sceneLabel,
                                        openInline: true,
                                      })
                                      if (!startContinuityExplanation(inlineLine, lineContinuityFlags[0])) {
                                        focusAskInput(inlineLine.lineIndex)
                                      }
                                    }
                                  }}
                                  onClick={(event) => {
                                    if (event.detail === 0) {
                                      return
                                    }
                                    activateLine({
                                      lineIndex: inlineLine.lineIndex,
                                      sceneId: inlineLine.scene_id,
                                      speaker: inlineLine.speaker,
                                      text: inlineLine.text,
                                      sceneLabel: inlineLine.sceneLabel,
                                      openInline: true,
                                    })
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
                                      <div className="whitespace-pre-wrap text-[15px] font-bold leading-7 text-black sm:text-[16px]">{displayText}</div>
                                      {lineEdits[line.lineIndex] ? (
                                        <div className="mt-2 inline-flex border border-black/25 bg-white/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black/60">
                                          Local Edit
                                        </div>
                                      ) : null}
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
                                      {lineContinuityFlags.length ? (
                                        <div className="mt-3 flex flex-col gap-2">
                                          {lineContinuityFlags.map((flag) => (
                                            <div
                                              key={flag.id}
                                              className={`border-2 px-3 py-2 text-xs font-bold leading-5 ${continuitySeverityClass(flag.severity)}`}
                                            >
                                              <div className="flex flex-wrap items-center gap-2">
                                                <span className="border border-current bg-white/45 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]">
                                                  Plot Hole Risk
                                                </span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                                                  {flag.severity}
                                                </span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                                                  {formatContinuityCategory(flag.category)}
                                                </span>
                                              </div>
                                              <div className="mt-2 text-sm font-black uppercase leading-5">{flag.title}</div>
                                              <div className="mt-1">{flag.explanation}</div>
                                              {flag.references?.length ? (
                                                <div className="mt-2 border-t border-current/35 pt-2">
                                                  <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
                                                    Prior context
                                                  </div>
                                                  <div className="mt-1 flex flex-wrap gap-2">
                                                    {flag.references.slice(0, 2).map((reference, index) => (
                                                      <span
                                                        key={`${flag.id}-${reference.episode_id}-${index}`}
                                                        className="border border-current/45 bg-white/45 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                                                      >
                                                        {reference.episode_id.toUpperCase()} · {reference.title}
                                                      </span>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </button>
                                {isInlineOpen ? renderInlineWorkbench(inlineLine, lineContinuityFlags) : null}
                              </div>
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

        <div id="mobile-cast-pane" className="min-h-[20rem] overflow-hidden border-4 border-black bg-white shadow-hard-sm md:hidden">
          {castPaneContent}
        </div>
      </div>
    </Layout>
  )
}
