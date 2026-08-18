/**
 * Creates two local development accounts. No sample properties — real data
 * comes in through the Import page.
 *
 * On a deployed instance you don't need this at all: /setup creates the tables
 * and your first account in the browser.
 *
 *   npx tsx prisma/seed.ts            # accounts only
 *   npx tsx prisma/seed.ts --clear    # wipe imported data, keep accounts
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { db } from "../src/lib/db";

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
  console.log("Property data cleared. Accounts kept.");
}

async function main(): Promise<void> {
  if (process.argv.includes("--clear")) {
    await clearDemo();
    return;
  }

  const password = process.env.SEED_PASSWORD || "changeme123";

  await Promise.all([
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

  console.log("Created accounts. Load properties via the Import page — there is no sample data.");

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
