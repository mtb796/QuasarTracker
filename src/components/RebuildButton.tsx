"use client";

import { useTransition } from "react";
import { rebuildRenewals } from "@/app/actions";

/**
 * Regenerates milestones from current lease dates. Sync does this automatically;
 * this is here for when lease data changed by another route, or to reassure
 * someone that the board is current.
 */
export function RebuildButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn"
      disabled={pending}
      onClick={() => startTransition(() => rebuildRenewals())}
      type="button"
    >
      {pending ? "Rebuilding…" : "Rebuild from lease dates"}
    </button>
  );
}
