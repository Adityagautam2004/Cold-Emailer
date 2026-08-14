"use client";

import { warmupStage } from "@dispatch/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

const inputClass =
  "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus-visible:border-accent";

function StatusBadge({ status, verified }: { status: string; verified: boolean }) {
  if (status === "error") return <span className="font-mono text-xs text-bad">error</span>;
  if (status === "paused") return <span className="font-mono text-xs text-pending">paused</span>;
  if (!verified) return <span className="font-mono text-xs text-pending">unverified</span>;
  return <span className="font-mono text-xs text-good">active</span>;
}

export function EmailAccountManager({ initialAccounts }: { initialAccounts: EmailAccountRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  const [reconnectPassword, setReconnectPassword] = useState("");
  const [testEmailSentId, setTestEmailSentId] = useState<string | null>(null);

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
    return json;
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await postJson("/api/email-accounts", { fromEmail, fromName, appPassword });
      setFromEmail("");
      setFromName("");
      setAppPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function handleSendTest(id: string) {
    setError(null);
    setPending(true);
    try {
      await postJson(`/api/email-accounts/${id}/test-email`, {});
      setTestEmailSentId(id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function handleReconnect(id: string) {
    setError(null);
    setPending(true);
    try {
      await postJson(`/api/email-accounts/${id}/reconnect`, { appPassword: reconnectPassword });
      setReconnectingId(null);
      setReconnectPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-bad">
          {error}
        </p>
      )}

      {initialAccounts.map((acc) => {
        const stage = warmupStage(new Date(acc.warmupStartedAt));
        return (
          <div key={acc.id} className="mb-4 rounded-lg border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm">{acc.fromEmail}</p>
                <p className="text-xs text-muted">{acc.fromName}</p>
              </div>
              <StatusBadge status={acc.status} verified={!!acc.verifiedAt} />
            </div>

            {acc.status === "error" && (
              <div className="mt-3 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {acc.statusReason ?? "Gmail rejected the app password. Generate a new one and reconnect."}
              </div>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">Warmup stage</dt>
                <dd className="font-mono">
                  {stage.stage} of 4 — {stage.cap}/day
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Next step-up</dt>
                <dd className="font-mono">
                  {stage.nextStepUpAt ? new Date(stage.nextStepUpAt).toLocaleDateString() : "at ceiling"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Sent today</dt>
                <dd className="font-mono">
                  {acc.sentToday} / {acc.dailyCap}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Verified</dt>
                <dd className="font-mono">{acc.verifiedAt ? "yes" : "not yet"}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              {!acc.verifiedAt && acc.status === "active" && (
                <button
                  type="button"
                  onClick={() => handleSendTest(acc.id)}
                  disabled={pending}
                  className="text-accent hover:underline disabled:opacity-50"
                >
                  Send test email to myself
                </button>
              )}
              {testEmailSentId === acc.id && <span className="text-good">Sent — check your inbox.</span>}
              <button
                type="button"
                onClick={() => setReconnectingId(reconnectingId === acc.id ? null : acc.id)}
                className="text-muted hover:underline"
              >
                {acc.status === "error" ? "Reconnect" : "Use a different app password"}
              </button>
            </div>

            {reconnectingId === acc.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleReconnect(acc.id);
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="password"
                  required
                  value={reconnectPassword}
                  onChange={(e) => setReconnectPassword(e.target.value)}
                  placeholder="New app password"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-text disabled:opacity-50"
                >
                  Save
                </button>
              </form>
            )}
          </div>
        );
      })}

      <div className="rounded-lg border border-line bg-surface p-5">
        <h3 className="font-medium">Connect a Gmail account</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            Your Google account needs 2-Step Verification on —{" "}
            <a className="text-accent underline" href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">
              check here
            </a>
            .
          </li>
          <li>
            Go to{" "}
            <a className="text-accent underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              myaccount.google.com/apppasswords
            </a>
            , name it &quot;Dispatch&quot;, create it, and copy the 16-character code.
          </li>
          <li>Paste it below — spaces don&apos;t matter, and it&apos;s stored encrypted, never shown again.</li>
        </ol>
        <form onSubmit={handleConnect} className="mt-4 space-y-3">
          <div>
            <label htmlFor="fromEmail" className="mb-1 block text-xs font-medium text-muted">
              Gmail address
            </label>
            <input
              id="fromEmail"
              type="email"
              required
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fromName" className="mb-1 block text-xs font-medium text-muted">
              Your name (shown as the sender)
            </label>
            <input
              id="fromName"
              type="text"
              required
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="appPassword" className="mb-1 block text-xs font-medium text-muted">
              App password
            </label>
            <input
              id="appPassword"
              type="password"
              required
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Connecting…" : "Connect"}
          </button>
        </form>
      </div>
    </div>
  );
}
