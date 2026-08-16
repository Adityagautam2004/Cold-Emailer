"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center text-text">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bad-soft text-bad">
        <AlertTriangle size={22} aria-hidden />
      </div>
      <h1 className="font-display text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        That was unexpected on our end — nothing you did caused this. Try again, or head back home.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" onClick={() => (window.location.href = "/")}>
          Go home
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
