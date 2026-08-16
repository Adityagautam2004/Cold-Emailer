"use client";

import { bucketRows, formatImportSummary, rejectedRowsToCsv, type ImportReport } from "@dispatch/core";
import { Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";

interface ParsedSheet {
  headers: string[];
  rows: Array<{ rowNumber: number; values: string[] }>;
}

type FixedTarget = "email" | "hr_name" | "company" | "title" | "ignore" | "custom";

const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map columns" },
  { key: "report", label: "Review" },
  { key: "done", label: "Done" },
] as const;

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StepIndicator({ active }: { active: (typeof STEPS)[number]["key"] }) {
  const activeIndex = STEPS.findIndex((s) => s.key === active);
  return (
    <ol className="mb-8 flex flex-wrap gap-2">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
            i === activeIndex ? "border-accent text-text" : i < activeIndex ? "border-line text-muted" : "border-line text-muted opacity-50"
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px]",
              i <= activeIndex ? "bg-accent-soft text-accent" : "bg-line text-muted"
            )}
          >
            {i < activeIndex ? "✓" : i + 1}
          </span>
          {s.label}
        </li>
      ))}
    </ol>
  );
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

  return (
    <div>
      <StepIndicator active={step} />

      {step === "upload" && (
        <Card className="flex flex-col items-center justify-center border-dashed p-14 text-center">
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleUpload} />
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted">
            <Upload size={20} aria-hidden />
          </div>
          <p className="text-sm font-medium">Choose a spreadsheet to import</p>
          <p className="mt-1 text-sm text-muted">.xlsx or .csv, up to 5 MB and 2,000 rows</p>
          <Button
            type="button"
            loading={pending}
            onClick={() => fileInputRef.current?.click()}
            className="mt-5"
          >
            {pending ? "Reading…" : "Choose a file"}
          </Button>
          <FieldError>{error}</FieldError>
        </Card>
      )}

      {step === "map" && sheet && (
        <div>
          <h2 className="font-medium">Map your columns</h2>
          <p className="mt-1 text-sm text-muted">Email is the only required mapping.</p>

          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-max border-collapse text-xs">
              <thead>
                <tr>
                  {sheet.headers.map((h, i) => (
                    <th key={i} className="border-b border-line bg-surface p-2 text-left align-top">
                      <div className="mb-1 font-mono text-muted">{h || `(column ${i + 1})`}</div>
                      <select
                        value={selects[i]}
                        onChange={(e) => {
                          const next = [...selects];
                          next[i] = e.target.value as FixedTarget;
                          setSelects(next);
                        }}
                        className="w-full rounded border border-line bg-ink px-1.5 py-1 text-xs outline-none focus-visible:border-accent"
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
                          className="mt-1 w-full rounded border border-line bg-ink px-1.5 py-1 text-xs outline-none focus-visible:border-accent"
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
                      <td key={i} className="border-b border-line p-2 text-muted last:border-b-0">
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

          <Button disabled={!mapping.includes("email")} onClick={() => setStep("report")} className="mt-4">
            Continue
          </Button>
        </div>
      )}

      {step === "report" && report && (
        <div>
          <h2 className="font-medium">Review before importing</h2>
          <p className="mt-3 font-mono text-sm">{formatImportSummary(report)}</p>

          {report.duplicates.length + report.invalid.length + report.roleSkipped.length > 0 && (
            <button
              type="button"
              onClick={() => downloadCsv("rejected-rows.csv", rejectedRowsToCsv(report))}
              className="mt-3 text-sm text-accent hover:underline"
            >
              Download rejected rows ({report.duplicates.length + report.invalid.length + report.roleSkipped.length}) as CSV
            </button>
          )}

          <div className="mt-4 max-w-sm">
            <Label htmlFor="listName">List name</Label>
            <Input id="listName" value={listName} onChange={(e) => setListName(e.target.value)} />
          </div>

          <FieldError>{error}</FieldError>

          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={() => setStep("map")}>
              Back
            </Button>
            <Button
              disabled={report.candidates.length === 0 || !listName.trim()}
              loading={pending}
              onClick={handleCommit}
            >
              {pending ? "Importing…" : `Import ${report.candidates.length} contacts`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && commitResult && (
        <div>
          <div className="rounded-md border border-good/40 bg-good-soft px-4 py-3 text-sm text-good">
            Imported {commitResult.report.imported} contacts into &quot;{commitResult.list.name}&quot;.
          </div>
          {(commitResult.report.excludedSuppressed > 0 || commitResult.report.excludedAlreadyContacted > 0) && (
            <p className="mt-3 text-sm text-muted">
              Also excluded: {commitResult.report.excludedSuppressed} on your suppression list,{" "}
              {commitResult.report.excludedAlreadyContacted} already contacted in a previous list.
            </p>
          )}
          <Button onClick={() => router.push(`/lists/${commitResult.list.id}`)} className="mt-4">
            View list
          </Button>
        </div>
      )}
    </div>
  );
}
