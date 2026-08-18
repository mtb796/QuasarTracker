"use client";

import { useActionState, useState, useTransition } from "react";
import { FIELDS, FIELD_ORDER } from "@/lib/import-fields";
import { commitImport, previewImport, type CommitState, type PreviewState } from "./actions";

/**
 * Upload, check, then import.
 *
 * Both steps post the File from React state rather than relying on the file
 * input's contents: React re-creates the uncontrolled input when an action
 * re-renders the page, silently emptying it.
 *
 * The sheet selector lives in the same form as everything else, so choosing a
 * different sheet always re-reads and re-detects the mapping. Getting that
 * wrong once meant previewing one sheet and importing another with the first
 * one's column names — which produced records with no lease dates at all.
 */
export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState("");
  const [preview, previewAction, previewing] = useActionState<PreviewState, FormData>(previewImport, {});
  const [commit, commitAction, committing] = useActionState<CommitState, FormData>(commitImport, {});
  const [, startTransition] = useTransition();

  function run(action: (data: FormData) => void, form: HTMLFormElement, sheetName: string) {
    const data = new FormData(form);
    if (file) data.set("file", file);
    data.set("sheetName", sheetName);
    startTransition(() => action(data));
  }

  if (commit.result) {
    const r = commit.result;
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold">Import complete</h2>
        <ul className="mt-3 space-y-1 text-sm">
          <li>{r.properties} new properties</li>
          <li>{r.units} new units</li>
          <li>{r.tenants} new tenants</li>
          {r.owners > 0 && <li>{r.owners} new owners</li>}
          <li className="font-medium">{r.renewals} leases now tracked for renewal</li>
          {r.plansApplied > 0 && <li>{r.plansApplied} carried a suggested rent or status note</li>}
          {r.skipped > 0 && <li className="text-muted">{r.skipped} rows skipped (month dividers or no property)</li>}
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
      <form
        className="card space-y-3 p-5"
        onSubmit={(e) => { e.preventDefault(); run(previewAction, e.currentTarget, sheet); }}
      >
        <div>
          <label className="label" htmlFor="file">Spreadsheet (.xlsx or .csv)</label>
          <input
            accept=".xlsx,.csv,.txt"
            className="input"
            id="file"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSheet(""); }}
            required={!file}
            type="file"
          />
          {file && <p className="mt-1 text-xs text-muted">Using {file.name}</p>}
        </div>

        {preview.sheetNames && preview.sheetNames.length > 1 && (
          <div>
            <label className="label" htmlFor="sheetPick">
              Sheet ({preview.sheetNames.length} in this workbook)
            </label>
            <select
              className="input"
              id="sheetPick"
              onChange={(e) => setSheet(e.target.value)}
              value={sheet || preview.sheetName || ""}
            >
              {preview.sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted">Changing this re-reads the file.</p>
          </div>
        )}

        {preview.error && (
          <p className="rounded-md bg-crimson-tint px-3 py-2 text-sm text-accent-strong">{preview.error}</p>
        )}

        <button className="btn btn-accent" disabled={previewing || !file} type="submit">
          {previewing ? "Reading…" : preview.preview ? "Re-read" : "Check the file"}
        </button>
        <p className="text-xs text-muted">Nothing is saved at this step.</p>
      </form>

      {preview.preview && (
        <form
          className="card space-y-5 p-5"
          onSubmit={(e) => { e.preventDefault(); run(commitAction, e.currentTarget, preview.sheetName ?? ""); }}
        >
          <div>
            <h2 className="text-sm font-semibold">
              Sheet “{preview.sheetName}” — {preview.preview.totalRows} rows, {preview.preview.usableRows} usable
            </h2>
            <p className={`mt-1 text-sm ${preview.preview.leaseDatesFound === 0 ? "font-medium text-accent-strong" : "text-muted"}`}>
              {preview.preview.leaseDatesFound} have a readable lease end date — those are the ones
              that get renewal milestones.
              {preview.preview.leaseDatesFound === 0 && " Fix the lease-end column below before importing."}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Column mapping — correct anything wrong
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELD_ORDER.map((key) => (
                // Keyed by sheet: `defaultValue` only applies on mount, so
                // without this the selects keep the previous sheet's choice
                // (or fall back to "not in sheet") after re-reading.
                <label className="flex items-center gap-2 text-sm" key={`${preview.sheetName}-${key}`}>
                  <span className="w-40 shrink-0 text-muted">
                    {FIELDS[key].label}
                    {FIELDS[key].required && <span className="text-accent"> *</span>}
                  </span>
                  <select className="input" defaultValue={preview.preview!.mapping[key] ?? ""} name={`map_${key}`}>
                    <option value="">— not in sheet —</option>
                    {preview.preview!.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {preview.preview.sample.length > 0 && (
            <div className="overflow-x-auto">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                First few rows, as they&apos;ll import
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
                      <td className={`td ${s.leaseEnd === "—" ? "font-medium text-accent-strong" : ""}`}>{s.leaseEnd}</td>
                      <td className="td">{s.rent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

          {!preview.preview.mapping.leaseEnd && (
            <label className="flex items-start gap-2 rounded-md bg-ember-tint px-3 py-2 text-sm text-amber-900">
              <input className="mt-0.5" name="allowNoDates" type="checkbox" value="true" />
              <span>
                No lease-end column is selected, so <strong>nothing will be tracked for renewal</strong>.
                Tick this only if that&apos;s deliberate.
              </span>
            </label>
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
