import { db } from "./db";
import { generateRenewals } from "./renewal-generate";
import { addDays } from "./renewal-rules";

/**
 * A small demo portfolio, so a fresh install isn't a set of empty pages.
 *
 * Lease end dates are spread deliberately across every renewal milestone —
 * beyond the window, 150, 120, 100, the hard 90, and one already expired — so
 * the Renewals board can be judged at a glance.
 *
 * Demo rows carry no `appfolioId`, so a real sync can never collide with them.
 * Remove them later with `npx tsx prisma/seed.ts --clear`.
 */
const PORTFOLIO = [
  { property: "Larchmere Duplex", address: "12480 Larchmere Blvd", city: "Cleveland", unit: "A", tenant: "Danielle Ortiz", phone: "(216) 555-0198", rent: 1250, market: 1400, daysOut: 168, beds: 2, baths: 1 },
  { property: "Shaker Court", address: "3418 Warrensville Center Rd", city: "Shaker Heights", unit: "1", tenant: "Priya Raman", phone: "(216) 555-0114", rent: 1395, market: 1550, daysOut: 147, beds: 2, baths: 1.5 },
  { property: "Shaker Court", address: "3418 Warrensville Center Rd", city: "Shaker Heights", unit: "2", tenant: "Marcus Bell", phone: "(216) 555-0176", rent: 1320, market: 1525, daysOut: 118, beds: 2, baths: 1 },
  { property: "Detroit Ave Fourplex", address: "8802 Detroit Ave", city: "Lakewood", unit: "3", tenant: "Tanya Whitfield", phone: "(216) 555-0133", rent: 1100, market: 1295, daysOut: 97, beds: 1, baths: 1 },
  { property: "Detroit Ave Fourplex", address: "8802 Detroit Ave", city: "Lakewood", unit: "4", tenant: "Andre Kowalski", phone: "(216) 555-0187", rent: 1150, market: 1350, daysOut: 88, beds: 1, baths: 1 },
  { property: "Clifton Blvd Triple", address: "11714 Clifton Blvd", city: "Cleveland", unit: "B", tenant: "Rosa Delgado", phone: "(216) 555-0152", rent: 1425, market: 1650, daysOut: 42, beds: 3, baths: 1.5 },
  { property: "Clifton Blvd Triple", address: "11714 Clifton Blvd", city: "Cleveland", unit: "C", tenant: "Kevin Osei", phone: "(216) 555-0169", rent: 1375, market: 1600, daysOut: -6, beds: 2, baths: 1 },
];

export type DemoResult = { properties: number; units: number; tenants: number; renewals: number };

/** Idempotent by refusing to run twice — does nothing if any property exists. */
export async function seedDemoPortfolio(
  authorId: string,
  assigneeId?: string,
): Promise<DemoResult | null> {
  if ((await db.property.count()) > 0) return null;

  const owner = await db.owner.create({
    data: {
      name: "Marcus Webb",
      company: "Webb Holdings LLC",
      email: "marcus@webbholdings.example",
      phone: "(216) 555-0142",
    },
  });

  const today = new Date();
  const propertyIds = new Map<string, string>();

  for (const entry of PORTFOLIO) {
    let propertyId = propertyIds.get(entry.property);
    if (!propertyId) {
      const property = await db.property.create({
        data: {
          name: entry.property,
          address1: entry.address,
          city: entry.city,
          state: "OH",
          zip: "44120",
          propertyType: "Multi-family",
          ownerId: owner.id,
        },
      });
      propertyId = property.id;
      propertyIds.set(entry.property, propertyId);
    }

    const unit = await db.unit.create({
      data: {
        name: entry.unit,
        propertyId,
        bedrooms: entry.beds,
        bathrooms: entry.baths,
        squareFeet: 700 + entry.beds * 220,
        marketRent: entry.market,
        occupancy: "occupied",
      },
    });

    await db.tenant.create({
      data: {
        name: entry.tenant,
        email: `${entry.tenant.split(" ")[0].toLowerCase()}@example.com`,
        phone: entry.phone,
        unitId: unit.id,
        propertyId,
        leaseStart: addDays(today, entry.daysOut - 365),
        leaseEnd: addDays(today, entry.daysOut),
        rent: entry.rent,
        status: "current",
      },
    });
  }

  // One vacant unit, so the occupancy filters have something to show.
  const larchmere = propertyIds.get("Larchmere Duplex")!;
  const vacant = await db.unit.create({
    data: {
      name: "B",
      propertyId: larchmere,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
      marketRent: 1300,
      occupancy: "vacant",
      workStatus: "Paint + carpet scheduled",
    },
  });
  await db.property.update({
    where: { id: larchmere },
    data: { workStatus: "Turn in progress" },
  });

  await db.note.create({
    data: {
      body: "Owner approved the unit B turn budget at $2,400. Paint starts Monday.",
      authorId,
      propertyId: larchmere,
      pinned: true,
    },
  });

  await db.handoff.create({
    data: {
      title: "Schedule unit B carpet install",
      detail: "Vendor said they have Thursday or Friday open.",
      creatorId: authorId,
      assigneeId: assigneeId ?? authorId,
      propertyId: larchmere,
      unitId: vacant.id,
      dueDate: addDays(today, 3),
    },
  });

  const { renewalsCreated } = await generateRenewals();

  return {
    properties: propertyIds.size,
    units: PORTFOLIO.length + 1,
    tenants: PORTFOLIO.length,
    renewals: renewalsCreated,
  };
}
