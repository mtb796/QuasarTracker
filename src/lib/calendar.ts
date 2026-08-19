import "server-only";

import { db } from "./db";
import { addDays, startOfDay } from "./renewal-rules";

/**
 * Everything that lands on a date, in one shape.
 *
 * The calendar is assembled from things that already exist — renewal
 * milestones, lease ends, task due dates — plus reminders someone typed in.
 * Nothing here is a second source of truth: change a lease end and the notice
 * dates move with it.
 */
export type CalendarItem = {
  id: string;
  date: string; // YYYY-MM-DD, local
  kind: "notice" | "leaseEnd" | "task" | "reminder";
  title: string;
  detail?: string;
  href?: string;
  milestone?: number;
  done?: boolean;
  urgent?: boolean;
  /// For reminders: "increase" | "renewal" | "visit" | "general".
  reminderKind?: string;
};

export function dayKeyOf(value: Date): string {
  const d = startOfDay(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthBounds(year: number, month: number): { from: Date; to: Date } {
  // Pad by a week each side so the leading/trailing days of the grid are filled.
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { from: addDays(first, -10), to: addDays(last, 10) };
}

export async function getCalendarItems(from: Date, to: Date): Promise<CalendarItem[]> {
  const items: CalendarItem[] = [];

  const [steps, tenants, tasks, reminders] = await Promise.all([
    db.renewalStep.findMany({
      where: { dueOn: { gte: from, lte: to } },
      include: {
        renewal: {
          include: { tenant: { include: { unit: { include: { property: true } }, property: true } } },
        },
      },
      take: 800,
    }),
    db.tenant.findMany({
      where: { leaseEnd: { gte: from, lte: to }, status: { in: ["current", "future"] } },
      include: { unit: { include: { property: true } }, property: true },
      take: 500,
    }),
    db.handoff.findMany({
      where: { dueDate: { gte: from, lte: to } },
      include: { assignee: true, unit: true, property: true },
      take: 300,
    }),
    db.reminder.findMany({
      where: { onDate: { gte: from, lte: to } },
      include: { unit: { include: { property: true } }, property: true },
      take: 300,
    }),
  ]);

  for (const step of steps) {
    const tenant = step.renewal.tenant;
    const property = tenant.unit?.property ?? tenant.property ?? null;
    items.push({
      id: `step-${step.id}`,
      date: dayKeyOf(step.dueOn),
      kind: "notice",
      milestone: step.milestone,
      title: `${step.milestone}-day notice — ${tenant.name}`,
      detail: property?.name,
      href: tenant.unit ? `/units/${tenant.unit.id}` : "/renewals",
      done: step.status === "done" || step.status === "skipped",
      urgent: step.milestone === 90 && step.status === "pending",
    });
  }

  for (const tenant of tenants) {
    if (!tenant.leaseEnd) continue;
    const property = tenant.unit?.property ?? tenant.property ?? null;
    items.push({
      id: `lease-${tenant.id}`,
      date: dayKeyOf(tenant.leaseEnd),
      kind: "leaseEnd",
      title: `Lease ends — ${tenant.name}`,
      detail: property?.name,
      href: tenant.unit ? `/units/${tenant.unit.id}` : "/tenants",
    });
  }

  for (const task of tasks) {
    if (!task.dueDate) continue;
    items.push({
      id: `task-${task.id}`,
      date: dayKeyOf(task.dueDate),
      kind: "task",
      title: task.title,
      detail: task.assignee ? `for ${task.assignee.name}` : "unassigned",
      href: "/tasks",
      done: task.status === "done",
    });
  }

  for (const reminder of reminders) {
    const property = reminder.unit?.property ?? reminder.property ?? null;
    items.push({
      id: `rem-${reminder.id}`,
      date: dayKeyOf(reminder.onDate),
      kind: "reminder",
      title: reminder.title,
      detail: [reminder.note, property?.name].filter(Boolean).join(" · ") || undefined,
      done: reminder.done,
      reminderKind: reminder.kind,
    });
  }

  return items;
}

export function groupByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = map.get(item.date);
    if (list) list.push(item);
    else map.set(item.date, [item]);
  }
  // Urgent first within a day, then unfinished, then the rest.
  for (const list of map.values()) {
    list.sort((a, b) => {
      const score = (i: CalendarItem) => (i.urgent ? 0 : i.done ? 2 : 1);
      return score(a) - score(b);
    });
  }
  return map;
}
