import "server-only";

import { db } from "./db";
import { AppFolioError, type AppFolioRow, date, fetchReport, num, pick, str } from "./appfolio";
import { generateRenewals } from "./renewals";

/**
 * Pulls AppFolio reports into the local mirror.
 *
 * Sync only ever writes mirrored columns. Notes, handoffs and `workStatus` are
 * ours and are never touched here, so running a sync can't wipe out anything
 * you and your coworker wrote.
 *
 * Reports are pulled in dependency order (owners -> properties -> units ->
 * tenants) so foreign keys resolve. A failure in one report is recorded and the
 * remaining reports still run — a partial refresh beats none.
 */

/**
 * Report names, overridable per-account via env. AppFolio account
 * configurations differ; if a name 404s, check /settings/diagnostics.
 */
const REPORTS = {
  owner: process.env.APPFOLIO_REPORT_OWNER || "owner_directory",
  property: process.env.APPFOLIO_REPORT_PROPERTY || "property_directory",
  unit: process.env.APPFOLIO_REPORT_UNIT || "unit_directory",
  tenant: process.env.APPFOLIO_REPORT_TENANT || "tenant_directory",
} as const;

export type SyncReportResult = {
  report: string;
  status: "ok" | "error";
  fetched: number;
  written: number;
  error?: string;
};

export type SyncResult = {
  startedAt: Date;
  finishedAt: Date;
  reports: SyncReportResult[];
  renewals: { renewalsCreated: number; stepsCreated: number };
};

export async function syncAll(): Promise<SyncResult> {
  const startedAt = new Date();
  const reports: SyncReportResult[] = [
    await runReport(REPORTS.owner, syncOwners),
    await runReport(REPORTS.property, syncProperties),
    await runReport(REPORTS.unit, syncUnits),
    await runReport(REPORTS.tenant, syncTenants),
  ];

  // Fresh lease dates mean new renewal milestones. Generating here is what makes
  // a newly-synced lease show up on the renewals board without anyone asking.
  const renewals = await generateRenewals();

  return { startedAt, finishedAt: new Date(), reports, renewals };
}

/** Wraps one report pull: records a SyncRun row and never throws. */
async function runReport(
  report: string,
  handler: (rows: AppFolioRow[]) => Promise<number>,
): Promise<SyncReportResult> {
  const run = await db.syncRun.create({ data: { report } });
  try {
    const rows = await fetchReport(report);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const written = await handler(rows);

    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: "ok",
        rowsFetched: rows.length,
        rowsWritten: written,
        columns: JSON.stringify(columns),
        finishedAt: new Date(),
      },
    });
    return { report, status: "ok", fetched: rows.length, written };
  } catch (error) {
    const message =
      error instanceof AppFolioError
        ? [error.message, error.detail].filter(Boolean).join(" — ")
        : error instanceof Error
          ? error.message
          : String(error);

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "error", error: message, finishedAt: new Date() },
    });
    return { report, status: "error", fetched: 0, written: 0, error: message };
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

async function syncOwners(rows: AppFolioRow[]): Promise<number> {
  let written = 0;
  for (const row of rows) {
    const appfolioId = str(pick(row, "OwnerId", "owner_id", "Id"));
    const name = str(pick(row, "OwnerName", "owner_name", "Name", "Owner"));
    if (!appfolioId || !name) continue;

    const data = {
      name,
      email: str(pick(row, "Email", "OwnerEmail", "email_address")),
      phone: str(pick(row, "Phone", "PhoneNumber", "OwnerPhone", "primary_phone")),
      company: str(pick(row, "Company", "CompanyName", "business_name")),
      raw: JSON.stringify(row),
      syncedAt: new Date(),
    };

    await db.owner.upsert({
      where: { appfolioId },
      create: { appfolioId, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
}

async function syncProperties(rows: AppFolioRow[]): Promise<number> {
  const ownerIdByAppfolioId = await keyMap(db.owner);
  let written = 0;

  for (const row of rows) {
    const appfolioId = str(pick(row, "PropertyId", "property_id", "Id"));
    const name = str(pick(row, "PropertyName", "property_name", "Name", "Property"));
    if (!appfolioId || !name) continue;

    const ownerKey = str(pick(row, "OwnerId", "owner_id"));

    const data = {
      name,
      address1: str(pick(row, "Address1", "PropertyAddress", "Address", "street_address")),
      city: str(pick(row, "City", "PropertyCity")),
      state: str(pick(row, "State", "PropertyState")),
      zip: str(pick(row, "Zip", "PostalCode", "ZipCode")),
      propertyType: str(pick(row, "PropertyType", "property_type", "Type")),
      ownerId: ownerKey ? (ownerIdByAppfolioId.get(ownerKey) ?? null) : null,
      raw: JSON.stringify(row),
      syncedAt: new Date(),
    };

    await db.property.upsert({
      where: { appfolioId },
      create: { appfolioId, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
}

async function syncUnits(rows: AppFolioRow[]): Promise<number> {
  const propertyIdByAppfolioId = await keyMap(db.property);
  let written = 0;

  for (const row of rows) {
    const appfolioId = str(pick(row, "UnitId", "unit_id", "Id"));
    const propertyKey = str(pick(row, "PropertyId", "property_id"));
    if (!appfolioId || !propertyKey) continue;

    const propertyId = propertyIdByAppfolioId.get(propertyKey);
    if (!propertyId) continue; // property report didn't include it; skip rather than orphan

    const data = {
      name: str(pick(row, "UnitName", "unit_name", "Unit", "Name")) ?? "Unit",
      propertyId,
      bedrooms: num(pick(row, "Bedrooms", "Beds", "bedroom_count")),
      bathrooms: num(pick(row, "Bathrooms", "Baths", "bathroom_count")),
      squareFeet: toInt(num(pick(row, "SquareFeet", "SqFt", "square_footage"))),
      marketRent: num(pick(row, "MarketRent", "market_rent", "Rent", "RentAmount")),
      occupancy: normalizeOccupancy(row),
      raw: JSON.stringify(row),
      syncedAt: new Date(),
    };

    await db.unit.upsert({
      where: { appfolioId },
      create: { appfolioId, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
}

async function syncTenants(rows: AppFolioRow[]): Promise<number> {
  const [unitIdByAppfolioId, propertyIdByAppfolioId] = await Promise.all([
    keyMap(db.unit),
    keyMap(db.property),
  ]);
  let written = 0;

  for (const row of rows) {
    const appfolioId = str(pick(row, "TenantId", "tenant_id", "OccupancyId", "Id"));
    const name = str(pick(row, "TenantName", "tenant_name", "Name", "Tenant"));
    if (!appfolioId || !name) continue;

    const unitKey = str(pick(row, "UnitId", "unit_id"));
    const propertyKey = str(pick(row, "PropertyId", "property_id"));

    const data = {
      name,
      email: str(pick(row, "Email", "TenantEmail", "email_address")),
      phone: str(pick(row, "Phone", "PhoneNumber", "TenantPhone", "primary_phone")),
      unitId: unitKey ? (unitIdByAppfolioId.get(unitKey) ?? null) : null,
      propertyId: propertyKey ? (propertyIdByAppfolioId.get(propertyKey) ?? null) : null,
      leaseStart: date(pick(row, "LeaseFrom", "LeaseStart", "lease_start_date", "MoveIn")),
      leaseEnd: date(pick(row, "LeaseTo", "LeaseEnd", "lease_end_date", "MoveOut")),
      rent: num(pick(row, "Rent", "RentAmount", "rent_amount", "MonthlyRent")),
      status: normalizeTenantStatus(row),
      raw: JSON.stringify(row),
      syncedAt: new Date(),
    };

    await db.tenant.upsert({
      where: { appfolioId },
      create: { appfolioId, ...data },
      update: data,
    });
    written += 1;
  }
  return written;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** appfolioId -> local id, for resolving foreign keys during sync. */
async function keyMap(model: {
  findMany: (args: {
    where: { appfolioId: { not: null } };
    select: { id: true; appfolioId: true };
  }) => Promise<{ id: string; appfolioId: string | null }[]>;
}): Promise<Map<string, string>> {
  const rows = await model.findMany({
    where: { appfolioId: { not: null } },
    select: { id: true, appfolioId: true },
  });
  return new Map(rows.flatMap((r) => (r.appfolioId ? [[r.appfolioId, r.id] as const] : [])));
}

function toInt(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

function normalizeOccupancy(row: AppFolioRow): string {
  const raw = str(pick(row, "UnitStatus", "Status", "OccupancyStatus", "unit_status"));
  if (raw) {
    const text = raw.toLowerCase();
    if (text.includes("notice")) return "notice";
    if (text.includes("vacant") || text.includes("available")) return "vacant";
    if (text.includes("occupied") || text.includes("current")) return "occupied";
  }
  // Fall back to inference: a move-out date in the future means notice given,
  // and a named tenant means occupied.
  const moveOut = date(pick(row, "MoveOut", "move_out_date", "LeaseTo"));
  if (moveOut && moveOut.getTime() > Date.now()) return "notice";
  if (str(pick(row, "TenantName", "tenant_name", "Tenant"))) return "occupied";
  return "unknown";
}

function normalizeTenantStatus(row: AppFolioRow): string {
  const raw = str(pick(row, "Status", "TenantStatus", "tenant_status"));
  if (raw) {
    const text = raw.toLowerCase();
    if (text.includes("current") || text.includes("active")) return "current";
    if (text.includes("past") || text.includes("former") || text.includes("evicted")) return "past";
    if (text.includes("future") || text.includes("upcoming")) return "future";
  }
  const start = date(pick(row, "LeaseFrom", "LeaseStart", "MoveIn"));
  const end = date(pick(row, "LeaseTo", "LeaseEnd", "MoveOut"));
  const now = Date.now();
  if (start && start.getTime() > now) return "future";
  if (end && end.getTime() < now) return "past";
  if (start) return "current";
  return "unknown";
}
