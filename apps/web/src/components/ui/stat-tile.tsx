import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: "good" | "bad" | "pending" | "accent";
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-4", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {Icon && <Icon size={13} aria-hidden />}
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 font-mono text-xl font-medium",
          tone === "good" && "text-good",
          tone === "bad" && "text-bad",
          tone === "pending" && "text-pending",
          tone === "accent" && "text-accent",
          !tone && "text-text"
        )}
      >
        {value}
      </div>
    </div>
  );
}
