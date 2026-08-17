import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HandoffComposer, HandoffList } from "@/components/Handoffs";
import { NoteComposer, NoteFeed } from "@/components/Notes";
import { WorkStatusForm } from "@/components/WorkStatusForm";
import { Crumbs, Empty, Field, OccupancyPill, PageHeader, WorkStatusPill, formatMoney } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [property, users] = await Promise.all([
    db.property.findUnique({
      where: { id },
      include: {
        owner: true,
        units: { orderBy: { name: "asc" }, include: { tenants: { where: { status: "current" } } } },
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

  if (!property) notFound();

  const returnTo = `/properties/${property.id}`;

  return (
    <div>
      <Crumbs items={[{ href: "/properties", label: "Properties" }, { label: property.name }]} />
      <PageHeader
        title={property.name}
        subtitle={
          [property.address1, property.city, property.state, property.zip]
            .filter(Boolean)
            .join(", ") || undefined
        }
      />

      <div className="card mb-6 p-4">
        <dl className="grid gap-4 sm:grid-cols-4">
          <Field label="Owner">
            {property.owner ? (
              <Link className="text-accent hover:underline" href={`/owners#${property.owner.id}`}>
                {property.owner.name}
              </Link>
            ) : null}
          </Field>
          <Field label="Type">{property.propertyType}</Field>
          <Field label="Units">{property.units.length}</Field>
          <Field label="Our status">
            <WorkStatusPill value={property.workStatus} />
          </Field>
        </dl>
        <div className="mt-4 border-t border-line pt-4">
          <WorkStatusForm value={property.workStatus} returnTo={returnTo} propertyId={property.id} />
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Units</h2>
        {property.units.length === 0 ? (
          <Empty>No units synced for this property.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <th className="th">Unit</th>
                  <th className="th">Status</th>
                  <th className="th">Beds / Baths</th>
                  <th className="th">Market rent</th>
                  <th className="th">Current tenant</th>
                </tr>
              </thead>
              <tbody>
                {property.units.map((unit) => (
                  <tr key={unit.id} className="border-b border-line last:border-0 hover:bg-gray-50">
                    <td className="td">
                      <Link
                        className="font-medium text-accent hover:underline"
                        href={`/units/${unit.id}`}
                      >
                        {unit.name}
                      </Link>
                    </td>
                    <td className="td">
                      <span className="flex flex-wrap gap-1">
                        <OccupancyPill value={unit.occupancy} />
                        <WorkStatusPill value={unit.workStatus} />
                      </span>
                    </td>
                    <td className="td text-muted">
                      {unit.bedrooms ?? "—"} / {unit.bathrooms ?? "—"}
                    </td>
                    <td className="td tabular-nums">{formatMoney(unit.marketRent)}</td>
                    <td className="td">
                      {unit.tenants.length > 0 ? (
                        unit.tenants.map((tenant) => tenant.name).join(", ")
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Updates</h2>
          <div className="mb-3">
            <NoteComposer
              target={{ propertyId: property.id }}
              returnTo={returnTo}
              placeholder={`Update on ${property.name}…`}
            />
          </div>
          <NoteFeed notes={property.notes} currentUserId={user.id} returnTo={returnTo} showContext />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Tasks</h2>
          <div className="mb-3">
            <HandoffComposer
              users={users}
              currentUserId={user.id}
              returnTo={returnTo}
              propertyId={property.id}
            />
          </div>
          <HandoffList tasks={property.handoffs} returnTo={returnTo} showContext />
        </section>
      </div>
    </div>
  );
}
