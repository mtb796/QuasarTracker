import "server-only";

import { db } from "./db";
import { generateRenewals } from "./renewal-generate";
import type { SheetRow } from "./sheet";
import { FIELDS, type FieldKey, type Mapping } from "./import-fields";

export { FIELDS, type FieldKey, type Mapping } from "./import-fields";

/**
 * Turns a spreadsheet of properties into Properties, Units and Tenants — and
 * therefore into renewal milestones, since those are derived from lease end
 * dates.
 *
 * Import is an alternative to the AppFolio sync, not a replacement: imported
 * rows carry no `appfolioId`, and sync only ever upserts rows that have one, so
 * the two can coexist without overwriting each other.
 *
 * Re-importing an updated sheet updates in place rather than duplicating —
 * properties match on name, units on (property, unit name), tenants on (unit,
 * name). That matters because the sheet is going to be re-sent as things change.
 */

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best-guess mapping from sheet headers to our fields. */
export function detectColumns(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<string>();

  for (const [key, spec] of Object.entries(FIELDS) as [FieldKey, { aliases: readonly string[] }][]) {
    // Exact alias match first, then a contains match, so "Lease End Date"
    // still finds leaseEnd without stealing a column an exact match wants.
    const exact = headers.find((h) => !used.has(h) && spec.aliases.includes(norm(h)));
    const loose =
      exact ??
      headers.find((h) => !used.has(h) && spec.aliases.some((a) => norm(h).includes(a)));
    if (loose) {
      mapping[key] = loose;
      used.add(loose);
    }
  }
  return mapping;
}

// --- value coercion -------------------------------------------------------

function text(row: SheetRow, header?: string): string | null {
  if (!header) return null;
  const value = row[header];
  if (value === undefined || value === null) return null;
  const string = String(value).trim();
  return string === "" ? null : string;
}

function money(row: SheetRow, header?: string): number | null {
  const raw = text(row, header);
  if (raw === null) return null;
  const parsed = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Dates arrive three ways: a real Date from Excel (ISO by the time it reaches
 * us), a typed string, or an Excel serial number if the cell was never
 * formatted as a date. The serial case is the one that silently produces
 * nonsense, so it's handled explicitly.
 */
export function parseDate(raw: string | null): Date | null {
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 60000) {
      // Excel's epoch is 1899-12-30 (it thinks 1900 was a leap year).
      return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// --- preview --------------------------------------------------------------

export type RowIssue = { row: number; problem: string };
export type ImportPreview = {
  headers: string[];
  mapping: Mapping;
  totalRows: number;
  usableRows: number;
  issues: RowIssue[];
  sample: { property: string; unit: string; tenant: string; leaseEnd: string; rent: string }[];
  leaseDatesFound: number;
};

export function buildPreview(headers: string[], rows: SheetRow[], mapping: Mapping): ImportPreview {
  const issues: RowIssue[] = [];
  const sample: ImportPreview["sample"] = [];
  let usable = 0;
  let leaseDates = 0;

  rows.forEach((row, index) => {
    const property = text(row, mapping.property);
    const leaseEndRaw = text(row, mapping.leaseEnd);
    const leaseEnd = parseDate(leaseEndRaw);

    if (!property) {
      if (issues.length < 25) issues.push({ row: index + 2, problem: "No property name — row skipped." });
      return;
    }
    usable += 1;
    if (leaseEnd) leaseDates += 1;
    else if (leaseEndRaw && issues.length < 25) {
      issues.push({ row: index + 2, problem: `Couldn't read "${leaseEndRaw}" as a date — no renewal milestones for this row.` });
    }

    if (sample.length < 8) {
      sample.push({
        property,
        unit: text(row, mapping.unit) ?? "—",
        tenant: text(row, mapping.tenant) ?? "—",
        leaseEnd: leaseEnd ? leaseEnd.toISOString().slice(0, 10) : "—",
        rent: money(row, mapping.rent)?.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) ?? "—",
      });
    }
  });

  return { headers, mapping, totalRows: rows.length, usableRows: usable, issues, sample, leaseDatesFound: leaseDates };
}

// --- commit ---------------------------------------------------------------

export type ImportResult = {
  properties: number;
  units: number;
  tenants: number;
  owners: number;
  renewals: number;
  skipped: number;
};

export async function importRows(rows: SheetRow[], mapping: Mapping): Promise<ImportResult> {
  const result: ImportResult = { properties: 0, units: 0, tenants: 0, owners: 0, renewals: 0, skipped: 0 };

  const propertyCache = new Map<string, string>();
  const ownerCache = new Map<string, string>();

  for (const row of rows) {
    const propertyName = text(row, mapping.property);
    if (!propertyName) { result.skipped += 1; continue; }

    // Owner ------------------------------------------------------------
    let ownerId: string | null = null;
    const ownerName = text(row, mapping.owner);
    if (ownerName) {
      ownerId = ownerCache.get(ownerName) ?? null;
      if (!ownerId) {
        const existing = await db.owner.findFirst({ where: { name: ownerName }, select: { id: true } });
        if (existing) ownerId = existing.id;
        else {
          const created = await db.owner.create({
            data: {
              name: ownerName,
              email: text(row, mapping.ownerEmail),
              phone: text(row, mapping.ownerPhone),
            },
            select: { id: true },
          });
          ownerId = created.id;
          result.owners += 1;
        }
        ownerCache.set(ownerName, ownerId);
      }
    }

    // Property ---------------------------------------------------------
    let propertyId = propertyCache.get(propertyName) ?? null;
    const propertyData = {
      address1: text(row, mapping.address1),
      city: text(row, mapping.city),
      state: text(row, mapping.state),
      zip: text(row, mapping.zip),
      ...(ownerId ? { ownerId } : {}),
    };

    if (!propertyId) {
      const existing = await db.property.findFirst({ where: { name: propertyName }, select: { id: true } });
      if (existing) {
        await db.property.update({ where: { id: existing.id }, data: propertyData });
        propertyId = existing.id;
      } else {
        const created = await db.property.create({
          data: { name: propertyName, ...propertyData },
          select: { id: true },
        });
        propertyId = created.id;
        result.properties += 1;
      }
      propertyCache.set(propertyName, propertyId);
    }

    // Unit -------------------------------------------------------------
    // A sheet with no unit column is one row per property; give it a single
    // unit so lease dates and renewals still have somewhere to live.
    const unitName = text(row, mapping.unit) ?? "—";
    const unitData = {
      bedrooms: money(row, mapping.bedrooms),
      bathrooms: money(row, mapping.bathrooms),
      marketRent: money(row, mapping.marketRent),
      raw: JSON.stringify(row),
    };

    const existingUnit = await db.unit.findFirst({
      where: { propertyId, name: unitName },
      select: { id: true },
    });
    let unitId: string;
    if (existingUnit) {
      await db.unit.update({ where: { id: existingUnit.id }, data: unitData });
      unitId = existingUnit.id;
    } else {
      const created = await db.unit.create({
        data: { propertyId, name: unitName, occupancy: "unknown", ...unitData },
        select: { id: true },
      });
      unitId = created.id;
      result.units += 1;
    }

    // Tenant -----------------------------------------------------------
    const tenantName = text(row, mapping.tenant);
    const leaseEnd = parseDate(text(row, mapping.leaseEnd));

    if (tenantName) {
      const tenantData = {
        email: text(row, mapping.email),
        phone: text(row, mapping.phone),
        unitId,
        propertyId,
        leaseStart: parseDate(text(row, mapping.leaseStart)),
        leaseEnd,
        rent: money(row, mapping.rent),
        status: "current",
        raw: JSON.stringify(row),
      };

      const existingTenant = await db.tenant.findFirst({
        where: { unitId, name: tenantName },
        select: { id: true },
      });
      if (existingTenant) {
        await db.tenant.update({ where: { id: existingTenant.id }, data: tenantData });
      } else {
        await db.tenant.create({ data: { name: tenantName, ...tenantData } });
        result.tenants += 1;
      }

      await db.unit.update({ where: { id: unitId }, data: { occupancy: "occupied" } });
    }
  }

  const { renewalsCreated } = await generateRenewals();
  result.renewals = renewalsCreated;
  return result;
}
