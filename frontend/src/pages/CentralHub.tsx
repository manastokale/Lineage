import Layout from "../components/Layout"
import { useStore } from "../store/useStore"
import { useNavigate } from "react-router-dom"
import { streamScene } from "../lib/api"
import { useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

const CHAR_COLORS: Record<string, string> = {
  Chandler: "#6C5CE7", Monica: "#00B894", Ross: "#E17055",
  Rachel: "#E84393", Joey: "#00CEC9", Phoebe: "#A29BFE",
}

export default function CentralHub({ apiInfo }: { apiInfo?: string }) {
  const { agents, streamedLines, appendLine, clearStream, isStreaming, setIsStreaming } = useStore()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handlePlay = () => {
    clearStream()
    setIsStreaming(true)
    abortRef.current = new AbortController()
    streamScene(
      "s01e01", "s01e01_sc01",
      (line) => appendLine(line),
      () => setIsStreaming(false),
      abortRef.current.signal,
    )
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
    clearStream()
  }

  const handlePause = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [streamedLines.length])

  return (
    <Layout activeNav="/">
      <header className="mb-10 mt-4">
        <h1 className="text-6xl md:text-8xl font-headline text-ink tracking-tight mb-2" style={{ textShadow: "4px 4px 0px #F472B6" }}>
          Central Hub
        </h1>
        <div className="flex flex-wrap items-center gap-4 mt-6">
          <div className="inline-block bg-highlight border-2 border-black px-4 py-2 font-black uppercase shadow-hard-sm">
            Episode: S01E01
          </div>
          <div className="inline-block bg-accent border-2 border-black px-4 py-2 font-black uppercase shadow-hard-sm">
            {agents.length} Agents Active
          </div>
          {apiInfo && (
            <div className="inline-block bg-white border-2 border-black px-4 py-2 font-black uppercase shadow-hard-sm text-xs">
              ● {apiInfo}
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={handlePlay}
              className="bg-black text-white px-6 py-3 font-black uppercase tracking-widest border-2 border-black shadow-hard-sm hover:bg-highlight hover:text-black transition-colors btn-press flex items-center gap-2">
              <span className="material-symbols-outlined icon-fill">play_arrow</span> PLAY
            </button>
            <button onClick={handlePause}
              className="bg-white text-black px-6 py-3 font-black uppercase tracking-widest border-2 border-black shadow-hard-sm hover:bg-primary transition-colors btn-press flex items-center gap-2">
              <span className="material-symbols-outlined">pause</span> PAUSE
            </button>
            <button onClick={handleStop}
              className="bg-accent text-black px-6 py-3 font-black uppercase tracking-widest border-2 border-black shadow-hard-sm hover:bg-sitcom-muted hover:text-white transition-colors btn-press flex items-center gap-2">
              <span className="material-symbols-outlined icon-fill">stop</span> STOP
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cast Roster Mini */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="neo-card p-0">
            <div className="bg-accent border-b-4 border-black p-4">
              <h2 className="font-headline text-xl text-black">Cast Roster</h2>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {agents.map((a) => (
                <button key={a.name} onClick={() => navigate(`/agent/${a.name}`)}
                  className="flex items-center gap-3 p-3 hover:bg-highlight transition-none cursor-pointer border-2 border-transparent hover:border-black text-left w-full">
                  <span className="text-2xl">{a.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm uppercase truncate">{a.name}</p>
                    <p className="text-xs font-bold text-black/60 truncate">{a.occupation}</p>
                  </div>
                  <span className="w-3 h-3 bg-green-400 border-2 border-black" />
                </button>
              ))}
            </div>
          </div>
          <div className="neo-card p-5 bg-primary">
            <h3 className="font-headline text-sm text-black mb-1 uppercase">Laughter Track</h3>
            <p className="font-headline text-5xl text-black">87%</p>
            <div className="w-full h-4 bg-white border-2 border-black mt-3 overflow-hidden">
              <div className="h-full bg-black w-[87%]" />
            </div>
          </div>
        </div>

        {/* Live Script Stream */}
        <div className="lg:col-span-6">
          <div className="neo-card p-0 flex flex-col h-[650px]">
            <div className="bg-black text-primary p-4 border-b-4 border-black flex justify-between items-center">
              <h2 className="font-headline text-2xl uppercase tracking-wider">Live Script</h2>
              <div className="flex items-center gap-2">
                {isStreaming && <span className="w-3 h-3 bg-sitcom-muted border-2 border-primary animate-pulse" />}
                <span className="font-black text-xs text-primary uppercase tracking-widest">
                  {isStreaming ? "Recording" : "Idle"}
                </span>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-cream space-y-5">
              <div className="text-center font-black text-sm uppercase tracking-[0.15em] py-3 border-b-2 border-dashed border-black/20">
                [ SCENE START: Central Perk · Afternoon ]
              </div>

              <AnimatePresence>
                {streamedLines.map((line, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    className="group relative max-w-[90%]">
                    <div className="bg-white border-4 border-black shadow-hard-sm p-4 transition-all group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] group-hover:shadow-hard">
                      <p className="font-black text-sm uppercase tracking-widest mb-1" style={{ color: CHAR_COLORS[line.speaker] || "#000" }}>
                        {line.speaker}
                      </p>
                      <p className="font-bold text-base leading-relaxed">{line.text}</p>
                    </div>
                    <button className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-primary border-2 border-black shadow-hard-xs px-3 py-1 font-black text-xs uppercase transition-all hover:bg-highlight btn-press">
                      PIVOT!
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isStreaming && (
                <div className="flex gap-2 items-center p-4">
                  <div className="w-3 h-3 bg-black animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-3 h-3 bg-black animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-3 h-3 bg-black animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}

              {!isStreaming && streamedLines.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-50 py-20">
                  <span className="text-6xl mb-4">🎬</span>
                  <h2 className="font-headline text-2xl mb-2">Waiting for the cold open...</h2>
                  <p className="font-bold text-black/60">Hit PLAY to start generating the episode!</p>
                </div>
              )}
            </div>

            <div className="border-t-4 border-black p-4 bg-white">
              <div className="flex gap-2">
                <input type="text" placeholder="Inject a director's note..."
                  className="flex-1 bg-cream border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-accent" />
                <button className="bg-black text-primary px-4 border-2 border-black font-black uppercase text-sm hover:bg-highlight hover:text-black transition-none btn-press">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* The Pivot sidebar */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="neo-card p-0 flex flex-col h-[650px]">
            <div className="bg-sitcom-purple text-primary p-4 border-b-4 border-black flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-primary">alt_route</span>
              <h2 className="font-headline text-xl uppercase">The Pivot</h2>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
              <p className="font-bold text-sm text-black/70">Inject a "What-If" scenario to derail the current scene.</p>
              {[
                { title: "Genre Swap", desc: "Turn it into a Noir mystery.", icon: "movie_filter", bg: "bg-white" },
                { title: "Surprise Entrance", desc: "Force an inactive agent through the door.", icon: "door_open", bg: "bg-accent/30" },
                { title: "Prop Malfunction", desc: "The coffee machine explodes.", icon: "build_circle", bg: "bg-white" },
              ].map((card) => (
                <button key={card.title}
                  className={`${card.bg} border-2 border-black shadow-hard-xs p-4 text-left hover:bg-highlight transition-none cursor-pointer group btn-press w-full`}>
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-sm uppercase">{card.title}</h4>
                    <span className="material-symbols-outlined text-sm text-black/40 group-hover:text-black">{card.icon}</span>
                  </div>
                  <p className="text-xs font-bold text-black/60 group-hover:text-black">{card.desc}</p>
                </button>
              ))}
              <div className="mt-auto pt-4">
                <label className="font-black text-xs uppercase tracking-wider text-black/60 mb-2 block">Custom</label>
                <textarea className="w-full bg-cream border-2 border-black p-3 font-bold text-sm focus:outline-none focus:border-accent resize-none" rows={3} placeholder="e.g., Gravity stops working." />
                <button onClick={() => navigate("/pivot")}
                  className="w-full mt-3 bg-highlight text-black font-black uppercase py-3 border-2 border-black shadow-hard-sm hover:bg-accent transition-none btn-press">
                  Execute Pivot
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
