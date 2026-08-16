"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Thin wrapper over the native <dialog> element rather than a hand-rolled fixed/inset-0 div —
 * the browser gives us focus-trapping, Escape-to-close, and top-layer stacking for free, which
 * the app's one prior modal (the resume preview overlay) had none of.
 */
export function Dialog({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onOpenChange(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onOpenChange]);

  return (
    <dialog
      ref={ref}
      // Tailwind's preflight resets `margin: 0` on every element, which silently defeats the
      // native <dialog>'s own default `margin: auto` centering — m-auto here restores it. The
      // mobile nav drawer passes its own `m-0` in className, and cn()/tailwind-merge resolves
      // the conflict by keeping that later, more specific override instead of this default.
      className={cn("m-auto w-[calc(100vw-2rem)] max-w-md", className)}
      onClick={(e) => {
        if (e.target === ref.current) onOpenChange(false);
      }}
    >
      {open && <div onClick={(e) => e.stopPropagation()}>{children}</div>}
    </dialog>
  );
}

export function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-5 py-4">
      <h2 className="font-medium text-text">{title}</h2>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
        <X size={16} />
      </Button>
    </div>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4 text-sm text-muted", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex justify-end gap-2 border-t border-line px-5 py-4", className)} {...props} />;
}
