import type {
  CharacterFocusProfile,
  ContinuityFlag,
  ContinuityReport,
  EditImpactReport,
  Episode,
  EpisodeGraph,
  StatsOverview,
} from "../types"

const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/

function resolveBaseUrl() {
  const configured = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "")
  if (configured) return configured
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location
    // In local/LAN static serving, the frontend runs on 5173 and the backend
    // runs on 8000 on the same host. On Vercel, there is no explicit port and
    // `/api` should stay same-origin.
    if (port && port !== "8000") {
      return `${protocol}//${hostname}:8000`
    }
    return ""
  }
  return "http://127.0.0.1:8000"
}

const BASE = resolveBaseUrl()

function buildRequestUrl(path: string) {
  if (BASE) {
    return `${BASE}${path}`
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`
  }
  return `http://127.0.0.1:8000${path}`
}

function getDeviceId() {
  if (typeof window === "undefined") return "server"
  const storageKey = "lineage-device-id"
  try {
    const existing = window.localStorage.getItem(storageKey)
    if (existing && DEVICE_ID_PATTERN.test(existing)) return existing
  } catch {
    // ignore storage access issues and fall through to ephemeral id generation
  }
  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `lineage-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const normalized = DEVICE_ID_PATTERN.test(next) ? next : `lineage-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  try {
    window.localStorage.setItem(storageKey, normalized)
  } catch {
    // ignore storage access issues and just use the generated id for this request
  }
  return normalized
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildRequestUrl(path)
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "X-Lineage-Device": getDeviceId(),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try {
      const payload = JSON.parse(text)
      if (typeof payload?.detail === "string" && payload.detail.trim()) {
        detail = payload.detail.trim()
      } else if (Array.isArray(payload?.detail)) {
        detail = payload.detail
          .map((item: { msg?: string; message?: string; type?: string }) => item?.msg || item?.message || item?.type || "")
          .filter(Boolean)
          .join("; ") || "Request validation failed."
      } else if (payload?.detail && typeof payload.detail === "object") {
        detail = payload.detail.message || payload.detail.error || "Request failed."
      }
    } catch {
      // leave raw text as-is
    }
    throw new Error(`API ${res.status} ${path}: ${detail}`)
  }
  return res.json()
}

export const fetchStatsOverview = () => request<StatsOverview>("/api/stats/overview")

export const fetchEpisodes = () => request<Episode[]>("/api/episodes/")

export const fetchEpisode = (id: string) => request<Episode>(`/api/episodes/${encodeURIComponent(id)}`)

export const askAgent = (
  name: string,
  body: {
    episode_id: string
    scene_id: string
    anchor_line_index: number
    question: string
    thread_messages?: { type: "user_question" | "agent_reply"; speaker: string; text: string }[]
    continuity_flag?: ContinuityFlag
  },
) =>
  request<{
    name: string
    reply: string
    references?: { kind: "character_arc" | "interaction_arc"; episode_id: string; title: string; participants?: string[] }[]
  }>(`/api/agents/${encodeURIComponent(name)}/ask`, {
    method: "POST",
    body: JSON.stringify(body),
  })

export const fetchEpisodeGraph = (id: string) =>
  request<EpisodeGraph>(`/api/episodes/${encodeURIComponent(id)}/graph`)

export const fetchEpisodeContinuity = (id: string) =>
  request<ContinuityReport>(`/api/episodes/${encodeURIComponent(id)}/continuity`)

export const analyzeLineImpact = (
  episodeId: string,
  lineIndex: number,
  body: { edited_text: string },
) =>
  request<EditImpactReport>(`/api/episodes/${encodeURIComponent(episodeId)}/lines/${lineIndex}/impact`, {
    method: "POST",
    body: JSON.stringify(body),
  })

export const fetchCharacterFocus = (episodeId: string, name: string) =>
  request<CharacterFocusProfile>(`/api/episodes/${encodeURIComponent(episodeId)}/characters/${encodeURIComponent(name)}`)

export const fetchInteractionFocus = (episodeId: string, characters: string[]) =>
  request<{ episode_id: string; title: string; participants: string[]; summary: string }[]>(
    `/api/episodes/${encodeURIComponent(episodeId)}/interactions?characters=${encodeURIComponent(characters.join(","))}`,
  )
