import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HandoffList } from "@/components/Handoffs";
import { NoteComposer, NoteFeed } from "@/components/Notes";
import { RenewalAlert } from "@/components/RenewalAlert";
import { getRenewalBoard, pendingActionStep, summarize } from "@/lib/renewals";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const [myTasks, otherOpenTasks, notes, counts, lastSync] = await Promise.all([
    db.handoff.findMany({
      where: { status: "open", assigneeId: user.id },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: { creator: true, assignee: true, property: true, unit: true },
      take: 25,
    }),
    db.handoff.findMany({
      // `NOT: { assigneeId }` drops unassigned rows: in SQL, NOT (NULL = 'x')
      // is NULL, not true. Spelled out so an unassigned task can't vanish from
      // both this list and "assigned to me".
      where: {
        status: "open",
        OR: [{ assigneeId: null }, { assigneeId: { not: user.id } }],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: { creator: true, assignee: true, property: true, unit: true },
      take: 25,
    }),
    db.note.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: true,
        property: true,
        unit: { include: { property: true } },
      },
      take: 20,
    }),
    Promise.all([
      db.property.count(),
      db.unit.count(),
      db.unit.count({ where: { occupancy: "vacant" } }),
      db.tenant.count({ where: { status: "current" } }),
    ]),
    db.syncRun.findFirst({ where: { status: "ok" }, orderBy: { startedAt: "desc" } }),
  ]);

  const [properties, units, vacant, currentTenants] = counts;

  const renewalRows = await getRenewalBoard();
  const renewalSummary = summarize(renewalRows);
  // Same rule the Renewals page uses, so the banner can't claim work the
  // pipeline says is already done.
  const criticalRenewals = renewalRows.filter((row) => {
    const step = pendingActionStep(row);
    return step?.state === "critical" || step?.state === "expired";
  });

  return (
    <div>
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        subtitle={
          lastSync
            ? `AppFolio last synced ${lastSync.startedAt.toLocaleString("en-US")}`
            : "No AppFolio sync yet — connect it in Settings."
        }
      />

      <RenewalAlert critical={criticalRenewals} actionNeeded={renewalSummary.actionNeeded} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Renewals due" value={renewalSummary.actionNeeded} href="/renewals" />
        <Stat label="Properties" value={properties} href="/properties" />
        <Stat label="Units" value={units} href="/properties" />
        <Stat label="Vacant units" value={vacant} href="/properties?occupancy=vacant" />
        <Stat label="Current tenants" value={currentTenants} href="/tenants" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            Assigned to me{myTasks.length > 0 ? ` (${myTasks.length})` : ""}
          </h2>
          <HandoffList tasks={myTasks} returnTo="/" showContext emptyLabel="Nothing on your plate." />

          {otherOpenTasks.length > 0 && (
            <>
              <h2 className="mt-5 mb-2 text-sm font-semibold">Everything else open</h2>
              <HandoffList tasks={otherOpenTasks} returnTo="/" showContext />
            </>
          )}

          <Link className="mt-3 inline-block text-sm text-accent hover:underline" href="/tasks">
            All tasks →
          </Link>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Latest updates</h2>
          <div className="mb-3">
            <NoteComposer
              target={{}}
              returnTo="/"
              placeholder="Post a general update for the team…"
            />
          </div>
          <NoteFeed notes={notes} currentUserId={user.id} returnTo="/" showContext />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link className="card block p-3 hover:border-gray-300" href={href}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </Link>
  );
}
