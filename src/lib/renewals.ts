import "server-only";

import { db } from "./db";
import {
  GRACE_DAYS,
  HORIZON_DAYS,
  type Milestone,
  type StepState,
  SEVERITY,
  addDays,
  currentWindow,
  daysUntil,
  isActionable,
  stepState,
} from "./renewal-rules";

// Re-exported so pages import renewal concepts from one place.
export { generateRenewals } from "./renewal-generate";

export {
  HARD_DEADLINE,
  MILESTONES,
  type Milestone,
  type StepState,
  currentWindow,
  daysUntil,
  isActionable,
  stepState,
} from "./renewal-rules";

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export type RenewalStepView = {
  id: string;
  milestone: number;
  dueOn: Date;
  state: StepState;
  completedAt: Date | null;
  completedBy: string | null;
};

export type RenewalRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  unitId: string | null;
  unitName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  leaseEnd: Date;
  daysOut: number;
  currentRent: number | null;
  marketRent: number | null;
  proposedRent: number | null;
  decision: string | null;
  notes: string | null;
  window: Milestone | null;
  steps: RenewalStepView[];
  /** Worst state across steps still needing action — drives sorting and emphasis. */
  urgency: StepState;
};

export async function getRenewalBoard(now: Date = new Date()): Promise<RenewalRow[]> {
  const renewals = await db.renewal.findMany({
    where: { leaseEnd: { gte: addDays(now, -GRACE_DAYS), lte: addDays(now, HORIZON_DAYS) } },
    include: {
      steps: { orderBy: { milestone: "desc" }, include: { completedBy: true } },
      tenant: { include: { unit: { include: { property: true } }, property: true } },
    },
  });

  const rows = renewals.map((renewal): RenewalRow => {
    const daysOut = daysUntil(renewal.leaseEnd, now);

    const steps = renewal.steps.map((step) => ({
      id: step.id,
      milestone: step.milestone,
      dueOn: step.dueOn,
      state: stepState(step, daysOut),
      completedAt: step.completedAt,
      completedBy: step.completedBy?.name ?? null,
    }));

    const urgency =
      steps
        .map((step) => step.state)
        .filter(isActionable)
        .sort((a, b) => SEVERITY[a] - SEVERITY[b])[0] ?? "upcoming";

    const property = renewal.tenant.unit?.property ?? renewal.tenant.property ?? null;

    return {
      id: renewal.id,
      tenantId: renewal.tenantId,
      tenantName: renewal.tenant.name,
      unitId: renewal.tenant.unit?.id ?? null,
      unitName: renewal.tenant.unit?.name ?? null,
      propertyId: property?.id ?? null,
      propertyName: property?.name ?? null,
      leaseEnd: renewal.leaseEnd,
      daysOut,
      currentRent: renewal.tenant.rent,
      marketRent: renewal.tenant.unit?.marketRent ?? null,
      proposedRent: renewal.proposedRent,
      decision: renewal.decision,
      notes: renewal.notes,
      window: currentWindow(daysOut),
      steps,
      urgency,
    };
  });

  // Soonest lease end first — that is the order they need working.
  return rows.sort((a, b) => a.daysOut - b.daysOut);
}

/**
 * The one notice that actually needs sending for this lease, or null if none.
 *
 * Only the *current* window counts. Once that notice has gone out, the lease is
 * handled — earlier windows that closed unsent are history and must not drag it
 * back into the queue, because re-sending a 150-day notice at 42 days out is
 * not a thing anyone can do.
 */
export function pendingActionStep(row: RenewalRow): RenewalStepView | null {
  if (row.window === null) return null; // nothing has opened yet
  const step = row.steps.find((candidate) => candidate.milestone === row.window);
  return step && isActionable(step.state) ? step : null;
}

/** Earlier windows that closed without a notice — context, not actions. */
export function missedBefore(row: RenewalRow): number {
  if (row.window === null) return 0;
  return row.steps.filter(
    (step) => step.milestone > row.window! && isActionable(step.state),
  ).length;
}

export type RenewalSummary = {
  actionNeeded: number;
  critical: number;
  expired: number;
  /** How many leases currently sit in each milestone window. */
  byWindow: Record<Milestone, number>;
};

export function summarize(rows: RenewalRow[]): RenewalSummary {
  const byWindow = { 150: 0, 120: 0, 100: 0, 90: 0 } as Record<Milestone, number>;
  let actionNeeded = 0;
  let critical = 0;
  let expired = 0;

  for (const row of rows) {
    if (row.window !== null) byWindow[row.window] += 1;

    // Counted off the same rule the queue uses, so the tiles and the list can
    // never disagree about how much work is outstanding.
    const step = pendingActionStep(row);
    if (!step) continue;
    actionNeeded += 1;
    if (step.state === "critical") critical += 1;
    if (step.state === "expired") expired += 1;
  }

  return { actionNeeded, critical, expired, byWindow };
}
