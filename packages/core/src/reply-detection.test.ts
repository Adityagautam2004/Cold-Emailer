import { describe, expect, it } from "vitest";
import {
  extractLikelyBouncedRecipient,
  extractReferencedMessageIds,
  isBounceSenderAddress,
  isDsnContentType,
  parseDsnRecipient,
} from "./reply-detection.js";

describe("extractReferencedMessageIds (§13.1)", () => {
  it("extracts a single In-Reply-To value", () => {
    expect(extractReferencedMessageIds("<abc123.xyz@dispatch.app>", null)).toEqual(["<abc123.xyz@dispatch.app>"]);
  });

  it("extracts every id from a space-separated References chain", () => {
    const refs = "<one@dispatch.app> <two@dispatch.app> <three@dispatch.app>";
    expect(extractReferencedMessageIds(null, refs)).toEqual(["<one@dispatch.app>", "<two@dispatch.app>", "<three@dispatch.app>"]);
  });

  it("dedupes ids appearing in both headers", () => {
    const id = "<abc123.xyz@dispatch.app>";
    expect(extractReferencedMessageIds(id, id)).toEqual([id]);
  });

  it("returns an empty array when both headers are absent", () => {
    expect(extractReferencedMessageIds(null, null)).toEqual([]);
    expect(extractReferencedMessageIds(undefined, undefined)).toEqual([]);
  });

  it("handles mailparser's array form (multiple In-Reply-To values)", () => {
    expect(extractReferencedMessageIds(["<a@x.com>", "<b@x.com>"], null)).toEqual(["<a@x.com>", "<b@x.com>"]);
  });
});

describe("isBounceSenderAddress (§13.4)", () => {
  it("flags mailer-daemon@ addresses", () => {
    expect(isBounceSenderAddress("mailer-daemon@googlemail.com")).toBe(true);
  });

  it("flags postmaster@ addresses", () => {
    expect(isBounceSenderAddress("Postmaster@example.com")).toBe(true);
  });

  it("does not flag a normal recruiter reply", () => {
    expect(isBounceSenderAddress("hr@acmecorp.com")).toBe(false);
  });

  it("handles null/undefined safely", () => {
    expect(isBounceSenderAddress(null)).toBe(false);
    expect(isBounceSenderAddress(undefined)).toBe(false);
  });
});

describe("isDsnContentType (§13.4)", () => {
  it("recognises a standard DSN content-type", () => {
    expect(isDsnContentType('multipart/report; report-type=delivery-status; boundary="xyz"')).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isDsnContentType("Multipart/Report; Report-Type=Delivery-Status")).toBe(true);
  });

  it("rejects an unrelated multipart type", () => {
    expect(isDsnContentType("multipart/mixed; boundary=xyz")).toBe(false);
  });

  it("handles null/undefined safely", () => {
    expect(isDsnContentType(null)).toBe(false);
  });
});

describe("parseDsnRecipient (§13.4)", () => {
  it("parses a standard rfc822-prefixed Final-Recipient", () => {
    const text = [
      "Reporting-MTA: dns; mx.example.com",
      "",
      "Final-Recipient: rfc822; nonexistent@acmecorp.com",
      "Action: failed",
      "Status: 5.1.1",
    ].join("\n");
    expect(parseDsnRecipient(text)).toBe("nonexistent@acmecorp.com");
  });

  it("falls back to Original-Recipient when Final-Recipient is absent", () => {
    const text = "Original-Recipient: rfc822; someone@example.com\nAction: failed";
    expect(parseDsnRecipient(text)).toBe("someone@example.com");
  });

  it("handles a bare address with no rfc822 prefix", () => {
    const text = "Final-Recipient: someone@example.com";
    expect(parseDsnRecipient(text)).toBe("someone@example.com");
  });

  it("lowercases the extracted address", () => {
    const text = "Final-Recipient: rfc822; SomeOne@Example.COM";
    expect(parseDsnRecipient(text)).toBe("someone@example.com");
  });

  it("returns null when neither field is present", () => {
    expect(parseDsnRecipient("Reporting-MTA: dns; mx.example.com\nAction: failed")).toBeNull();
  });
});

describe("extractLikelyBouncedRecipient (§13.4 fallback)", () => {
  it("finds the recipient mentioned in a human-readable bounce body", () => {
    const body =
      "Delivery to the following recipient failed permanently:\n\n" +
      "     nonexistent@acmecorp.com\n\n" +
      "Technical details of permanent failure: The email account does not exist.";
    expect(extractLikelyBouncedRecipient(body, "student@gmail.com")).toBe("nonexistent@acmecorp.com");
  });

  it("skips the receiving mailbox's own address", () => {
    const body = "Your message to student@gmail.com could not be delivered to nonexistent@acmecorp.com";
    expect(extractLikelyBouncedRecipient(body, "student@gmail.com")).toBe("nonexistent@acmecorp.com");
  });

  it("skips generic mailer addresses", () => {
    const body = "From: mailer-daemon@googlemail.com\nThe recipient nonexistent@acmecorp.com does not exist.";
    expect(extractLikelyBouncedRecipient(body, "student@gmail.com")).toBe("nonexistent@acmecorp.com");
  });

  it("returns null when no candidate address is found", () => {
    expect(extractLikelyBouncedRecipient("Delivery failed for unknown reasons.", "student@gmail.com")).toBeNull();
  });
});
