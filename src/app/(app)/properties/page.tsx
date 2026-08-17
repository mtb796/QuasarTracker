import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Empty, OccupancyPill, PageHeader, WorkStatusPill } from "@/components/ui";
import { SearchBar } from "@/components/SearchBar";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "All" },
  { key: "vacant", label: "Vacant" },
  { key: "notice", label: "On notice" },
  { key: "occupied", label: "Occupied" },
];

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; occupancy?: string }>;
}) {
  await requireUser();
  const { q = "", occupancy = "" } = await searchParams;

  const properties = await db.property.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { address1: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      owner: { select: { id: true, name: true } },
      units: { select: { id: true, occupancy: true } },
    },
    orderBy: { name: "asc" },
    take: 300,
  });

  // Occupancy filters describe units, so keep properties that have a matching unit.
  const visible = occupancy
    ? properties.filter((p) => p.units.some((u) => u.occupancy === occupancy))
    : properties;

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={`${visible.length} ${visible.length === 1 ? "property" : "properties"}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search name, address or city…" />
        <div className="flex gap-1">
          {FILTERS.map((filter) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (filter.key) params.set("occupancy", filter.key);
            const active = occupancy === filter.key;
            return (
              <Link
                key={filter.label}
                className={`rounded-md px-2.5 py-1.5 text-sm ${
                  active ? "bg-ink text-white" : "text-muted hover:bg-gray-100"
                }`}
                href={`/properties${params.toString() ? `?${params}` : ""}`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty>
          {q || occupancy ? (
            <>No properties match that filter.</>
          ) : (
            <>
              No properties yet. Run a sync from{" "}
              <Link className="text-accent hover:underline" href="/settings">
                Settings
              </Link>{" "}
              to pull them from AppFolio.
            </>
          )}
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-line">
              <tr>
                <th className="th">Property</th>
                <th className="th">Address</th>
                <th className="th">Owner</th>
                <th className="th">Units</th>
                <th className="th">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((property) => {
                const total = property.units.length;
                const occupied = property.units.filter((u) => u.occupancy === "occupied").length;
                const vacantCount = property.units.filter((u) => u.occupancy === "vacant").length;

                return (
                  <tr key={property.id} className="border-b border-line last:border-0 hover:bg-gray-50">
                    <td className="td">
                      <Link
                        className="font-medium text-accent hover:underline"
                        href={`/properties/${property.id}`}
                      >
                        {property.name}
                      </Link>
                      <div className="mt-1">
                        <WorkStatusPill value={property.workStatus} />
                      </div>
                    </td>
                    <td className="td text-muted">
                      {[property.address1, property.city, property.state].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td className="td">
                      {property.owner ? (
                        <Link
                          className="text-accent hover:underline"
                          href={`/owners#${property.owner.id}`}
                        >
                          {property.owner.name}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="td tabular-nums">{total}</td>
                    <td className="td">
                      {total === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="tabular-nums text-muted">
                            {occupied}/{total}
                          </span>
                          {vacantCount > 0 && <OccupancyPill value="vacant" />}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
