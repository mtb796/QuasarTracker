import Link from "next/link";
import type { CalendarItem } from "@/lib/calendar";
import { deleteReminder, toggleReminder } from "@/app/(app)/calendar/actions";

const LABEL: Record<CalendarItem["kind"], string> = {
  notice: "Notice",
  leaseEnd: "Lease ends",
  task: "Task",
  reminder: "Reminder",
};

/** A reminder's own type is the useful label — "Rent increase" beats "Reminder". */
const REMINDER_LABEL: Record<string, string> = {
  increase: "Rent increase",
  renewal: "Renewal",
  visit: "Visit",
  general: "Reminder",
};

function labelFor(item: CalendarItem): string {
  if (item.kind === "reminder") {
    return REMINDER_LABEL[item.reminderKind ?? "general"] ?? "Reminder";
  }
  return LABEL[item.kind];
}

const TONE: Record<CalendarItem["kind"], string> = {
  notice: "bg-crimson-tint text-accent-strong",
  leaseEnd: "bg-sky-tint text-sky",
  task: "bg-leaf-tint text-leaf",
  reminder: "bg-ember-tint text-amber-800",
};

export function DayItems({ items }: { items: CalendarItem[] }) {
  if (items.length === 0) {
    return <p className="py-3 text-sm text-muted">Nothing on this day.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          className={`rounded-[10px] border p-2.5 ${
            item.urgent ? "border-accent/50 bg-crimson-tint/50" : "border-line"
          }`}
          key={item.id}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`pill ${TONE[item.kind]}`}>{labelFor(item)}</span>
            {item.urgent && <span className="pill bg-accent text-white">send now</span>}
          </div>

          <div className={`mt-1 text-sm ${item.done ? "text-muted line-through" : ""}`}>
            {item.href ? (
              <Link className="hover:underline" href={item.href}>
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </div>
          {item.detail && <div className="text-xs text-muted">{item.detail}</div>}

          {item.kind === "reminder" && (
            <div className="mt-1.5 flex gap-3 text-xs">
              <form action={toggleReminder}>
                <input name="id" type="hidden" value={item.id} />
                <button className="text-muted hover:text-ink" type="submit">
                  {item.done ? "Undo" : "Done"}
                </button>
              </form>
              <form action={deleteReminder}>
                <input name="id" type="hidden" value={item.id} />
                <button className="text-muted hover:text-accent-strong" type="submit">
                  Delete
                </button>
              </form>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
