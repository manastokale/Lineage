import type { Agent, Episode, DialogueLine } from "../types"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "ngrok-skip-browser-warning": "true" },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

// ── Health ─────────────────────────────────────────────
export const fetchHealth = () => get<{
  status: string
  dummy_mode: boolean
  dialogue_provider: string
}>("/api/health")

// ── Agents ─────────────────────────────────────────────
export const fetchAgents = () => get<Agent[]>("/api/agents/")

export interface AgentProfile {
  name: string
  subtitle: string
  version: string
  status: string
  quote: string
  emoji: string
  color: string
  occupation: string
  personality: Record<string, number>
  recentLines: { scene: string; text: string; time: string }[]
  relationships: { id: string; strength: string }[]
}
export const fetchAgentProfile = (name: string) =>
  get<AgentProfile>(`/api/agents/${name}/profile`)

// ── Episodes ───────────────────────────────────────────
export const fetchEpisodes = () => get<Episode[]>("/api/episodes/")

export const fetchEpisode = (id: string) =>
  get<Episode>(`/api/episodes/${id}`)

// ── Streaming ──────────────────────────────────────────
export function streamScene(
  episodeId: string,
  sceneId: string,
  onLine: (line: DialogueLine) => void,
  onDone: () => void,
  signal?: AbortSignal,
) {
  const url = `${BASE}/api/stream/episode/${episodeId}/scene/${sceneId}`
  fetch(url, {
    headers: { "ngrok-skip-browser-warning": "true" },
    signal,
  }).then((res) => {
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    function pump(): Promise<void> | undefined {
      return reader?.read().then(({ done, value }) => {
        if (done) { onDone(); return }
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""
        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim()
          if (!line || line === "[DONE]") {
            if (line === "[DONE]") onDone()
            continue
          }
          try { onLine(JSON.parse(line)) } catch {}
        }
        return pump()
      })
    }
    pump()
  })
}

// ── Pivot ──────────────────────────────────────────────
export interface PivotRequest {
  episode_id?: string
  scene_id?: string
  scenario?: string
  chaos_level?: number
  monica_cleanliness?: number
  sarcasm_meter?: number
}
export interface PivotDiff {
  original: { speaker: string; text: string }[]
  generated: { speaker: string; text: string }[]
}
export const triggerWhatIf = (req: PivotRequest) =>
  post<PivotDiff>("/api/pivot/what-if", req)
