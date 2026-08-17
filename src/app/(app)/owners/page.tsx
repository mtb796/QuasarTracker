import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q = "" } = await searchParams;

  const owners = await db.owner.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : undefined,
    include: { properties: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
    take: 500,
  });

  return (
    <div>
      <PageHeader title="Owners" subtitle={`${owners.length} ${owners.length === 1 ? "owner" : "owners"}`} />

      <div className="mb-4">
        <SearchBar placeholder="Search name, company or email…" />
      </div>

      {owners.length === 0 ? (
        <Empty>
          No owners match. Sync from{" "}
          <Link className="text-accent hover:underline" href="/settings">
            Settings
          </Link>{" "}
          to pull them from AppFolio.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {owners.map((owner) => (
            <li key={owner.id} id={owner.id} className="card p-4 target:border-amber-400">
              <div className="font-medium">{owner.name}</div>
              {owner.company && <div className="text-sm text-muted">{owner.company}</div>}

              <div className="mt-2 space-y-0.5 text-sm text-muted">
                {owner.phone && (
                  <div>
                    <a className="hover:text-ink" href={`tel:${owner.phone}`}>
                      {owner.phone}
                    </a>
                  </div>
                )}
                {owner.email && (
                  <div>
                    <a className="hover:text-ink" href={`mailto:${owner.email}`}>
                      {owner.email}
                    </a>
                  </div>
                )}
              </div>

              {owner.properties.length > 0 && (
                <div className="mt-3 border-t border-line pt-2">
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                    Properties ({owner.properties.length})
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {owner.properties.map((property) => (
                      <Link
                        key={property.id}
                        className="text-accent hover:underline"
                        href={`/properties/${property.id}`}
                      >
                        {property.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
