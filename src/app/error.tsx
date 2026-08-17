"use client";

/**
 * Replaces Next's blank "a server error occurred" page.
 *
 * Nearly every unexpected failure here is a setup problem — missing
 * DATABASE_URL, tables not created, no accounts — so the useful thing to show
 * is where to look, not an apology.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="quasar-gradient mb-6 h-1 rounded-full" />
        <h1 className="text-lg font-semibold">Something failed on the server</h1>
        <p className="mt-2 text-sm text-muted">
          If this is a fresh deployment, it is almost certainly setup rather than a bug — the
          database connection, the tables, or the accounts.
        </p>

        <div className="card mt-4 p-4">
          <a className="text-sm font-medium text-accent hover:underline" href="/api/health">
            Open /api/health →
          </a>
          <p className="mt-1 text-sm text-muted">
            Reports exactly which step is failing and what to run next.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn" onClick={reset} type="button">
            Try again
          </button>
          <a className="btn" href="/login">
            Back to sign in
          </a>
        </div>

        {error.digest && (
          <p className="mt-4 font-mono text-xs text-muted">Reference: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
