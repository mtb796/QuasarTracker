import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dayKeyOf, getCalendarItems, groupByDay, monthBounds } from "@/lib/calendar";
import { PageHeader } from "@/components/ui";
import { AddReminder } from "@/components/AddReminder";
import { DayItems } from "@/components/DayItems";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  await requireUser();
  const { m, d } = await searchParams;

  const today = new Date();
  // ?m=YYYY-MM keeps month navigation in the URL, so it survives a refresh
  // and can be linked to.
  const [yearRaw, monthRaw] = (m ?? "").split("-");
  const year = Number(yearRaw) || today.getFullYear();
  const month = (Number(monthRaw) || today.getMonth() + 1) - 1;

  const { from, to } = monthBounds(year, month);
  const items = await getCalendarItems(from, to);
  const byDay = groupByDay(items);

  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return date;
  });

  const key = (offset: number) => {
    const date = new Date(year, month + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const selected = d ?? dayKeyOf(today);
  const selectedItems = byDay.get(selected) ?? [];
  const todayKey = dayKeyOf(today);

  const monthItems = items.filter((i) => {
    const [y, mo] = i.date.split("-").map(Number);
    return y === year && mo === month + 1;
  });
  const noticesDue = monthItems.filter((i) => i.kind === "notice" && !i.done).length;
  const leaseEnds = monthItems.filter((i) => i.kind === "leaseEnd").length;

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Notice dates and lease ends appear on their own — change a lease and they move with it."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Link className="btn" href={`/calendar?m=${key(-1)}`}>←</Link>
          <h2 className="min-w-[190px] px-2 text-center text-base font-semibold">
            {MONTHS[month]} {year}
          </h2>
          <Link className="btn" href={`/calendar?m=${key(1)}`}>→</Link>
        </div>
        <Link className="btn" href="/calendar">Today</Link>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted">
          <Legend className="bg-accent" label={`${noticesDue} notices due`} />
          <Legend className="bg-sky" label={`${leaseEnds} leases ending`} />
          <Legend className="bg-ember" label="reminder" />
          <Legend className="bg-leaf" label="task" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="card p-3">
          <div className="mb-1 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <div className="px-1 py-1 text-center text-xs font-medium text-muted" key={w}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((date) => {
              const dk = dayKeyOf(date);
              const outside = date.getMonth() !== month;
              const dayItems = byDay.get(dk) ?? [];
              const urgent = dayItems.some((i) => i.urgent);

              return (
                <Link
                  className={`day ${outside ? "day-outside" : ""} ${dk === todayKey ? "day-today" : ""} ${
                    dk === selected ? "ring-2 ring-accent/40" : ""
                  } hover:border-accent/60`}
                  href={`/calendar?m=${key(0)}&d=${dk}`}
                  key={dk}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`text-xs ${dk === todayKey ? "font-bold text-accent" : ""}`}>
                      {date.getDate()}
                    </span>
                    {urgent && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  </div>

                  <div className="mt-1 space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${dotClass(item.kind, item.done)}`}
                        key={item.id}
                        title={item.title}
                      >
                        {item.kind === "notice" ? `${item.milestone}d · ` : ""}
                        {item.title.replace(/^\d+-day notice — /, "")}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="px-1 text-[10px] text-muted">+{dayItems.length - 3} more</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">
              {new Date(`${selected}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <DayItems items={selectedItems} />
          </div>

          <AddReminder date={selected} />
        </aside>
      </div>
    </div>
  );
}

function dotClass(kind: string, done?: boolean): string {
  if (done) return "bg-gray-100 text-gray-400 line-through";
  switch (kind) {
    case "notice": return "bg-crimson-tint text-accent-strong";
    case "leaseEnd": return "bg-sky-tint text-sky";
    case "reminder": return "bg-ember-tint text-amber-800";
    default: return "bg-leaf-tint text-leaf";
  }
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
