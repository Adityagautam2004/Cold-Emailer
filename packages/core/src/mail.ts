import { randomBytes } from "node:crypto";

/** `<{sendId}.{random}@{domain}>` — this is the join key for reply detection, so it must be unique per send. */
export function generateMessageId(sendId: string, domain: string): string {
  const random = randomBytes(8).toString("hex");
  return `<${sendId}.${random}@${domain}>`;
}

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
