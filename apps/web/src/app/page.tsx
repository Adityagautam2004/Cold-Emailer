import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ink text-text">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Dispatch</p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-bold leading-tight sm:text-5xl">
          Cold outreach that paces itself.
        </h1>
        <p className="mt-6 text-lg text-muted">
          Connect your own Gmail, upload your HR contact list, pick a template, and Dispatch
          sends a handful of emails a day — from your mailbox, on a schedule — and tells you
          who replied. It stops chasing anyone who answers.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href="/login"
            className="rounded-md bg-accent px-5 py-2.5 font-medium text-white transition-standard hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/terms"
            className="rounded-md border border-line px-5 py-2.5 font-medium text-text transition-standard hover:bg-surface"
          >
            Read the terms
          </Link>
        </div>

        <dl className="mt-16 grid grid-cols-1 gap-6 border-t border-line pt-10 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-xs uppercase tracking-widest text-muted">Hard cap</dt>
            <dd className="mt-1 text-2xl font-semibold">50 / day</dd>
            <dd className="mt-1 text-sm text-muted">enforced server-side, no opt-out</dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-widest text-muted">Warmup</dt>
            <dd className="mt-1 text-2xl font-semibold">10 → 50</dd>
            <dd className="mt-1 text-sm text-muted">ramps over 9 days on a new account</dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-widest text-muted">Who it&apos;s for</dt>
            <dd className="mt-1 text-2xl font-semibold">Final-year students</dd>
            <dd className="mt-1 text-sm text-muted">running their own placement outreach</dd>
          </div>
        </dl>

        <p className="mt-16 text-sm text-muted">
          Every email is sent from your own mailbox — there is no shared sending address. No
          scraped or purchased contact lists. Every send includes a one-line opt-out, and a
          reply cancels every follow-up immediately.

        </p>
      </div>
    </main>
  );
}
