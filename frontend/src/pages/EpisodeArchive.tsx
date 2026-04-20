import Layout from "../components/Layout"
import { useNavigate } from "react-router-dom"
import { useStore } from "../store/useStore"
import { motion } from "framer-motion"

const STATUS_COLORS: Record<string, { bg: string; label: string }> = {
  final:           { bg: "bg-primary",          label: "FINAL" },
  draft:           { bg: "bg-highlight",         label: "DRAFT" },
  "what-if-branch":{ bg: "bg-sitcom-purple text-white", label: "WHAT-IF BRANCH" },
}

const EPISODE_ICONS = ["coffee", "apartment", "payments", "local_pizza", "bolt"]

export default function EpisodeArchive() {
  const navigate = useNavigate()
  const { episodes } = useStore()

  return (
    <Layout activeNav="/archive">
      {/* Header */}
      <header className="mb-12 mt-4">
        <h1 className="text-6xl md:text-8xl font-headline text-ink tracking-tight mb-2" style={{ textShadow: "4px 4px 0px #F472B6" }}>
          Episode Archive
        </h1>
        <div className="flex items-center gap-4 mt-6">
          <div className="inline-block bg-highlight border-2 border-black px-4 py-2 font-black uppercase shadow-hard-sm">
            Total: {episodes.length} Episodes
          </div>
          <div className="inline-block bg-accent border-2 border-black px-4 py-2 font-black uppercase shadow-hard-sm">
            Season 1 Active
          </div>
        </div>
      </header>

      {/* Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {episodes.map((ep, i) => {
          const isWhatIf = ep.status === "what-if-branch"
          const status = STATUS_COLORS[ep.status] || STATUS_COLORS.final

          if (isWhatIf) {
            return (
              <motion.div key={ep.episode_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="neo-card p-0 flex flex-col group bg-pink-100 md:col-span-2 cursor-pointer"
                onClick={() => navigate(`/episode/${ep.episode_id}`)}>
                <div className="flex flex-col md:flex-row h-full">
                  <div className="md:w-1/2 border-b-4 md:border-b-0 md:border-r-4 border-black relative overflow-hidden h-64 md:h-auto bg-gradient-to-br from-purple-200 via-purple-300 to-accent/30">
                    <div className="absolute top-4 left-4 bg-sitcom-purple text-white border-2 border-black px-4 py-2 font-black text-sm uppercase shadow-hard-sm">
                      WHAT-IF BRANCH
                    </div>
                  </div>
                  <div className="p-8 md:w-1/2 flex flex-col justify-between bg-white">
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <span className="font-black text-accent text-lg tracking-widest uppercase">{ep.episode_id.toUpperCase()} (ALT)</span>
                        <span className="material-symbols-outlined text-4xl text-black">bolt</span>
                      </div>
                      <h3 className="font-headline text-4xl text-ink leading-none mb-6">{ep.title}</h3>
                      <p className="text-black/70 font-bold mb-6">Explore the alternate reality where the ATM vestibule blackout lasted for three entire days.</p>
                    </div>
                    <div className="pt-6 border-t-4 border-black flex justify-between items-center text-sm font-black uppercase">
                      <span>LAST EDITED: {ep.created_at.toUpperCase()}</span>
                      <button className="bg-primary border-2 border-black px-4 py-2 shadow-hard-xs active:shadow-none active:translate-x-1 active:translate-y-1">
                        OPEN SCRIPT
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          }

          return (
            <motion.div key={ep.episode_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="neo-card p-0 flex flex-col group bg-white cursor-pointer"
              onClick={() => navigate(`/episode/${ep.episode_id}`)}>
              <div className="h-48 border-b-4 border-black relative overflow-hidden bg-gradient-to-br from-amber-100 to-orange-200 group-hover:scale-[1.02] transition-transform">
                <div className={`absolute top-4 left-4 ${status.bg} border-2 border-black px-2 py-1 font-black text-xs uppercase shadow-hard-xs`}>
                  {status.label}
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-black text-accent text-sm tracking-widest uppercase">{ep.episode_id.toUpperCase()}</span>
                    <span className="material-symbols-outlined text-black">{EPISODE_ICONS[i] || "coffee"}</span>
                  </div>
                  <h3 className="font-headline text-2xl text-ink leading-tight mb-4">{ep.title}</h3>
                </div>
                <div className="pt-4 border-t-2 border-black/10 flex justify-between items-center text-xs font-bold text-black/60">
                  <span>CREATED: {ep.created_at.toUpperCase()}</span>
                  <span className="material-symbols-outlined text-sm">schedule</span>
                </div>
              </div>
            </motion.div>
          )
        })}

        {/* Create New Card */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="neo-card p-0 flex flex-col cursor-pointer">
          <div className="h-48 border-b-4 border-black bg-highlight flex items-center justify-center">
            <span className="material-symbols-outlined text-7xl text-black/20">add_circle</span>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center items-center">
            <h3 className="font-headline text-2xl text-ink text-center mb-4">Create New Episode</h3>
            <button className="bg-black text-white px-8 py-3 font-black uppercase tracking-widest hover:bg-accent transition-colors">START SCRIPT</button>
          </div>
        </motion.div>
      </section>
    </Layout>
  )
}
