import { describe, expect, it } from "vitest";
import {
  appendOptOut,
  buildListUnsubscribeHeaders,
  resolveFollowUpThreading,
  resumeAttachmentFilename,
  threadSubject,
} from "./mail.js";

describe("threadSubject", () => {
  it("adds a Re: prefix to a subject with none", () => {
    expect(threadSubject("Application for SDE Intern")).toBe("Re: Application for SDE Intern");
  });

  it("does not double up an existing Re: prefix", () => {
    expect(threadSubject("Re: Application for SDE Intern")).toBe("Re: Application for SDE Intern");
    expect(threadSubject("re: already threaded")).toBe("re: already threaded");
  });
});

describe("resolveFollowUpThreading (§10.3)", () => {
  const root = { providerMessageId: "<root@dispatch.app>", renderedSubject: "Application for SDE Intern" };
  const step1 = { providerMessageId: "<step1@dispatch.app>", renderedSubject: "Application for SDE Intern" };

  it("a first follow-up (step 1) threads In-Reply-To/References off the root, since root IS the immediate prior", () => {
    const result = resolveFollowUpThreading(root, root);
    expect(result.inReplyTo).toBe("<root@dispatch.app>");
    expect(result.references).toEqual(["<root@dispatch.app>"]);
    expect(result.subject).toBe("Re: Application for SDE Intern");
  });

  it("a second follow-up (step 2) threads In-Reply-To/References off step 1, NOT off the root", () => {
    const result = resolveFollowUpThreading(root, step1);
    expect(result.inReplyTo).toBe("<step1@dispatch.app>");
    expect(result.references).toEqual(["<step1@dispatch.app>"]);
    // subject still traces to the root regardless of which step is the immediate prior.
    expect(result.subject).toBe("Re: Application for SDE Intern");
  });

  it("leaves subject untouched (null) when the root has no renderedSubject yet", () => {
    const result = resolveFollowUpThreading(null, step1);
    expect(result.subject).toBeNull();
    expect(result.inReplyTo).toBe("<step1@dispatch.app>");
  });

  it("produces no threading headers when neither anchor has a providerMessageId", () => {
    const result = resolveFollowUpThreading(null, null);
    expect(result.inReplyTo).toBeUndefined();
    expect(result.references).toBeUndefined();
    expect(result.subject).toBeNull();
  });
});

describe("appendOptOut / buildListUnsubscribeHeaders", () => {
  it("appends the opt-out line with a blank line separator", () => {
    const result = appendOptOut("Hi there, checking in.", "https://dispatch.app/u/abc");
    expect(result).toBe('Hi there, checking in.\n\nNot the right contact? Reply "no" or opt out: https://dispatch.app/u/abc');
  });

  it("trims trailing whitespace from the body before appending", () => {
    const result = appendOptOut("Hi there.\n\n  ", "https://dispatch.app/u/abc");
    expect(result.endsWith("Hi there.\n\nNot the right contact? Reply \"no\" or opt out: https://dispatch.app/u/abc")).toBe(true);
  });

  it("builds RFC 8058 one-click headers", () => {
    const headers = buildListUnsubscribeHeaders("https://dispatch.app/u/abc");
    expect(headers["List-Unsubscribe"]).toBe("<https://dispatch.app/u/abc>");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("resumeAttachmentFilename", () => {
  it("sanitises the student's name into a safe filename", () => {
    expect(resumeAttachmentFilename("Priya Sharma")).toBe("Priya_Sharma_Resume.pdf");
  });

  it("strips characters unsafe in a filename", () => {
    expect(resumeAttachmentFilename("O'Brien / Smith!")).toBe("OBrien_Smith_Resume.pdf");
  });

  it("falls back to a generic name when the input is empty after sanitising", () => {
    expect(resumeAttachmentFilename("!!!")).toBe("Student_Resume.pdf");
  });
});
