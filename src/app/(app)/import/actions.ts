"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseSheet } from "@/lib/sheet";
import {
  buildPreview,
  detectColumns,
  importRows,
  type ImportPreview,
  type ImportResult,
} from "@/lib/import-properties";
import { FIELD_ORDER, type FieldKey, type Mapping } from "@/lib/import-fields";

export type PreviewState = {
  preview?: ImportPreview;
  sheetNames?: string[];
  sheetName?: string;
  error?: string;
};
export type CommitState = { result?: ImportResult; error?: string };

async function readFile(formData: FormData): Promise<{ buffer: Buffer; name: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file first.");
  if (file.size > 8 * 1024 * 1024) throw new Error("That file is over 8MB — save it as .csv and try again.");
  return { buffer: Buffer.from(await file.arrayBuffer()), name: file.name };
}

/** Any mapping the operator corrected on screen wins over the auto-detection. */
function mappingFrom(formData: FormData, fallback: Mapping): Mapping {
  const mapping: Mapping = {};
  let sawAny = false;
  for (const key of FIELD_ORDER) {
    const value = formData.get(`map_${key}`);
    if (value === null) continue;
    sawAny = true;
    const header = String(value).trim();
    if (header) mapping[key] = header;
  }
  return sawAny ? mapping : fallback;
}

export async function previewImport(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  await requireUser();
  try {
    const { buffer, name } = await readFile(formData);
    const chosen = String(formData.get("sheetName") ?? "").trim() || undefined;
    const { headers, rows, sheetNames, sheetName } = await parseSheet(buffer, name, chosen);
    if (rows.length === 0) {
      return { sheetNames, sheetName, error: `Sheet "${sheetName}" has a header but no data rows.` };
    }

    const mapping = mappingFrom(formData, detectColumns(headers));
    return { preview: buildPreview(headers, rows, mapping), sheetNames, sheetName };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't read that file." };
  }
}

export async function commitImport(
  _prev: CommitState,
  formData: FormData,
): Promise<CommitState> {
  await requireUser();
  try {
    const { buffer, name } = await readFile(formData);
    const chosen = String(formData.get("sheetName") ?? "").trim() || undefined;
    const { headers, rows, sheetName } = await parseSheet(buffer, name, chosen);
    const mapping = mappingFrom(formData, detectColumns(headers));

    if (!mapping.property) return { error: "Pick which column holds the property name." };

    // Renewal tracking is the whole point, and a missing lease-end column fails
    // silently — every row imports, nothing is ever tracked. Refuse unless it
    // was ticked as deliberate.
    if (!mapping.leaseEnd && formData.get("allowNoDates") !== "true") {
      return {
        error:
          "No lease-end column is selected, so no renewals would be tracked. Pick the column that holds the lease end date, or tick the box to import without renewal tracking.",
      };
    }

    // Guard against previewing one sheet and importing another: a mapping built
    // from different headers silently yields empty values — which for the
    // lease-end column means no renewal milestones at all.
    const missing = Object.entries(mapping)
      .filter(([, header]) => header && !headers.includes(header))
      .map(([field]) => field);
    if (missing.length > 0) {
      return {
        error: `These columns aren't in sheet "${sheetName}": ${missing.join(", ")}. Press "Re-read" and check the mapping.`,
      };
    }

    const result = await importRows(rows, mapping);
    revalidatePath("/", "layout");
    return { result };
  } catch (error) {
    // Surface the real reason. A schema/table mismatch used to abort the action
    // with nothing on screen, which reads as a hang rather than a failure.
    const raw = error instanceof Error ? error.message : String(error);
    const first = raw.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "Import failed.";
    const hint = /column .* does not exist|Unknown argument|no such column/i.test(raw)
      ? " The database schema is older than this build — open /api/health, then re-run setup or `npx prisma db push`."
      : "";
    return { error: `${first.slice(0, 220)}${hint}` };
  }
}
