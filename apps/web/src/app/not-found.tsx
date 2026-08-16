import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center text-text">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted">
        <Compass size={22} aria-hidden />
      </div>
      <h1 className="font-display text-xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        That page doesn&apos;t exist, or it may have moved.
      </p>
      <LinkButton href="/" className="mt-6">
        Back to home
      </LinkButton>
    </div>
  );
}
