"use client";

import { useActionState, useState, useTransition } from "react";
import { FIELDS, FIELD_ORDER, type FieldKey } from "@/lib/import-fields";
import { commitImport, previewImport, type CommitState, type PreviewState } from "./actions";


/**
 * Upload, check, then import.
 *
 * The file stays in the browser between the two steps and is sent again on
 * confirm — nothing is written until the mapping has actually been looked at,
 * because a wrongly-guessed lease-end column would quietly produce no renewal
 * milestones at all.
 */
export function ImportForm() {
  // The chosen File lives in state, not in the input. React re-creates the
  // uncontrolled input when the preview action re-renders the page, which
  // silently empties it — so the second step builds its own FormData from this.
  const [file, setFile] = useState<File | null>(null);
  const [preview, previewAction, previewing] = useActionState<PreviewState, FormData>(previewImport, {});
  const [commit, commitAction, committing] = useActionState<CommitState, FormData>(commitImport, {});
  const [, startTransition] = useTransition();

  function submitImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const data = new FormData(event.currentTarget); // the mapping selects
    data.set("file", file);
    startTransition(() => commitAction(data));
  }

  const detected = preview.preview?.mapping ?? {};
  const headers = preview.preview?.headers ?? [];

  if (commit.result) {
    const r = commit.result;
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold">Import complete</h2>
        <ul className="mt-3 space-y-1 text-sm">
          <li>{r.properties} new properties</li>
          <li>{r.units} new units</li>
          <li>{r.tenants} new tenants</li>
          <li>{r.owners} new owners</li>
          <li className="font-medium">{r.renewals} leases now tracked for renewal</li>
          {r.skipped > 0 && <li className="text-muted">{r.skipped} rows skipped (no property name)</li>}
        </ul>
        <div className="mt-4 flex gap-2">
          <a className="btn btn-accent" href="/renewals">See renewals</a>
          <a className="btn" href="/properties">See properties</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={previewAction} className="card space-y-3 p-5">
        <div>
          <label className="label" htmlFor="file">Spreadsheet (.xlsx or .csv)</label>
          <input
            accept=".xlsx,.csv,.txt"
            className="input"
            id="file"
            name="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
            type="file"
          />
        </div>
        {preview.error && (
          <p className="rounded-md bg-crimson-tint px-3 py-2 text-sm text-accent-strong">{preview.error}</p>
        )}
        <button className="btn btn-accent" disabled={previewing} type="submit">
          {previewing ? "Reading…" : "Check the file"}
        </button>
        <p className="text-xs text-muted">Nothing is saved at this step.</p>
      </form>

      {preview.preview && (
        <form className="card space-y-5 p-5" onSubmit={submitImport}>
          {file && (
            <p className="text-xs text-muted">
              Importing from <span className="font-medium text-ink">{file.name}</span>
            </p>
          )}

          <div>
            <h2 className="text-sm font-semibold">
              Found {preview.preview.totalRows} rows, {preview.preview.usableRows} usable
            </h2>
            <p className="mt-1 text-sm text-muted">
              {preview.preview.leaseDatesFound} have a readable lease end date — those are the ones
              that get renewal milestones.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Column mapping — correct anything wrong
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELD_ORDER.map((key) => {
                const spec = FIELDS[key];
                return (
                  <label className="flex items-center gap-2 text-sm" key={key}>
                    <span className="w-40 shrink-0 text-muted">
                      {spec.label}
                      {spec.required && <span className="text-accent"> *</span>}
                    </span>
                    <select className="input" defaultValue={detected[key] ?? ""} name={`map_${key}`}>
                      <option value="">— not in sheet —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>

          {preview.preview.sample.length > 0 && (
            <div className="overflow-x-auto">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                First few rows, as they'll import
              </h3>
              <table className="w-full border-collapse">
                <thead className="border-b border-line">
                  <tr><th className="th">Property</th><th className="th">Unit</th><th className="th">Tenant</th><th className="th">Lease end</th><th className="th">Rent</th></tr>
                </thead>
                <tbody>
                  {preview.preview.sample.map((s, i) => (
                    <tr className="border-b border-line last:border-0" key={i}>
                      <td className="td">{s.property}</td>
                      <td className="td">{s.unit}</td>
                      <td className="td">{s.tenant}</td>
                      <td className={`td ${s.leaseEnd === "—" ? "text-accent-strong" : ""}`}>{s.leaseEnd}</td>
                      <td className="td">{s.rent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">
                If “Lease end” is blank here, pick the right column above — otherwise those rows
                import with no renewal tracking.
              </p>
            </div>
          )}

          {preview.preview.issues.length > 0 && (
            <details className="rounded-md bg-ember-tint px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-amber-900">
                {preview.preview.issues.length} rows need attention
              </summary>
              <ul className="mt-2 space-y-0.5 text-sm text-amber-900">
                {preview.preview.issues.map((issue, i) => (
                  <li key={i}>Row {issue.row}: {issue.problem}</li>
                ))}
              </ul>
            </details>
          )}

          {commit.error && (
            <p className="rounded-md bg-crimson-tint px-3 py-2 text-sm text-accent-strong">{commit.error}</p>
          )}

          <div className="flex items-center gap-3">
            <button className="btn btn-accent" disabled={committing} type="submit">
              {committing ? "Importing…" : `Import ${preview.preview.usableRows} rows`}
            </button>
            <span className="text-xs text-muted">
              Re-importing an updated sheet edits existing records instead of duplicating them.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
