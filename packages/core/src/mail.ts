/** §8.3 — reject a resume upload larger than this at the upload step, with a clear message. */
export const MAX_RESUME_SIZE_BYTES = 2 * 1024 * 1024;

const URL_RE = /\bhttps?:\/\/[^\s<>"]+/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Minimal HTML from plain text: paragraph breaks and autolinked URLs only. No tables, no
 * images, no tracking pixel, no wrapper divs with inline CSS — a styled marketing template
 * is what gets filtered; near-plaintext from a real mailbox is what gets replies.
 */
export function textToMinimalHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((block) => {
    const escaped = escapeHtml(block).replace(/\n/g, "<br>");
    const linked = escaped.replace(URL_RE, (url) => `<a href="${url}">${url}</a>`);
    return `<p>${linked}</p>`;
  });
  return paragraphs.join("\n");
}

export const OPT_OUT_LINE = (unsubscribeUrl: string) =>
  `Not the right contact? Reply "no" or opt out: ${unsubscribeUrl}`;

/** Appends the mandatory one-line opt-out (§2.5) as the last line of the text body. */
export function appendOptOut(text: string, unsubscribeUrl: string): string {
  return `${text.trimEnd()}\n\n${OPT_OUT_LINE(unsubscribeUrl)}`;
}

export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Sanitises a display name for use as `{name}_Resume.pdf` — strips anything not safe in a filename. */
export function sanitizeFilenamePart(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_");
  return cleaned || "Student";
}

export function resumeAttachmentFilename(studentName: string): string {
  return `${sanitizeFilenamePart(studentName)}_Resume.pdf`;
}

export function threadSubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

export interface ThreadAnchor {
  providerMessageId: string | null;
  renderedSubject: string | null;
}

export interface FollowUpThreading {
  /** New subject for the follow-up, or null to leave the step's own rendered subject untouched. */
  subject: string | null;
  inReplyTo: string | undefined;
  references: string[] | undefined;
}

/**
 * §10.3 — a follow-up threads off two different anchors for two different reasons. The
 * subject always traces back to the *root* (step 0): mail clients group by subject text,
 * and a follow-up's own template subject read as "Re: <something else>" looks like a second
 * cold email. `In-Reply-To`/`References`, by contrast, must point at the *immediately
 * preceding* step's Message-ID per §10.3's text ("the prior step's providerMessageId") —
 * for a 3-step campaign, step 2 threads off step 1, not step 0, or a mail client's raw RFC
 * 5322 reply-chain view (as opposed to its subject-grouping heuristic) won't line up.
 */
export function resolveFollowUpThreading(root: ThreadAnchor | null, immediatePrior: ThreadAnchor | null): FollowUpThreading {
  return {
    subject: root?.renderedSubject ? threadSubject(root.renderedSubject) : null,
    inReplyTo: immediatePrior?.providerMessageId ?? undefined,
    references: immediatePrior?.providerMessageId ? [immediatePrior.providerMessageId] : undefined,
  };
}
