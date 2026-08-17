"use client";

import { useTransition } from "react";
import { runSync } from "@/app/actions";

export function SyncButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-accent"
      disabled={disabled || pending}
      onClick={() => startTransition(() => runSync())}
      type="button"
    >
      {pending ? "Syncing…" : "Sync from AppFolio"}
    </button>
  );
}
