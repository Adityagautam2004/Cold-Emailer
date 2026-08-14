"use client";

import { bucketRows, formatImportSummary, rejectedRowsToCsv, type ImportReport } from "@dispatch/core";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface ParsedSheet {
  headers: string[];
  rows: Array<{ rowNumber: number; values: string[] }>;
}

type FixedTarget = "email" | "hr_name" | "company" | "title" | "ignore" | "custom";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:border-accent";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "map" | "report" | "done">("upload");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [sourceFilename, setSourceFilename] = useState("");
  const [selects, setSelects] = useState<FixedTarget[]>([]);
  const [customNames, setCustomNames] = useState<Record<number, string>>({});
  const [includeRoleAddresses, setIncludeRoleAddresses] = useState(false);
  const [listName, setListName] = useState("");
  const [commitResult, setCommitResult] = useState<{
    list: { id: string; name: string; rowCount: number };
    report: { imported: number; excludedSuppressed: number; excludedAlreadyContacted: number };
  } | null>(null);

  const mapping = useMemo(
    () => selects.map((s, i) => (s === "custom" ? `custom.${customNames[i] || `field_${i + 1}`}` : s)),
    [selects, customNames]
  );

  const report: ImportReport | null = useMemo(() => {
    if (!sheet) return null;
    if (!mapping.includes("email")) return null;
    try {
      return bucketRows(sheet, mapping, { includeRoleAddresses });
    } catch {
      return null;
    }
  }, [sheet, mapping, includeRoleAddresses]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setPending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/lists/import/parse", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not read that file.");

      setSheet(body.sheet);
      setSourceFilename(body.sourceFilename);
      setSelects(body.mapping.map((m: string) => (["email", "hr_name", "company", "title"].includes(m) ? m : "ignore") as FixedTarget));
      setListName(file.name.replace(/\.(xlsx|csv)$/i, ""));
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function handleCommit() {
    if (!report) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: listName, sourceFilename, candidates: report.candidates }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not import.");
      setCommitResult(body);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  if (step === "upload") {
    return (
      <div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleUpload} />
        <button
          type="button"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Reading…" : "Choose a file"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (step === "map" && sheet) {
    return (
      <div>
        <h2 className="font-medium">Map your columns</h2>
        <p className="mt-1 text-sm text-muted">Email is the only required mapping.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {sheet.headers.map((h, i) => (
                  <th key={i} className="border-b border-line p-2 text-left align-top">
                    <div className="mb-1 font-mono text-muted">{h || `(column ${i + 1})`}</div>
                    <select
                      value={selects[i]}
                      onChange={(e) => {
                        const next = [...selects];
                        next[i] = e.target.value as FixedTarget;
                        setSelects(next);
                      }}
                      className="w-full rounded border border-line bg-surface px-1.5 py-1 text-xs"
                    >
                      <option value="email">email</option>
                      <option value="hr_name">hr_name</option>
                      <option value="company">company</option>
                      <option value="title">title</option>
                      <option value="custom">custom field…</option>
                      <option value="ignore">ignore</option>
                    </select>
                    {selects[i] === "custom" && (
                      <input
                        type="text"
                        placeholder="field name"
                        value={customNames[i] ?? ""}
                        onChange={(e) => setCustomNames({ ...customNames, [i]: e.target.value })}
                        className="mt-1 w-full rounded border border-line bg-surface px-1.5 py-1 text-xs"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.slice(0, 5).map((row) => (
                <tr key={row.rowNumber}>
                  {row.values.map((v, i) => (
                    <td key={i} className="border-b border-line p-2 text-muted">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={includeRoleAddresses}
            onChange={(e) => setIncludeRoleAddresses(e.target.checked)}
          />
          Include role addresses (info@, careers@, hr@, support@, admin@, noreply@) — these get few replies
        </label>

        {!mapping.includes("email") && <p className="mt-3 text-sm text-bad">Map a column to &quot;email&quot; to continue.</p>}

        <button
          type="button"
          disabled={!mapping.includes("email")}
          onClick={() => setStep("report")}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    );
  }

  if (step === "report" && report) {
    const rejectedCount = report.duplicates.length + report.invalid.length + report.roleSkipped.length;
    return (
      <div>
        <h2 className="font-medium">Review before importing</h2>
        <p className="mt-3 font-mono text-sm">{formatImportSummary(report)}</p>

        {rejectedCount > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv("rejected-rows.csv", rejectedRowsToCsv(report))}
            className="mt-3 text-sm text-accent hover:underline"
          >
            Download rejected rows ({rejectedCount}) as CSV
          </button>
        )}

        <div className="mt-4">
          <label htmlFor="listName" className="mb-1 block text-xs font-medium text-muted">
            List name
          </label>
          <input id="listName" value={listName} onChange={(e) => setListName(e.target.value)} className={inputClass} />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setStep("map")}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-text transition-standard hover:bg-surface"
          >
            Back
          </button>
          <button
            type="button"
            disabled={pending || report.candidates.length === 0 || !listName.trim()}
            onClick={handleCommit}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Importing…" : `Import ${report.candidates.length} contacts`}
          </button>
        </div>
      </div>
    );
  }

  if (step === "done" && commitResult) {
    return (
      <div>
        <div className="rounded-md border border-good/40 bg-good/10 px-4 py-3 text-sm text-good">
          Imported {commitResult.report.imported} contacts into &quot;{commitResult.list.name}&quot;.
        </div>
        {(commitResult.report.excludedSuppressed > 0 || commitResult.report.excludedAlreadyContacted > 0) && (
          <p className="mt-3 text-sm text-muted">
            Also excluded: {commitResult.report.excludedSuppressed} on your suppression list,{" "}
            {commitResult.report.excludedAlreadyContacted} already contacted in a previous list.
          </p>
        )}
        <button
          type="button"
          onClick={() => router.push(`/lists/${commitResult.list.id}`)}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90"
        >
          View list
        </button>
      </div>
    );
  }

  return null;
}
