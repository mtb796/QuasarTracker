"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export type SetupState = { error?: string };

/**
 * Creates the tables and the first account, then signs that person in.
 *
 * Refuses once any account exists, which is what keeps this from being a way to
 * add yourself later. The check runs inside the action too, not just on the page
 * that renders the form, so a stale tab can't be replayed.
 */
export async function runSetup(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const tablesReady = formData.get("tablesReady") === "true";
  const schemaSql = String(formData.get("schemaSql") ?? "");

  if (!name || !email) return { error: "Enter your name and email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  // 1. Create the tables if they aren't there yet.
  if (!tablesReady) {
    if (!schemaSql.trim()) return { error: "The schema script is missing from this deployment." };
    try {
      // The generated DDL is many statements; Prisma needs them run individually.
      for (const statement of splitSql(schemaSql)) {
        await db.$executeRawUnsafe(statement);
      }
    } catch (error) {
      return {
        error: `Couldn't create the tables: ${short(error)}. Check /api/health, or run "npx prisma db push" against this database.`,
      };
    }
  }

  // 2. First account only.
  try {
    const existing = await db.user.count();
    if (existing > 0) {
      return { error: "An account already exists — setup is closed. Go to /login." };
    }
  } catch (error) {
    return { error: `The tables aren't queryable: ${short(error)}` };
  }

  // 3. Create the account.
  let userId: string;
  try {
    const user = await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    userId = user.id;
  } catch (error) {
    return { error: `Couldn't create the account: ${short(error)}` };
  }

  try {
    await createSession(userId);
  } catch {
    return {
      error:
        "Account created, but SESSION_SECRET isn't set so you can't be signed in. Add it in Vercel, redeploy, then sign in.",
    };
  }

  redirect("/import");
}

/**
 * Splits the generated DDL into statements.
 *
 * Line-comment stripping matters: Prisma's script is full of `-- CreateTable`
 * headers, and a trailing comment would swallow the next statement.
 */
function splitSql(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function short(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const line = raw.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "unknown error";
  return line.replace(/postgres(ql)?:\/\/[^\s`'"]+/gi, "<connection string>").slice(0, 160);
}
