export type SendErrorClass = "permanent" | "transient" | "account";

export interface ClassifiedError {
  class: SendErrorClass;
  reason: string;
}

interface NormalizedError {
  code?: string;
  responseCode?: number;
  response?: string;
  message: string;
}

function normalizeError(error: unknown): NormalizedError {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      code: typeof e.code === "string" ? e.code : undefined,
      responseCode: typeof e.responseCode === "number" ? e.responseCode : undefined,
      response: typeof e.response === "string" ? e.response : undefined,
      message: typeof e.message === "string" ? e.message : String(error),
    };
  }
  return { message: String(error) };
}

const ACCOUNT_TEXT_PATTERNS = [
  /application-specific password required/i,
  /daily user sending quota exceeded/i,
  /less secure app/i,
  /app password/i,
];

const PERMANENT_TEXT_PATTERNS = [
  /mailbox (unavailable|not found)/i,
  /user unknown/i,
  /no such user/i,
  /invalid recipient/i,
  /recipient (address )?rejected/i,
  /does not exist/i,
];

/**
 * Buckets a send failure into exactly one class per §8.2. Unclassifiable errors default to
 * `transient` — safer to retry a handful of times than to wrongly suppress a real contact or
 * halt the whole account on a fluke.
 */
export function classifySendError(error: unknown): ClassifiedError {
  const err = normalizeError(error);
  const text = `${err.message} ${err.response ?? ""}`;

  const isAccount =
    err.responseCode === 535 ||
    err.responseCode === 534 ||
    err.code === "EAUTH" ||
    ACCOUNT_TEXT_PATTERNS.some((p) => p.test(text));
  if (isAccount) {
    return { class: "account", reason: err.response || err.message };
  }

  const isTransientCode =
    err.code === "ECONNECTION" ||
    err.code === "ECONNRESET" ||
    err.code === "ETIMEDOUT" ||
    err.code === "ESOCKET" ||
    err.code === "EDNS" ||
    (typeof err.responseCode === "number" && err.responseCode >= 400 && err.responseCode < 500);
  if (isTransientCode) {
    return { class: "transient", reason: err.response || err.message };
  }

  const isPermanent =
    (typeof err.responseCode === "number" && err.responseCode >= 500 && err.responseCode < 600) ||
    PERMANENT_TEXT_PATTERNS.some((p) => p.test(text));
  if (isPermanent) {
    return { class: "permanent", reason: err.response || err.message };
  }

  return { class: "transient", reason: err.message };
}

/** 1m, 5m, 25m — index 0 is the delay before the *first* retry. */
export const TRANSIENT_RETRY_DELAYS_MS = [60_000, 300_000, 1_500_000];
export const MAX_TRANSIENT_ATTEMPTS = TRANSIENT_RETRY_DELAYS_MS.length;

/** Returns the delay before the next retry, or null once attempts are exhausted. */
export function nextRetryDelayMs(attemptsSoFar: number): number | null {
  return TRANSIENT_RETRY_DELAYS_MS[attemptsSoFar] ?? null;
}
