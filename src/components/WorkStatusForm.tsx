import { setWorkStatus } from "@/app/actions";

/**
 * AppFolio's Reporting API is read-only, so anything we want to track that
 * AppFolio doesn't own lives here — a free-text marker on a property or unit.
 */
export function WorkStatusForm({
  value,
  returnTo,
  propertyId,
  unitId,
}: {
  value: string | null;
  returnTo: string;
  propertyId?: string;
  unitId?: string;
}) {
  return (
    <form action={setWorkStatus} className="flex flex-wrap items-end gap-2">
      {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
      {unitId && <input type="hidden" name="unitId" value={unitId} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="min-w-[200px] flex-1">
        <label className="label" htmlFor="workStatus">
          Our status
        </label>
        <input
          className="input"
          defaultValue={value ?? ""}
          id="workStatus"
          name="workStatus"
          placeholder="e.g. Turn in progress"
        />
      </div>
      <button className="btn" type="submit">
        Save
      </button>
    </form>
  );
}
