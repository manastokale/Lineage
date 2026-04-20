import { create } from "zustand"
import type { Agent, Episode, DialogueLine, PivotConfig } from "../types"

interface AppState {
  currentPage: string
  setCurrentPage: (page: string) => void

  agents: Agent[]
  setAgents: (agents: Agent[]) => void
  updateAgentEmotion: (name: string, emotion: string, value: number) => void

  episodes: Episode[]
  setEpisodes: (episodes: Episode[]) => void
  activeEpisodeId: string | null
  setActiveEpisode: (id: string | null) => void

  streamedLines: DialogueLine[]
  appendLine: (line: DialogueLine) => void
  clearStream: () => void
  isStreaming: boolean
  setIsStreaming: (v: boolean) => void

  pivotConfig: PivotConfig
  setPivotConfig: (config: Partial<PivotConfig>) => void
  whatIfActive: boolean
  setWhatIfActive: (v: boolean) => void

  mode: "standard" | "what_if" | "converge"
  setMode: (m: "standard" | "what_if" | "converge") => void

  selectedAgent: string | null
  setSelectedAgent: (name: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  currentPage: "hub",
  setCurrentPage: (page) => set({ currentPage: page }),

  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgentEmotion: (name, emotion, value) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.name === name
          ? { ...a, emotions: { ...a.emotions, [emotion]: value } }
          : a
      ),
    })),

  episodes: [],
  setEpisodes: (episodes) => set({ episodes }),
  activeEpisodeId: null,
  setActiveEpisode: (id) => set({ activeEpisodeId: id }),

  streamedLines: [],
  appendLine: (line) => set((s) => ({ streamedLines: [...s.streamedLines, line] })),
  clearStream: () => set({ streamedLines: [] }),
  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  pivotConfig: { scenario: "", chaos_level: 80, monica_cleanliness: 100, sarcasm_meter: 45 },
  setPivotConfig: (config) => set((s) => ({ pivotConfig: { ...s.pivotConfig, ...config } })),
  whatIfActive: false,
  setWhatIfActive: (v) => set({ whatIfActive: v }),

  mode: "standard",
  setMode: (m) => set({ mode: m }),

  selectedAgent: null,
  setSelectedAgent: (name) => set({ selectedAgent: name }),
}))
