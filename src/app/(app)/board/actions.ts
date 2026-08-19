"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Moves a tenancy between the subsidised and market lanes.
 *
 * `null` puts it back in "not set", which is a real state — an imported sheet
 * often leaves the subsidy column blank, and pretending blank means "market"
 * would quietly mis-cap a rent increase.
 */
export async function setSubsidized(tenantId: string, value: boolean | null): Promise<void> {
  await requireUser();
  await db.tenant.update({ where: { id: tenantId }, data: { subsidized: value } });
  revalidatePath("/board");
  revalidatePath("/renewals");
}
