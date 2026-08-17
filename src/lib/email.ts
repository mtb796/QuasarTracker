import "server-only";

import { db } from "./db";

/**
 * Email delivery.
 *
 * Two transports, chosen automatically:
 *
 *   - **Resend** when RESEND_API_KEY is set. Plain `fetch`, no SDK, so there's
 *     no dependency to keep patched.
 *   - **Console** otherwise: the message is logged to the server and recorded
 *     as sent. This keeps the whole digest path runnable — and testable — before
 *     anyone signs up for an email provider.
 *
 * Every attempt is written to EmailLog, so "did it actually send?" is a
 * question the Settings page can answer.
 */

export type Transport = "resend" | "console";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** "digest" | "test" — used by the once-per-day guard. */
  kind: string;
};

export type SendResult = {
  ok: boolean;
  transport: Transport;
  skipped?: boolean;
  error?: string;
};

export function transport(): Transport {
  return process.env.RESEND_API_KEY?.trim() ? "resend" : "console";
}

export function fromAddress(): string {
  // Resend's shared sender works without domain verification, which makes the
  // first send possible before DNS is sorted out.
  return process.env.EMAIL_FROM?.trim() || "Quasar <onboarding@resend.dev>";
}

export function appUrl(): string {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

/** Local calendar day as YYYY-MM-DD — the key for the once-per-day guard. */
export function dayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** True when this recipient already got this kind of mail today. */
export async function alreadySentToday(to: string, kind: string, now = new Date()): Promise<boolean> {
  const existing = await db.emailLog.findFirst({
    where: { to, kind, day: dayKey(now), status: "sent" },
    select: { id: true },
  });
  return existing !== null;
}

export async function sendEmail(message: EmailMessage, now = new Date()): Promise<SendResult> {
  const mode = transport();

  try {
    if (mode === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 300)}`);
      }
    } else {
      console.log(
        `\n[email:console] To: ${message.to}\n[email:console] Subject: ${message.subject}\n` +
          `[email:console] ---\n${message.text}\n[email:console] ---\n` +
          `[email:console] Set RESEND_API_KEY in .env to send this for real.\n`,
      );
    }

    await db.emailLog.create({
      data: {
        to: message.to,
        subject: message.subject,
        kind: message.kind,
        status: "sent",
        day: dayKey(now),
      },
    });
    return { ok: true, transport: mode };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await db.emailLog.create({
      data: {
        to: message.to,
        subject: message.subject,
        kind: message.kind,
        status: "error",
        error: detail,
        day: dayKey(now),
      },
    });
    return { ok: false, transport: mode, error: detail };
  }
}
