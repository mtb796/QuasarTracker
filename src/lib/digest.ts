import "server-only";

import { db } from "./db";
import { appUrl } from "./email";
import { getRenewalBoard, missedBefore, pendingActionStep, type RenewalRow } from "./renewals";
import { HARD_DEADLINE, daysUntil } from "./renewal-rules";

/**
 * The daily digest.
 *
 * Ordered by what it costs to miss: the 90-day hard line first, then earlier
 * notice windows, then that person's own tasks. The subject line carries the
 * worst item, because on a phone that's often all that gets read.
 */

const INK = "#343945";
const MUTED = "#767C8A";
const LINE = "#E2E5EB";
const ACCENT = "#E4335C";
const EMBER = "#F5A623";

export type DigestTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  overdue: boolean;
};

export type Digest = {
  subject: string;
  html: string;
  text: string;
  /** False when there is genuinely nothing to say. */
  hasContent: boolean;
  counts: { critical: number; due: number; tasks: number };
};

export async function buildDigest(
  user: { id: string; name: string; email: string },
  now: Date = new Date(),
): Promise<Digest> {
  const rows = await getRenewalBoard(now);

  const actionable = rows
    .map((row) => ({ row, step: pendingActionStep(row) }))
    .filter((entry): entry is { row: RenewalRow; step: NonNullable<typeof entry.step> } =>
      entry.step !== null,
    );

  const critical = actionable.filter(
    ({ step }) => step.state === "critical" || step.state === "expired",
  );
  const due = actionable.filter(
    ({ step }) => step.state !== "critical" && step.state !== "expired",
  );

  // Only this person's tasks, and only ones that are actually pressing.
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const taskRows = await db.handoff.findMany({
    where: { status: "open", assigneeId: user.id, dueDate: { not: null, lte: today } },
    orderBy: { dueDate: "asc" },
    select: { id: true, title: true, dueDate: true },
    take: 20,
  });
  const tasks: DigestTask[] = taskRows.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueDate,
    overdue: task.dueDate !== null && daysUntil(task.dueDate, now) < 0,
  }));

  const counts = { critical: critical.length, due: due.length, tasks: tasks.length };
  const hasContent = critical.length + due.length + tasks.length > 0;

  return {
    subject: buildSubject(counts),
    html: renderHtml(user, critical, due, tasks, now),
    text: renderText(user, critical, due, tasks),
    hasContent,
    counts,
  };
}

function buildSubject(counts: { critical: number; due: number; tasks: number }): string {
  if (counts.critical > 0) {
    return `Quasar — ${counts.critical} rent increase${
      counts.critical === 1 ? "" : "s"
    } must go out now (${HARD_DEADLINE}-day line)`;
  }
  if (counts.due > 0) {
    return `Quasar — ${counts.due} renewal notice${counts.due === 1 ? "" : "s"} due`;
  }
  if (counts.tasks > 0) {
    return `Quasar — ${counts.tasks} task${counts.tasks === 1 ? "" : "s"} due`;
  }
  return "Quasar — nothing due today";
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

type Entry = { row: RenewalRow; step: { milestone: number; state: string } };

function describe(row: RenewalRow): string {
  const place = [row.propertyName, row.unitName ? `Unit ${row.unitName}` : null]
    .filter(Boolean)
    .join(" · ");
  return `${place || "Unassigned unit"} — ${row.tenantName}`;
}

function timing(row: RenewalRow): string {
  const ends = row.leaseEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const out =
    row.daysOut < 0 ? `ended ${Math.abs(row.daysOut)} days ago` : `${row.daysOut} days out`;
  return `Lease ends ${ends} · ${out}`;
}

function money(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function rentLine(row: RenewalRow): string {
  const parts = [`Current ${money(row.currentRent)}`, `market ${money(row.marketRent)}`];
  if (row.proposedRent !== null) parts.push(`proposed ${money(row.proposedRent)}`);
  return parts.join(" · ");
}

/**
 * Email HTML has to survive Outlook and Gmail, so this is tables and inline
 * styles only — no flexbox, no grid, no stylesheet.
 */
function renderHtml(
  user: { name: string },
  critical: Entry[],
  due: Entry[],
  tasks: DigestTask[],
  now: Date,
): string {
  const url = appUrl();
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const section = (title: string, color: string, body: string) => `
    <tr><td style="padding:22px 24px 0 24px;">
      <p style="margin:0 0 10px 0;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                text-transform:uppercase;letter-spacing:.06em;color:${color};">${title}</p>
      ${body}
    </td></tr>`;

  const renewalCard = (entry: Entry, urgent: boolean) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 0 10px 0;border:1px solid ${urgent ? ACCENT : LINE};border-radius:8px;
                  background:${urgent ? "#FDEEF2" : "#FFFFFF"};">
      <tr><td style="padding:12px 14px;font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;
                     background:${urgent ? ACCENT : EMBER};color:#FFFFFF;">
          ${entry.step.milestone}-day${entry.step.state === "expired" ? " · MISSED" : ""}
        </span>
        <div style="margin-top:6px;font-weight:600;">${escapeHtml(describe(entry.row))}</div>
        <div style="color:${MUTED};font-size:13px;">${escapeHtml(timing(entry.row))}</div>
        <div style="color:${MUTED};font-size:13px;">${escapeHtml(rentLine(entry.row))}</div>
        ${(() => {
          const missed = missedBefore(entry.row);
          return missed > 0
            ? `<div style="color:${ACCENT};font-size:13px;">${missed} earlier notice${
                missed === 1 ? "" : "s"
              } missed</div>`
            : "";
        })()}
      </td></tr>
    </table>`;

  const taskRow = (task: DigestTask) => `
    <li style="margin:0 0 6px 0;">
      ${escapeHtml(task.title)}
      <span style="color:${task.overdue ? ACCENT : MUTED};">
        ${task.dueDate ? `— due ${task.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        ${task.overdue ? " (overdue)" : ""}
      </span>
    </li>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F6F7F9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F7F9;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
         style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid ${LINE};border-radius:12px;overflow:hidden;">

    <tr><td style="height:4px;background:linear-gradient(90deg,${ACCENT},${EMBER});font-size:0;line-height:0;">&nbsp;</td></tr>

    <tr><td style="padding:20px 24px 0 24px;">
      <p style="margin:0;font:400 15px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                letter-spacing:.28em;text-transform:uppercase;color:${INK};">Quasar</p>
      <p style="margin:6px 0 0 0;font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
        ${escapeHtml(user.name)} — ${escapeHtml(date)}
      </p>
    </td></tr>

    ${
      critical.length > 0
        ? section(
            `Past the ${HARD_DEADLINE}-day line — send now`,
            ACCENT,
            critical.map((entry) => renewalCard(entry, true)).join(""),
          )
        : ""
    }

    ${
      due.length > 0
        ? section(
            "Renewal notices due",
            INK,
            due.map((entry) => renewalCard(entry, false)).join(""),
          )
        : ""
    }

    ${
      tasks.length > 0
        ? section(
            "Your tasks",
            INK,
            `<ul style="margin:0;padding-left:18px;font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">
               ${tasks.map(taskRow).join("")}
             </ul>`,
          )
        : ""
    }

    ${
      critical.length + due.length + tasks.length === 0
        ? section(
            "All clear",
            INK,
            `<p style="margin:0;font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
               No renewal notices or tasks due today.</p>`,
          )
        : ""
    }

    <tr><td style="padding:22px 24px 26px 24px;">
      <a href="${url}/renewals"
         style="display:inline-block;padding:10px 18px;border-radius:6px;background:${ACCENT};
                color:#FFFFFF;text-decoration:none;font:600 14px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        Open renewals
      </a>
    </td></tr>

    <tr><td style="padding:0 24px 22px 24px;border-top:1px solid ${LINE};">
      <p style="margin:14px 0 0 0;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
        Daily digest from Quasar. Turn it off for your account under Settings → Email.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;
}

/** Plain-text alternative — some clients show it, and it's what the console transport prints. */
function renderText(
  user: { name: string },
  critical: Entry[],
  due: Entry[],
  tasks: DigestTask[],
): string {
  const lines: string[] = [`QUASAR — daily digest for ${user.name}`, ""];

  if (critical.length > 0) {
    lines.push(`PAST THE ${HARD_DEADLINE}-DAY LINE — SEND NOW (${critical.length})`);
    for (const entry of critical) {
      lines.push(`  [${entry.step.milestone}d] ${describe(entry.row)}`);
      lines.push(`      ${timing(entry.row)}`);
      lines.push(`      ${rentLine(entry.row)}`);
    }
    lines.push("");
  }

  if (due.length > 0) {
    lines.push(`RENEWAL NOTICES DUE (${due.length})`);
    for (const entry of due) {
      lines.push(`  [${entry.step.milestone}d] ${describe(entry.row)}`);
      lines.push(`      ${timing(entry.row)}`);
    }
    lines.push("");
  }

  if (tasks.length > 0) {
    lines.push(`YOUR TASKS (${tasks.length})`);
    for (const task of tasks) {
      lines.push(`  - ${task.title}${task.overdue ? " (overdue)" : ""}`);
    }
    lines.push("");
  }

  if (critical.length + due.length + tasks.length === 0) {
    lines.push("Nothing due today.", "");
  }

  lines.push(`${appUrl()}/renewals`);
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
