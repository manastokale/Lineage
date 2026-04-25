import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import Layout from "../components/Layout"
import { fetchEpisodeTimeline } from "../lib/api"
import type { TimelineEntry } from "../types"

export default function EpisodeView() {
  const { id } = useParams()
  const [entries, setEntries] = useState<TimelineEntry[]>([])

  useEffect(() => {
    if (!id) return
    fetchEpisodeTimeline(id).then(setEntries).catch(console.error)
  }, [id])

  return (
    <Layout title={id?.toUpperCase() || "Episode"}>
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div key={`${entry.scene_id}-${entry.line_index ?? index}`} className="border-2 border-black bg-white p-3">
            <div className="font-black uppercase text-xs">{entry.type}</div>
            <div className="mt-1 font-bold">{entry.speaker ? `${entry.speaker}: ` : ""}{entry.text}</div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
