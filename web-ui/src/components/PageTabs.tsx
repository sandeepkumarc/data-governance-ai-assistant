import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface PageTab {
  id: string;
  label: string;
  to: string;
  icon?: LucideIcon;
}

interface PageTabsProps {
  tabs: PageTab[];
  activeId: string;
}

export function PageTabs({ tabs, activeId }: PageTabsProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
