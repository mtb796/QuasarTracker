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

export type PreviewState = { preview?: ImportPreview; error?: string };
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
    const { headers, rows } = await parseSheet(buffer, name);
    if (rows.length === 0) return { error: "That sheet has a header but no data rows." };

    const mapping = mappingFrom(formData, detectColumns(headers));
    return { preview: buildPreview(headers, rows, mapping) };
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
    const { headers, rows } = await parseSheet(buffer, name);
    const mapping = mappingFrom(formData, detectColumns(headers));

    if (!mapping.property) return { error: "Pick which column holds the property name." };

    const result = await importRows(rows, mapping);
    revalidatePath("/", "layout");
    return { result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Import failed." };
  }
}
