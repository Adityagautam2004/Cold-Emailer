"use client";

import { MAX_RESUME_SIZE_BYTES } from "@dispatch/core";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ResumeRow {
  id: string;
  filename: string;
  sizeBytes: number;
  version: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string | Date;
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ResumeManager({ initialResumes }: { initialResumes: ResumeRow[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    if (!/\.pdf$/i.test(file.name)) {
      setError("Resumes must be a PDF file.");
      return;
    }
    if (file.size > MAX_RESUME_SIZE_BYTES) {
      setError(`That file is ${formatSize(file.size)} — the limit is ${formatSize(MAX_RESUME_SIZE_BYTES)}.`);
      return;
    }

    setUploading(true);
    try {
      const urlRes = await fetch("/api/resumes/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, sizeBytes: file.size }),
      });
      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start the upload.");
      }
      const { resumeId, uploadUrl } = await urlRes.json();

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!putRes.ok) throw new Error("The upload didn't complete. Try again.");

      const confirmRes = await fetch("/api/resumes/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, filename: file.name, sizeBytes: file.size }),
      });
      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save the upload.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  async function handleActivate(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/resumes/${id}/activate`, { method: "POST" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/resumes/${id}/archive`, { method: "POST" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handlePreview(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/resumes/${id}/preview-url`);
      const body = await res.json();
      if (res.ok) setPreviewUrl(body.url);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChosen} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload a resume"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {error}
        </p>
      )}

      {initialResumes.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          No resumes yet. Upload a PDF, under 2 MB — this is what gets attached to every
          campaign send.
        </p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">File</th>
              <th className="py-2 pr-4">Version</th>
              <th className="py-2 pr-4">Size</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Uploaded</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {initialResumes.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="py-2.5 pr-4">{r.filename}</td>
                <td className="py-2.5 pr-4 font-mono">v{r.version}</td>
                <td className="py-2.5 pr-4 font-mono">{formatSize(r.sizeBytes)}</td>
                <td className="py-2.5 pr-4">
                  {r.isArchived ? (
                    <span className="text-muted">Archived</span>
                  ) : r.isActive ? (
                    <span className="text-good">Active</span>
                  ) : (
                    <span className="text-muted">Inactive</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 font-mono text-muted">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => handlePreview(r.id)}
                      disabled={busyId === r.id}
                      className="text-accent hover:underline"
                    >
                      Preview
                    </button>
                    {!r.isActive && !r.isArchived && (
                      <button
                        type="button"
                        onClick={() => handleActivate(r.id)}
                        disabled={busyId === r.id}
                        className="text-accent hover:underline"
                      >
                        Make active
                      </button>
                    )}
                    {!r.isArchived && (
                      <button
                        type="button"
                        onClick={() => handleArchive(r.id)}
                        disabled={busyId === r.id}
                        className="text-muted hover:underline"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className={cn("h-full w-full max-w-3xl rounded-lg border border-line bg-surface p-2")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setPreviewUrl(null)} className="text-sm text-muted hover:text-text">
                Close
              </button>
            </div>
            <iframe src={previewUrl} title="Resume preview" className="h-[calc(100%-2rem)] w-full rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
