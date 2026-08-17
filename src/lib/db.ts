import { PrismaClient } from "@prisma/client";

/**
 * Resolves the Postgres connection string.
 *
 * Vercel's own Postgres integration does NOT set `DATABASE_URL` — it injects
 * `POSTGRES_PRISMA_URL` and `POSTGRES_URL`. Adding a database from the Storage
 * tab and then seeing "can't reach the database" is exactly that mismatch, so
 * every common name is accepted here rather than making someone discover it.
 *
 * Order matters: the Prisma-specific URL comes first because it already carries
 * the pooling parameters Prisma wants, then the pooled URL, then the direct one.
 */
export function resolveDatabaseUrl(): { url: string | null; source: string | null } {
  const candidates = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "DATABASE_POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
  ] as const;

  for (const name of candidates) {
    const value = process.env[name]?.trim();
    if (value) return { url: value, source: name };
  }
  return { url: null, source: null };
}

// Next's dev server hot-reloads modules, which would otherwise open a new
// connection pool on every edit until Postgres refuses more.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const { url } = resolveDatabaseUrl();
  // Passing the URL explicitly is what lets the fallbacks above work at all —
  // Prisma would otherwise only ever read DATABASE_URL.
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Rows mirrored from AppFolio keep their original JSON in a `raw` string. */
export function parseRaw(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
