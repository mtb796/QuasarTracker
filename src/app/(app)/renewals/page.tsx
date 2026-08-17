import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  getRenewalBoard,
  missedBefore,
  pendingActionStep,
  summarize,
  type RenewalRow,
} from "@/lib/renewals";
import { HARD_DEADLINE, MILESTONES } from "@/lib/renewal-rules";
import { ActionQueue, StepChip } from "@/components/RenewalPipeline";
import { RenewalPlanForm } from "@/components/RenewalPlanForm";
import { RebuildButton } from "@/components/RebuildButton";
import { Empty, PageHeader, formatDate, formatMoney } from "@/components/ui";

export const dynamic = "force-dynamic";

const DECISION_LABEL: Record<string, string> = {
  increase: "Rent increase",
  flat: "Renew at same rent",
  non_renew: "Do not renew",
};

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  await requireUser();
  const { window: windowFilter = "" } = await searchParams;

  const rows = await getRenewalBoard();
  const summary = summarize(rows);
  const returnTo = `/renewals${windowFilter ? `?window=${windowFilter}` : ""}`;

  // One entry per lease, built around the current window's notice — the one
  // that actually has to go out. Earlier windows that closed unsent are shown
  // as a count, not as separate rows.
  const queue = rows
    .map((row) => {
      const step = pendingActionStep(row);
      return step ? { row, step, missed: missedBefore(row) } : null;
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => a.row.daysOut - b.row.daysOut);

  const visible = windowFilter
    ? rows.filter((row) => String(row.window) === windowFilter)
    : rows;

  return (
    <div>
      <PageHeader
        title="Renewals"
        subtitle="Notices at 150, 120 and 100 days — and a hard stop at 90."
        action={<RebuildButton />}
      />

      {/* The headline number: what has to go out. */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="Need action"
          value={summary.actionNeeded}
          tone={summary.actionNeeded > 0 ? "alert" : "calm"}
          href="/renewals"
        />
        <Tile
          label={`At ${HARD_DEADLINE} days`}
          value={summary.critical}
          tone={summary.critical > 0 ? "critical" : "calm"}
          href="/renewals?window=90"
        />
        <Tile
          label="Lease ended"
          value={summary.expired}
          tone={summary.expired > 0 ? "critical" : "calm"}
          href="/renewals"
        />
        {MILESTONES.filter((m) => m !== HARD_DEADLINE).map((milestone) => (
          <Tile
            key={milestone}
            label={`${milestone}-day window`}
            value={summary.byWindow[milestone]}
            tone="calm"
            href={`/renewals?window=${milestone}`}
          />
        ))}
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold">
          Send now{queue.length > 0 ? ` (${queue.length})` : ""}
        </h2>
        <p className="mb-3 text-sm text-muted">
          Click a milestone chip to mark that notice sent. Anything at{" "}
          <strong>{HARD_DEADLINE} days</strong> is past the point where a rent increase can wait.
        </p>
        <ActionQueue rows={queue} returnTo={returnTo} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">All upcoming renewals</h2>
          <div className="flex gap-1">
            <FilterLink active={windowFilter === ""} href="/renewals" label="All" />
            {MILESTONES.map((milestone) => (
              <FilterLink
                key={milestone}
                active={windowFilter === String(milestone)}
                href={`/renewals?window=${milestone}`}
                label={`${milestone}d`}
              />
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <Empty>
            No leases in this window. Renewals are built from tenant lease-end dates — sync from{" "}
            <Link className="text-accent hover:underline" href="/settings">
              Settings
            </Link>{" "}
            or press Rebuild above.
          </Empty>
        ) : (
          <ul className="space-y-3">
            {visible.map((row) => (
              <RenewalCard key={row.id} row={row} returnTo={returnTo} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RenewalCard({ row, returnTo }: { row: RenewalRow; returnTo: string }) {
  const hard = row.daysOut <= HARD_DEADLINE;

  return (
    <li className={`card p-4 ${hard ? "border-accent/40" : ""}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-medium">
            {row.unitId ? (
              <Link className="text-accent hover:underline" href={`/units/${row.unitId}`}>
                {row.propertyName} · Unit {row.unitName}
              </Link>
            ) : (
              (row.propertyName ?? "Unassigned")
            )}
            <span className="text-muted"> — {row.tenantName}</span>
          </div>
          <div className="text-xs text-muted">
            Lease ends {formatDate(row.leaseEnd)} ·{" "}
            <span className={hard ? "font-semibold text-accent" : ""}>
              {row.daysOut < 0
                ? `ended ${Math.abs(row.daysOut)} days ago`
                : `${row.daysOut} days out`}
            </span>
            {row.decision && ` · ${DECISION_LABEL[row.decision] ?? row.decision}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {row.steps.map((step) => (
            <StepChip key={step.id} step={step} returnTo={returnTo} />
          ))}
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <RenewalPlanForm row={row} returnTo={returnTo} />
      </div>
    </li>
  );
}

function Tile({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone: "calm" | "alert" | "critical";
  href: string;
}) {
  const styles = {
    calm: "border-line",
    alert: "border-amber-300 bg-ember-tint",
    critical: "border-accent/50 bg-crimson-tint",
  }[tone];

  return (
    <Link className={`card block p-3 hover:border-gray-400 ${styles}`} href={href}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Link>
  );
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      className={`rounded-md px-2.5 py-1.5 text-sm ${
        active ? "bg-ink text-white" : "text-muted hover:bg-gray-100"
      }`}
      href={href}
    >
      {label}
    </Link>
  );
}
