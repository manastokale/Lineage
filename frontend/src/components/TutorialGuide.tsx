import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

const STORAGE_KEY = "lineage-tutorial-seen-v1"

const STEPS = [
  {
    eyebrow: "Why this exists",
    title: "Lineage answers from a specific moment in the script.",
    body:
      "The problem is not just asking what happened in Friends. The problem is asking what a character could know at one exact line, using only prior context and the current scene instead of spoiler-heavy recap memory.",
    tryThis: "Start in Hub, pick an episode, and treat the script like the source of truth.",
    route: "/",
  },
  {
    eyebrow: "Hub",
    title: "Read the episode feed, then anchor on one line.",
    body:
      "Use Up/Down to move line by line. Shift+Up/Down jumps scenes. Cmd or Ctrl+Up/Down jumps between flagged continuity risks. The blue highlight is the current moment every downstream tool will use.",
    tryThis: "Highlight any dialogue line, then press Enter to move directly into the Ask field.",
    route: "/",
  },
  {
    eyebrow: "Ask",
    title: "Ask a character from that exact point in time.",
    body:
      "Ask uses the selected speaker by default. You can mention other characters with @names. Replies should stay short, in-character, and grounded in prior memories plus recent scene context.",
    tryThis: "Ask something like: What do you remember about this? If it has not happened yet, expect the character to say so.",
    route: "/",
  },
  {
    eyebrow: "Continuity",
    title: "Plot-hole cards are leads, not final verdicts.",
    body:
      "The continuity scanner extracts possible claims, retrieves prior script/memory context, and asks a validator to flag tensions. If a highlighted line has a risk card, pressing Enter starts by asking why it may be a continuity issue.",
    tryThis: "Use Cmd/Ctrl+Up or Down to jump between flagged lines, then press Enter for a character POV explanation.",
    route: "/",
  },
  {
    eyebrow: "Edit impact",
    title: "Test changed dialogue and inspect downstream drift.",
    body:
      "The inline workbench lets you edit a selected line and estimate whether that change drifts from prior memory or later beats. It is meant for exploration, not automatic canon changes.",
    tryThis: "Open a line workbench, change the draft text, then run impact analysis.",
    route: "/",
  },
  {
    eyebrow: "Graph",
    title: "Use the character graph to inspect prior relationships.",
    body:
      "Select one node to see a character's prior arcs. Select multiple nodes with Cmd/Ctrl/Shift to inspect shared prior interactions before the active episode.",
    tryThis: "Open Graph, select Chandler, then add Monica to compare their shared interaction memory.",
    route: "/graph",
  },
  {
    eyebrow: "Usage",
    title: "Watch model traffic by model, role, and feature.",
    body:
      "Usage shows provider health, live model limits, RPD, and feature spread across Ask, edit impact, summaries, continuity scans, and generation tasks. Counts are for the current backend session.",
    tryThis: "Open Usage after asking a question or running impact analysis to see where the call landed.",
    route: "/usage",
  },
  {
    eyebrow: "Expectations",
    title: "This is a grounded assistant, not a magic canon oracle.",
    body:
      "Lineage should refuse non-Friends requests, avoid future spoilers from a character POV, and cite retrieved memory when useful. Model outputs can still be wrong, so treat flags and edit impact as review aids.",
    tryThis: "When in doubt, inspect the prior context chips and compare them to the script.",
    route: "/",
  },
]

function hasStoredTutorialSeen() {
  if (typeof window === "undefined") return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return true
  }
}

function storeTutorialSeen() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, "true")
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

type TutorialGuideProps = {
  className?: string
  triggerContent?: ReactNode
}

export default function TutorialGuide({ className, triggerContent }: TutorialGuideProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]
  const isLastStep = stepIndex === STEPS.length - 1

  useEffect(() => {
    if (!hasStoredTutorialSeen()) {
      setOpen(true)
    }
  }, [])

  function openGuide() {
    setStepIndex(0)
    setOpen(true)
  }

  function closeGuide() {
    storeTutorialSeen()
    setOpen(false)
  }

  function goToStepRoute() {
    storeTutorialSeen()
    setOpen(false)
    navigate(step.route)
  }

  return (
    <>
      <button
        type="button"
        onClick={openGuide}
        className={
          className ||
          "border-2 border-black bg-[#dcfce7] px-4 py-3 text-left font-black uppercase tracking-wider shadow-hard-xs hover:bg-highlight"
        }
      >
        {triggerContent || "Guide"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="lineage-guide-title">
          <div className="mx-auto grid h-full max-w-5xl grid-rows-[auto_1fr_auto] border-4 border-black bg-cream shadow-hard">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b-4 border-black bg-primary px-4 py-3 sm:px-5">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-black/60">First-Time Tutorial</div>
                <h2 id="lineage-guide-title" className="mt-1 font-headline text-3xl leading-none sm:text-4xl">
                  How To Use Lineage
                </h2>
              </div>
              <button
                type="button"
                onClick={closeGuide}
                className="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] shadow-hard-xs"
              >
                Skip
              </button>
            </div>

            <div className="grid min-h-0 gap-0 overflow-y-auto lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="border-b-4 border-black bg-white p-3 lg:border-b-0 lg:border-r-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/55">Tour Map</div>
                <div className="mt-3 grid gap-2">
                  {STEPS.map((item, index) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => setStepIndex(index)}
                      className={`border-2 px-3 py-2 text-left ${
                        index === stepIndex ? "border-black bg-highlight shadow-hard-xs" : "border-black/30 bg-cream hover:border-black"
                      }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
                        {String(index + 1).padStart(2, "0")} / {item.eyebrow}
                      </div>
                      <div className="mt-1 text-xs font-black uppercase leading-5">{item.title}</div>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="min-h-0 overflow-y-auto p-4 sm:p-6">
                <div className="grid gap-5">
                  <div className="border-4 border-black bg-white p-5 shadow-hard-sm">
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-black/55">{step.eyebrow}</div>
                    <div className="mt-3 max-w-3xl text-3xl font-black uppercase leading-tight sm:text-5xl">{step.title}</div>
                    <p className="mt-4 max-w-3xl text-base font-bold leading-7 text-black/75 sm:text-lg">{step.body}</p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="border-2 border-black bg-[#fffaf1] p-4 xl:col-span-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/55">Try This</div>
                      <div className="mt-2 text-lg font-black leading-7">{step.tryThis}</div>
                    </div>
                    <div className="border-2 border-black bg-[#eef6ff] p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/55">Mental Model</div>
                      <div className="mt-2 text-sm font-bold leading-6 text-black/75">
                        Select moment {"->"} retrieve prior context {"->"} ask or inspect {"->"} verify against the script.
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="border-2 border-black bg-white p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/55">Best For</div>
                      <div className="mt-2 text-sm font-bold leading-6">Moment-aware character questions, continuity review, and edit-impact exploration.</div>
                    </div>
                    <div className="border-2 border-black bg-white p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/55">Not For</div>
                      <div className="mt-2 text-sm font-bold leading-6">General web answers, non-Friends requests, or unquestioned final canon decisions.</div>
                    </div>
                    <div className="border-2 border-black bg-white p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-black/55">Expected Output</div>
                      <div className="mt-2 text-sm font-bold leading-6">Short grounded replies, prior-memory references, and reviewable risk signals.</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex flex-col gap-3 border-t-4 border-black bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {STEPS.map((item, index) => (
                  <button
                    key={item.eyebrow}
                    type="button"
                    onClick={() => setStepIndex(index)}
                    aria-label={`Go to tutorial step ${index + 1}`}
                    className={`h-3 w-8 border border-black ${index === stepIndex ? "bg-black" : "bg-cream"}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                  disabled={stepIndex === 0}
                  className="border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goToStepRoute}
                  className="border-2 border-black bg-highlight px-4 py-2 text-xs font-black uppercase tracking-[0.16em] shadow-hard-xs"
                >
                  Open {step.route === "/" ? "Hub" : step.route.slice(1)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isLastStep) {
                      closeGuide()
                      return
                    }
                    setStepIndex((value) => Math.min(STEPS.length - 1, value + 1))
                  }}
                  className="border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-hard-xs"
                >
                  {isLastStep ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
