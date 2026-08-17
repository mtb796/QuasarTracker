import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/appfolio";
import { fromAddress, transport } from "@/lib/email";
import { toggleDigest } from "@/app/actions";
import { SyncButton } from "@/components/SyncButton";
import { TestDigestButton } from "@/components/TestDigestButton";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  const config = getConfig();
  const emailTransport = transport();
  const from = fromAddress();
  const cronReady = Boolean(process.env.CRON_SECRET?.trim());

  const [runs, users, emails, me] = await Promise.all([
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    db.user.findMany({
      select: { id: true, name: true, email: true, digestEnabled: true },
      orderBy: { name: "asc" },
    }),
    db.emailLog.findMany({ orderBy: { sentAt: "desc" }, take: 8 }),
    db.user.findUnique({ where: { id: user.id }, select: { digestEnabled: true } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />

      <section className="card mb-6 p-4">
        <h2 className="mb-1 text-sm font-semibold">AppFolio connection</h2>
        <p className="mb-3 text-sm text-muted">
          Credentials are read from environment variables on the server and are never sent to the
          browser. Edit <code className="rounded bg-gray-100 px-1">.env</code> to change them.
        </p>

        {config ? (
          <dl className="mb-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Database</dt>
              <dd className="text-sm">{config.database}.appfolio.com</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">API version</dt>
              <dd className="text-sm">{config.version}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Client ID</dt>
              <dd className="text-sm">
                {config.clientId.slice(0, 4)}…{config.clientId.slice(-4)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Not configured. Set <code>APPFOLIO_DATABASE</code>, <code>APPFOLIO_CLIENT_ID</code> and{" "}
            <code>APPFOLIO_CLIENT_SECRET</code> in <code>.env</code>, then restart the server.
          </p>
        )}

        <SyncButton disabled={!config} />
        <p className="mt-2 text-xs text-muted">
          Sync pulls owners, properties, units and tenants. It never writes to AppFolio, and it never
          touches your notes, tasks or “our status” values.
        </p>
      </section>

      <section className="card mb-6 p-4">
        <h2 className="mb-1 text-sm font-semibold">Sync history</h2>
        <p className="mb-3 text-sm text-muted">
          If a report comes back empty or errors, the columns AppFolio actually returned are listed
          here — use them to correct the field mapping in{" "}
          <code className="rounded bg-gray-100 px-1">src/lib/sync.ts</code>.
        </p>

        {runs.length === 0 ? (
          <p className="text-sm text-muted">No syncs yet.</p>
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => {
              const columns: string[] = run.columns ? safeParse(run.columns) : [];
              return (
                <li key={run.id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={`pill ${
                        run.status === "ok"
                          ? "bg-emerald-50 text-emerald-700"
                          : run.status === "error"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {run.status}
                    </span>
                    <span className="font-medium">{run.report}</span>
                    <span className="text-muted">
                      {run.rowsFetched} fetched · {run.rowsWritten} saved
                    </span>
                    <span className="ml-auto text-xs text-muted">
                      {run.startedAt.toLocaleString("en-US")}
                    </span>
                  </div>

                  {run.error && (
                    <p className="mt-2 break-words rounded bg-red-50 px-2 py-1.5 text-xs text-red-800">
                      {run.error}
                    </p>
                  )}

                  {columns.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted">
                        Columns returned ({columns.length})
                      </summary>
                      <p className="mt-1 break-words font-mono text-xs text-muted">
                        {columns.join(", ")}
                      </p>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card mb-6 p-4">
        <h2 className="mb-1 text-sm font-semibold">Email digest</h2>
        <p className="mb-3 text-sm text-muted">
          A daily summary of renewal notices that need sending, worst first, plus your own due
          tasks. Nothing due means no email — a daily &ldquo;all clear&rdquo; just trains you to
          ignore it.
        </p>

        <dl className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Delivery</dt>
            <dd className="text-sm">
              {emailTransport === "resend" ? (
                <span className="pill bg-emerald-50 text-emerald-700">Resend</span>
              ) : (
                <span className="pill bg-ember-tint text-amber-900">Console only</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">From</dt>
            <dd className="truncate text-sm">{from}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Schedule</dt>
            <dd className="text-sm">{cronReady ? "Weekdays 9am ET" : "Not scheduled"}</dd>
          </div>
        </dl>

        {emailTransport === "console" && (
          <p className="mb-4 rounded-md bg-ember-tint px-3 py-2 text-sm text-amber-900">
            No email provider configured, so digests are printed to the server log instead of
            being delivered. Set <code>RESEND_API_KEY</code> in <code>.env</code> to send for real
            — see the README.
          </p>
        )}
        {!cronReady && (
          <p className="mb-4 rounded-md bg-ember-tint px-3 py-2 text-sm text-amber-900">
            <code>CRON_SECRET</code> is not set, so the scheduled send is disabled and{" "}
            <code>/api/cron/digest</code> will refuse to run. You can still send manually below.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <TestDigestButton />
          <a className="btn" href="/api/digest/preview" target="_blank" rel="noreferrer">
            Preview mine
          </a>
          <form action={toggleDigest}>
            <input type="hidden" name="enabled" value={me?.digestEnabled ? "false" : "true"} />
            <button className="btn" type="submit">
              {me?.digestEnabled ? "Turn my digest off" : "Turn my digest on"}
            </button>
          </form>
          <span className="text-sm text-muted">
            Yours is {me?.digestEnabled ? "on" : "off"}.
          </span>
        </div>

        {emails.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Recent sends
            </h3>
            <ul className="space-y-1 text-sm">
              {emails.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`pill ${
                      entry.status === "sent"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-crimson-tint text-accent-strong"
                    }`}
                  >
                    {entry.status}
                  </span>
                  <span className="text-muted">{entry.to}</span>
                  <span className="min-w-0 flex-1 truncate">{entry.subject}</span>
                  <span className="text-xs text-muted">
                    {entry.sentAt.toLocaleString("en-US")}
                  </span>
                  {entry.error && (
                    <span className="w-full break-words text-xs text-accent-strong">
                      {entry.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-1 text-sm font-semibold">People</h2>
        <p className="mb-3 text-sm text-muted">
          Accounts are created from the command line — see the README. Keeping it to the two of you
          means no invite flow to build or secure.
        </p>
        <ul className="space-y-1 text-sm">
          {users.map((user) => (
            <li key={user.id}>
              {user.name} <span className="text-muted">· {user.email}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function safeParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
