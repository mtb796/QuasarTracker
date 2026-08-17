/**
 * Account management from the command line — no invite flow to build or secure.
 *
 *   npx tsx scripts/user.ts add "Malik Banks" malik@example.com "a-good-password"
 *   npx tsx scripts/user.ts password malik@example.com "a-new-password"
 *   npx tsx scripts/user.ts list
 *   npx tsx scripts/user.ts remove malik@example.com
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (p: string, s: string, l: number) => Promise<Buffer>;
const db = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

function requirePassword(password: string | undefined): string {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return password;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "add": {
      const [name, email, password] = rest;
      if (!name || !email) throw new Error('Usage: user.ts add "Full Name" email@example.com password');
      const user = await db.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash: await hashPassword(requirePassword(password)),
        },
      });
      console.log(`Added ${user.name} <${user.email}>`);
      break;
    }

    case "password": {
      const [email, password] = rest;
      if (!email) throw new Error("Usage: user.ts password email@example.com new-password");
      await db.user.update({
        where: { email: email.toLowerCase() },
        data: { passwordHash: await hashPassword(requirePassword(password)) },
      });
      console.log(`Password updated for ${email}`);
      break;
    }

    case "list": {
      const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
      if (users.length === 0) console.log("No accounts yet.");
      for (const user of users) console.log(`${user.name} <${user.email}>`);
      break;
    }

    case "remove": {
      const [email] = rest;
      if (!email) throw new Error("Usage: user.ts remove email@example.com");
      await db.user.delete({ where: { email: email.toLowerCase() } });
      console.log(`Removed ${email}`);
      break;
    }

    default:
      console.log("Commands: add | password | list | remove");
      process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
