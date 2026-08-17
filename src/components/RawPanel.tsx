/**
 * Shows every column AppFolio returned for a record.
 *
 * Two reasons this exists: the mapper only promotes a handful of columns to
 * real fields, and AppFolio's column names differ between accounts. Rather than
 * lose the rest, we keep the original row and show it here — so a field we
 * haven't mapped is still one click away.
 */
export function RawPanel({ title, data }: { title: string; data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (entries.length === 0) return null;

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        {title} <span className="font-normal text-muted">({entries.length})</span>
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0">
            <dt className="truncate text-xs font-medium text-muted">{key}</dt>
            <dd className="break-words text-sm">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
