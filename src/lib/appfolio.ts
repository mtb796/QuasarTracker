import "server-only";

/**
 * AppFolio Reporting API client.
 *
 * Shape of the API (per AppFolio's Reporting API docs):
 *
 *   POST https://{database}.appfolio.com/api/{version}/reports/{report}.json
 *   Authorization: Basic base64(client_id:client_secret)
 *
 *   -> { "results": [ {...}, ... ], "next_page_url": "https://..." | null }
 *
 * Two things vary between AppFolio accounts and are therefore configurable
 * rather than hardcoded:
 *
 *   - The API version segment (v0 / v1 / v2). Set APPFOLIO_API_VERSION.
 *   - Which reports are enabled, and the exact column names each returns.
 *     Column names differ by account configuration, so every mapper below
 *     matches names loosely (see `pick`), and /settings/diagnostics shows you
 *     the real columns your account returns so mappings can be corrected.
 *
 * The API is READ-ONLY. Nothing here writes back to AppFolio.
 */

export type AppFolioConfig = {
  database: string;
  clientId: string;
  clientSecret: string;
  version: string;
};

export type AppFolioRow = Record<string, unknown>;

export class AppFolioError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "AppFolioError";
  }
}

/** Reads credentials from the environment. Returns null when not configured. */
export function getConfig(): AppFolioConfig | null {
  const database = process.env.APPFOLIO_DATABASE?.trim();
  const clientId = process.env.APPFOLIO_CLIENT_ID?.trim();
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET?.trim();
  if (!database || !clientId || !clientSecret) return null;
  return {
    database,
    clientId,
    clientSecret,
    version: process.env.APPFOLIO_API_VERSION?.trim() || "v2",
  };
}

export function isConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Fetches every page of a report.
 *
 * `maxPages` is a safety valve: a misconfigured filter on a large portfolio
 * could otherwise page for a very long time.
 */
export async function fetchReport(
  report: string,
  params: Record<string, string> = {},
  { maxPages = 50 }: { maxPages?: number } = {},
): Promise<AppFolioRow[]> {
  const config = getConfig();
  if (!config) {
    throw new AppFolioError(
      "AppFolio is not configured. Set APPFOLIO_DATABASE, APPFOLIO_CLIENT_ID and APPFOLIO_CLIENT_SECRET in .env.",
    );
  }

  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const first = new URL(
    `https://${config.database}.appfolio.com/api/${config.version}/reports/${report}.json`,
  );
  for (const [key, value] of Object.entries(params)) first.searchParams.set(key, value);

  const rows: AppFolioRow[] = [];
  let url: string | null = first.toString();
  let page = 0;

  while (url && page < maxPages) {
    const response: Response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AppFolioError(
        describeStatus(response.status, report),
        response.status,
        body.slice(0, 500),
      );
    }

    const payload = (await response.json()) as {
      results?: AppFolioRow[];
      next_page_url?: string | null;
    };

    if (Array.isArray(payload.results)) rows.push(...payload.results);
    url = payload.next_page_url ?? null;
    page += 1;
  }

  return rows;
}

function describeStatus(status: number, report: string): string {
  switch (status) {
    case 401:
      return "AppFolio rejected the credentials (401). Check APPFOLIO_CLIENT_ID and APPFOLIO_CLIENT_SECRET.";
    case 403:
      return `AppFolio denied access to the "${report}" report (403). It may not be enabled on your account.`;
    case 404:
      return `AppFolio has no "${report}" report at API version ${process.env.APPFOLIO_API_VERSION || "v2"} (404). Try a different APPFOLIO_API_VERSION, or check the report name.`;
    case 429:
      return "AppFolio rate-limited the request (429). Wait a minute and sync again.";
    default:
      return `AppFolio returned HTTP ${status} for the "${report}" report.`;
  }
}

// ---------------------------------------------------------------------------
// Field access
// ---------------------------------------------------------------------------

/**
 * Reads a value by trying several candidate column names.
 *
 * AppFolio column names vary by account and report — you'll see `PropertyName`,
 * `property_name` and `Property Name` in different places — so matching is done
 * on a normalized key (lowercase, non-alphanumerics stripped).
 */
export function pick(row: AppFolioRow, ...candidates: string[]): unknown {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalized.set(normalizeKey(key), value);
  }
  for (const candidate of candidates) {
    const value = normalized.get(normalizeKey(candidate));
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function str(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function num(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  // AppFolio money columns arrive as strings like "$1,250.00".
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function date(value: unknown): Date | null {
  const text = str(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
