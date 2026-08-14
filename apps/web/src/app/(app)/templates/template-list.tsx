"use client";

import { hasPersonalizationVariable } from "@dispatch/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  bodyText: string;
  updatedAt: string | Date;
}

export function TemplateList({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
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
      <Link
        href="/templates/new"
        className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90"
      >
        New template
      </Link>

      {error && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {error}
        </p>
      )}

      {templates.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No templates yet.</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Subject</th>
              <th className="py-2 pr-4">Personalised</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-line">
                <td className="py-2.5 pr-4">
                  <Link href={`/templates/${t.id}`} className="text-accent hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 text-muted">{t.subject}</td>
                <td className="py-2.5 pr-4">
                  {hasPersonalizationVariable(t.bodyText) ? (
                    <span className="text-good">yes</span>
                  ) : (
                    <span className="text-bad">no</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => handleDelete(t.id)}
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
