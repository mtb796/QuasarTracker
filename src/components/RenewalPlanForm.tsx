import { saveRenewalPlan } from "@/app/actions";
import type { RenewalRow } from "@/lib/renewals";
import { formatMoney } from "./ui";

const DECISIONS = [
  { value: "", label: "Undecided" },
  { value: "increase", label: "Rent increase" },
  { value: "flat", label: "Renew at same rent" },
  { value: "non_renew", label: "Do not renew" },
];

/**
 * Where the rent increase is decided and recorded.
 *
 * Market rent sits next to current rent so the number can be chosen without
 * leaving the row, and the decision is stored so it survives the conversation
 * that produced it.
 */
export function RenewalPlanForm({ row, returnTo }: { row: RenewalRow; returnTo: string }) {
  const delta =
    row.proposedRent !== null && row.currentRent !== null
      ? row.proposedRent - row.currentRent
      : null;

  return (
    <form action={saveRenewalPlan} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="w-32">
        <label className="label" htmlFor={`rent-${row.id}`}>
          New rent
        </label>
        <input
          className="input"
          defaultValue={row.proposedRent ?? ""}
          id={`rent-${row.id}`}
          inputMode="decimal"
          name="proposedRent"
          placeholder={row.marketRent ? String(row.marketRent) : "0"}
        />
      </div>

      <div className="w-48">
        <label className="label" htmlFor={`decision-${row.id}`}>
          Decision
        </label>
        <select
          className="input"
          defaultValue={row.decision ?? ""}
          id={`decision-${row.id}`}
          name="decision"
        >
          {DECISIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[180px] flex-1">
        <label className="label" htmlFor={`notes-${row.id}`}>
          Notes
        </label>
        <input
          className="input"
          defaultValue={row.notes ?? ""}
          id={`notes-${row.id}`}
          name="notes"
          placeholder="Anything the other of us should know"
        />
      </div>

      <button className="btn" type="submit">
        Save
      </button>

      <div className="text-xs text-muted">
        Current {formatMoney(row.currentRent)} · Market {formatMoney(row.marketRent)}
        {delta !== null && delta !== 0 && (
          <span className={delta > 0 ? " font-medium text-emerald-700" : " font-medium text-accent"}>
            {" "}
            · {delta > 0 ? "+" : ""}
            {formatMoney(delta)}
          </span>
        )}
      </div>
    </form>
  );
}
