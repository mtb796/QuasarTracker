import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireUser();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Import from a spreadsheet"
        subtitle="Load properties, units, tenants and lease dates from a file — no AppFolio API needed."
      />

      <div className="card mb-5 p-4">
        <h2 className="mb-1 text-sm font-semibold">What the sheet needs</h2>
        <p className="text-sm text-muted">
          One row per unit. Column names don&apos;t matter — they get matched automatically and you
          can correct any guess before anything is saved. The two that matter most:
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <strong>Property</strong> — required, otherwise the row is skipped.
          </li>
          <li>
            <strong>Lease end / renewal date</strong> — this is what drives the 150/120/100/90
            milestones. Without it a unit imports fine but is never tracked for renewal.
          </li>
        </ul>
        <p className="mt-2 text-sm text-muted">
          Everything else — unit, tenant, phone, email, rent, market rent, owner, address, beds and
          baths — is used when present and skipped when absent.
        </p>
      </div>

      <ImportForm />
    </div>
  );
}
