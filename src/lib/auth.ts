import "server-only";

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, resolveDatabaseUrl } from "./db";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const COOKIE = "quasar_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Key used to sign session cookies.
 *
 * SESSION_SECRET is preferred, but falling over because it is missing means a
 * deployment that has a working database still can't log anyone in — one more
 * env var between "deployed" and "usable". So when it is absent the key is
 * derived from the database URL, which is already a secret, already set (the
 * app cannot run without it), and stable across restarts and redeploys.
 *
 * The tradeoff: change the database URL and everyone is signed out, since the
 * derived key changes with it. Setting SESSION_SECRET explicitly avoids that,
 * and /api/health says so.
 */
function secret(): string {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit && explicit !== "change-me-to-a-long-random-string") return explicit;

  const { url } = resolveDatabaseUrl();
  if (url) {
    return createHmac("sha256", "quasar.session.v1").update(url).digest("hex");
  }

  throw new Error(
    "Neither SESSION_SECRET nor a database URL is set, so sessions cannot be signed.",
  );
}

/** True when the key is derived rather than configured — surfaced in diagnostics. */
export function usingDerivedSessionSecret(): boolean {
  const explicit = process.env.SESSION_SECRET?.trim();
  return !explicit || explicit === "change-me-to-a-long-random-string";
}

// --- passwords ------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(keyHex, "hex");
  // Lengths must match before timingSafeEqual, which throws on mismatch.
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// --- session cookie -------------------------------------------------------
// Format: <userId>.<expiryEpochSeconds>.<hmac>. Signed so it can't be forged,
// and self-expiring so a stolen cookie doesn't live forever.

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const expiry = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `${userId}.${expiry}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export type SessionUser = { id: string; name: string; email: string };

/** Returns the signed-in user, or null. Safe to call from any server component. */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const [userId, expiryRaw, mac] = token.split(".");
  if (!userId || !expiryRaw || !mac) return null;

  const expected = sign(`${userId}.${expiryRaw}`);
  const given = Buffer.from(mac, "hex");
  const want = Buffer.from(expected, "hex");
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  if (Number(expiryRaw) * 1000 < Date.now()) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  return user;
}

/** Use at the top of every protected page. Redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
