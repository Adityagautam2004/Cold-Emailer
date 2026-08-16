"use client";

import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LinkButton } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

interface ListRow {
  id: string;
  name: string;
  sourceFilename: string;
  rowCount: number;
  createdAt: string | Date;
}

export function ListTable({ lists }: { lists: ListRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Delete list?",
      description: `"${name}" and all its contacts will be permanently removed. This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/lists/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not delete.");
      toast.success(`"${name}" deleted.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {dialog}

      {lists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No lists yet"
          description="Upload an Excel sheet with one HR contact per row."
          action={<LinkButton href="/lists/import">Import a list</LinkButton>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Source file</TableHeaderCell>
              <TableHeaderCell>Contacts</TableHeaderCell>
              <TableHeaderCell>Imported</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {lists.map((l) => (
              <TableRow key={l.id} className="transition-standard hover:bg-surface">
                <TableCell>
                  <Link href={`/lists/${l.id}`} className="font-medium text-accent hover:underline">
                    {l.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-muted">{l.sourceFilename}</TableCell>
                <TableCell className="font-mono">{l.rowCount}</TableCell>
                <TableCell className="font-mono text-muted">{new Date(l.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    disabled={busyId === l.id}
                    onClick={() => handleDelete(l.id, l.name)}
                    className="text-sm text-muted transition-standard hover:text-bad disabled:opacity-50"
                  >
                    Delete
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
