"use client";

import { warmupStage } from "@dispatch/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";

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

function accountStatusLabel(acc: Pick<EmailAccountRow, "status" | "verifiedAt">): string {
  if (acc.status === "error") return "error";
  if (acc.status === "paused") return "paused";
  if (!acc.verifiedAt) return "unverified";
  return "active";
}

export function EmailAccountManager({
  initialAccounts,
  hideConnectForm = false,
}: {
  initialAccounts: EmailAccountRow[];
  /** Onboarding's "send test email" step shows this same component right after the "connect
   * Gmail" step already did — repeating the "connect a new account" form there reads as if
   * the first connection didn't take. */
  hideConnectForm?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);
  const [reconnectPassword, setReconnectPassword] = useState("");

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
      toast.success("Mailbox connected.");
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
      toast.success("Test email sent — check your inbox.");
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
      toast.success("Mailbox reconnected.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <FieldError>{error}</FieldError>

      {initialAccounts.map((acc) => {
        const stage = warmupStage(new Date(acc.warmupStartedAt));
        return (
          <Card key={acc.id} className="mb-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm">{acc.fromEmail}</p>
                <p className="text-xs text-muted">{acc.fromName}</p>
              </div>
              <StatusBadge status={accountStatusLabel(acc)} />
            </div>

            {acc.status === "error" && (
              <div className="mt-3 rounded-md border border-bad/40 bg-bad-soft px-3 py-2 text-sm text-bad">
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
                <Input
                  type="password"
                  required
                  value={reconnectPassword}
                  onChange={(e) => setReconnectPassword(e.target.value)}
                  placeholder="New app password"
                />
                <Button type="submit" loading={pending} className="shrink-0">
                  Save
                </Button>
              </form>
            )}
          </Card>
        );
      })}

      {!hideConnectForm && (
        <Card className="p-5">
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
              <Label htmlFor="fromEmail">Gmail address</Label>
              <Input id="fromEmail" type="email" required value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fromName">Your name (shown as the sender)</Label>
              <Input id="fromName" type="text" required value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="appPassword">App password</Label>
              <Input id="appPassword" type="password" required value={appPassword} onChange={(e) => setAppPassword(e.target.value)} />
            </div>
            <Button type="submit" loading={pending}>
              Connect
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
