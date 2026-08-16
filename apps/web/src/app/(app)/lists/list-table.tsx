"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ListRow {
  id: string;
  name: string;
  sourceFilename: string;
  rowCount: number;
  createdAt: string | Date;
}

export function ListTable({ lists }: { lists: ListRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This removes all its contacts and can't be undone.`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not delete.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-bad">
          {error}
        </p>
      )}

      {lists.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          No lists yet. Upload an Excel sheet with one HR contact per row.
        </p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Source file</th>
              <th className="py-2 pr-4">Contacts</th>
              <th className="py-2 pr-4">Imported</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="py-2.5 pr-4">
                  <Link href={`/lists/${l.id}`} className="text-accent hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 font-mono text-muted">{l.sourceFilename}</td>
                <td className="py-2.5 pr-4 font-mono">{l.rowCount}</td>
                <td className="py-2.5 pr-4 font-mono text-muted">{new Date(l.createdAt).toLocaleDateString()}</td>
                <td className="py-2.5 pr-4 text-right">
                  <button
                    type="button"
                    disabled={busyId === l.id}
                    onClick={() => handleDelete(l.id, l.name)}
                    className="text-muted hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
