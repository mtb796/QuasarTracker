import { PrismaClient } from "@prisma/client";

// Next's dev server hot-reloads modules, which would otherwise open a new pool
// on every edit until SQLite runs out of connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

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
