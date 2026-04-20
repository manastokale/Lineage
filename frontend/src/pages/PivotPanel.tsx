import { useNavigate } from "react-router-dom"
import { useStore } from "../store/useStore"
import { triggerWhatIf, type PivotDiff } from "../lib/api"
import { useState } from "react"
import { motion } from "framer-motion"

export default function PivotPanel() {
  const navigate = useNavigate()
  const { pivotConfig, setPivotConfig } = useStore()
  const [scenario, setScenario] = useState(pivotConfig.scenario)
  const [chaos, setChaos] = useState(pivotConfig.chaos_level)
  const [cleanliness, setCleanliness] = useState(pivotConfig.monica_cleanliness)
  const [sarcasm, setSarcasm] = useState(pivotConfig.sarcasm_meter)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PivotDiff | null>(null)

  const handleAction = async () => {
    setPivotConfig({ scenario, chaos_level: chaos, monica_cleanliness: cleanliness, sarcasm_meter: sarcasm })
    setLoading(true)
    try {
      const diff = await triggerWhatIf({
        scenario, chaos_level: chaos,
        monica_cleanliness: cleanliness, sarcasm_meter: sarcasm,
      })
      setResult(diff)
    } catch (err) {
      console.error("Pivot failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-cream min-h-screen flex items-center justify-center p-4 md:p-8">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="w-full max-w-sm bg-white border-4 border-black shadow-hard p-0 flex flex-col">

        <div className="bg-sitcom-purple p-5 border-b-4 border-black flex items-center justify-between">
          <h2 className="font-headline text-2xl text-primary uppercase tracking-wide">The Pivot!</h2>
          <span className="material-symbols-outlined text-primary text-3xl icon-fill">alt_route</span>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="font-black text-sm uppercase tracking-wider flex items-center gap-2" htmlFor="scenario-input">
              <span className="material-symbols-outlined text-sitcom-muted text-lg">edit_note</span>
              Scenario Override
            </label>
            <textarea id="scenario-input" value={scenario} onChange={(e) => setScenario(e.target.value)}
              className="w-full h-[120px] resize-none border-4 border-black p-3 font-bold bg-cream placeholder:text-black/40 focus:outline-none focus:ring-4 focus:ring-highlight"
              placeholder="e.g., A monkey steals the remote..." />
          </div>

          <div className="border-t-2 border-dashed border-sitcom-muted" />

          <div className="flex flex-col gap-5">
            <h3 className="font-headline text-xl uppercase">Tweak the Vibe</h3>
            {[
              { label: "Chaos Level", value: chaos, set: setChaos },
              { label: "Monica Cleanliness", value: cleanliness, set: setCleanliness },
              { label: "Sarcasm Meter", value: sarcasm, set: setSarcasm },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <label className="font-black text-sm uppercase">{s.label}</label>
                  <span className="font-black text-sm bg-primary px-2 py-0.5 border-2 border-black shadow-hard-xs">{s.value}%</span>
                </div>
                <input type="range" min="1" max="100" value={s.value} onChange={(e) => s.set(Number(e.target.value))} />
              </div>
            ))}
          </div>

          {/* Result */}
          {result && (
            <div className="border-2 border-black p-4 bg-cream space-y-2">
              <h4 className="font-black text-xs uppercase mb-2">Generated diff:</h4>
              {result.generated.map((line, i) => (
                <div key={i} className="text-xs">
                  <span className="font-black" style={{ color: "#6C5CE7" }}>{line.speaker}:</span>{" "}
                  <span className="font-bold">{line.text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t-4 border-black">
            <button onClick={handleAction} disabled={loading}
              className="w-full h-[56px] bg-highlight border-4 border-black shadow-hard flex items-center justify-center gap-2 cursor-pointer transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-hard-hover btn-press disabled:opacity-50">
              <span className="font-headline text-xl uppercase tracking-wider">
                {loading ? "PIVOTING..." : "ACTION!"}
              </span>
              <span className="material-symbols-outlined text-2xl icon-fill">movie</span>
            </button>
            <p className="text-center text-xs font-black text-sitcom-muted mt-3 italic uppercase">Warning: May cause timeline splits.</p>
          </div>

          <button onClick={() => navigate("/")}
            className="text-center text-sm font-black text-black/60 hover:text-black uppercase transition-none">
            ← Back to Central Hub
          </button>
        </div>
      </motion.div>
    </div>
  )
}
