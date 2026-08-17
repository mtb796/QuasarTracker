import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendDigests } from "@/lib/send-digest";

export const dynamic = "force-dynamic";

/**
 * Daily digest trigger.
 *
 * Called by a scheduler (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`).
 * This is the one route that isn't behind a login, so it is guarded by a shared
 * secret and refuses to run at all when that secret isn't configured — a
 * publicly-callable endpoint that emails people is not an acceptable default.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set; refusing to run." },
      { status: 503 },
    );
  }

  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDigests();
  return NextResponse.json({ ok: true, ...result });
}

/** Constant-time compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
