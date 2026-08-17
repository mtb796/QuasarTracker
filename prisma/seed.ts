/**
 * Seeds two accounts and a demo portfolio so the app is usable before AppFolio
 * is connected.
 *
 * Lease end dates are deliberately spread across every renewal milestone —
 * beyond the window, 150, 120, 100, the hard 90, and one already expired — so
 * the Renewals board can be judged at a glance.
 *
 * Demo records have no `appfolioId`, so a real sync will not collide with them.
 * Clear them once real data lands:
 *   npx tsx prisma/seed.ts --clear
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { db } from "../src/lib/db";
import { generateRenewals } from "../src/lib/renewal-generate";
import { addDays } from "../src/lib/renewal-rules";

const scrypt = promisify(scryptCb) as (p: string, s: string, l: number) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

async function clearDemo(): Promise<void> {
  await db.renewalStep.deleteMany({});
  await db.renewal.deleteMany({});
  await db.note.deleteMany({});
  await db.handoff.deleteMany({});
  await db.tenant.deleteMany({ where: { appfolioId: null } });
  await db.unit.deleteMany({ where: { appfolioId: null } });
  await db.property.deleteMany({ where: { appfolioId: null } });
  await db.owner.deleteMany({ where: { appfolioId: null } });
  console.log("Demo data cleared. Accounts kept.");
}

/** property, unit, tenant, rent, market, and how many days until the lease ends. */
const PORTFOLIO: {
  property: string;
  address: string;
  city: string;
  unit: string;
  tenant: string;
  phone: string;
  rent: number;
  market: number;
  daysOut: number;
  beds: number;
  baths: number;
}[] = [
  // Comfortably ahead — nothing due yet.
  { property: "Larchmere Duplex", address: "12480 Larchmere Blvd", city: "Cleveland", unit: "A", tenant: "Danielle Ortiz", phone: "(216) 555-0198", rent: 1250, market: 1400, daysOut: 168, beds: 2, baths: 1 },
  // Just entered the 150-day window.
  { property: "Shaker Court", address: "3418 Warrensville Center Rd", city: "Shaker Heights", unit: "1", tenant: "Priya Raman", phone: "(216) 555-0114", rent: 1395, market: 1550, daysOut: 147, beds: 2, baths: 1.5 },
  // In the 120 window — the 150 notice is now overdue.
  { property: "Shaker Court", address: "3418 Warrensville Center Rd", city: "Shaker Heights", unit: "2", tenant: "Marcus Bell", phone: "(216) 555-0176", rent: 1320, market: 1525, daysOut: 118, beds: 2, baths: 1 },
  // In the 100 window.
  { property: "Detroit Ave Fourplex", address: "8802 Detroit Ave", city: "Lakewood", unit: "3", tenant: "Tanya Whitfield", phone: "(216) 555-0133", rent: 1100, market: 1295, daysOut: 97, beds: 1, baths: 1 },
  // Sitting on the hard line.
  { property: "Detroit Ave Fourplex", address: "8802 Detroit Ave", city: "Lakewood", unit: "4", tenant: "Andre Kowalski", phone: "(216) 555-0187", rent: 1150, market: 1350, daysOut: 88, beds: 1, baths: 1 },
  // Well inside the hard line and clearly late.
  { property: "Clifton Blvd Triple", address: "11714 Clifton Blvd", city: "Cleveland", unit: "B", tenant: "Rosa Delgado", phone: "(216) 555-0152", rent: 1425, market: 1650, daysOut: 42, beds: 3, baths: 1.5 },
  // Already ended — the case that must never be silent.
  { property: "Clifton Blvd Triple", address: "11714 Clifton Blvd", city: "Cleveland", unit: "C", tenant: "Kevin Osei", phone: "(216) 555-0169", rent: 1375, market: 1600, daysOut: -6, beds: 2, baths: 1 },
];

async function main(): Promise<void> {
  if (process.argv.includes("--clear")) {
    await clearDemo();
    return;
  }

  const password = process.env.SEED_PASSWORD || "changeme123";

  const [alex, sam] = await Promise.all([
    db.user.upsert({
      where: { email: "you@example.com" },
      update: {},
      create: { email: "you@example.com", name: "You", passwordHash: await hashPassword(password) },
    }),
    db.user.upsert({
      where: { email: "coworker@example.com" },
      update: {},
      create: {
        email: "coworker@example.com",
        name: "Coworker",
        passwordHash: await hashPassword(password),
      },
    }),
  ]);

  if ((await db.property.count()) > 0) {
    console.log("Properties already exist — skipping demo portfolio.");
    await report(password);
    return;
  }

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
  let firstVacantUnitId = "";

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
  firstVacantUnitId = vacant.id;
  await db.property.update({
    where: { id: larchmere },
    data: { workStatus: "Turn in progress" },
  });

  await db.note.create({
    data: {
      body: "Owner approved the unit B turn budget at $2,400. Paint starts Monday.",
      authorId: alex.id,
      propertyId: larchmere,
      pinned: true,
    },
  });

  await db.handoff.create({
    data: {
      title: "Schedule unit B carpet install",
      detail: "Vendor said they have Thursday or Friday open.",
      creatorId: alex.id,
      assigneeId: sam.id,
      propertyId: larchmere,
      unitId: firstVacantUnitId,
      dueDate: addDays(today, 3),
    },
  });

  const { renewalsCreated, stepsCreated } = await generateRenewals();
  console.log(
    `Seeded ${propertyIds.size} properties, ${PORTFOLIO.length + 1} units, ${PORTFOLIO.length} tenants.`,
  );
  console.log(`Renewals: ${renewalsCreated} leases tracked, ${stepsCreated} milestones created.`);

  await report(password);
}

async function report(password: string): Promise<void> {
  console.log("\nAccounts:");
  console.log(`  you@example.com      / ${password}`);
  console.log(`  coworker@example.com / ${password}`);
  console.log("\nChange these before anyone else uses the app (see README).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
