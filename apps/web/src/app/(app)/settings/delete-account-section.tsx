"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";

export function DeleteAccountSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeDialog() {
    setOpen(false);
    setConfirmText("");
    setError(null);
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: confirmText }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not delete your account.");
      toast.success("Account deleted.");
      // The session is a signed JWT, not a DB-backed lookup — deleting the User row doesn't
      // invalidate it. signOut() is the only real way to clear the client's session cookie.
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  return (
    <section className="mt-10 rounded-lg border border-bad/30 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-bad">Danger zone</h2>
      <p className="mt-2 text-sm text-muted">
        Permanently deletes your account: every contact list, campaign, send history, template,
        resume (including the files themselves), connected mailbox, and suppression record.
        This can&apos;t be undone.
      </p>
      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeDialog())}>
        <DialogHeader title="Delete your account?" onClose={closeDialog} />
        <DialogBody>
          <p>
            This immediately and permanently deletes everything associated with your account.
            Any running campaigns stop at once. There is no recovery.
          </p>
          <div className="mt-4">
            <Label htmlFor="confirmEmail">
              Type <span className="font-mono text-text">{email}</span> to confirm
            </Label>
            <Input
              id="confirmEmail"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
          <FieldError>{error}</FieldError>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={closeDialog} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={deleting}
            disabled={confirmText.trim().toLowerCase() !== email.toLowerCase()}
            onClick={handleDelete}
          >
            Permanently delete
          </Button>
        </DialogFooter>
      </Dialog>
    </section>
  );
}
