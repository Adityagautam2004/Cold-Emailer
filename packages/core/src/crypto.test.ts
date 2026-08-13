import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto.js";

describe("crypto", () => {
  it("round-trips plaintext", () => {
    const plaintext = "a-gmail-app-password-1234";
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same-input");
    expect(decrypt(b)).toBe("same-input");
  });

  it("is versioned", () => {
    expect(encrypt("x").startsWith("v1.")).toBe(true);
  });

  it("rejects a tampered ciphertext (auth tag mismatch)", () => {
    const payload = encrypt("secret");
    const parts = payload.split(".");
    // Flip the last character of the ciphertext segment.
    const tampered = parts[3].slice(0, -1) + (parts[3].endsWith("A") ? "B" : "A");
    const corrupted = [parts[0], parts[1], parts[2], tampered].join(".");
    expect(() => decrypt(corrupted)).toThrow();
  });

  it("rejects an unknown version prefix", () => {
    expect(() => decrypt("v2.aa.bb.cc")).toThrow(/unknown ciphertext version/);
  });
});
