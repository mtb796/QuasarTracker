import Link from "next/link";
import { skipRenewalStep, toggleRenewalStep } from "@/app/actions";
import type { RenewalRow, RenewalStepView } from "@/lib/renewals";
import { HARD_DEADLINE, type StepState } from "@/lib/renewal-rules";
import { formatDate, formatMoney } from "./ui";

const STATE_CHIP: Record<StepState, string> = {
  expired: "bg-accent-strong text-white",
  critical: "bg-accent text-white",
  late: "bg-crimson-tint text-accent-strong ring-1 ring-accent/30",
  due: "bg-ember-tint text-amber-900 ring-1 ring-amber-300",
  upcoming: "bg-gray-100 text-gray-500",
  done: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  skipped: "bg-gray-100 text-gray-400 line-through",
};

const STATE_LABEL: Record<StepState, string> = {
  expired: "Missed",
  critical: "SEND NOW",
  late: "Overdue",
  due: "Due",
  upcoming: "Upcoming",
  done: "Sent",
  skipped: "Skipped",
};

export function StepChip({ step, returnTo }: { step: RenewalStepView; returnTo: string }) {
  const isHard = step.milestone === HARD_DEADLINE;
  const actionable = step.state !== "done" && step.state !== "skipped";

  return (
    <form action={toggleRenewalStep} className="inline">
      <input type="hidden" name="id" value={step.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        className={`pill gap-1 ${STATE_CHIP[step.state]} ${
          isHard && actionable && step.state !== "upcoming" ? "animate-pulse" : ""
        } cursor-pointer`}
        data-milestone={step.milestone}
        data-state={step.state}
        title={
          step.state === "done"
            ? `Sent ${step.completedAt ? formatDate(step.completedAt) : ""}${
                step.completedBy ? ` by ${step.completedBy}` : ""
              } — click to undo`
            : `${step.milestone}-day notice, due ${formatDate(step.dueOn)} — click to mark sent`
        }
        type="submit"
      >
        <span className="font-semibold tabular-nums">{step.milestone}</span>
        <span>{step.state === "done" ? "✓" : STATE_LABEL[step.state]}</span>
      </button>
    </form>
  );
}

/**
 * The action queue: one line per lease, showing the single notice that actually
 * needs sending now.
 *
 * A lease 42 days out has its 150, 120 and 100 windows all sitting open and
 * unsent, but sending a "150-day notice" today is meaningless — those windows
 * have closed. Listing all four would put the real 90-day emergency behind
 * three rows of noise for the same unit. So each lease contributes one row,
 * built around the nearest open milestone, with the missed earlier ones noted
 * as context rather than as actions.
 */
export function ActionQueue({
  rows,
  returnTo,
}: {
  rows: { row: RenewalRow; step: RenewalStepView; missed: number }[];
  returnTo: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-5 text-sm text-muted">
        Nothing due. Every notice inside the 150-day window has been sent.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map(({ row, step, missed }) => (
        <li
          key={step.id}
          className={`card flex flex-wrap items-center gap-3 p-3 ${
            step.state === "critical" || step.state === "expired"
              ? "border-accent/40 bg-crimson-tint/40"
              : ""
          }`}
        >
          <StepChip step={step} returnTo={returnTo} />

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">
              {row.unitId ? (
                <Link className="text-accent hover:underline" href={`/units/${row.unitId}`}>
                  {row.propertyName} · Unit {row.unitName}
                </Link>
              ) : (
                <span>{row.propertyName ?? "Unassigned unit"}</span>
              )}
              <span className="text-muted"> — {row.tenantName}</span>
            </div>
            <div className="text-xs text-muted">
              Lease ends {formatDate(row.leaseEnd)} ·{" "}
              <span className={row.daysOut <= HARD_DEADLINE ? "font-semibold text-accent" : ""}>
                {row.daysOut < 0 ? `${Math.abs(row.daysOut)} days ago` : `${row.daysOut} days out`}
              </span>{" "}
              · Rent {formatMoney(row.currentRent)}
              {row.proposedRent ? ` → ${formatMoney(row.proposedRent)}` : ""}
              {missed > 0 && (
                <span className="text-accent-strong">
                  {" "}
                  · {missed} earlier notice{missed === 1 ? "" : "s"} missed
                </span>
              )}
            </div>
          </div>

          <form action={skipRenewalStep}>
            <input type="hidden" name="id" value={step.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="text-xs text-muted hover:text-ink" type="submit">
              Skip
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
