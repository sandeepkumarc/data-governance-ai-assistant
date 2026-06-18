import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Card } from "./ui";

interface AdminSectionProps {
  title?: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function AdminSection({
  title = "Administration",
  description = "Configuration, integration, and setup — expand when you need to change how scoring works.",
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
}: AdminSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;

  function toggle() {
    const next = !open;
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  }

  return (
    <Card className="mt-10 border border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-900/40">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="space-y-6 border-t border-slate-200 px-5 py-5 dark:border-slate-700">{children}</div>
      )}
    </Card>
  );
}
