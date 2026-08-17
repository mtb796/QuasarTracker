import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, resolveDatabaseUrl } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

/**
 * First-run setup, in the browser.
 *
 * Creating the tables and the first account used to require a terminal, Node,
 * a clone of the repo and the production connection string. That's a lot of
 * friction between "deployed" and "usable", so both steps happen here instead.
 *
 * This page only works while the database has **no accounts**. The moment the
 * first one exists it refuses and sends you to sign in, so it can't be used to
 * add accounts later.
 */
export default async function SetupPage() {
  const { source } = resolveDatabaseUrl();

  if (!source) {
    return (
      <Shell>
        <Problem
          title="No database is connected yet"
          body={
            <>
              None of <code>DATABASE_URL</code>, <code>POSTGRES_PRISMA_URL</code> or{" "}
              <code>POSTGRES_URL</code> is set on this deployment. Create a Postgres database and
              add its connection string in Vercel → Settings → Environment Variables, then
              redeploy.
            </>
          }
        />
      </Shell>
    );
  }

  // Can we reach it at all?
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return (
      <Shell>
        <Problem
          title="The database won't accept a connection"
          body={
            <>
              Found the connection string in <code>{source}</code>, but couldn&apos;t connect. For a
              hosted provider the string usually needs to end with{" "}
              <code>?sslmode=require</code>. Check it in Vercel and redeploy.
            </>
          }
        />
      </Shell>
    );
  }

  // Are the tables there? If not, we can create them from the checked-in SQL.
  let tablesReady = false;
  try {
    const rows = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'User'
    `;
    tablesReady = rows.length > 0;
  } catch {
    tablesReady = false;
  }

  if (tablesReady) {
    const users = await db.user.count();
    if (users > 0) {
      return (
        <Shell>
          <Problem
            title="Setup is already done"
            body={
              <>
                This deployment has {users} account{users === 1 ? "" : "s"}. Setup only runs while
                there are none, so nobody can add themselves later.{" "}
                <a className="text-accent underline" href="/login">
                  Sign in
                </a>
                .
              </>
            }
          />
        </Shell>
      );
    }
  }

  const schemaSql = await readFile(path.join(process.cwd(), "prisma", "init.sql"), "utf8");

  return (
    <Shell>
      <p className="mb-5 text-sm text-muted">
        Connected via <code>{source}</code>.{" "}
        {tablesReady ? "Tables are ready." : "The tables will be created now."} Create the first
        account to finish.
      </p>
      <SetupForm schemaSql={schemaSql} tablesReady={tablesReady} />
      <p className="mt-4 text-xs text-muted">
        Do this now — until an account exists, anyone who finds this page could create the first
        one.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="quasar-gradient h-1" />
      <div className="flex flex-1 items-start justify-center p-6">
        <div className="w-full max-w-md pt-10">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo size={56} id="setup" />
            <h1 className="wordmark mt-4 text-xl text-ink">Quasar</h1>
            <p className="mt-2 text-sm text-muted">First-run setup</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

function Problem({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <a className="mt-4 inline-block text-sm text-accent hover:underline" href="/api/health">
        Open diagnostics →
      </a>
    </div>
  );
}
