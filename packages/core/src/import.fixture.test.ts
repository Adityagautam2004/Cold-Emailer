import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bucketRows, guessColumnMapping } from "./import.js";
import { parseSpreadsheet } from "./spreadsheet-parser.js";

// §4/§19 — a deliberately messy fixture (blank row, duplicate emails in different cases,
// one malformed address, one careers@, a stray repeated header row) with exact expected
// counts. See fixtures/contacts-messy.xlsx and the row-by-row comments in the generator
// this was built from (DECISIONS.md).
describe("fixtures/contacts-messy.xlsx (§19)", () => {
  it("produces the exact expected counts", async () => {
    const buffer = await readFile(path.resolve(__dirname, "../../../fixtures/contacts-messy.xlsx"));
    const sheet = await parseSpreadsheet(buffer, "contacts-messy.xlsx");
    const mapping = guessColumnMapping(sheet.headers);

    expect(mapping).toEqual(["hr_name", "email", "company"]);

    const report = bucketRows(sheet, mapping, { includeRoleAddresses: false });

    expect(report.blankRowsSkipped).toBe(1);
    expect(report.totalRowsRead).toBe(7);
    expect(report.candidates).toHaveLength(3);
    expect(report.candidates.map((c) => c.email)).toEqual(["asha@acme.com", "bala@acme.com", "chetan@beta.com"]);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0].email).toBe("bala@acme.com");
    expect(report.invalid).toHaveLength(2);
    expect(report.roleSkipped).toHaveLength(1);
    expect(report.roleSkipped[0].email).toBe("careers@acme.com");

    // Buckets are mutually exclusive and exhaustive over the non-blank rows.
    expect(report.totalRowsRead).toBe(
      report.candidates.length + report.duplicates.length + report.invalid.length + report.roleSkipped.length
    );
  });

  it("includes the role address when the toggle is on, one fewer skipped and one more imported", async () => {
    const buffer = await readFile(path.resolve(__dirname, "../../../fixtures/contacts-messy.xlsx"));
    const sheet = await parseSpreadsheet(buffer, "contacts-messy.xlsx");
    const mapping = guessColumnMapping(sheet.headers);
    const report = bucketRows(sheet, mapping, { includeRoleAddresses: true });

    expect(report.roleSkipped).toHaveLength(0);
    expect(report.candidates).toHaveLength(4);
  });
});
