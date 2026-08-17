"use client";

import { useActionState } from "react";
import { runSetup } from "./actions";
import type { SetupState } from "./actions";

export function SetupForm({
  schemaSql,
  tablesReady,
}: {
  schemaSql: string;
  tablesReady: boolean;
}) {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(runSetup, {});

  return (
    <form action={formAction} className="card space-y-4 p-5">
      {/* The DDL is read on the server page and passed through, so the action
          doesn't need filesystem access in a serverless function. */}
      <input type="hidden" name="schemaSql" value={schemaSql} />
      <input type="hidden" name="tablesReady" value={String(tablesReady)} />

      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input className="input" id="name" name="name" required defaultValue="" />
      </div>

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input className="input" id="email" name="email" type="email" required autoComplete="username" />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password (at least 8 characters)
        </label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input className="mt-0.5" defaultChecked name="demo" type="checkbox" value="true" />
        <span>
          Add demo data — a few properties with leases spread across every renewal milestone, so
          the app isn&apos;t empty. Safe to delete later, and a real AppFolio sync won&apos;t
          collide with it.
        </span>
      </label>

      {state.error && (
        <p className="rounded-md bg-crimson-tint px-3 py-2 text-sm text-accent-strong">
          {state.error}
        </p>
      )}

      <button className="btn btn-accent w-full" disabled={pending} type="submit">
        {pending ? "Setting up…" : "Create tables and my account"}
      </button>
    </form>
  );
}
