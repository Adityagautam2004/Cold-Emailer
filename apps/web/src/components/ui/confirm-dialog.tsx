"use client";

import { useCallback, useState } from "react";
import { Button } from "./button";
import { Dialog, DialogBody, DialogFooter, DialogHeader } from "./dialog";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/**
 * Imperative confirm() for destructive/disruptive actions (delete, stop, archive) — replaces
 * the mix of native window.confirm() (list delete) and no confirmation at all (template
 * delete, resume archive, campaign pause/stop) with one consistent, styled dialog.
 *
 * const { confirm, dialog } = useConfirm();
 * async function handleDelete() {
 *   if (!(await confirm({ title: "...", description: "...", destructive: true }))) return;
 *   ...
 * }
 * return <>{dialog}...</>
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ ...options, resolve }));
  }, []);

  function settle(value: boolean) {
    state?.resolve(value);
    setState(null);
  }

  const dialog = (
    <Dialog open={!!state} onOpenChange={(open) => !open && settle(false)}>
      {state && (
        <>
          <DialogHeader title={state.title} onClose={() => settle(false)} />
          <DialogBody>{state.description}</DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => settle(false)}>
              {state.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={state.destructive ? "destructive" : "primary"} onClick={() => settle(true)}>
              {state.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );

  return { confirm, dialog };
}
