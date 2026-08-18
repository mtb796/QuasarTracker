"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { syncAll } from "@/lib/sync";
import { generateRenewals } from "@/lib/renewals";
import { sendDigests } from "@/lib/send-digest";

/** Server actions return this so forms can show a message without throwing. */
export type ActionState = { error?: string; ok?: string };

// --- auth -----------------------------------------------------------------

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  // A misconfigured deployment fails right here, and an unhandled throw renders
  // a blank "a server error occurred" page that says nothing useful. Catch it
  // and point at the diagnostic instead.
  let user: Awaited<ReturnType<typeof db.user.findUnique>>;
  try {
    user = await db.user.findUnique({ where: { email } });
  } catch {
    return {
      error: "Can't reach the database. Open /api/health for the cause and the fix.",
    };
  }

  // Same message either way, so this can't be used to discover valid emails.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }

  try {
    await createSession(user.id);
  } catch {
    return {
      error: "SESSION_SECRET is missing, so the login cookie can't be signed. See /api/health.",
    };
  }
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// --- notes ----------------------------------------------------------------

export async function addNote(formData: FormData): Promise<void> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await db.note.create({
    data: {
      body,
      authorId: user.id,
      propertyId: optional(formData.get("propertyId")),
      unitId: optional(formData.get("unitId")),
      tenantId: optional(formData.get("tenantId")),
      ownerId: optional(formData.get("ownerId")),
    },
  });

  revalidatePath(String(formData.get("returnTo") ?? "/"));
}

export async function togglePin(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const note = await db.note.findUnique({ where: { id }, select: { pinned: true } });
  if (!note) return;

  await db.note.update({ where: { id }, data: { pinned: !note.pinned } });
  revalidatePath(String(formData.get("returnTo") ?? "/"));
}

export async function deleteNote(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  // Only the author can delete their own note.
  const note = await db.note.findUnique({ where: { id }, select: { authorId: true } });
  if (!note || note.authorId !== user.id) return;

  await db.note.delete({ where: { id } });
  revalidatePath(String(formData.get("returnTo") ?? "/"));
}

// --- handoffs -------------------------------------------------------------

export async function createHandoff(formData: FormData): Promise<void> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dueRaw = String(formData.get("dueDate") ?? "").trim();

  await db.handoff.create({
    data: {
      title,
      detail: optional(formData.get("detail")),
      creatorId: user.id,
      assigneeId: optional(formData.get("assigneeId")),
      dueDate: dueRaw ? new Date(`${dueRaw}T12:00:00`) : null,
      propertyId: optional(formData.get("propertyId")),
      unitId: optional(formData.get("unitId")),
    },
  });

  revalidatePath(String(formData.get("returnTo") ?? "/tasks"));
}

export async function toggleHandoff(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const task = await db.handoff.findUnique({ where: { id }, select: { status: true } });
  if (!task) return;

  const done = task.status !== "done";
  await db.handoff.update({
    where: { id },
    data: { status: done ? "done" : "open", completedAt: done ? new Date() : null },
  });

  revalidatePath(String(formData.get("returnTo") ?? "/tasks"));
}

export async function deleteHandoff(formData: FormData): Promise<void> {
  await requireUser();
  await db.handoff.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath(String(formData.get("returnTo") ?? "/tasks"));
}

// --- our workflow status overlay -----------------------------------------

export async function setWorkStatus(formData: FormData): Promise<void> {
  await requireUser();
  const value = String(formData.get("workStatus") ?? "").trim() || null;
  const propertyId = optional(formData.get("propertyId"));
  const unitId = optional(formData.get("unitId"));

  if (unitId) await db.unit.update({ where: { id: unitId }, data: { workStatus: value } });
  else if (propertyId)
    await db.property.update({ where: { id: propertyId }, data: { workStatus: value } });

  revalidatePath(String(formData.get("returnTo") ?? "/"));
}

// --- AppFolio -------------------------------------------------------------

export async function runSync(): Promise<void> {
  await requireUser();
  await syncAll();
  revalidatePath("/", "layout");
}

// --- renewals -------------------------------------------------------------

/** Mark a notice milestone as sent (or undo it). */
export async function toggleRenewalStep(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const step = await db.renewalStep.findUnique({ where: { id }, select: { status: true } });
  if (!step) return;

  const done = step.status !== "done";
  await db.renewalStep.update({
    where: { id },
    data: {
      status: done ? "done" : "pending",
      completedAt: done ? new Date() : null,
      completedById: done ? user.id : null,
    },
  });

  revalidatePath(String(formData.get("returnTo") ?? "/renewals"));
}

/**
 * Skip a milestone deliberately — e.g. the tenant already signed, so the
 * remaining notices are moot. Distinct from "done" so the board doesn't claim
 * a notice went out when it didn't.
 */
export async function skipRenewalStep(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");

  const step = await db.renewalStep.findUnique({ where: { id }, select: { status: true } });
  if (!step) return;

  await db.renewalStep.update({
    where: { id },
    data: {
      status: step.status === "skipped" ? "pending" : "skipped",
      completedAt: null,
      completedById: null,
    },
  });

  revalidatePath(String(formData.get("returnTo") ?? "/renewals"));
}

/** Record the intended new rent and the renewal decision. */
export async function saveRenewalPlan(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");

  const rentRaw = String(formData.get("proposedRent") ?? "").replace(/[$,\s]/g, "");
  const parsed = Number(rentRaw);
  const decision = String(formData.get("decision") ?? "").trim();

  await db.renewal.update({
    where: { id },
    data: {
      proposedRent: rentRaw === "" || !Number.isFinite(parsed) ? null : parsed,
      decision: decision === "" ? null : decision,
      notes: optional(formData.get("notes")),
    },
  });

  revalidatePath(String(formData.get("returnTo") ?? "/renewals"));
}

// --- email ----------------------------------------------------------------

/** Sends the digest to the signed-in user right now, ignoring the daily guard. */
export async function sendTestDigest(): Promise<void> {
  const user = await requireUser();
  await sendDigests({ force: true, onlyUserId: user.id, kind: "test" });
  revalidatePath("/settings");
}

/** Turn the daily digest on or off for the signed-in user. */
export async function toggleDigest(formData: FormData): Promise<void> {
  const user = await requireUser();
  const enabled = formData.get("enabled") === "true";
  await db.user.update({ where: { id: user.id }, data: { digestEnabled: enabled } });
  revalidatePath("/settings");
}

/** Rebuild milestones from current lease dates. Safe to run any time. */
export async function rebuildRenewals(): Promise<void> {
  await requireUser();
  await generateRenewals();
  revalidatePath("/renewals");
  revalidatePath("/");
}

// --- helpers --------------------------------------------------------------

function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

// --- people ---------------------------------------------------------------

/**
 * Adds the other person's account.
 *
 * Any signed-in user can do this. With a team of two that's the right trade:
 * an invite-and-accept flow would be more machinery to build and secure than
 * the risk warrants, and /setup already refuses once one account exists, so
 * this is the only route in — you have to be signed in to use it.
 */
export async function addTeammate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email) return { error: "Enter a name and email." };
  if (!email.includes("@")) return { error: "That doesn't look like an email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const taken = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) return { error: `${email} already has an account.` };

  await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  revalidatePath("/settings");
  return { ok: `Added ${name}. They can sign in at /login with the password you set.` };
}

/** Changes your own password. Requires the current one, so a left-open tab can't. */
export async function changeMyPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record || !(await verifyPassword(current, record.passwordHash))) {
    return { error: "Current password is incorrect." };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
  return { ok: "Password changed." };
}

/** Resets someone else's password, for when they're locked out. */
export async function resetTeammatePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireUser();

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (id === me.id) return { error: "Use the change-password form for your own account." };

  const target = await db.user.findUnique({ where: { id }, select: { name: true } });
  if (!target) return { error: "That account no longer exists." };

  await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  revalidatePath("/settings");
  return { ok: `Set a new password for ${target.name}.` };
}

/**
 * Removes an account.
 *
 * Refuses to remove you, and refuses the last account, either of which would
 * lock everyone out — /setup won't reopen once an account has ever existed.
 * Notes and tasks reference their author, so an account that has written
 * anything can't be deleted without taking that history with it; changing the
 * password is the right move there instead.
 */
export async function removeTeammate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  const id = String(formData.get("id") ?? "");

  if (id === me.id) return { error: "You can't remove your own account." };
  if ((await db.user.count()) <= 1) return { error: "That's the only account — removing it would lock everyone out." };

  const target = await db.user.findUnique({ where: { id }, select: { name: true } });
  if (!target) return { error: "That account no longer exists." };

  try {
    await db.user.delete({ where: { id } });
  } catch {
    return {
      error: `${target.name} has written notes or tasks, so the account can't be deleted without losing that history. Change their password instead.`,
    };
  }

  revalidatePath("/settings");
  return { ok: `Removed ${target.name}.` };
}
