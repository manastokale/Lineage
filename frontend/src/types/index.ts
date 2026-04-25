export type CharacterName =
  | "Chandler"
  | "Monica"
  | "Ross"
  | "Rachel"
  | "Joey"
  | "Phoebe"
  | string

export interface EmotionLevels {
  joy?: number
  anger?: number
  anxiety?: number
  sarcasm?: number
  loneliness?: number
  [key: string]: number | undefined
}

export interface Agent {
  name: CharacterName
  emotions: EmotionLevels
  identity_file?: string
  occupation?: string
  emoji?: string
  color?: string
}

export interface DialogueLine {
  speaker: CharacterName
  text: string
  scene_id: string
  generated: boolean
  emotion_tags?: string[]
  stage_direction?: string
  location?: string
}

export interface Scene {
  scene_id: string
  location: string
  scene_description?: string
  lines: DialogueLine[]
}

export interface Episode {
  episode_id: string
  title: string
  season?: number
  episode?: number
  status: "final" | "draft" | string
  created_at: string
  scene_count: number
  scenes?: Scene[]
  outline?: string
}

export interface TimelineEntry {
  type: "scene_start" | "dialogue" | "user_question" | "agent_reply" | "story"
  scene_id: string
  text: string
  generated: boolean
  speaker?: string
  line_index?: number
  location?: string
  emotion_tags?: string[]
  stage_direction?: string
}

export interface HealthSnapshot {
  status: string
  dummy_mode: boolean
  response_delay_seconds?: number
}

export interface StatsOverview {
  status: string
  dummy_mode: boolean
  dialogue_provider: string
  dialogue_model?: string
  summary_model?: string
  arc_summary_model?: string
  ask_model?: string
  response_delay_seconds?: number
  chroma: {
    connected: boolean
    mode: string
    memory_collection: { name: string; count: number }
    main_script_collection: { name: string; count: number }
  }
  library: {
    episodes_loaded: number
    seasons_loaded: number
    parsed_seasons: number[]
    expected_seasons: number[]
  }
  usage: {
    models: string[]
    limits: Record<string, { rpm?: number; tpm?: number }>
    active_roles: Record<string, string | boolean | number | undefined>
    totals: Record<string, { requests?: number; tokens?: number }>
    role_breakdown: Record<string, Record<string, { requests?: number; tokens?: number }>>
    character_breakdown: Record<string, Record<string, number>>
    window_totals: Record<string, { requests_per_minute?: number; tokens_per_minute?: number; requests_per_day?: number }>
  }
  debug: {
    rerank_enabled: boolean
    recent_rerank_traces: {
      recorded_at: number
      kind: string
      character: string
      episode_id: string
      scene_id: string
      anchor_line_index: number
      question: string
      retrieval_query: string
      arc_candidates: {
        episode_id: string
        title: string
        participants?: string[]
        score: number
        overlap: number
        title_overlap: number
        phrase_bonus: number
        participant_bonus: number
        query_name_hits: number
        recency_bonus: number
      }[]
      interaction_candidates: {
        episode_id: string
        title: string
        participants?: string[]
        score: number
        overlap: number
        title_overlap: number
        phrase_bonus: number
        participant_bonus: number
        query_name_hits: number
        recency_bonus: number
      }[]
    }[]
  }
  seasons: {
    season: number
    parsed_episodes: number
    expected_episodes: number
    stored_arcs: number
    expected_arcs: number
    covered_arcs: number
    overflow_arcs: number
    fully_covered_episodes: number
    transcript_ready: boolean
    arc_ready: boolean
  }[]
}

export interface AgentProfile {
  name: string
  subtitle: string
  version: string
  status: string
  quote: string
  emoji: string
  color: string | null
  occupation: string
  personality: Record<string, number>
  recentLines: { scene: string; text: string; time: string }[]
  arcSummaries?: { episode_id: string; title: string; summary: string }[]
  interactionSummaries?: { episode_id: string; title: string; participants: string[]; summary: string }[]
  relationships: { id: string; strength: string }[]
}

export interface CharacterFocusProfile extends AgentProfile {
  episodeCount?: number
  lineCount?: number
}

export interface GraphNode {
  id: string
  label: string
  importance: number
  line_count: number
  emotion: string
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
  strength: number
  distance: number
  emotion?: string
}

export interface EpisodeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const CHARACTER_COLORS: Record<string, string> = {
  Chandler: "#6C5CE7",
  Monica: "#00B894",
  Ross: "#E17055",
  Rachel: "#E84393",
  Joey: "#00CEC9",
  Phoebe: "#A29BFE",
}
