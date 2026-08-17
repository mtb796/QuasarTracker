/**
 * Renewal milestone rules — pure functions, no database, no server-only guard.
 *
 * This is the logic that decides when a rent-increase notice must go out, so it
 * is kept free of I/O to stay directly testable: see scripts/test-renewals.ts.
 */

/**
 * Notices go out at 150, 120 and 100 days before a lease ends, and 90 is the
 * hard line — the last point at which a rent increase can go out and still
 * clear the notice period. The 90-day step is treated differently everywhere:
 * it goes critical the moment it's reached rather than easing in.
 *
 * Ordered furthest-out first, which is the order they come due.
 */
export const MILESTONES = [150, 120, 100, 90] as const;
export type Milestone = (typeof MILESTONES)[number];

/** The hard deadline. Named so its special handling is greppable. */
export const HARD_DEADLINE: Milestone = 90;

/** Leases further out than this aren't worth showing yet. */
export const HORIZON_DAYS = 210;
/** Recently-expired leases stay visible — an expired lease is a problem, not history. */
export const GRACE_DAYS = 45;

// ---------------------------------------------------------------------------
// Date maths
// ---------------------------------------------------------------------------

export function startOfDay(value: Date): Date {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(value: Date, days: number): Date {
  const copy = startOfDay(value);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Whole days from `from` to `target`, counting calendar days rather than
 * elapsed hours — a lease ending tomorrow is 1 day out whether it's now 9am or
 * 11pm. Both ends are floored to local midnight, and the result is rounded so a
 * daylight-saving boundary (a 23- or 25-hour day) can't produce an off-by-one.
 */
export function daysUntil(target: Date, from: Date = new Date()): number {
  return Math.round((startOfDay(target).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type StepState =
  /** Notice sent. */
  | "done"
  /** Deliberately passed over. */
  | "skipped"
  /** Not reached yet. */
  | "upcoming"
  /** Reached, still inside its own window. */
  | "due"
  /** Window has passed and it was never sent. */
  | "late"
  /** The 90-day line, still pending. */
  | "critical"
  /** Lease has already ended with this step unsent. */
  | "expired";

/** The milestone after this one, or null for the hard deadline. */
function nextMilestone(milestone: number): number | null {
  const index = MILESTONES.indexOf(milestone as Milestone);
  return index >= 0 && index < MILESTONES.length - 1 ? MILESTONES[index + 1] : null;
}

export function stepState(step: { milestone: number; status: string }, daysOut: number): StepState {
  if (step.status === "done") return "done";
  if (step.status === "skipped") return "skipped";

  if (daysOut < 0) return "expired";
  if (daysOut > step.milestone) return "upcoming";

  // The hard deadline doesn't get a grace window.
  if (step.milestone === HARD_DEADLINE) return "critical";

  const next = nextMilestone(step.milestone);
  return next !== null && daysOut <= next ? "late" : "due";
}

/** States that mean somebody has to do something. */
const ACTIONABLE: ReadonlySet<StepState> = new Set<StepState>([
  "due",
  "late",
  "critical",
  "expired",
]);

export function isActionable(state: StepState): boolean {
  return ACTIONABLE.has(state);
}

/** Sort weight — most urgent first. */
export const SEVERITY: Record<StepState, number> = {
  expired: 0,
  critical: 1,
  late: 2,
  due: 3,
  upcoming: 4,
  done: 5,
  skipped: 6,
};

/** Which milestone window a lease currently sits in, or null if further out. */
export function currentWindow(daysOut: number): Milestone | null {
  if (daysOut > MILESTONES[0]) return null;
  // Milestones run high to low; the window is the smallest one still >= daysOut.
  let window: Milestone = MILESTONES[0];
  for (const milestone of MILESTONES) {
    if (daysOut <= milestone) window = milestone;
  }
  return window;
}
