import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

/**
 * Brings an existing database up to the current schema.
 *
 * Deploys deliberately don't run migrations, so a database created before a
 * model was added simply never gets it — the page that uses that model 500s
 * with no obvious cause. This applies the generated idempotent script instead,
 * so it can be run from Settings without a terminal.
 *
 * Only additive: creates missing tables, columns, indexes and foreign keys.
 * Never drops or renames anything, so running it can't lose data.
 */

/** Tables the app expects. Kept here so the check needs no database metadata. */
const EXPECTED_TABLES = [
  "User", "Note", "Handoff", "Property", "Unit", "Tenant", "Owner",
  "Renewal", "RenewalStep", "Reminder", "EmailLog", "SyncRun",
];

export async function missingTables(): Promise<string[]> {
  const rows = await db.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()
  `;
  const present = new Set(rows.map((r) => r.table_name));
  return EXPECTED_TABLES.filter((name) => !present.has(name));
}

export type RepairResult = { applied: number; skipped: number; failed: string[] };

export async function repairSchema(): Promise<RepairResult> {
  const script = await readFile(path.join(process.cwd(), "prisma", "repair.sql"), "utf8");
  const result: RepairResult = { applied: 0, skipped: 0, failed: [] };

  for (const statement of splitStatements(script)) {
    try {
      await db.$executeRawUnsafe(statement);
      result.applied += 1;
    } catch (error) {
      // "Already exists" is the expected outcome for most statements here.
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists|duplicate/i.test(message)) result.skipped += 1;
      else result.failed.push(`${statement.slice(0, 60)}… — ${message.split("\n")[0].slice(0, 120)}`);
    }
  }

  return result;
}

/**
 * Splits on semicolons, except inside a DO $$ … $$ block — foreign keys are
 * wrapped in those, and splitting one apart would produce invalid SQL.
 */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buffer = "";
  let inDollar = false;

  for (const line of sql.split("\n")) {
    if (line.trim().startsWith("--")) continue;
    if (line.includes("$$")) inDollar = !inDollar || !line.trim().endsWith("$$;");
    buffer += line + "\n";

    if (!inDollar && line.trimEnd().endsWith(";")) {
      const statement = buffer.trim().replace(/;$/, "").trim();
      if (statement) out.push(statement);
      buffer = "";
    }
  }
  const tail = buffer.trim().replace(/;$/, "").trim();
  if (tail) out.push(tail);
  return out;
}
