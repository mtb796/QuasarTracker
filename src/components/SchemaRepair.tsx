"use client";

import { useActionState } from "react";
import { runSchemaRepair, type ActionState } from "@/app/actions";

/**
 * Applies schema changes to an already-set-up database.
 *
 * Deploys don't run migrations, so a database created before a model existed
 * never gains it and the page using it fails. This is the no-terminal fix.
 */
export function SchemaRepair({ missing }: { missing: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(runSchemaRepair, {});

  return (
    <form action={action} className="space-y-3">
      {missing.length > 0 ? (
        <p className="rounded-[10px] bg-crimson-tint px-3 py-2 text-sm text-accent-strong">
          This database is missing {missing.length} table{missing.length === 1 ? "" : "s"} this
          build expects: <strong>{missing.join(", ")}</strong>. Pages using them will fail until
          you update.
        </p>
      ) : (
        <p className="text-sm text-muted">
          All expected tables are present. Run this after a deploy that adds features, if a page
          starts failing.
        </p>
      )}

      {state.error && (
        <p className="rounded-[10px] bg-crimson-tint px-3 py-2 text-sm text-accent-strong">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-[10px] bg-leaf-tint px-3 py-2 text-sm text-leaf">{state.ok}</p>
      )}

      <button
        className={missing.length > 0 ? "btn btn-accent" : "btn"}
        disabled={pending}
        type="submit"
      >
        {pending ? "Updating…" : "Update database schema"}
      </button>
      <p className="text-xs text-muted">
        Only adds missing tables, columns and indexes. Nothing is dropped or renamed, so this
        can&apos;t lose data.
      </p>
    </form>
  );
}
