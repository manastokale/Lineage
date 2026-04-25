import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import Layout from "../components/Layout"
import { fetchAgentProfile } from "../lib/api"
import type { AgentProfile as AgentProfileType } from "../types"

export default function AgentProfile() {
  const { name } = useParams()
  const [profile, setProfile] = useState<AgentProfileType | null>(null)

  useEffect(() => {
    if (!name) return
    fetchAgentProfile(name).then(setProfile).catch(console.error)
  }, [name])

  return (
    <Layout title={name || "Character"}>
      {!profile ? (
        <div className="font-black uppercase">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="border-4 border-black bg-white p-6 shadow-hard-sm">
            <div className="font-headline text-4xl">{profile.name}</div>
            <div className="mt-2 font-black uppercase text-black/60">{profile.occupation}</div>
          </div>
          <div className="border-4 border-black bg-white p-6 shadow-hard-sm">
            <div className="font-black uppercase">Prior Arc Trail</div>
            <div className="mt-4 space-y-3">
              {(profile.arcSummaries || []).map((item) => (
                <div key={item.episode_id} className="border-2 border-black bg-cream p-3">
                  <div className="font-black uppercase text-xs">{item.episode_id.toUpperCase()}</div>
                  <div className="mt-1 font-bold">{item.summary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
