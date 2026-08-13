import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import validator from "validator";

export const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

export type ColumnTarget = "email" | "hr_name" | "company" | "title" | "ignore" | string; // string covers `custom.<name>`

export interface ParsedSheet {
  headers: string[];
  rows: Array<{ rowNumber: number; values: string[] }>;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; hyperlink?: unknown };
    if ("richText" in v && Array.isArray((v as any).richText)) {
      return (v as any).richText.map((r: { text: string }) => r.text).join("");
    }
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v.hyperlink !== undefined) return String(v.hyperlink);
    return "";
  }
  return String(value).trim();
}

/** Parses `.xlsx` or `.csv` into a raw header row + data rows. Never auto-trusts headers — mapping is a separate confirm step. */
export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  if (buffer.byteLength > MAX_IMPORT_SIZE_BYTES) {
    throw new Error(
      `File is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_IMPORT_SIZE_BYTES / 1024 / 1024} MB.`
    );
  }

  const isCsv = /\.csv$/i.test(filename);
  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet;

  if (isCsv) {
    worksheet = await workbook.csv.read(Readable.from(buffer));
  } else {
    // exceljs's bundled .d.ts declares `interface Buffer extends ArrayBuffer {}` globally,
    // which conflicts with the real Node Buffer type from @types/node. Runtime accepts a
    // plain Buffer fine — this cast only works around exceljs's own broken type declaration.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const first = workbook.worksheets[0];
    if (!first) throw new Error("This file has no sheets.");
    worksheet = first;
  }

  const rowsRaw: string[][] = [];
  const columnCount = Math.max(worksheet.columnCount, worksheet.actualColumnCount);
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = [];
    const cellCount = Math.max(row.cellCount, columnCount);
    for (let c = 1; c <= cellCount; c++) {
      values.push(cellToString(row.getCell(c).value));
    }
    rowsRaw.push(values);
  });

  if (rowsRaw.length === 0) {
    throw new Error("This file has no rows.");
  }

  const [headerRow, ...dataRows] = rowsRaw;
  const trimmedData = dataRows;
  if (trimmedData.length === 0) {
    throw new Error("This file has a header row but no data rows.");
  }
  if (trimmedData.length > MAX_IMPORT_ROWS) {
    throw new Error(`This file has ${trimmedData.length} data rows — the limit is ${MAX_IMPORT_ROWS}.`);
  }

  return {
    headers: headerRow.map((h) => h.trim()),
    rows: trimmedData.map((values, i) => ({ rowNumber: i + 2, values })), // +2: sheet is 1-indexed, row 1 is the header
  };
}

const HEADER_SYNONYMS: Record<"email" | "hr_name" | "company" | "title", string[]> = {
  email: ["email", "emailaddress", "emailid", "mail", "email address", "mailid"].map(normalizeHeader),
  hr_name: ["hrname", "name", "contactname", "recruitername", "hr", "contact", "contactperson"].map(normalizeHeader),
  company: ["company", "companyname", "organization", "organisation", "org", "employer"].map(normalizeHeader),
  title: ["title", "jobtitle", "role", "designation", "position"].map(normalizeHeader),
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Best-guess column → field mapping from header text. The user always confirms before import runs. */
export function guessColumnMapping(headers: string[]): ColumnTarget[] {
  const used = new Set<string>();
  return headers.map((h) => {
    const norm = normalizeHeader(h);
    for (const [target, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (used.has(target)) continue;
      if (synonyms.includes(norm)) {
        used.add(target);
        return target;
      }
    }
    return "ignore";
  });
}

export function normalizeEmail(raw: string): string {
  return raw
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  return validator.isEmail(email);
}

const ROLE_LOCAL_PARTS = new Set(["info", "careers", "hr", "support", "admin", "noreply"]);

export function isRoleAddress(email: string): boolean {
  const local = email.split("@")[0] ?? "";
  return ROLE_LOCAL_PARTS.has(local);
}

export interface ImportCandidate {
  rowNumber: number;
  email: string;
  hrName: string | null;
  company: string | null;
  title: string | null;
  custom: Record<string, string>;
}

export interface RejectedRow {
  rowNumber: number;
  email: string | null;
  reason: string;
}

export interface ImportReport {
  totalRowsRead: number;
  blankRowsSkipped: number;
  candidates: ImportCandidate[];
  duplicates: RejectedRow[];
  invalid: RejectedRow[];
  roleSkipped: RejectedRow[];
}

/**
 * Validates and buckets every data row. Buckets are mutually exclusive with priority
 * invalid > duplicate > role address > import candidate, so `totalRowsRead` always equals
 * the sum of the four bucket sizes — fully blank rows are excluded from that count entirely.
 * Suppression-list and already-contacted filtering happen one layer up (they need the DB);
 * merge their rejections into `duplicates`/`invalid`-shaped `RejectedRow`s before reporting.
 */
export function bucketRows(
  sheet: ParsedSheet,
  mapping: ColumnTarget[],
  options: { includeRoleAddresses: boolean }
): ImportReport {
  const emailIdx = mapping.indexOf("email");
  if (emailIdx === -1) {
    throw new Error('You must map a column to "email" before importing.');
  }

  const candidates: ImportCandidate[] = [];
  const duplicates: RejectedRow[] = [];
  const invalid: RejectedRow[] = [];
  const roleSkipped: RejectedRow[] = [];
  const seenEmails = new Set<string>();
  let blankRowsSkipped = 0;
  let totalRowsRead = 0;

  for (const row of sheet.rows) {
    if (row.values.every((v) => v.trim() === "")) {
      blankRowsSkipped++;
      continue;
    }
    totalRowsRead++;

    const rawEmail = row.values[emailIdx] ?? "";
    const email = normalizeEmail(rawEmail);

    if (!email || !isValidEmailAddress(email)) {
      invalid.push({
        rowNumber: row.rowNumber,
        email: email || null,
        reason: rawEmail.trim() ? "malformed email address" : "missing email",
      });
      continue;
    }

    if (seenEmails.has(email)) {
      duplicates.push({ rowNumber: row.rowNumber, email, reason: "duplicate of an earlier row in this file" });
      continue;
    }
    seenEmails.add(email);

    if (isRoleAddress(email) && !options.includeRoleAddresses) {
      roleSkipped.push({ rowNumber: row.rowNumber, email, reason: "role address — these get few replies" });
      continue;
    }

    const custom: Record<string, string> = {};
    let hrName: string | null = null;
    let company: string | null = null;
    let title: string | null = null;

    mapping.forEach((target, idx) => {
      const value = (row.values[idx] ?? "").trim();
      if (!value) return;
      if (target === "hr_name") hrName = value;
      else if (target === "company") company = value;
      else if (target === "title") title = value;
      else if (target.startsWith("custom.")) custom[target.slice("custom.".length)] = value;
    });

    candidates.push({ rowNumber: row.rowNumber, email, hrName, company, title, custom });
  }

  return { totalRowsRead, blankRowsSkipped, candidates, duplicates, invalid, roleSkipped };
}

export function formatImportSummary(report: ImportReport): string {
  return `${report.totalRowsRead} rows read · ${report.candidates.length} will import · ${report.duplicates.length} duplicates · ${report.invalid.length} invalid · ${report.roleSkipped.length} role addresses skipped`;
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rejectedRowsToCsv(report: ImportReport): string {
  const lines = ["row_number,email,reason"];
  const all = [...report.invalid, ...report.duplicates, ...report.roleSkipped].sort(
    (a, b) => a.rowNumber - b.rowNumber
  );
  for (const r of all) {
    lines.push([String(r.rowNumber), r.email ?? "", csvEscape(r.reason)].join(","));
  }
  return lines.join("\n");
}
