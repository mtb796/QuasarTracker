import { requireUser } from "@/lib/auth";
import { buildDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";

/**
 * Renders the digest you would receive right now, without sending it.
 *
 * Useful for checking wording and layout before a real send, and it's the only
 * practical way to see the HTML while the console transport is in use. Behind
 * the normal login — `requireUser` redirects when signed out.
 */
export async function GET(): Promise<Response> {
  const user = await requireUser();
  const digest = await buildDigest(user);

  return new Response(digest.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
