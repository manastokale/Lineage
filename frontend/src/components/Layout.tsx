import { useNavigate, useLocation } from "react-router-dom"
import type { ReactNode } from "react"

interface LayoutProps {
  children: ReactNode
  activeNav?: string
}

const NAV_ITEMS = [
  { id: "hub",     label: "Dashboard", icon: "dashboard",    path: "/" },
  { id: "archive", label: "Archive",   icon: "movie_filter", path: "/archive" },
  { id: "cast",    label: "Cast",      icon: "face",         path: "/cast" },
]

const TOP_NAV_ITEMS = [
  { label: "Studio",     path: "/" },
  { label: "Episodes",   path: "/archive" },
  { label: "Characters", path: "/cast" },
  { label: "Pivot",      path: "/pivot" },
]

export default function Layout({ children, activeNav }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const current = activeNav || location.pathname

  return (
    <div className="bg-cream text-ink min-h-screen">
      {/* ─── Top Nav Bar ──────────────────────────────────────── */}
      <nav className="flex justify-between items-center px-6 h-20 w-full bg-primary text-black border-b-4 border-black z-50 sticky top-0">
        <button onClick={() => navigate("/")} className="text-3xl font-black italic text-black uppercase cursor-pointer hover:scale-105 transition-transform">
          Sitcom Command
        </button>
        <div className="hidden md:flex items-center gap-8">
          {TOP_NAV_ITEMS.map((item) => {
            const isActive = current === item.path || (item.path !== "/" && current.startsWith(item.path))
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`font-black uppercase tracking-tighter px-3 py-1 transition-none ${
                  isActive
                    ? "border-b-4 border-accent text-black"
                    : "text-black/70 hover:bg-highlight hover:text-black"
                }`}>
                {item.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-4">
          <button className="material-symbols-outlined text-black active:translate-y-1">settings</button>
          <button className="material-symbols-outlined text-black active:translate-y-1">help</button>
        </div>
      </nav>

      {/* ─── Side Nav Bar (Desktop) ───────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-20 bg-white border-r-4 border-black shadow-[4px_0px_0px_0px_rgba(0,0,0,1)] z-40">
        <div className="p-6 border-b-4 border-black bg-accent">
          <h2 className="text-xl font-black text-black">Director's Cut</h2>
          <p className="font-bold text-sm text-black/80">Season 1</p>
        </div>
        <nav className="flex flex-col flex-1 p-2">
          {NAV_ITEMS.map((item) => {
            const isActive = current === item.path || (item.path !== "/" && current.startsWith(item.path))
            return (
              <button key={item.id} onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 p-4 font-bold text-lg cursor-pointer transition-none ${
                  isActive
                    ? "bg-accent text-black border-2 border-black shadow-hard-sm m-2"
                    : "text-black hover:bg-highlight m-0"
                }`}>
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
          <button onClick={() => navigate("/pivot")}
            className={`flex items-center gap-3 p-4 font-bold text-lg cursor-pointer transition-none ${
              current === "/pivot"
                ? "bg-accent text-black border-2 border-black shadow-hard-sm m-2"
                : "text-black hover:bg-highlight m-0"
            }`}>
            <span className="material-symbols-outlined">alt_route</span>
            <span>Pivot</span>
          </button>
          <button className="mt-auto text-black p-4 font-bold text-lg hover:bg-highlight cursor-pointer flex items-center gap-3 border-t-4 border-black pt-6">
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </button>
        </nav>
        <div className="p-4 border-t-4 border-black flex items-center gap-3 bg-primary">
          <div className="w-10 h-10 border-2 border-black bg-white overflow-hidden shadow-hard-xs" />
          <span className="font-black text-black text-sm uppercase">C. Geller</span>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────────────── */}
      <main className="md:ml-64 p-6 mb-20 md:mb-0">
        {children}
      </main>

      {/* ─── Bottom Nav (Mobile) ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 w-full h-16 flex justify-around items-center z-50 bg-primary border-t-4 border-black shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)]">
        {[
          { icon: "home",          label: "Home",    path: "/" },
          { icon: "video_library", label: "Archive", path: "/archive" },
          { icon: "groups",        label: "Cast",    path: "/cast" },
          { icon: "alt_route",     label: "Pivot",   path: "/pivot" },
        ].map((item) => {
          const isActive = current === item.path
          return (
            <button key={item.path} onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center h-full px-2 active:scale-95 ${
                isActive ? "bg-accent border-x-2 border-black" : "text-black hover:bg-highlight"
              }`}>
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-[12px] font-black uppercase">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
