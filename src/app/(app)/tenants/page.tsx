import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { Empty, PageHeader, SubsidyPill, TenantStatusPill, formatDate, formatMoney } from "@/components/ui";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "current", label: "Current" },
  { key: "future", label: "Future" },
  { key: "past", label: "Past" },
  { key: "", label: "All" },
];

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireUser();
  const { q = "", status = "current" } = await searchParams;

  const tenants = await db.tenant.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    include: {
      unit: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
    take: 500,
  });

  return (
    <div>
      <PageHeader
        title="Tenants"
        subtitle={`${tenants.length} ${tenants.length === 1 ? "tenant" : "tenants"}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search name, email or phone…" />
        <div className="flex gap-1">
          {FILTERS.map((filter) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (filter.key) params.set("status", filter.key);
            else params.set("status", "");
            return (
              <Link
                key={filter.label}
                className={`rounded-md px-2.5 py-1.5 text-sm ${
                  status === filter.key
                    ? "bg-ink text-white"
                    : "text-muted hover:bg-gray-100"
                }`}
                href={`/tenants?${params}`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      {tenants.length === 0 ? (
        <Empty>
          No tenants match. Sync from{" "}
          <Link className="text-accent hover:underline" href="/settings">
            Settings
          </Link>{" "}
          if you haven&apos;t pulled from AppFolio yet.
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-line">
              <tr>
                <th className="th">Name</th>
                <th className="th">Status</th>
                <th className="th">Unit</th>
                <th className="th">Contact</th>
                <th className="th">Lease</th>
                <th className="th">Rent</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  id={tenant.id}
                  className="border-b border-line last:border-0 target:bg-amber-50 hover:bg-gray-50"
                >
                  <td className="td font-medium">
                    {tenant.name}
                    <div className="mt-0.5"><SubsidyPill value={tenant.subsidized} /></div>
                  </td>
                  <td className="td">
                    <TenantStatusPill value={tenant.status} />
                  </td>
                  <td className="td">
                    {tenant.unit ? (
                      <Link className="text-accent hover:underline" href={`/units/${tenant.unit.id}`}>
                        {tenant.property?.name ? `${tenant.property.name} · ` : ""}
                        {tenant.unit.name}
                      </Link>
                    ) : tenant.property ? (
                      <Link
                        className="text-accent hover:underline"
                        href={`/properties/${tenant.property.id}`}
                      >
                        {tenant.property.name}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="td text-muted">
                    {tenant.phone && (
                      <div>
                        <a className="hover:text-ink" href={`tel:${tenant.phone}`}>
                          {tenant.phone}
                        </a>
                      </div>
                    )}
                    {tenant.email && (
                      <div>
                        <a className="hover:text-ink" href={`mailto:${tenant.email}`}>
                          {tenant.email}
                        </a>
                      </div>
                    )}
                    {!tenant.phone && !tenant.email && "—"}
                  </td>
                  <td className="td whitespace-nowrap text-muted">
                    {formatDate(tenant.leaseStart)} – {formatDate(tenant.leaseEnd)}
                  </td>
                  <td className="td tabular-nums">{formatMoney(tenant.rent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
