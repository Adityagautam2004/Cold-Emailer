"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface ContactRow {
  id: string;
  email: string;
  hrName: string | null;
  company: string | null;
  title: string | null;
  status: string;
  rowNumber: number;
}

const STATUSES = ["all", "pending", "sent", "replied", "bounced", "unsubscribed", "skipped"] as const;

const STATUS_COLOR: Record<string, string> = {
  pending: "text-muted",
  sent: "text-pending",
  replied: "text-good",
  bounced: "text-bad",
  unsubscribed: "text-muted",
  skipped: "text-muted",
};

export function ContactTable({ contacts }: { contacts: ContactRow[] }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return (
        c.email.toLowerCase().includes(q) ||
        (c.hrName ?? "").toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, status, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-xs transition-standard",
                status === s ? "border-accent text-text" : "border-line text-muted hover:text-text"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search email, name, company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ml-auto min-w-[220px] rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus-visible:border-accent"
          aria-label="Search contacts"
        />
      </div>

      <p className="mt-3 text-xs text-muted">
        {filtered.length} of {contacts.length}
      </p>

      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-4">Row</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">HR name</th>
            <th className="py-2 pr-4">Company</th>
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id} className="border-b border-line">
              <td className="py-2 pr-4 font-mono text-muted">{c.rowNumber}</td>
              <td className="py-2 pr-4 font-mono">{c.email}</td>
              <td className="py-2 pr-4">{c.hrName ?? "—"}</td>
              <td className="py-2 pr-4">{c.company ?? "—"}</td>
              <td className="py-2 pr-4">{c.title ?? "—"}</td>
              <td className={cn("py-2 pr-4 font-mono", STATUS_COLOR[c.status] ?? "text-muted")}>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
