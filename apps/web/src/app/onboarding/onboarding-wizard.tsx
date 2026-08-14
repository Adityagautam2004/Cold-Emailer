"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { EmailAccountManager } from "@/app/(app)/settings/email-account-manager";
import { ResumeManager } from "@/app/(app)/resumes/resume-manager";

interface EmailAccountRow {
  id: string;
  provider: string;
  fromEmail: string;
  fromName: string;
  dailyCap: number;
  sentToday: number;
  quotaResetAt: string | Date;
  warmupStartedAt: string | Date;
  status: string;
  statusReason: string | null;
  verifiedAt: string | Date | null;
  createdAt: string | Date;
}

interface ResumeRow {
  id: string;
  filename: string;
  sizeBytes: number;
  version: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string | Date;
}

const TIMEZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Asia/Kolkata", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Colombo", "UTC"];

export function OnboardingWizard({
  profile,
  emailAccounts,
  resumes,
}: {
  profile: { name: string | null; college: string | null; timezone: string };
  emailAccounts: EmailAccountRow[];
  resumes: ResumeRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.name ?? "");
  const [college, setCollege] = useState(profile.college ?? "");
  const [timezone, setTimezone] = useState(profile.timezone || "Asia/Kolkata");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const step1Done = Boolean(profile.college);
  const step2Done = emailAccounts.length > 0;
  const step3Done = resumes.some((r) => r.isActive);
  const step4Done = emailAccounts.some((a) => a.verifiedAt);

  const steps = [
    { key: "profile", label: "Profile", done: step1Done },
    { key: "email", label: "Connect Gmail", done: step2Done },
    { key: "resume", label: "Upload resume", done: step3Done },
    { key: "verify", label: "Send test email", done: step4Done },
  ];

  const firstIncomplete = steps.findIndex((s) => !s.done);
  const [active, setActive] = useState(firstIncomplete === -1 ? "profile" : steps[firstIncomplete].key);

  const allDone = step1Done && step2Done && step3Done && step4Done;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, college, timezone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setActive("email");
      router.refresh();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingProfile(false);
    }
  }

  const timezoneOptions = useMemo(() => TIMEZONES, []);

  return (
    <div>
      <ol className="mb-8 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setActive(s.key)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-standard",
                active === s.key ? "border-accent text-text" : "border-line text-muted hover:text-text"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px]",
                  s.done ? "bg-good text-ink" : "bg-line text-muted"
                )}
              >
                {s.done ? "✓" : i + 1}
              </span>
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      {allDone && (
        <div className="mb-6 rounded-md border border-good/40 bg-good/10 px-4 py-3 text-sm text-good">
          You&apos;re fully set up. Head to Templates and Lists to build your first campaign.
        </div>
      )}

      {active === "profile" && (
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-medium">Your profile</h2>
          <form onSubmit={saveProfile} className="mt-4 space-y-3">
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-medium text-muted">
                Name
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus-visible:border-accent"
              />
            </div>
            <div>
              <label htmlFor="college" className="mb-1 block text-xs font-medium text-muted">
                College
              </label>
              <input
                id="college"
                required
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus-visible:border-accent"
              />
            </div>
            <div>
              <label htmlFor="timezone" className="mb-1 block text-xs font-medium text-muted">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus-visible:border-accent"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            {profileError && (
              <p role="alert" className="text-sm text-bad">
                {profileError}
              </p>
            )}
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
            >
              {savingProfile ? "Saving…" : "Save and continue"}
            </button>
          </form>
        </div>
      )}

      {active === "email" && (
        <div>
          <EmailAccountManager initialAccounts={emailAccounts} />
        </div>
      )}

      {active === "resume" && (
        <div className="rounded-lg border border-line bg-surface p-5">
          <ResumeManager initialResumes={resumes} />
        </div>
      )}

      {active === "verify" && (
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="font-medium">Send a test email</h2>
          <p className="mt-2 text-sm text-muted">
            This is the same &quot;Send test email to myself&quot; button as the Connect Gmail
            step — your account isn&apos;t verified, and can&apos;t back a campaign, until it
            succeeds once.
          </p>
          <div className="mt-4">
            <EmailAccountManager initialAccounts={emailAccounts} />
          </div>
        </div>
      )}
    </div>
  );
}
