"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

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
const PAGE_SIZE = 50;

export function ContactTable({ contacts }: { contacts: ContactRow[] }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

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

  // A 2,000-row import shouldn't render 2,000 <tr>s at once — reset to page 1 whenever the
  // filtered set changes so a stale page number never points past the end of a new filter.
  useEffect(() => setPage(0), [status, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-xs transition-standard",
                status === s ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-text"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-auto sm:min-w-[220px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            placeholder="Search email, name, company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="py-1.5 pl-8"
            aria-label="Search contacts"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        {filtered.length} of {contacts.length}
      </p>

      {filtered.length === 0 ? (
        <EmptyState className="mt-3" title="No contacts match" description="Try a different status or search term." />
      ) : (
        <>
          <div className="mt-2">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Row</TableHeaderCell>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>HR name</TableHeaderCell>
                  <TableHeaderCell>Company</TableHeaderCell>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-muted">{c.rowNumber}</TableCell>
                    <TableCell className="font-mono">{c.email}</TableCell>
                    <TableCell>{c.hrName ?? "—"}</TableCell>
                    <TableCell>{c.company ?? "—"}</TableCell>
                    <TableCell>{c.title ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>
                Page {clampedPage + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={clampedPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={14} aria-hidden />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={clampedPage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                  <ChevronRight size={14} aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
