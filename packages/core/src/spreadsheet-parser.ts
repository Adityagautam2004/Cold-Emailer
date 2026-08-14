import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { MAX_IMPORT_ROWS, MAX_IMPORT_SIZE_BYTES, type ParsedSheet } from "./import.js";

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

/**
 * Parses `.xlsx` or `.csv` into a raw header row + data rows. Never auto-trusts headers —
 * mapping is a separate confirm step. Kept in its own file (not import.ts) purely so
 * exceljs's `node:stream` dependency doesn't end up in the main @dispatch/core barrel — see
 * index.ts's comment on why that barrel stays free of anything that needs a real Node
 * built-in. Server-only code imports this by direct subpath:
 * @dispatch/core/src/spreadsheet-parser.js.
 */
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
