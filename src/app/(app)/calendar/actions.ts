"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type ReminderState = { error?: string; ok?: string };

export async function addReminder(
  _prev: ReminderState,
  formData: FormData,
): Promise<ReminderState> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const onDate = String(formData.get("onDate") ?? "").trim();
  if (!title) return { error: "Give the reminder a title." };
  if (!onDate) return { error: "Pick a date." };

  await db.reminder.create({
    data: {
      title,
      note: String(formData.get("note") ?? "").trim() || null,
      kind: String(formData.get("kind") ?? "general"),
      // Midday local, so a timezone shift can't slide it into the day before.
      onDate: new Date(`${onDate}T12:00:00`),
      createdById: user.id,
    },
  });

  revalidatePath("/calendar");
  return { ok: "Added." };
}

export async function toggleReminder(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "").replace(/^rem-/, "");
  const reminder = await db.reminder.findUnique({ where: { id }, select: { done: true } });
  if (!reminder) return;

  await db.reminder.update({ where: { id }, data: { done: !reminder.done } });
  revalidatePath("/calendar");
}

export async function deleteReminder(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "").replace(/^rem-/, "");
  await db.reminder.delete({ where: { id } }).catch(() => {});
  revalidatePath("/calendar");
}
