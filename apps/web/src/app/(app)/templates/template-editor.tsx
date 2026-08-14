"use client";

import { renderTemplate, validateTemplate } from "@dispatch/core";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const VARIABLES = [
  { token: "{{hr_name}}", label: "HR name" },
  { token: "{{first_name}}", label: "First name" },
  { token: "{{company}}", label: "Company" },
  { token: "{{title}}", label: "Title" },
  { token: "{{my_name}}", label: "My name" },
  { token: "{{my_college}}", label: "My college" },
];

// Used until a real contact list exists (Phase 4) — §12 explicitly allows dummy data here.
const DUMMY_CONTACT = { hrName: "Priya Sharma", company: "Acme Corp", title: "SDE Intern" };
const DUMMY_SENDER = { myName: "Rahul Verma", myCollege: "IIT Bombay" };

interface TemplateData {
  id?: string;
  name: string;
  subject: string;
  bodyText: string;
}

export function TemplateEditor({ initial }: { initial: TemplateData }) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState(initial.name);
  const [subject, setSubject] = useState(initial.subject);
  const [bodyText, setBodyText] = useState(initial.bodyText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const warnings = useMemo(() => validateTemplate(subject, bodyText), [subject, bodyText]);
  const preview = useMemo(() => {
    const ctx = { ...DUMMY_CONTACT, ...DUMMY_SENDER };
    const subjectResult = renderTemplate(subject, ctx);
    const bodyResult = renderTemplate(bodyText, ctx);
    const missing = [
      ...(subjectResult.missing ?? []),
      ...(subjectResult.unknown ?? []),
      ...(bodyResult.missing ?? []),
      ...(bodyResult.unknown ?? []),
    ];
    if (missing.length > 0) {
      return { error: `Missing: ${Array.from(new Set(missing)).join(", ")}` } as const;
    }
    return { subject: subjectResult.text!, body: bodyResult.text! } as const;
  }, [subject, bodyText]);

  function insertVariable(token: string) {
    const el = bodyRef.current;
    if (!el) {
      setBodyText((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? bodyText.length;
    const end = el.selectionEnd ?? bodyText.length;
    const next = bodyText.slice(0, start) + token + bodyText.slice(end);
    setBodyText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const url = initial.id ? `/api/templates/${initial.id}` : "/api/templates";
      const method = initial.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, bodyText }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setSaved(true);
      if (!initial.id) {
        router.push(`/templates/${body.template.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <div className="space-y-3">
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-muted">
              Template name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:border-accent"
            />
          </div>
          <div>
            <label htmlFor="subject" className="mb-1 block text-xs font-medium text-muted">
              Subject
            </label>
            <input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:border-accent"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="body" className="block text-xs font-medium text-muted">
                Body
              </label>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => insertVariable(v.token)}
                  className="rounded border border-line bg-surface px-2 py-1 font-mono text-xs text-muted transition-standard hover:border-accent hover:text-text"
                >
                  {v.label}
                </button>
              ))}
            </div>
            <textarea
              id="body"
              ref={bodyRef}
              rows={14}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus-visible:border-accent"
            />
          </div>
        </div>

        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {warnings.map((w) => (
              <li key={w.code} className="text-sm text-pending">
                {w.message}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save template"}
        </button>
        {saved && <span className="ml-3 text-sm text-good">Saved.</span>}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Preview — against a dummy contact until you have a real list
        </p>
        <div className="rounded-lg border border-line bg-surface p-5">
          {"error" in preview ? (
            <p className="text-sm text-bad">{preview.error}</p>
          ) : (
            <>
              <p className="border-b border-line pb-3 text-sm font-medium">{preview.subject}</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-text">{preview.body}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
