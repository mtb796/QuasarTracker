"use client";

import { useActionState } from "react";
import {
  addTeammate,
  changeMyPassword,
  removeTeammate,
  resetTeammatePassword,
  type ActionState,
} from "@/app/actions";

type Person = { id: string; name: string; email: string; digestEnabled: boolean };

/**
 * Account management, in the browser.
 *
 * /setup creates the first account and then closes permanently, so without this
 * the second person could only be added from a terminal with the production
 * connection string — which defeats the point of a shared tool.
 */
export function PeopleManager({ people, meId }: { people: Person[]; meId: string }) {
  const [added, addAction, adding] = useActionState<ActionState, FormData>(addTeammate, {});
  const [changed, changeAction, changing] = useActionState<ActionState, FormData>(changeMyPassword, {});
  const [reset, resetAction, resetting] = useActionState<ActionState, FormData>(resetTeammatePassword, {});
  const [removed, removeAction, removing] = useActionState<ActionState, FormData>(removeTeammate, {});

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Who can sign in
        </h3>
        <ul className="space-y-2">
          {people.map((person) => (
            <li className="rounded-md border border-line p-3" key={person.id}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium">{person.name}</span>
                {person.id === meId && <span className="pill bg-ink/8 text-ink">you</span>}
                <span className="text-sm text-muted">{person.email}</span>
                <span className="ml-auto text-xs text-muted">
                  digest {person.digestEnabled ? "on" : "off"}
                </span>
              </div>

              {person.id !== meId && (
                <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-line pt-2">
                  <form action={resetAction} className="flex items-end gap-2">
                    <input name="id" type="hidden" value={person.id} />
                    <div>
                      <label className="label" htmlFor={`pw-${person.id}`}>
                        Set a new password for them
                      </label>
                      <input
                        className="input"
                        id={`pw-${person.id}`}
                        minLength={8}
                        name="password"
                        placeholder="at least 8 characters"
                        type="text"
                      />
                    </div>
                    <button className="btn" disabled={resetting} type="submit">
                      {resetting ? "Saving…" : "Set password"}
                    </button>
                  </form>

                  <form action={removeAction}>
                    <input name="id" type="hidden" value={person.id} />
                    <button className="btn text-accent-strong" disabled={removing} type="submit">
                      Remove
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
        <Result state={reset} />
        <Result state={removed} />
      </div>

      <form action={addAction} className="rounded-md border border-line p-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Add someone
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="tm-name">Name</label>
            <input className="input" id="tm-name" name="name" required />
          </div>
          <div>
            <label className="label" htmlFor="tm-email">Email</label>
            <input className="input" id="tm-email" name="email" required type="email" />
          </div>
          <div>
            <label className="label" htmlFor="tm-pw">Password</label>
            <input
              className="input"
              id="tm-pw"
              minLength={8}
              name="password"
              placeholder="at least 8 characters"
              required
              type="text"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          You set the password and pass it to them — there&apos;s no invite email. They can change
          it here once signed in.
        </p>
        <div className="mt-3">
          <button className="btn btn-accent" disabled={adding} type="submit">
            {adding ? "Adding…" : "Add account"}
          </button>
        </div>
        <Result state={added} />
      </form>

      <form action={changeAction} className="rounded-md border border-line p-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Change my password
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cur-pw">Current password</label>
            <input className="input" id="cur-pw" name="currentPassword" required type="password" />
          </div>
          <div>
            <label className="label" htmlFor="new-pw">New password</label>
            <input className="input" id="new-pw" minLength={8} name="newPassword" required type="password" />
          </div>
        </div>
        <div className="mt-3">
          <button className="btn" disabled={changing} type="submit">
            {changing ? "Saving…" : "Change password"}
          </button>
        </div>
        <Result state={changed} />
      </form>
    </div>
  );
}

function Result({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p className="mt-2 rounded-md bg-crimson-tint px-3 py-2 text-sm text-accent-strong">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>
    );
  }
  return null;
}
