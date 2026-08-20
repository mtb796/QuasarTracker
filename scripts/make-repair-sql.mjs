/**
 * Turns the generated schema script into an idempotent "repair" script.
 *
 * /setup creates tables from init.sql the first time. After that nothing
 * applies schema changes — deploys deliberately don't run migrations — so a
 * database set up before a model was added keeps missing it, and the page that
 * uses it 500s. That is exactly how the Reminder table went missing.
 *
 * This produces a script that is safe to run against any database at any time:
 *
 *   - CREATE TABLE / INDEX become IF NOT EXISTS
 *   - foreign keys are wrapped so an existing one is skipped, not an error
 *   - every column is additionally emitted as ADD COLUMN IF NOT EXISTS, which
 *     is what catches a column added to a table that already exists
 *
 * Limitation worth knowing: a new NOT NULL column with no default cannot be
 * added to a table that already has rows, so NOT NULL is dropped unless the
 * column carries a default. Renames and type changes aren't handled either —
 * those need a real migration.
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("prisma/init.sql", "utf8");
const out = [];

out.push("-- Generated from init.sql. Idempotent: safe to run repeatedly.");

// 1. Tables and indexes, made conditional.
for (const raw of src.split(";")) {
  const stmt = raw.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim();
  if (!stmt) continue;

  if (/^CREATE TABLE\s+"/i.test(stmt)) {
    out.push(stmt.replace(/^CREATE TABLE\s+/i, "CREATE TABLE IF NOT EXISTS ") + ";");
  } else if (/^CREATE (UNIQUE )?INDEX\s+"/i.test(stmt)) {
    out.push(stmt.replace(/^CREATE (UNIQUE )?INDEX\s+/i, (m, u) => `CREATE ${u ?? ""}INDEX IF NOT EXISTS `) + ";");
  } else if (/^ALTER TABLE .* ADD CONSTRAINT/i.test(stmt)) {
    // Postgres has no ADD CONSTRAINT IF NOT EXISTS; swallow the duplicate.
    out.push(
      `DO $$ BEGIN\n  ${stmt.replace(/\s+/g, " ")};\nEXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );
  } else if (/^CREATE SCHEMA/i.test(stmt)) {
    out.push(stmt + ";");
  }
}

// 2. Columns, so a table that already exists still gains new ones.
const tableRe = /CREATE TABLE\s+"([^"]+)"\s*\(([\s\S]*?)\n\);/g;
let match;
while ((match = tableRe.exec(src)) !== null) {
  const [, table, body] = match;
  for (const line of body.split("\n")) {
    const trimmed = line.trim().replace(/,$/, "");
    if (!trimmed.startsWith('"')) continue; // CONSTRAINT lines
    const col = trimmed.match(/^"([^"]+)"\s+(.*)$/);
    if (!col) continue;

    const [, name, rawDef] = col;
    let def = rawDef.trim();
    // Only keep NOT NULL when a default exists, otherwise adding it to a table
    // with rows would fail.
    if (/NOT NULL/i.test(def) && !/DEFAULT/i.test(def)) {
      def = def.replace(/\s*NOT NULL\s*/i, " ").trim();
    }
    out.push(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${name}" ${def};`);
  }
}

writeFileSync("prisma/repair.sql", out.join("\n\n") + "\n");
console.log(`repair.sql: ${out.length} statements`);
