"use client";

import { hasPersonalizationVariable } from "@dispatch/core";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";

interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  bodyText: string;
  updatedAt: string | Date;
}

export function TemplateList({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: "Delete template?",
      description: `"${name}" will be permanently removed. This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setBusyId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
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

      {templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No templates yet"
          description="Write your first cold-email template with recipient variables like {{hr_name}} and {{company}}."
          action={<LinkButton href="/templates/new">New template</LinkButton>}
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Subject</TableHeaderCell>
              <TableHeaderCell>Personalised</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id} className="transition-standard hover:bg-surface">
                <TableCell>
                  <Link href={`/templates/${t.id}`} className="font-medium text-accent hover:underline">
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted">{t.subject}</TableCell>
                <TableCell>
                  {hasPersonalizationVariable(t.bodyText) ? <Badge tone="good">yes</Badge> : <Badge tone="bad">no</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => handleDelete(t.id, t.name)}
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
