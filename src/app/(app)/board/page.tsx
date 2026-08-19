import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SubsidyBoard, type BoardCard } from "@/components/SubsidyBoard";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  await requireUser();

  const tenants = await db.tenant.findMany({
    where: { status: { in: ["current", "future"] } },
    include: { unit: { include: { property: true } }, property: true },
    orderBy: [{ leaseEnd: "asc" }, { name: "asc" }],
    take: 500,
  });

  const cards: BoardCard[] = tenants.map((tenant) => {
    const property = tenant.unit?.property ?? tenant.property ?? null;
    return {
      id: tenant.id,
      tenant: tenant.name,
      property: property?.name ?? "Unassigned",
      unitId: tenant.unit?.id ?? null,
      unitName: tenant.unit?.name ?? null,
      rent: tenant.rent,
      leaseEnd: tenant.leaseEnd ? tenant.leaseEnd.toISOString() : null,
      subsidized: tenant.subsidized,
    };
  });

  return (
    <div>
      <PageHeader
        title="Sort by programme"
        subtitle="Drag a card between lanes. Subsidised increases are capped by the programme, market ones aren't — so this decides how each renewal gets priced."
      />
      <SubsidyBoard cards={cards} />
    </div>
  );
}
