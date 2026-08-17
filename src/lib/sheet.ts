import "server-only";

import ExcelJS from "exceljs";

/**
 * Reads a spreadsheet of properties into rows we can map.
 *
 * Accepts .xlsx and .csv, because "export from AppFolio" or "the list I already
 * keep" arrives as either. Column names are whatever the sheet happens to use —
 * matching them is `detectColumns` below, and the operator can correct any guess
 * before anything is written.
 */

export type SheetRow = Record<string, unknown>;
export type ParsedSheet = { headers: string[]; rows: SheetRow[] };

export async function parseSheet(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return parseCsv(buffer.toString("utf8"));
  return parseXlsx(buffer);
}

async function parseXlsx(buffer: Buffer): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS wants an ArrayBuffer-ish; a Node Buffer is accepted at runtime.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("That workbook has no sheets.");

  // The header is the first row with two or more non-empty cells — real sheets
  // often open with a title row or a blank line above the actual table.
  let headerRowNumber = 0;
  let headers: string[] = [];
  for (let i = 1; i <= Math.min(sheet.rowCount, 25); i += 1) {
    const values = rowValues(sheet.getRow(i));
    const filled = values.filter((v) => v !== "");
    if (filled.length >= 2) {
      headerRowNumber = i;
      headers = values;
      break;
    }
  }
  if (!headerRowNumber) throw new Error("Couldn't find a header row in that sheet.");

  const rows: SheetRow[] = [];
  for (let i = headerRowNumber + 1; i <= sheet.rowCount; i += 1) {
    const values = rowValues(sheet.getRow(i));
    if (values.every((v) => v === "")) continue;
    const row: SheetRow = {};
    headers.forEach((header, index) => {
      if (header) row[header] = values[index] ?? "";
    });
    rows.push(row);
  }

  return { headers: headers.filter(Boolean), rows };
}

function rowValues(row: ExcelJS.Row): string[] {
  const out: string[] = [];
  const count = Math.max(row.cellCount, 0);
  for (let c = 1; c <= count; c += 1) {
    out.push(cellText(row.getCell(c).value));
  }
  return out;
}

/** ExcelJS cell values are a union — formulas, rich text, hyperlinks, dates. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if ("text" in object) return String(object.text ?? "").trim();
    if ("result" in object) return String(object.result ?? "").trim();
    if ("richText" in object && Array.isArray(object.richText)) {
      return object.richText.map((part: { text?: string }) => part.text ?? "").join("").trim();
    }
    if ("hyperlink" in object) return String(object.hyperlink ?? "").trim();
    return "";
  }
  return String(value).trim();
}

/** Minimal RFC-4180 CSV: quoted fields, escaped quotes, embedded newlines. */
export function parseCsv(text: string): ParsedSheet {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ",") { row.push(field.trim()); field = ""; continue; }
    if (char === "\n") { row.push(field.trim()); rows.push(row); row = []; field = ""; continue; }
    field += char;
  }
  if (field !== "" || row.length > 0) { row.push(field.trim()); rows.push(row); }

  const headerIndex = rows.findIndex((r) => r.filter(Boolean).length >= 2);
  if (headerIndex === -1) throw new Error("Couldn't find a header row in that file.");

  const headers = rows[headerIndex];
  const out: SheetRow[] = [];
  for (const values of rows.slice(headerIndex + 1)) {
    if (values.every((v) => v === "")) continue;
    const record: SheetRow = {};
    headers.forEach((header, index) => {
      if (header) record[header] = values[index] ?? "";
    });
    out.push(record);
  }

  return { headers: headers.filter(Boolean), rows: out };
}
