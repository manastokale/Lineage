import { useNavigate, useParams } from "react-router-dom"
import { streamScene } from "../lib/api"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { DialogueLine } from "../types"

const CHAR_COLORS: Record<string, string> = {
  Chandler: "#6C5CE7", Monica: "#00B894", Ross: "#E17055",
  Rachel: "#E84393", Joey: "#00CEC9", Phoebe: "#A29BFE",
}

export default function EpisodeView() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [lines, setLines] = useState<DialogueLine[]>([])
  const [isStreaming, setIsStreaming] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const episodeId = id || "s01e01"
  const sceneId = `${episodeId}_sc01`

  useEffect(() => {
    const abort = new AbortController()
    setLines([])
    setIsStreaming(true)
    streamScene(
      episodeId, sceneId,
      (line) => setLines((prev) => [...prev, line]),
      () => setIsStreaming(false),
      abort.signal,
    )
    return () => abort.abort()
  }, [episodeId, sceneId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [lines.length])

  return (
    <div className="bg-cream min-h-screen flex flex-col items-center py-8">
      <div className="w-full max-w-4xl px-4 mb-6 flex justify-start">
        <button onClick={() => navigate("/")}
          className="flex items-center gap-2 bg-white border-4 border-black shadow-hard-sm px-5 py-2 font-black text-sm uppercase hover:bg-highlight transition-none btn-press cursor-pointer">
          <span className="material-symbols-outlined font-bold text-sm">arrow_back</span>
          Back to Hub
        </button>
      </div>

      <main className="w-full max-w-4xl bg-white border-4 border-black shadow-hard flex flex-col h-[819px] overflow-hidden relative">
        <header className="bg-black text-primary border-b-4 border-black p-4 flex justify-between items-center z-10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-primary">movie_filter</span>
            <h1 className="text-2xl font-headline tracking-wide uppercase">The Episode</h1>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1 border-2 border-black">
            {isStreaming && <span className="w-3 h-3 bg-highlight border border-black animate-pulse" />}
            <span className="text-sm font-black text-black uppercase">
              {isStreaming ? "Live Broadcast" : "Complete"}
            </span>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-cream relative">
          <div className="w-full flex justify-center my-4">
            <div className="action-text text-sitcom-muted bg-white px-6 py-2 border-2 border-black shadow-hard-xs font-black text-sm uppercase">
              [ SCENE START: Central Perk · Afternoon ]
            </div>
          </div>

          <AnimatePresence>
            {lines.map((line, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="group relative flex w-full max-w-[85%] pr-16">
                  <div className="bg-white border-4 border-black shadow-hard-sm p-4 w-full transition-all group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] group-hover:shadow-hard">
                    <p className="font-black uppercase text-lg mb-1 tracking-wide" style={{ color: CHAR_COLORS[line.speaker] || "#000" }}>
                      {line.speaker}
                    </p>
                    <p className="font-bold text-base leading-relaxed">{line.text}</p>
                  </div>
                  <button className="absolute -right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-primary border-2 border-black shadow-hard-xs px-3 py-2 font-black text-sm uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-1 z-10 cursor-pointer">
                    <span className="material-symbols-outlined text-sm icon-fill">bolt</span>
                    PIVOT!
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isStreaming && (
            <div className="flex w-full max-w-[85%] mt-2">
              <div className="bg-white border-2 border-black shadow-hard-xs p-4 flex items-center gap-2 w-24 h-12">
                <div className="w-3 h-3 bg-black animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-3 h-3 bg-black animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-3 h-3 bg-black animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div className="h-4 w-full shrink-0" />
        </div>
      </main>
    </div>
  )
}
