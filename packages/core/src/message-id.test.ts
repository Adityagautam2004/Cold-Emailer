import { describe, expect, it } from "vitest";
import { generateMessageId } from "./message-id.js";

describe("generateMessageId", () => {
  it("embeds the sendId and domain in RFC 5322 angle-bracket form", () => {
    const id = generateMessageId("send123", "dispatch.app");
    expect(id).toMatch(/^<send123\.[0-9a-f]{16}@dispatch\.app>$/);
  });

  it("is unique across calls for the same sendId", () => {
    const a = generateMessageId("send123", "dispatch.app");
    const b = generateMessageId("send123", "dispatch.app");
    expect(a).not.toBe(b);
  });
});
