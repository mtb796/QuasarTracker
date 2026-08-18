import Link from "next/link";
import type { RenewalRow } from "@/lib/renewals";
import { HARD_DEADLINE } from "@/lib/renewal-rules";
import { formatDate, unitLabel } from "./ui";

/**
 * The dashboard banner. Renewals are the reason this app exists, so anything
 * at or past the 90-day line is stated in plain language at the top of the
 * first screen either of us sees — not tucked behind a nav click.
 */
export function RenewalAlert({
  critical,
  actionNeeded,
}: {
  critical: RenewalRow[];
  actionNeeded: number;
}) {
  if (actionNeeded === 0) {
    return (
      <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        All renewal notices are up to date.{" "}
        <Link className="font-medium underline" href="/renewals">
          View pipeline
        </Link>
      </div>
    );
  }

  const urgent = critical.slice(0, 4);

  return (
    <div
      className={`mb-6 rounded-lg border px-4 py-3 ${
        critical.length > 0 ? "border-accent/50 bg-crimson-tint" : "border-amber-300 bg-ember-tint"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          {critical.length > 0 ? (
            <>
              {critical.length} lease{critical.length === 1 ? "" : "s"} at or past the{" "}
              {HARD_DEADLINE}-day line — rent increase notices must go out now
            </>
          ) : (
            <>
              {actionNeeded} renewal notice{actionNeeded === 1 ? "" : "s"} due
            </>
          )}
        </p>
        <Link className="text-sm font-medium text-accent hover:underline" href="/renewals">
          Open renewals →
        </Link>
      </div>

      {urgent.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {urgent.map((row) => (
            <li key={row.id}>
              <Link
                className="hover:underline"
                href={row.unitId ? `/units/${row.unitId}` : "/renewals"}
              >
                <span className="font-medium">
                  {row.propertyName}
                  {unitLabel(row.unitName) ? ` · Unit ${unitLabel(row.unitName)}` : ""}
                </span>{" "}
                <span className="text-muted">
                  — {row.tenantName}, ends {formatDate(row.leaseEnd)} (
                  {row.daysOut < 0 ? `${Math.abs(row.daysOut)} days ago` : `${row.daysOut} days`})
                </span>
              </Link>
            </li>
          ))}
          {critical.length > urgent.length && (
            <li className="text-muted">and {critical.length - urgent.length} more…</li>
          )}
        </ul>
      )}
    </div>
  );
}
