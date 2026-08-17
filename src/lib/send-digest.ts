import "server-only";

import { db } from "./db";
import { buildDigest } from "./digest";
import { alreadySentToday, sendEmail } from "./email";

export type DigestRunResult = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  detail: { email: string; outcome: string }[];
};

/**
 * Sends the digest to everyone who wants it.
 *
 * Three guards, all of which matter for something that runs unattended:
 *
 *   - Recipients must have `digestEnabled`.
 *   - A recipient who already got today's digest is skipped, so a cron that
 *     fires twice (retries, overlapping schedules) cannot email twice.
 *   - An empty digest is not sent unless DIGEST_ALWAYS_SEND is on. A daily
 *     "nothing due" trains people to ignore the mail, which defeats the point
 *     of having it at all.
 *
 * `force` bypasses the once-a-day and empty-digest guards — that's the "send me
 * a test now" button.
 */
export async function sendDigests({
  force = false,
  onlyUserId,
  kind = "digest",
  now = new Date(),
}: {
  force?: boolean;
  onlyUserId?: string;
  kind?: string;
  now?: Date;
} = {}): Promise<DigestRunResult> {
  const users = await db.user.findMany({
    where: {
      ...(onlyUserId ? { id: onlyUserId } : {}),
      ...(force ? {} : { digestEnabled: true }),
    },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  const result: DigestRunResult = {
    attempted: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    detail: [],
  };

  const alwaysSend = process.env.DIGEST_ALWAYS_SEND === "true";

  for (const user of users) {
    result.attempted += 1;

    if (!force && (await alreadySentToday(user.email, kind, now))) {
      result.skipped += 1;
      result.detail.push({ email: user.email, outcome: "already sent today" });
      continue;
    }

    const digest = await buildDigest(user, now);

    if (!digest.hasContent && !alwaysSend && !force) {
      result.skipped += 1;
      result.detail.push({ email: user.email, outcome: "nothing due" });
      continue;
    }

    const send = await sendEmail(
      {
        to: user.email,
        subject: digest.subject,
        html: digest.html,
        text: digest.text,
        kind,
      },
      now,
    );

    if (send.ok) {
      result.sent += 1;
      result.detail.push({ email: user.email, outcome: `sent via ${send.transport}` });
    } else {
      result.failed += 1;
      result.detail.push({ email: user.email, outcome: `failed: ${send.error}` });
    }
  }

  return result;
}
