const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Recipient-side variables — at least one of these must appear for a template to count as "personalised" (§2.4). */
const PERSONALIZATION_VARS = new Set(["hr_name", "first_name", "company", "title"]);

export interface RenderContext {
  hrName?: string | null;
  company?: string | null;
  title?: string | null;
  myName: string;
  myCollege?: string | null;
  custom?: Record<string, string | number | null | undefined>;
}

export interface RenderResult {
  ok: boolean;
  text?: string;
  /** Recognised variables that resolved to nothing for this contact. */
  missing?: string[];
  /** `{{...}}` tokens that aren't a known variable name (typo protection). */
  unknown?: string[];
}

const UNKNOWN = Symbol("unknown-variable");

function deriveFirstName(hrName: string | null | undefined): string | null {
  if (!hrName) return null;
  const trimmed = hrName.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

function resolveVariable(name: string, ctx: RenderContext): string | null | undefined | typeof UNKNOWN {
  switch (name) {
    case "hr_name":
      return ctx.hrName;
    case "first_name":
      return deriveFirstName(ctx.hrName);
    case "company":
      return ctx.company;
    case "title":
      return ctx.title;
    case "my_name":
      return ctx.myName;
    case "my_college":
      return ctx.myCollege;
    default:
      if (name.startsWith("custom.")) {
        const key = name.slice("custom.".length);
        const value = ctx.custom?.[key];
        return value === undefined || value === null ? null : String(value);
      }
      return UNKNOWN;
  }
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/** Renders `text` against `ctx`. Refuses to render if any variable is unresolved or unrecognised — an unresolvable variable is an error, never an empty string. */
export function renderTemplate(text: string, ctx: RenderContext): RenderResult {
  const missing: string[] = [];
  const unknown: string[] = [];

  const rendered = text.replace(VAR_RE, (_match, rawName: string) => {
    const name = rawName.trim();
    const value = resolveVariable(name, ctx);
    if (value === UNKNOWN) {
      unknown.push(name);
      return `{{${name}}}`;
    }
    if (value === null || value === undefined || value === "") {
      missing.push(name);
      return `{{${name}}}`;
    }
    return value;
  });

  if (missing.length > 0 || unknown.length > 0) {
    return { ok: false, missing: dedupe(missing), unknown: dedupe(unknown) };
  }
  return { ok: true, text: rendered };
}

/** All `{{...}}` variable names referenced anywhere in `text`, recognised or not. */
export function extractVariables(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(VAR_RE)) {
    names.push(m[1].trim());
  }
  return dedupe(names);
}

function isPersonalizationVar(name: string): boolean {
  return PERSONALIZATION_VARS.has(name) || name.startsWith("custom.");
}

/** §2.4: a campaign cannot start unless the template references at least one recipient-side variable. */
export function hasPersonalizationVariable(bodyText: string): boolean {
  return extractVariables(bodyText).some(isPersonalizationVar);
}

export function hasAnyVariable(text: string): boolean {
  return extractVariables(text).length > 0;
}

const SPAM_TRIGGER_WORDS = ["guaranteed", "act now"];

export interface TemplateWarning {
  code: string;
  message: string;
}

/** Save-time advisory checks — none of these block saving, unlike §2.4's hard campaign-start rule. */
export function validateTemplate(subject: string, bodyText: string): TemplateWarning[] {
  const warnings: TemplateWarning[] = [];

  if (!hasAnyVariable(bodyText)) {
    warnings.push({
      code: "no-variable",
      message: "This body has no {{variable}}. Every recipient will get the exact same email.",
    });
  }

  if (subject.length > 60) {
    warnings.push({
      code: "subject-too-long",
      message: `Subject is ${subject.length} characters — subjects over 60 characters get truncated in most inboxes.`,
    });
  }

  const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 200) {
    warnings.push({
      code: "body-too-long",
      message: `Body is ${wordCount} words — cold emails over 200 words get skimmed, not read.`,
    });
  }

  const lower = bodyText.toLowerCase();
  const hitTrigger = SPAM_TRIGGER_WORDS.find((w) => lower.includes(w));
  if (hitTrigger) {
    warnings.push({
      code: "spam-trigger-word",
      message: `"${hitTrigger}" reads as a spam signal to mail filters. Consider rewording.`,
    });
  }

  if (/\b[A-Z]{4,}\b/.test(bodyText)) {
    warnings.push({
      code: "all-caps-run",
      message: "A run of all-caps text reads as shouting to mail filters and to a human.",
    });
  }

  const exclamations = (bodyText.match(/!/g) ?? []).length;
  if (exclamations > 1) {
    warnings.push({
      code: "too-many-exclamations",
      message: `${exclamations} exclamation marks — more than one reads as a spam signal.`,
    });
  }

  return warnings;
}

export interface ContactLike {
  rowNumber: number;
  email: string;
  hrName?: string | null;
  company?: string | null;
  title?: string | null;
  custom?: Record<string, unknown> | null;
}

export interface UnresolvedRow {
  rowNumber: number;
  email: string;
  variables: string[];
}

/**
 * Checks every contact against subject+body before a campaign is allowed to start.
 * Returns one entry per contact that would produce an unfilled variable, naming exactly
 * which variables and which row — "Hi , I saw that is hiring" is the bug this exists to catch.
 */
export function validateContactsAgainstTemplate(
  subject: string,
  bodyText: string,
  contacts: ContactLike[],
  sender: { myName: string; myCollege?: string | null }
): UnresolvedRow[] {
  const combined = `${subject}\n${bodyText}`;
  const rows: UnresolvedRow[] = [];

  for (const contact of contacts) {
    const ctx: RenderContext = {
      hrName: contact.hrName,
      company: contact.company,
      title: contact.title,
      myName: sender.myName,
      myCollege: sender.myCollege,
      custom: (contact.custom ?? {}) as Record<string, string | number | null | undefined>,
    };
    const result = renderTemplate(combined, ctx);
    if (!result.ok) {
      rows.push({
        rowNumber: contact.rowNumber,
        email: contact.email,
        variables: dedupe([...(result.missing ?? []), ...(result.unknown ?? [])]),
      });
    }
  }

  return rows;
}
