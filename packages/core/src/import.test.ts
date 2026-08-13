import { describe, expect, it } from "vitest";
import {
  bucketRows,
  guessColumnMapping,
  isRoleAddress,
  isValidEmailAddress,
  normalizeEmail,
  type ParsedSheet,
} from "./import.js";

describe("normalizeEmail", () => {
  it("trims, lowercases, strips mailto:, collapses whitespace", () => {
    expect(normalizeEmail("  Mailto:John.Doe@Example.com  ")).toBe("john.doe@example.com");
    expect(normalizeEmail("jane doe@example.com")).toBe("janedoe@example.com");
  });
});

describe("isValidEmailAddress", () => {
  it("accepts well-formed addresses", () => {
    expect(isValidEmailAddress("hr@company.com")).toBe(true);
  });

  it("rejects malformed addresses with a real validator, not a naive regex", () => {
    expect(isValidEmailAddress("not-an-email")).toBe(false);
    expect(isValidEmailAddress("missing-domain@")).toBe(false);
    expect(isValidEmailAddress("@missing-local.com")).toBe(false);
    expect(isValidEmailAddress("two@@at.com")).toBe(false);
  });
});

describe("isRoleAddress", () => {
  it("flags known role local-parts", () => {
    for (const local of ["info", "careers", "hr", "support", "admin", "noreply"]) {
      expect(isRoleAddress(`${local}@company.com`)).toBe(true);
    }
  });

  it("does not flag a personal address", () => {
    expect(isRoleAddress("priya.sharma@company.com")).toBe(false);
  });
});

describe("guessColumnMapping", () => {
  it("guesses common header variants", () => {
    const mapping = guessColumnMapping(["HR Name", "Email ID", "Company Name", "Job Title", "Notes"]);
    expect(mapping).toEqual(["hr_name", "email", "company", "title", "ignore"]);
  });
});

describe("bucketRows", () => {
  const mapping = ["hr_name", "email", "company"];

  function sheetOf(rows: string[][]): ParsedSheet {
    return { headers: ["HR Name", "Email", "Company"], rows: rows.map((values, i) => ({ rowNumber: i + 2, values })) };
  }

  it("buckets invalid, duplicate, role, and importable rows with mutually exclusive counts", () => {
    const sheet = sheetOf([
      ["Asha", "asha@acme.com", "Acme"], // valid
      ["", "", ""], // blank row — excluded from totalRowsRead entirely
      ["Bad Row", "not-an-email", "Beta"], // invalid
      ["Asha Dup", "ASHA@acme.com", "Acme"], // duplicate (case-insensitive)
      ["", "careers@acme.com", "Acme"], // role address
    ]);

    const report = bucketRows(sheet, mapping, { includeRoleAddresses: false });

    expect(report.blankRowsSkipped).toBe(1);
    expect(report.totalRowsRead).toBe(4);
    expect(report.candidates).toHaveLength(1);
    expect(report.invalid).toHaveLength(1);
    expect(report.duplicates).toHaveLength(1);
    expect(report.roleSkipped).toHaveLength(1);
    expect(report.totalRowsRead).toBe(
      report.candidates.length + report.invalid.length + report.duplicates.length + report.roleSkipped.length
    );
  });

  it("includes role addresses when the toggle is on", () => {
    const sheet = sheetOf([["", "careers@acme.com", "Acme"]]);
    const report = bucketRows(sheet, mapping, { includeRoleAddresses: true });
    expect(report.roleSkipped).toHaveLength(0);
    expect(report.candidates).toHaveLength(1);
  });
});
