"use client";

import { useActionState } from "react";
import { addReminder, type ReminderState } from "@/app/(app)/calendar/actions";

const KINDS = [
  { value: "increase", label: "Rent increase" },
  { value: "renewal", label: "Renewal" },
  { value: "visit", label: "Visit / inspection" },
  { value: "general", label: "Something else" },
];

/**
 * Adds a reminder to the selected day.
 *
 * Notice dates and lease ends are already on the calendar automatically; this
 * is for the things around them — owner calls, inspections, follow-ups.
 */
export function AddReminder({ date }: { date: string }) {
  const [state, action, pending] = useActionState<ReminderState, FormData>(addReminder, {});

  return (
    <form action={action} className="card space-y-3 p-4" key={date}>
      <h3 className="text-sm font-semibold">Add a reminder</h3>

      <div>
        <label className="label" htmlFor="rem-title">What</label>
        <input className="input" id="rem-title" name="title" placeholder="Call the owner about 1913" required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="rem-date">When</label>
          <input className="input" defaultValue={date} id="rem-date" name="onDate" required type="date" />
        </div>
        <div>
          <label className="label" htmlFor="rem-kind">Type</label>
          <select className="input" defaultValue="general" id="rem-kind" name="kind">
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="rem-note">Note (optional)</label>
        <input className="input" id="rem-note" name="note" placeholder="Anything worth remembering" />
      </div>

      {state.error && (
        <p className="rounded-[10px] bg-crimson-tint px-3 py-2 text-sm text-accent-strong">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-[10px] bg-leaf-tint px-3 py-2 text-sm text-leaf">{state.ok}</p>
      )}

      <button className="btn btn-accent w-full" disabled={pending} type="submit">
        {pending ? "Adding…" : "Add reminder"}
      </button>
    </form>
  );
}
