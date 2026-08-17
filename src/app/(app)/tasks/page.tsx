import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HandoffComposer, HandoffList } from "@/components/Handoffs";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Mine" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const { view = "open" } = await searchParams;

  const where =
    view === "mine"
      ? { assigneeId: user.id, status: "open" }
      : view === "done"
        ? { status: "done" }
        : view === "all"
          ? {}
          : { status: "open" };

  const [tasks, users] = await Promise.all([
    db.handoff.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: { creator: true, assignee: true, property: true, unit: true },
      take: 300,
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Hand work back and forth without losing track of it." />

      <div className="mb-4 flex gap-1">
        {VIEWS.map((option) => (
          <Link
            key={option.key}
            className={`rounded-md px-2.5 py-1.5 text-sm ${
              view === option.key ? "bg-ink text-white" : "text-muted hover:bg-gray-100"
            }`}
            href={`/tasks?view=${option.key}`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <HandoffList
          tasks={tasks}
          returnTo={`/tasks?view=${view}`}
          showContext
          emptyLabel={view === "done" ? "Nothing completed yet." : "Nothing here."}
        />

        <div>
          <h2 className="mb-2 text-sm font-semibold">New task</h2>
          <HandoffComposer users={users} currentUserId={user.id} returnTo={`/tasks?view=${view}`} />
          <p className="mt-2 text-xs text-muted">
            To attach a task to a specific property or unit, add it from that page instead.
          </p>
        </div>
      </div>
    </div>
  );
}
