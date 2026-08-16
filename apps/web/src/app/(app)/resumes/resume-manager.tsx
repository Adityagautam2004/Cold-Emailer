"use client";

import { MAX_RESUME_SIZE_BYTES } from "@dispatch/core";
import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

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
  const { confirm, dialog } = useConfirm();

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

      toast.success(`"${file.name}" uploaded.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  async function handleActivate(id: string, filename: string) {
    setBusyId(id);
    try {
      await fetch(`/api/resumes/${id}/activate`, { method: "POST" });
      toast.success(`"${filename}" is now the active resume.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(id: string, filename: string) {
    const ok = await confirm({
      title: "Archive this resume?",
      description: `"${filename}" will stop being selectable for new campaigns. Existing campaigns that already reference it keep working.`,
      confirmLabel: "Archive",
      destructive: true,
    });
    if (!ok) return;

    setBusyId(id);
    try {
      await fetch(`/api/resumes/${id}/archive`, { method: "POST" });
      toast.success(`"${filename}" archived.`);
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
      {dialog}
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChosen} />
      <Button loading={uploading} onClick={() => fileInputRef.current?.click()}>
        <Upload size={15} aria-hidden />
        {uploading ? "Uploading…" : "Upload a resume"}
      </Button>
      <FieldError>{error}</FieldError>

      <div className="mt-6">
        {initialResumes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No resumes yet"
            description="Upload a PDF, under 2 MB — this is what gets attached to every campaign send."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>File</TableHeaderCell>
                <TableHeaderCell>Version</TableHeaderCell>
                <TableHeaderCell>Size</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Uploaded</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {initialResumes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.filename}</TableCell>
                  <TableCell className="font-mono">v{r.version}</TableCell>
                  <TableCell className="font-mono text-muted">{formatSize(r.sizeBytes)}</TableCell>
                  <TableCell>
                    {r.isArchived ? (
                      <Badge tone="neutral">Archived</Badge>
                    ) : r.isActive ? (
                      <Badge tone="good">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-muted">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => handlePreview(r.id)}
                        disabled={busyId === r.id}
                        className="text-sm text-accent hover:underline disabled:opacity-50"
                      >
                        Preview
                      </button>
                      {!r.isActive && !r.isArchived && (
                        <button
                          type="button"
                          onClick={() => handleActivate(r.id, r.filename)}
                          disabled={busyId === r.id}
                          className="text-sm text-accent hover:underline disabled:opacity-50"
                        >
                          Make active
                        </button>
                      )}
                      {!r.isArchived && (
                        <button
                          type="button"
                          onClick={() => handleArchive(r.id, r.filename)}
                          disabled={busyId === r.id}
                          className="text-sm text-muted hover:text-bad disabled:opacity-50"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)} className="h-[85dvh] w-[calc(100vw-2rem)] max-w-3xl">
        <div className="flex h-full flex-col">
          <DialogHeader title="Resume preview" onClose={() => setPreviewUrl(null)} />
          {previewUrl && <iframe src={previewUrl} title="Resume preview" className="flex-1 rounded-b-xl" />}
        </div>
      </Dialog>
    </div>
  );
}
