import { db } from "./db";
import { GRACE_DAYS, HORIZON_DAYS, MILESTONES, addDays, startOfDay } from "./renewal-rules";

/**
 * Creates the Renewal and its four RenewalSteps for every lease that needs them.
 *
 * Idempotent: existing renewals and steps are left alone, so a completed
 * milestone is never reset. A lease whose end date changes (because it was
 * renewed) gets a brand-new Renewal, since the unique key includes leaseEnd —
 * the old one stays as history.
 *
 * Runs after every AppFolio sync, from the seed, and on demand from the
 * Renewals page. Kept free of the `server-only` guard so the seed and scripts
 * can call it outside a Next request.
 */
export async function generateRenewals(now: Date = new Date()): Promise<{
  renewalsCreated: number;
  stepsCreated: number;
}> {
  const tenants = await db.tenant.findMany({
    where: {
      status: { in: ["current", "future"] },
      leaseEnd: { not: null, gte: addDays(now, -GRACE_DAYS), lte: addDays(now, HORIZON_DAYS) },
    },
    select: { id: true, leaseEnd: true },
  });

  let renewalsCreated = 0;
  let stepsCreated = 0;

  for (const tenant of tenants) {
    const leaseEnd = startOfDay(tenant.leaseEnd!);

    const existing = await db.renewal.findUnique({
      where: { tenantId_leaseEnd: { tenantId: tenant.id, leaseEnd } },
      select: { id: true },
    });

    const renewal =
      existing ??
      (await db.renewal.create({ data: { tenantId: tenant.id, leaseEnd }, select: { id: true } }));
    if (!existing) renewalsCreated += 1;

    for (const milestone of MILESTONES) {
      const before = await db.renewalStep.findUnique({
        where: { renewalId_milestone: { renewalId: renewal.id, milestone } },
        select: { id: true },
      });
      if (before) continue; // never rewrite an existing step — it may already be done

      await db.renewalStep.create({
        data: { renewalId: renewal.id, milestone, dueOn: addDays(leaseEnd, -milestone) },
      });
      stepsCreated += 1;
    }
  }

  return { renewalsCreated, stepsCreated };
}
