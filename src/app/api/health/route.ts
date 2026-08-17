import { NextResponse } from "next/server";
import { db, resolveDatabaseUrl } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Setup diagnostics — open /api/health in a browser.
 *
 * Exists because a misconfigured deployment otherwise shows nothing but a
 * generic 500. Prisma's own errors are no help here: a missing table and an
 * unreachable host both report "Can't reach database server", so this probes
 * each stage explicitly instead of parsing error text.
 *
 * Deliberately reports only booleans, counts, and plain-English next steps —
 * never a connection string, host, or secret value — so it is safe to leave
 * reachable without a login. That matters, since the most common reason to need
 * it is that signing in doesn't work.
 */

type Stage = { ok: boolean; detail: string };

export async function GET(): Promise<NextResponse> {
  // Use the same resolution the app does, so this can't report "not set" while
  // the app is happily connected via one of Vercel's POSTGRES_* names.
  const { source } = resolveDatabaseUrl();

  const required = {
    databaseUrl: source ? `set (from ${source})` : "missing",
    SESSION_SECRET:
      Boolean(process.env.SESSION_SECRET?.trim()) &&
      process.env.SESSION_SECRET !== "change-me-to-a-long-random-string",
  };
  const optional = {
    APP_URL: Boolean(process.env.APP_URL?.trim()),
    CRON_SECRET: Boolean(process.env.CRON_SECRET?.trim()),
    APPFOLIO_DATABASE: Boolean(process.env.APPFOLIO_DATABASE?.trim()),
    APPFOLIO_CLIENT_ID: Boolean(process.env.APPFOLIO_CLIENT_ID?.trim()),
    APPFOLIO_CLIENT_SECRET: Boolean(process.env.APPFOLIO_CLIENT_SECRET?.trim()),
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY?.trim()),
  };

  const stages: Record<string, Stage> = {};
  let nextStep = "Everything looks set up. Sign in at /login.";
  let ok = true;

  // 1. Is a connection string present under any of the accepted names?
  if (!source) {
    stages.connection = {
      ok: false,
      detail: "No connection string found in DATABASE_URL, POSTGRES_PRISMA_URL or POSTGRES_URL.",
    };
    return NextResponse.json(
      {
        ok: false,
        nextStep:
          "Add a Postgres database and put its connection string in Vercel → Settings → Environment Variables as DATABASE_URL, then redeploy.",
        env: { required, optional },
        stages,
      },
      { status: 503 },
    );
  }

  // 2. Can we actually reach the server?
  try {
    await db.$queryRaw`SELECT 1`;
    stages.connection = { ok: true, detail: "Connected to Postgres." };
  } catch (error) {
    ok = false;
    stages.connection = { ok: false, detail: summarize(error) };
    nextStep =
      "The database can't be reached. Check DATABASE_URL is the full Postgres string, that it ends with ?sslmode=require for hosted providers, and that you used the pooled connection string if your provider offers one.";
    return NextResponse.json(
      { ok, nextStep, env: { required, optional }, stages },
      { status: 503 },
    );
  }

  // 3. Have the tables been created? Ask the catalog rather than guessing from
  //    a query failure, which Prisma reports the same as a connection failure.
  try {
    const rows = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('User', 'Property', 'Unit', 'Tenant', 'Renewal', 'RenewalStep')
    `;
    const found = rows.length;
    if (found === 0) {
      ok = false;
      stages.tables = { ok: false, detail: "No application tables exist yet." };
      nextStep = "Open /setup in your browser — it creates the tables and your first account.";
      return NextResponse.json(
        { ok, nextStep, env: { required, optional }, stages },
        { status: 503 },
      );
    }
    stages.tables = { ok: found >= 6, detail: `${found} of 6 core tables present.` };
    if (found < 6) {
      ok = false;
      nextStep = "Some tables are missing. Run: npx prisma db push";
    }
  } catch (error) {
    ok = false;
    stages.tables = { ok: false, detail: summarize(error) };
    nextStep = "Could not inspect the schema. Run: npx prisma db push";
  }

  // 4. Does anyone have an account? There is no sign-up page, so zero users
  //    means sign-in cannot succeed no matter what is typed.
  try {
    const users = await db.user.count();
    stages.accounts = {
      ok: users > 0,
      detail: `${users} account${users === 1 ? "" : "s"}.`,
    };
    if (users === 0) {
      ok = false;
      nextStep =
        "No accounts exist yet. Open /setup in your browser to create the first one.";
    }
  } catch (error) {
    ok = false;
    stages.accounts = { ok: false, detail: summarize(error) };
  }

  if (ok && !required.SESSION_SECRET) {
    ok = false;
    nextStep =
      "SESSION_SECRET is missing or still the placeholder. Set it to a long random value, or sign-in will fail when the cookie is signed.";
  }

  return NextResponse.json(
    { ok, nextStep, env: { required, optional }, stages },
    { status: ok ? 200 : 503 },
  );
}

/**
 * Prisma errors can quote the connection string, which would put credentials in
 * a publicly reachable response. Keep the shape, drop anything sensitive.
 */
function summarize(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine = raw.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "Unknown error";
  return firstLine
    .replace(/postgres(ql)?:\/\/[^\s`'"]+/gi, "<connection string>")
    .replace(/`[^`]*:\d{2,5}`/g, "<host>")
    .slice(0, 200);
}
