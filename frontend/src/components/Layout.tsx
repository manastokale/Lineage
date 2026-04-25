import type { ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"

interface LayoutProps {
  children: ReactNode
  headerContent?: ReactNode
  sidebarExtra?: ReactNode
}

export default function Layout({ children, headerContent, sidebarExtra }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const navItems = [
    { label: "Hub", path: "/" },
    { label: "Graph", path: "/graph" },
    { label: "Usage", path: "/usage" },
  ]

  return (
    <div className="h-screen overflow-hidden bg-cream text-ink">
      <div className="flex h-full overflow-hidden">
        <aside className="hidden w-56 shrink-0 flex-col border-r-4 border-black bg-white md:flex">
          <div className="flex h-[93px] items-center border-b-4 border-black bg-accent px-5 py-6">
            <button onClick={() => navigate("/")} className="w-full text-left">
              <div className="text-[2rem] font-black leading-none tracking-[-0.03em]">Lineage</div>
            </button>
          </div>
          <nav className="shrink-0 flex flex-col gap-2 p-3">
            {navItems.map((item) => {
              const active = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`rounded-none border-2 px-4 py-3 text-left font-black uppercase tracking-wider ${
                    active
                      ? "border-black bg-highlight shadow-hard-sm"
                      : "border-transparent bg-white hover:border-black hover:bg-primary/60"
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
          {sidebarExtra ? (
            <div className="min-h-0 flex-1 border-t-4 border-black overflow-hidden">
              {sidebarExtra}
            </div>
          ) : null}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="border-b-4 border-black bg-primary px-4 py-4 md:h-[93px] md:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                {headerContent || (
                  <div>
                    <button onClick={() => navigate("/")} className="text-left">
                      <div className="text-4xl font-black leading-none tracking-[-0.03em] md:text-5xl">Lineage</div>
                    </button>
                  </div>
                )}
              </div>
              <nav className="flex items-center gap-2 md:hidden">
                {navItems.map((item) => {
                  const active = location.pathname === item.path
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`border-2 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${
                        active ? "border-black bg-black text-white" : "border-black bg-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </nav>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-hidden p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
