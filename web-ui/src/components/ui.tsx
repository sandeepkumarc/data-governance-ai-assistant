import type { ReactNode } from "react";

const map: Record<string, string> = {
  Public: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700",
  Internal: "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:ring-sky-700",
  Confidential: "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700",
  Restricted: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-700",
  approved: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700",
  pending_review: "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700",
  rejected: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-700",
  draft: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600",
  Healthy: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700",
  Warning: "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-700",
  Critical: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-700",
  Passed: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700",
  Suggested: "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:ring-indigo-700",
  Failed: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-700",
};

export function Badge({ label, className = "" }: { label: string; className?: string }) {
  const style = map[label] ?? "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style} ${className}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

export function MetricCard({
  label, value, sub, icon, accent = "indigo",
}: {
  label: string; value: string | number; sub?: string; icon?: ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "violet";
}) {
  const accents = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    violet: "from-violet-500 to-violet-600",
  };
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:shadow-lg dark:hover:shadow-black/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
        {icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${accents[accent]} text-white shadow-sm`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "", title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-800/60 ${className}`}>
      {title && (
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Button({
  children, onClick, variant = "primary", disabled, type = "button", className = "",
}: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean; type?: "button" | "submit"; className?: string;
}) {
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:bg-indigo-300 dark:disabled:bg-indigo-800",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-indigo-600 dark:text-indigo-400 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-800/30">
      <p className="text-base font-medium text-slate-700 dark:text-slate-300">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function OfflineBanner({ offline, onSwitchLive }: { offline: boolean; onSwitchLive?: () => void }) {
  if (!offline) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/30">
      <p className="text-sm text-amber-900 dark:text-amber-200">
        <span className="font-semibold">Offline mode</span> — showing embedded sample data. Connect the backend for live analysis.
      </p>
      {onSwitchLive && (
        <button type="button" onClick={onSwitchLive} className="text-xs font-medium text-amber-700 underline dark:text-amber-300">
          Try live backend
        </button>
      )}
    </div>
  );
}

export function BackendDisconnectedBanner({
  disconnected,
  onRetry,
}: {
  disconnected: boolean;
  onRetry?: () => void;
}) {
  if (!disconnected) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800/50 dark:bg-rose-950/30">
      <p className="text-sm text-rose-900 dark:text-rose-200">
        <span className="font-semibold">Backend unreachable</span> — your work on this page is
        preserved. Start the API on port 8000 or retry the connection.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-medium text-rose-700 underline dark:text-rose-300"
        >
          Retry connection
        </button>
      )}
    </div>
  );
}
