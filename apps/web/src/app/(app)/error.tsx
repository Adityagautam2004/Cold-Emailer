"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bad-soft text-bad">
        <AlertTriangle size={22} aria-hidden />
      </div>
      <h1 className="font-display text-xl font-bold text-text">This page hit a snag</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Nothing you did caused this — try again, or head back to the dashboard.
      </p>
      <div className="mt-6 flex gap-3">
        <LinkButton href="/dashboard" variant="secondary">
          Dashboard
        </LinkButton>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
