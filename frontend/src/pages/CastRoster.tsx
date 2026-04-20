import Layout from "../components/Layout"
import { useNavigate } from "react-router-dom"
import { useStore } from "../store/useStore"
import { motion } from "framer-motion"

const EMOTION_COLORS: Record<string, string> = {
  joy: "#00B894", anger: "#E84393", sarcasm: "#6C5CE7", anxiety: "#E17055",
}

export default function CastRoster() {
  const navigate = useNavigate()
  const { agents } = useStore()

  return (
    <Layout activeNav="/cast">
      {/* Header */}
      <header className="mb-12 mt-4">
        <h1 className="text-6xl md:text-8xl font-headline text-ink tracking-tight mb-2" style={{ textShadow: "4px 4px 0px #22D3EE" }}>
          Cast Roster
        </h1>
        <div className="flex flex-wrap items-center gap-4 mt-6">
          <div className="inline-block bg-accent border-2 border-black px-4 py-2 font-black uppercase shadow-hard-sm">
            {agents.length} Agents Active
          </div>
          <div className="inline-block bg-primary border-2 border-black px-4 py-2 font-black uppercase shadow-hard-sm">
            Emotional Volatility: HIGH
          </div>
          <div className="ml-auto hidden md:block">
            <button className="bg-black text-white px-6 py-3 font-black uppercase tracking-widest border-2 border-black shadow-hard-sm hover:bg-highlight hover:text-black transition-colors btn-press flex items-center gap-2">
              <span className="material-symbols-outlined">add</span> New Agent
            </button>
          </div>
        </div>
      </header>

      {/* Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {agents.map((agent, i) => (
          <motion.div key={agent.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="neo-card p-0 flex flex-col cursor-pointer"
            onClick={() => navigate(`/agent/${agent.name}`)}>
            {/* Card Header */}
            <div className="border-b-4 border-black p-6 flex items-center gap-4" style={{ backgroundColor: (agent.color || "#6C5CE7") + "18" }}>
              <div className="w-16 h-16 bg-white border-2 border-black shadow-hard-xs flex items-center justify-center text-4xl">
                {agent.emoji}
              </div>
              <div className="flex-1">
                <h2 className="font-headline text-2xl text-ink">{agent.name}</h2>
                <span className="inline-block bg-white border-2 border-black px-2 py-0.5 font-black text-xs uppercase shadow-hard-xs mt-1" style={{ color: agent.color || "#000" }}>
                  {agent.occupation}
                </span>
              </div>
              <button className="material-symbols-outlined text-black/40 hover:text-black" onClick={(e) => e.stopPropagation()}>more_vert</button>
            </div>

            {/* Emotion Bars */}
            <div className="p-6 space-y-4 flex-1">
              {Object.entries(agent.emotions)
                .filter(([_, v]) => v !== undefined)
                .slice(0, 3)
                .map(([emotion, value]) => (
                  <div key={emotion}>
                    <div className="flex justify-between text-xs font-black uppercase tracking-wider mb-1">
                      <span>{emotion}</span>
                      <span>{value}%</span>
                    </div>
                    <div className="h-4 w-full bg-cream border-2 border-black overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full" style={{ backgroundColor: EMOTION_COLORS[emotion] || "#000" }} />
                    </div>
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black/10 px-6 py-3 flex justify-between items-center text-xs font-bold text-black/60 uppercase">
              <span>Status: Active</span>
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </div>
          </motion.div>
        ))}

        {/* Add New Agent Card */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="neo-card p-0 flex flex-col cursor-pointer border-4 border-dashed border-black/40" style={{ boxShadow: "none" }}>
          <div className="h-full min-h-[300px] bg-highlight/20 flex flex-col items-center justify-center p-8 gap-4 hover:bg-highlight transition-colors">
            <div className="w-16 h-16 bg-white border-2 border-black shadow-hard-xs flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-black">add</span>
            </div>
            <span className="font-headline text-xl text-ink">Synthesize New Agent</span>
          </div>
        </motion.div>
      </section>
    </Layout>
  )
}
