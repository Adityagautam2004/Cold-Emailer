import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium leading-5",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface text-muted",
        accent: "border-accent/30 bg-accent-soft text-accent",
        pending: "border-pending/30 bg-pending-soft text-pending",
        good: "border-good/30 bg-good-soft text-good",
        bad: "border-bad/30 bg-bad-soft text-bad",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot = true, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** Central mapping from a domain status string to a Badge tone — the single place that used
 * to be redefined as a local Record<string, string> on every list page. */
const STATUS_TONE: Record<string, BadgeProps["tone"]> = {
  // sends / contacts
  queued: "pending",
  claimed: "pending",
  sending: "pending",
  pending: "neutral",
  sent: "accent",
  replied: "good",
  bounced: "bad",
  failed: "bad",
  unsubscribed: "neutral",
  skipped: "neutral",
  cancelled: "neutral",
  // campaigns
  draft: "neutral",
  scheduled: "pending",
  running: "accent",
  paused: "pending",
  completed: "good",
  stopped: "bad",
  // email accounts
  active: "good",
  error: "bad",
  unverified: "pending",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} className={className}>
      {status}
    </Badge>
  );
}
