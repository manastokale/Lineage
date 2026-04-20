import Layout from "../components/Layout"
import { useNavigate, useParams } from "react-router-dom"
import { useStore } from "../store/useStore"
import { fetchAgentProfile, type AgentProfile as ProfileData } from "../lib/api"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"

const CHAR_COLORS: Record<string, string> = {
  Chandler: "#6C5CE7", Monica: "#00B894", Ross: "#E17055",
  Rachel: "#E84393", Joey: "#00CEC9", Phoebe: "#A29BFE",
}

export default function AgentProfile() {
  const navigate = useNavigate()
  const { name } = useParams()
  const { agents } = useStore()
  const agent = agents.find(a => a.name === name)
  const [profile, setProfile] = useState<ProfileData | null>(null)

  const color = agent?.color || CHAR_COLORS[name || ""] || "#6C5CE7"

  useEffect(() => {
    if (!name) return
    fetchAgentProfile(name).then(setProfile).catch(console.error)
  }, [name])

  if (!profile) {
    return (
      <Layout activeNav="/cast">
        <div className="flex items-center justify-center h-96">
          <div className="flex gap-2">
            <div className="w-4 h-4 bg-black animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-4 h-4 bg-black animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-4 h-4 bg-black animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activeNav="/cast">
      <div className="flex items-center gap-2 text-sm font-bold text-black/60 mb-6 mt-4">
        <button onClick={() => navigate("/cast")} className="hover:text-black uppercase">Cast Roster</button>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="uppercase" style={{ color }}>{name}.ai</span>
      </div>

      <h1 className="text-5xl md:text-7xl font-headline text-ink tracking-tight mb-10" style={{ textShadow: `4px 4px 0px ${color}44` }}>
        Agent Profile
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Identity Card */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-8 neo-card p-0 flex flex-col md:flex-row">
          <div className="md:w-1/3 border-b-4 md:border-b-0 md:border-r-4 border-black flex items-center justify-center p-8"
            style={{ backgroundColor: color + "15" }}>
            <div className="w-36 h-36 bg-white border-4 border-black shadow-hard flex items-center justify-center text-8xl">
              {profile.emoji}
            </div>
          </div>
          <div className="md:w-2/3 p-8 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <h2 className="font-headline text-4xl text-ink uppercase">{name}.ai</h2>
              <span className="inline-block border-2 border-black px-3 py-1 font-black text-xs uppercase shadow-hard-xs" style={{ backgroundColor: color + "22", color }}>
                {profile.version} · {profile.status}
              </span>
            </div>
            <p className="text-xl font-black uppercase tracking-wider" style={{ color }}>{profile.subtitle}</p>
            <div className="bg-cream border-2 border-black p-5 relative mt-2">
              <span className="material-symbols-outlined absolute -top-3 -left-3 text-3xl" style={{ color: color + "44" }}>format_quote</span>
              <p className="font-bold italic text-black/70 leading-relaxed">"{profile.quote}"</p>
            </div>
          </div>
        </motion.section>

        {/* Relationship Graph */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-4 neo-card p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-lg" style={{ color }}>share_reviews</span>
              Relationships
            </h3>
          </div>
          <div className="relative h-48 bg-cream border-2 border-dashed border-black/20 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200">
              <line x1="200" y1="100" x2="100" y2="50"  stroke={color} strokeOpacity="0.6" strokeWidth="4" />
              <line x1="200" y1="100" x2="300" y2="60"  stroke={color} strokeOpacity="0.4" strokeWidth="2" />
              <line x1="200" y1="100" x2="250" y2="160" stroke={color} strokeOpacity="0.5" strokeWidth="3" />
              <line x1="200" y1="100" x2="120" y2="150" stroke={color} strokeOpacity="0.8" strokeWidth="5" />
            </svg>
            <div className="relative w-full h-full">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border-3 border-black shadow-hard-xs z-20 flex items-center justify-center text-white font-black text-xs" style={{ backgroundColor: color }}>
                {(name || "CH").slice(0, 2).toUpperCase()}
              </div>
              {(profile.relationships || []).map((r, i) => {
                const positions = [
                  { top: "40px", left: "70px" }, { top: "50px", right: "70px" },
                  { bottom: "30px", left: "90px" }, { bottom: "25px", right: "120px" },
                ]
                const pos = positions[i % positions.length]
                return (
                  <div key={r.id} className="absolute w-9 h-9 bg-white border-2 border-black shadow-hard-xs z-10 flex items-center justify-center text-[10px] font-black hover:scale-110 transition-transform cursor-pointer"
                    style={pos}>{r.id}</div>
                )
              })}
            </div>
          </div>
        </motion.section>

        {/* Personality Matrix */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-6 neo-card p-8">
          <h3 className="font-black text-lg uppercase tracking-wider mb-8 flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color }}>analytics</span>
            Personality Matrix
          </h3>
          <div className="space-y-6">
            {Object.entries(profile.personality).map(([trait, value]) => (
              <div key={trait}>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-black uppercase tracking-wider">{trait}</span>
                  <span className="text-xs font-black" style={{ color }}>{value}%</span>
                </div>
                <div className="h-4 w-full bg-cream border-2 border-black overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, delay: 0.3 }}
                    className="h-full" style={{ backgroundColor: color }} />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Recent Lines */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-6 neo-card p-8 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-lg uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ color }}>description</span>
              Recent Lines
            </h3>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px]">
            {profile.recentLines.map((line, i) => (
              <div key={i} className="bg-cream border-2 border-black p-4 hover:bg-primary/20 transition-none cursor-pointer">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-black text-[10px] uppercase px-2 py-0.5 border border-black" style={{ backgroundColor: color + "22", color }}>{line.scene}</span>
                  <span className="text-[10px] font-bold text-black/50">{line.time}</span>
                </div>
                <p className="text-sm font-bold italic leading-snug">"{line.text}"</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Deploy Banner */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="col-span-12 bg-black border-4 border-black p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-hard">
          <div>
            <h4 className="text-3xl font-headline text-primary mb-2">DEPLOY AGENT?</h4>
            <p className="text-white/60 font-bold">Ready for the Central Perk simulation scene.</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button onClick={() => navigate("/cast")}
              className="flex-1 md:flex-none px-8 py-4 text-white font-black uppercase border-2 border-white/30 hover:bg-white/10 transition-all">
              CANCEL
            </button>
            <button className="flex-1 md:flex-none px-10 py-4 text-black font-black uppercase border-2 border-black shadow-hard-sm hover:shadow-hard transition-all flex items-center justify-center gap-2 btn-press" style={{ backgroundColor: color }}>
              <span className="material-symbols-outlined text-sm">rocket_launch</span>
              PUSH TO PRODUCTION
            </button>
          </div>
        </motion.section>
      </div>
    </Layout>
  )
}
