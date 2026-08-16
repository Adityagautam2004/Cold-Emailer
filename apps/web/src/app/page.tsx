import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/logo";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ink text-text">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Wordmark size={22} />
          <nav className="flex items-center gap-6 text-sm text-muted">
            <Link href="/terms" className="transition-standard hover:text-text">
              Terms
            </Link>
            <LinkButton href="/login" size="sm">
              Sign in
            </LinkButton>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <LogoMark size={40} />
        <h1 className="mt-4 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          Cold outreach that paces itself.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Connect your own Gmail, upload your HR contact list, pick a template, and Dispatch
          sends a handful of emails a day — from your mailbox, on a schedule — and tells you
          who replied. It stops chasing anyone who answers.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <LinkButton href="/login" size="lg">
            Sign in
            <ArrowRight size={16} aria-hidden />
          </LinkButton>
          <LinkButton href="/terms" variant="secondary" size="lg">
            Read the terms
          </LinkButton>
        </div>

        <dl className="mt-20 grid grid-cols-1 gap-8 border-t border-line pt-10 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-xs uppercase tracking-widest text-muted">Hard cap</dt>
            <dd className="mt-1.5 text-2xl font-semibold">50 / day</dd>
            <dd className="mt-1 text-sm text-muted">enforced server-side, no opt-out</dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-widest text-muted">Warmup</dt>
            <dd className="mt-1.5 text-2xl font-semibold">10 → 50</dd>
            <dd className="mt-1 text-sm text-muted">ramps over 9 days on a new account</dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-widest text-muted">Who it&apos;s for</dt>
            <dd className="mt-1.5 text-2xl font-semibold">Final-year students</dd>
            <dd className="mt-1 text-sm text-muted">running their own placement outreach</dd>
          </div>
        </dl>

        <p className="mt-16 max-w-xl text-sm leading-relaxed text-muted">
          Every email is sent from your own mailbox — there is no shared sending address. No
          scraped or purchased contact lists. Every send includes a one-line opt-out, and a
          reply cancels every follow-up immediately.
        </p>
      </div>
    </main>
  );
}
