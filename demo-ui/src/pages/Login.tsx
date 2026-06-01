import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Database, Moon, Shield, Sparkles, Sun } from "lucide-react";
import { useApp } from "../context/AppContext";
import { DEMO_CREDENTIALS } from "../data/demoData";
import { Button, Spinner } from "../components/ui";

export function LoginPage() {
  const { user, login, loginAsDemo, theme, toggleTheme, setOfflineMode } = useApp();
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      const ok = login(email, password);
      if (!ok) setError("Invalid credentials. Use demo@govern.ai / demo");
      setLoading(false);
    }, 600);
  }

  function enterOfflineDemo() {
    setOfflineMode(true);
    loginAsDemo();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.15) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow orbs */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />

      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-6 top-6 rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 backdrop-blur transition hover:bg-white/10"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold text-white shadow-xl shadow-indigo-500/30">
            G
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">GovernAI</h1>
          <p className="mt-2 text-sm text-indigo-200/80">
            AI-powered data governance for modern enterprises
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-indigo-200">
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-indigo-200">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full !bg-indigo-600 hover:!bg-indigo-500">
              {loading ? <Spinner className="h-4 w-4 !text-white" /> : "Sign in"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={enterOfflineDemo}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20"
          >
            <Sparkles className="h-4 w-4" />
            Launch offline demo
          </button>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Demo credentials:{" "}
            <code className="text-indigo-300">{DEMO_CREDENTIALS.email}</code> /{" "}
            <code className="text-indigo-300">{DEMO_CREDENTIALS.password}</code>
          </p>
        </div>

        {/* Feature pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {[
            { icon: Database, label: "Semantic mapping" },
            { icon: Shield, label: "Auto-classification" },
            { icon: Sparkles, label: "Local RAG + LLM" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400"
            >
              <Icon className="h-3 w-3 text-indigo-400" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
