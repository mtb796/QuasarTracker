import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, parseRaw } from "@/lib/db";
import { HandoffComposer, HandoffList } from "@/components/Handoffs";
import { NoteComposer, NoteFeed } from "@/components/Notes";
import { WorkStatusForm } from "@/components/WorkStatusForm";
import { RawPanel } from "@/components/RawPanel";
import {
  Crumbs,
  Field,
  OccupancyPill,
  PageHeader,
  TenantStatusPill,
  WorkStatusPill,
  formatDate,
  formatMoney,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [unit, users] = await Promise.all([
    db.unit.findUnique({
      where: { id },
      include: {
        property: true,
        tenants: { orderBy: { leaseEnd: "desc" } },
        notes: {
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
          include: { author: true, property: true, unit: { include: { property: true } } },
        },
        handoffs: {
          orderBy: [{ status: "asc" }, { dueDate: "asc" }],
          include: { creator: true, assignee: true, property: true, unit: true },
        },
      },
    }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!unit) notFound();

  const returnTo = `/units/${unit.id}`;

  return (
    <div>
      <Crumbs
        items={[
          { href: "/properties", label: "Properties" },
          { href: `/properties/${unit.property.id}`, label: unit.property.name },
          { label: `Unit ${unit.name}` },
        ]}
      />
      <PageHeader title={`Unit ${unit.name}`} subtitle={unit.property.name} />

      <div className="card mb-6 p-4">
        <dl className="grid gap-4 sm:grid-cols-5">
          <Field label="Status">
            <OccupancyPill value={unit.occupancy} />
          </Field>
          <Field label="Bedrooms">{unit.bedrooms}</Field>
          <Field label="Bathrooms">{unit.bathrooms}</Field>
          <Field label="Square feet">{unit.squareFeet}</Field>
          <Field label="Market rent">{formatMoney(unit.marketRent)}</Field>
        </dl>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
          <WorkStatusForm value={unit.workStatus} returnTo={returnTo} unitId={unit.id} />
          <WorkStatusPill value={unit.workStatus} />
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Tenants</h2>
        {unit.tenants.length === 0 ? (
          <p className="text-sm text-muted">No tenants on record for this unit.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Status</th>
                  <th className="th">Contact</th>
                  <th className="th">Lease</th>
                  <th className="th">Rent</th>
                </tr>
              </thead>
              <tbody>
                {unit.tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-line last:border-0">
                    <td className="td font-medium">
                      <Link className="text-accent hover:underline" href={`/tenants#${tenant.id}`}>
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="td">
                      <TenantStatusPill value={tenant.status} />
                    </td>
                    <td className="td text-muted">
                      {tenant.phone && <div>{tenant.phone}</div>}
                      {tenant.email && <div>{tenant.email}</div>}
                      {!tenant.phone && !tenant.email && "—"}
                    </td>
                    <td className="td text-muted">
                      {formatDate(tenant.leaseStart)} – {formatDate(tenant.leaseEnd)}
                    </td>
                    <td className="td tabular-nums">{formatMoney(tenant.rent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Updates</h2>
          <div className="mb-3">
            <NoteComposer
              target={{ unitId: unit.id, propertyId: unit.propertyId }}
              returnTo={returnTo}
              placeholder={`Update on unit ${unit.name}…`}
            />
          </div>
          <NoteFeed notes={unit.notes} currentUserId={user.id} returnTo={returnTo} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Tasks</h2>
          <div className="mb-3">
            <HandoffComposer
              users={users}
              currentUserId={user.id}
              returnTo={returnTo}
              propertyId={unit.propertyId}
              unitId={unit.id}
            />
          </div>
          <HandoffList tasks={unit.handoffs} returnTo={returnTo} />
        </section>
      </div>

      <RawPanel title="All AppFolio fields for this unit" data={parseRaw(unit.raw)} />
    </div>
  );
}
