import { describe, expect, it } from "vitest";
import { classifySendError, MAX_TRANSIENT_ATTEMPTS, nextRetryDelayMs, TRANSIENT_RETRY_DELAYS_MS } from "./errors.js";

function smtpError(responseCode: number, response: string, code?: string) {
  return { responseCode, response, code, message: response };
}

describe("classifySendError — real SMTP error shapes", () => {
  it("classifies 550 mailbox not found as permanent", () => {
    expect(classifySendError(smtpError(550, "550 5.1.1 The email account that you tried to reach does not exist")).class).toBe(
      "permanent"
    );
  });

  it("classifies 553 invalid recipient as permanent", () => {
    expect(classifySendError(smtpError(553, "553 5.1.2 Invalid recipient")).class).toBe("permanent");
  });

  it("classifies 421 as transient", () => {
    expect(classifySendError(smtpError(421, "421 4.7.0 Try again later")).class).toBe("transient");
  });

  it("classifies 451 temporary lookup failure as transient", () => {
    expect(classifySendError(smtpError(451, "451 4.3.0 Temporary lookup failure")).class).toBe("transient");
  });

  it("classifies 535 auth failed as account", () => {
    expect(classifySendError(smtpError(535, "535 5.7.8 Username and Password not accepted")).class).toBe("account");
  });

  it("classifies a revoked app password message as account", () => {
    expect(
      classifySendError({ message: "Application-specific password required" }).class
    ).toBe("account");
  });

  it('classifies "Daily user sending quota exceeded" as account', () => {
    expect(classifySendError(smtpError(550, "550 5.4.5 Daily user sending quota exceeded")).class).toBe("account");
  });

  it("classifies a connection reset as transient", () => {
    expect(classifySendError({ code: "ECONNRESET", message: "socket hang up" }).class).toBe("transient");
  });

  it("classifies a connection timeout as transient", () => {
    expect(classifySendError({ code: "ETIMEDOUT", message: "Connection timed out" }).class).toBe("transient");
  });

  it("defaults an unrecognised error to transient rather than silently dropping it", () => {
    expect(classifySendError(new Error("something weird happened")).class).toBe("transient");
  });
});

describe("retry backoff", () => {
  it("is 1m, 5m, 25m, capped at 3 attempts", () => {
    expect(TRANSIENT_RETRY_DELAYS_MS).toEqual([60_000, 300_000, 1_500_000]);
    expect(MAX_TRANSIENT_ATTEMPTS).toBe(3);
    expect(nextRetryDelayMs(0)).toBe(60_000);
    expect(nextRetryDelayMs(1)).toBe(300_000);
    expect(nextRetryDelayMs(2)).toBe(1_500_000);
    expect(nextRetryDelayMs(3)).toBeNull();
  });
});
