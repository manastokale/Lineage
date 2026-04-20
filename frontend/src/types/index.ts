export type CharacterName = "Chandler" | "Monica" | "Ross" | "Rachel" | "Joey" | "Phoebe"

export interface EmotionLevels {
  joy?: number
  anger?: number
  anxiety?: number
  sarcasm?: number
  loneliness?: number
  [key: string]: number | undefined
}

export interface Agent {
  name: CharacterName | string
  emotions: EmotionLevels
  identity_file?: string
  avatar?: string
  occupation?: string
  emoji?: string
  color?: string
}

export interface DialogueLine {
  speaker: CharacterName | string
  text: string
  scene_id: string
  generated: boolean
  emotion_tags?: string[]
  stage_direction?: string
}

export interface Scene {
  scene_id: string
  location: string
  lines: DialogueLine[]
  scene_description?: string
}

export interface Episode {
  episode_id: string
  title: string
  season?: number
  episode?: number
  status: "final" | "draft" | "what-if-branch"
  created_at: string
  scene_count: number
  thumbnail?: string
}

export interface PivotConfig {
  scenario: string
  chaos_level: number
  monica_cleanliness: number
  sarcasm_meter: number
}

export interface StreamEvent {
  speaker: string
  text: string
  scene_id: string
  generated: boolean
}

export const CHARACTER_COLORS: Record<string, string> = {
  Chandler: "#4640e3",
  Monica:   "#0f6e56",
  Ross:     "#ba7517",
  Rachel:   "#d4537e",
  Joey:     "#1d9e75",
  Phoebe:   "#993556",
}
