import type { CharacterFocusProfile, Episode, EpisodeGraph, HealthSnapshot, StatsOverview, TimelineEntry } from "../types"

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

function getDeviceId() {
  if (typeof window === "undefined") return "server"
  const storageKey = "lineage-device-id"
  const existing = window.localStorage.getItem(storageKey)
  if (existing) return existing
  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `lineage-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(storageKey, next)
  return next
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = BASE ? `${BASE}${path}` : path
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
      }
    } catch {
      // leave raw text as-is
    }
    throw new Error(`API ${res.status} ${path}: ${detail}`)
  }
  return res.json()
}

export const fetchHealth = () => request<HealthSnapshot>("/api/health")
export const fetchStatsOverview = () => request<StatsOverview>("/api/stats/overview")

export const fetchEpisodes = () => request<Episode[]>("/api/episodes/")

export const fetchEpisode = (id: string) => request<Episode>(`/api/episodes/${id}`)

export const fetchEpisodeTimeline = (id: string) =>
  request<TimelineEntry[]>(`/api/episodes/${id}/timeline`)

export const askAgent = (
  name: string,
  body: {
    episode_id: string
    scene_id: string
    anchor_line_index: number
    question: string
    thread_messages?: { type: "user_question" | "agent_reply"; speaker: string; text: string }[]
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
  request<EpisodeGraph>(`/api/episodes/${id}/graph`)

export const fetchCharacterFocus = (episodeId: string, name: string) =>
  request<CharacterFocusProfile>(`/api/episodes/${episodeId}/characters/${encodeURIComponent(name)}`)

export const fetchInteractionFocus = (episodeId: string, characters: string[]) =>
  request<{ episode_id: string; title: string; participants: string[]; summary: string }[]>(
    `/api/episodes/${episodeId}/interactions?characters=${encodeURIComponent(characters.join(","))}`,
  )
