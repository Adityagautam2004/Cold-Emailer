import { describe, expect, it } from "vitest";
import { buildUnsubscribeUrl, generateUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe.js";

const SECRET = "s".repeat(64);

describe("unsubscribe token", () => {
  it("round-trips userId and email", () => {
    const token = generateUnsubscribeToken({ userId: "u1", email: "hr@company.com" }, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({ userId: "u1", email: "hr@company.com" });
  });

  it("is stateless — no DB lookup required to verify", () => {
    // (implicit: verifyUnsubscribeToken takes no DB argument at all)
    const token = generateUnsubscribeToken({ userId: "u2", email: "a@b.com" }, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).not.toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = generateUnsubscribeToken({ userId: "u1", email: "hr@company.com" }, SECRET);
    const [encoded, sig] = token.split(".");
    const tamperedPayload = Buffer.from("u1:someone-else@company.com").toString("base64url");
    expect(verifyUnsubscribeToken(`${tamperedPayload}.${sig}`, SECRET)).toBeNull();
    expect(encoded).toBeTruthy();
  });

  it("rejects a token signed with a different secret", () => {
    const token = generateUnsubscribeToken({ userId: "u1", email: "hr@company.com" }, SECRET);
    expect(verifyUnsubscribeToken(token, "t".repeat(64))).toBeNull();
  });

  it("rejects garbage input without throwing", () => {
    expect(verifyUnsubscribeToken("not-a-real-token", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
  });

  it("builds a full URL under /u/:token", () => {
    const url = buildUnsubscribeUrl("https://dispatch.example.com", { userId: "u1", email: "a@b.com" }, SECRET);
    expect(url.startsWith("https://dispatch.example.com/u/")).toBe(true);
  });
});
