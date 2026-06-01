import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity, BookMarked, BookOpen, ClipboardCheck, Download, GitBranch, LayoutDashboard,
  LogOut, Moon, ScanSearch, Shield, Sparkles, Sun, Users,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { DemoBanner } from "./ui";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analyze", label: "Semantic Mapping", icon: ScanSearch },
  { to: "/knowledge", label: "Knowledge Base", icon: BookMarked },
  { to: "/steward", label: "Steward Review", icon: ClipboardCheck },
  { to: "/lineage", label: "Lineage", icon: GitBranch },
  { to: "/quality", label: "Data Quality", icon: Shield },
  { to: "/trust", label: "Trust Scores", icon: Activity },
  { to: "/ownership", label: "Ownership", icon: Users },
  { to: "/export", label: "Export", icon: Download },
  { to: "/audit", label: "Audit Log", icon: BookOpen },
];

export function Layout() {
  const navigate = useNavigate();
  const {
    connected, appName, kbCount, apiKey, setApiKey,
    user, logout, theme, toggleTheme,
    offlineMode, setOfflineMode, isDemoData,
  } = useApp();

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[var(--color-sidebar)] text-slate-300">
        <div className="border-b border-slate-800 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg">
              G
            </div>
            <div>
              <p className="text-sm font-semibold text-white">GovernAI</p>
              <p className="text-[11px] text-slate-400">Data Governance Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-600/20 text-white ring-1 ring-indigo-500/30"
                    : "text-slate-400 hover:bg-[var(--color-sidebar-hover)] hover:text-slate-200"
                }`
              }>
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4 space-y-3">
          {/* User */}
          {user && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {user.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">{user.name}</p>
                <p className="truncate text-[10px] text-slate-500">{user.role}</p>
              </div>
              <button type="button" onClick={() => { logout(); navigate("/login"); }}
                className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${isDemoData ? "bg-amber-400" : connected ? "bg-emerald-400 status-live" : "bg-rose-400"}`} />
            <span className={isDemoData ? "text-amber-400" : connected ? "text-emerald-400" : "text-rose-400"}>
              {isDemoData ? "Offline demo data" : connected ? "Backend connected" : "Backend offline"}
            </span>
          </div>

          {/* Offline toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={offlineMode}
              onChange={(e) => setOfflineMode(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-indigo-500" />
            <Sparkles className="h-3 w-3" />
            Offline demo mode
          </label>

          {!isDemoData && connected && (
            <p className="truncate text-[11px] text-slate-500">{appName} · {kbCount} KB sections</p>
          )}

          <input type="password" placeholder="API key (optional)" value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none" />
        </div>
      </aside>

      <main className="ml-64 min-h-screen flex-1">
        <div className="border-b border-slate-200/80 bg-white/80 px-8 py-3 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/80">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Product Demo
            </p>
            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-slate-400 sm:block">Local-first · RAG + Ollama · Steward-ready</p>
              <button type="button" onClick={toggleTheme}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Toggle dark mode">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <div className="animate-fade-in px-8 py-8">
          <DemoBanner offline={isDemoData} onSwitchLive={() => setOfflineMode(false)} />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
