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

      <p className="rounded-md bg-ember-tint px-3 py-2 text-sm text-amber-900">
        Next you&apos;ll be taken to Import, to load your properties from a spreadsheet.
      </p>

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
