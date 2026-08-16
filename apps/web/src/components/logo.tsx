import { cn } from "@/lib/utils";

/**
 * Three dots ascending in size and energy (muted -> text -> accent) — not a paper-plane/mail
 * icon (every outreach tool uses one). The shape reads as a ramp: it's the same idea as the
 * warmup curve (10 -> 50 emails/day) and the DispatchStrip's own ticks-over-time language,
 * just abstracted into a mark. Plain SVG, no external asset — themeable via currentColor
 * would fight the intentionally fixed three-tone read, so the tones are hardcoded to match
 * the design tokens in globals.css directly.
 */
export function LogoMark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Dispatch"
    >
      <rect width="32" height="32" rx="8" fill="#1c1f24" />
      <circle cx="10" cy="22" r="2.25" fill="#8b9199" />
      <circle cx="17.5" cy="15.5" r="3.25" fill="#e8e6e1" />
      <circle cx="25" cy="8" r="4.25" fill="#4f5bd5" />
    </svg>
  );
}

export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      <span className="font-display font-bold text-text" style={{ fontSize: size * 0.73 }}>
        Dispatch
      </span>
    </span>
  );
}
