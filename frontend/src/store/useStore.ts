import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { Episode } from "../types"

interface AppState {
  episodes: Episode[]
  setEpisodes: (episodes: Episode[]) => void
  activeSeason: number
  setActiveSeason: (season: number) => void
  activeEpisodeId: string | null
  setActiveEpisode: (id: string | null) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      episodes: [],
      setEpisodes: (episodes) =>
        set((state) => ({
          episodes,
          activeSeason: episodes.some((episode) => (episode.season || 0) === state.activeSeason)
            ? state.activeSeason
            : episodes[0]?.season || 1,
          activeEpisodeId: episodes.some((episode) => episode.episode_id === state.activeEpisodeId)
            ? state.activeEpisodeId
            : episodes.find((episode) => (episode.season || 0) === state.activeSeason)?.episode_id || episodes[0]?.episode_id || null,
        })),
      activeSeason: 1,
      setActiveSeason: (season) => set({ activeSeason: season }),
      activeEpisodeId: null,
      setActiveEpisode: (id) => set({ activeEpisodeId: id }),
    }),
    {
      name: "lineage-shell-state",
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        activeSeason: state.activeSeason,
        activeEpisodeId: state.activeEpisodeId,
      }),
    },
  ),
)
