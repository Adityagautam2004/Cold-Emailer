import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/**
 * Every nested page (campaign/list/template detail, the import wizard, the "new" forms) used
 * to have no way back to its parent except the browser's Back button. This is the one place
 * that back-affordance is wired up from now on.
 */
export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition-standard hover:text-text"
        >
          <ChevronLeft size={15} aria-hidden />
          {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold text-text">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
