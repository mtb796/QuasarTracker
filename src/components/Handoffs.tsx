import Link from "next/link";
import { createHandoff, deleteHandoff, toggleHandoff } from "@/app/actions";
import { formatDate } from "./ui";

export type HandoffRecord = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  dueDate: Date | null;
  creator: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  property?: { id: string; name: string } | null;
  unit?: { id: string; name: string } | null;
};

export function HandoffComposer({
  users,
  currentUserId,
  returnTo,
  propertyId,
  unitId,
}: {
  users: { id: string; name: string }[];
  currentUserId: string;
  returnTo: string;
  propertyId?: string;
  unitId?: string;
}) {
  // Default the assignee to the other person — handing work off is the point.
  const other = users.find((u) => u.id !== currentUserId);

  return (
    <form action={createHandoff} className="card space-y-3 p-4">
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      {unitId && <input type="hidden" name="unitId" value={unitId} />}
      <input type="hidden" name="returnTo" value={returnTo} />

      <input className="input" name="title" placeholder="What needs doing?" required />
      <textarea className="input min-h-[60px] resize-y" name="detail" placeholder="Details (optional)" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="assigneeId">
            Assign to
          </label>
          <select className="input" id="assigneeId" name="assigneeId" defaultValue={other?.id ?? ""}>
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
                {user.id === currentUserId ? " (me)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dueDate">
            Due
          </label>
          <input className="input" id="dueDate" name="dueDate" type="date" />
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary" type="submit">
          Add task
        </button>
      </div>
    </form>
  );
}

export function HandoffList({
  tasks,
  returnTo,
  showContext = false,
  emptyLabel = "Nothing open.",
}: {
  tasks: HandoffRecord[];
  returnTo: string;
  showContext?: boolean;
  emptyLabel?: string;
}) {
  if (tasks.length === 0) {
    return <p className="px-1 py-4 text-sm text-muted">{emptyLabel}</p>;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const overdue =
          task.status === "open" && task.dueDate !== null && task.dueDate < today;

        return (
          <li key={task.id} className="card flex items-start gap-3 p-3">
            <form action={toggleHandoff} className="pt-0.5">
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                aria-label={task.status === "done" ? "Reopen task" : "Mark done"}
                className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                  task.status === "done"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-gray-300 hover:border-gray-500"
                }`}
                type="submit"
              >
                {task.status === "done" ? "✓" : ""}
              </button>
            </form>

            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  task.status === "done" ? "text-muted line-through" : ""
                }`}
              >
                {task.title}
              </p>
              {task.detail && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">
                  {task.detail}
                </p>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>
                  {task.assignee ? `→ ${task.assignee.name}` : "Unassigned"} · from{" "}
                  {task.creator.name}
                </span>
                {task.dueDate && (
                  <span className={overdue ? "font-medium text-accent-strong" : ""}>
                    Due {formatDate(task.dueDate)}
                    {overdue ? " · overdue" : ""}
                  </span>
                )}
                {showContext && task.unit && (
                  <Link className="text-accent hover:underline" href={`/units/${task.unit.id}`}>
                    Unit {task.unit.name}
                  </Link>
                )}
                {showContext && !task.unit && task.property && (
                  <Link
                    className="text-accent hover:underline"
                    href={`/properties/${task.property.id}`}
                  >
                    {task.property.name}
                  </Link>
                )}
              </div>
            </div>

            <form action={deleteHandoff}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button
                className="text-xs text-muted hover:text-accent-strong"
                type="submit"
                aria-label="Delete task"
              >
                ×
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
