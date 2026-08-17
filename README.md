# Quasar

A shared workspace for a two-person property management team: properties, units,
tenants and owners pulled from AppFolio, with the communication layer AppFolio
doesn't give you — updates and task handoffs attached to the actual property.

## Renewals — the point of the whole thing

Every lease gets four notice milestones counted back from its end date:

| Milestone | Meaning |
| --------- | ------- |
| **150 days** | First notice window opens |
| **120 days** | Second notice |
| **100 days** | Third notice |
| **90 days** | **Hard stop.** Last point a rent increase can go out and still clear the notice period. |

The 90-day mark is treated differently everywhere in the code: it goes
**critical the moment it is reached**, with no easing-in, and it drives the red
banner on the dashboard. The other three ease from "Due" to "Overdue" once the
next window opens.

**How a lease moves through it**

1. AppFolio sync brings in lease end dates; milestones are generated
   automatically (`generateRenewals`). Nothing to remember.
2. The Renewals page shows **Send now** — one line per lease, built around the
   notice that actually needs sending today.
3. Click the milestone chip to record that the notice went out. It stores who
   marked it and when.
4. Record the new rent and the decision (increase / flat / do not renew) next to
   current and market rent, so the number and the reasoning stay together.

**Two rules worth knowing**

- *One line per lease.* A lease 42 days out has its 150, 120 and 100 windows all
  open and unsent, but sending a "150-day notice" today isn't a real action.
  Only the current window is offered; the earlier ones show as "3 earlier
  notices missed".
- *Sending the current notice clears the lease.* Stale earlier windows never
  drag it back into the queue.

A renewed lease reports a new end date from AppFolio, which creates a **new**
Renewal with a fresh set of milestones. The completed one stays as history —
nothing is overwritten.

The milestone maths is pure and separately tested:

```bash
npm run test:renewals    # boundary, DST and hard-line cases
```

## Import from a spreadsheet

**Import** in the nav loads properties, units, tenants and lease dates from an
`.xlsx` or `.csv` — no AppFolio API needed. One row per unit.

Column names don't matter. They're matched automatically (`Lease Expiration`,
`Renewal Date` and `lease_end` all find the same field), and the mapping is
shown for correction **before anything is written**. A title row or a blank row
above the table is fine — the header is found by looking for the first row with
real content.

Two columns carry weight:

- **Property** — required. Rows without one are skipped and counted.
- **Lease end / renewal date** — this is what creates the 150/120/100/90
  milestones. A unit imports fine without it but is never tracked for renewal,
  so the preview reports how many readable dates it found and flags any it
  couldn't parse.

Everything else — unit, tenant, phone, email, rent, market rent, owner, address,
beds, baths — is used when present and ignored when absent. Unmapped columns are
kept on the record and visible under "All AppFolio fields" on the unit page,
so nothing in the sheet is lost.

**Re-importing an updated sheet edits in place** rather than duplicating:
properties match on name, units on property + unit name, tenants on unit + name.
Imported rows carry no AppFolio id, and the sync only ever touches rows that
have one, so importing and syncing can coexist.

---

## Email digest

A daily email, worst-first: anything past the 90-day line, then other notice
windows that are open, then your own due and overdue tasks. The subject line
carries the worst item, because on a phone that's often all that gets read.

### Setting it up

**1. Get a sending key.** Sign up at [resend.com](https://resend.com) — the free
tier covers a two-person team many times over — and create an API key.

```bash
RESEND_API_KEY="re_..."
EMAIL_FROM="Quasar <onboarding@resend.dev>"   # works with no DNS setup
APP_URL="https://your-deployment-url"          # used for links in the email
```

`onboarding@resend.dev` is Resend's shared sender and works immediately. Switch
`EMAIL_FROM` to your own domain once you've verified it with them, which is
worth doing — mail from your own domain is far less likely to land in spam.

**2. Set the cron secret.**

```bash
CRON_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
```

The scheduled endpoint **refuses to run without this**, so it can never be an
open URL that emails people on demand.

**3. Deploy.** `vercel.json` already schedules it for weekdays at 9am Eastern
(`0 13 * * 1-5`, since Vercel crons run in UTC — adjust for daylight saving if
that hour matters to you). Vercel sends the secret automatically as long as
`CRON_SECRET` is set in the project's environment variables.

Any other scheduler works too:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/digest
```

### Before you have a provider

Without `RESEND_API_KEY`, digests are **printed to the server log** rather than
sent, and still recorded as sent. So the whole path — content, scheduling,
guards — is testable before you sign up for anything. Settings shows
`Console only` when this is the case.

### Checking it works

Settings → Email digest has **Send me a test digest now** (bypasses every guard)
and **Preview mine**, which renders the email you'd receive right now without
sending it.

### Three guards worth knowing

- **Opt-out per person.** Turn your own digest off in Settings.
- **No double sends.** A recipient who already got today's digest is skipped, so
  a cron that fires twice — retries, overlapping schedules — can't email twice.
- **No empty mail.** Nothing due means no email. A daily "all clear" just trains
  you to ignore the thing you most need to notice. Set
  `DIGEST_ALWAYS_SEND="true"` if you'd rather have it daily regardless.

Every attempt is logged and the recent ones are listed in Settings, so "did it
actually send?" has an answer.

### What this still doesn't do

No SMS, and no per-milestone email at the moment one comes due — it's a daily
roundup. Given nothing comes due more than once a day, that's the right
granularity, but say the word if you want texts for the 90-day line.

---

## Brand

Colours come from the Quasar logo and are defined once as Tailwind v4 `@theme`
tokens in `src/app/globals.css`, so each generates real utilities (`text-muted`,
`bg-accent`, `border-line`, …).

| Token             | Value     | Used for                                     |
| ----------------- | --------- | -------------------------------------------- |
| `ink` / `slate`   | `#343945` / `#3D4250` | Text, primary buttons, the wordmark |
| `accent`          | `#E4335C` | Links and the sign-in / sync actions          |
| `ember`           | `#F5A623` | The second half of the jet gradient           |
| `muted`           | `#767C8A` | Secondary text                                |
| `line`            | `#E2E5EB` | Borders                                       |
| `canvas`          | `#F6F7F9` | Page background                               |

The crimson→amber jet gradient (`.quasar-gradient`) is used sparingly: a hairline
above the header and on the sign-in screen. The mark itself lives in
`src/components/Logo.tsx` as inline SVG — the disk is a dashed ellipse, so the
swirl stays predictable at any size, and it drops its inner band below 32px so
the header mark doesn't turn to mush.

Semantic colours reuse the brand rather than adding new hues: **vacant** is amber
and **on notice** is crimson, since those are the two states that need attention.
Occupied stays a calm green. Our own "our status" marker is deliberately slate, so
it reads as something a person wrote rather than a status AppFolio sent.

Layout and typography are still plain — the structure is the point, and a fuller
design pass comes later.

---

## Quick start

Postgres is required — see [Database](#database) below for a URL in two minutes.

```bash
git clone https://github.com/mtb796/QuasarTracker.git
cd QuasarTracker
npm install
cp .env.example .env          # then edit it — see "Configuration" below
npx prisma db push            # create the tables
npm run db:seed               # demo data + two starter accounts
npm run dev                   # http://localhost:3000
```

Seeded logins (**change these before anyone else uses the app**):

| Email                  | Password      |
| ---------------------- | ------------- |
| `you@example.com`      | `changeme123` |
| `coworker@example.com` | `changeme123` |

---

## Configuration

Everything lives in `.env` (never committed). Start from `.env.example`.

**Required**

- `DATABASE_URL` — defaults to a local SQLite file at `prisma/dev.db`.
- `SESSION_SECRET` — signs the login cookie. Generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

**AppFolio** (all three required to enable sync)

- `APPFOLIO_DATABASE` — your subdomain. If you log in at `https://acme.appfolio.com`, this is `acme`.
- `APPFOLIO_CLIENT_ID` / `APPFOLIO_CLIENT_SECRET` — from AppFolio.
- `APPFOLIO_API_VERSION` — defaults to `v2`. If sync 404s, try `v1`.

Credentials are read **server-side only** and never reach the browser. Restart the
server after changing `.env`.

---

## Accounts

There's no invite flow — with two people, the command line is simpler and safer:

```bash
npx tsx scripts/user.ts add "Malik Banks" malik@example.com "a-good-password"
npx tsx scripts/user.ts password malik@example.com "a-new-password"
npx tsx scripts/user.ts list
npx tsx scripts/user.ts remove old@example.com
```

Passwords are hashed with scrypt. Sessions are signed, HTTP-only cookies that
expire after 30 days.

---

## How the AppFolio connection works

AppFolio's **Reporting API is read-only**, so this app never writes back to
AppFolio. It mirrors four reports into the local database:

| Report               | Becomes    |
| -------------------- | ---------- |
| `owner_directory`    | Owners     |
| `property_directory` | Properties |
| `unit_directory`     | Units      |
| `tenant_directory`   | Tenants    |

Hit **Sync from AppFolio** on the Settings page to pull. Reports run in dependency
order so foreign keys resolve, and one failing report doesn't stop the others.

### Two things that will likely need adjusting on first sync

This is the part that can't be verified without hitting your actual account, so
the app is built to make correcting it easy:

**1. Report names.** Which reports are enabled varies by account. Override any of
them without touching code:

```bash
APPFOLIO_REPORT_PROPERTY="property_directory"
APPFOLIO_REPORT_UNIT="unit_directory"
APPFOLIO_REPORT_TENANT="tenant_directory"
APPFOLIO_REPORT_OWNER="owner_directory"
```

**2. Column names.** AppFolio returns different column names for different
accounts (`PropertyName` vs `property_name` vs `Property Name`). The mapper
already matches loosely — case, spaces and underscores are ignored, and each
field tries several candidate names — but it can't guess a name it's never seen.

If a column comes through empty:

1. Go to **Settings → Sync history** and expand **Columns returned**. That's the
   real list of column names your account sends.
2. Add the correct name to the matching `pick(...)` call in `src/lib/sync.ts`.

Every synced record also keeps its untouched AppFolio row — open any unit and
expand **All AppFolio fields for this unit** to see everything that came back,
including fields not yet promoted to real columns.

**Check the lease end date first.** Renewals are built entirely from
`Tenant.leaseEnd`, so if that column doesn't map, the renewal board stays empty
and no milestone will ever fire. It's tried against `LeaseTo`, `LeaseEnd`,
`lease_end_date` and `MoveOut`. After your first sync, open **Tenants** and
confirm the Lease column shows real dates before trusting the Renewals page.

### Your data is never overwritten by a sync

Sync only writes the mirrored columns. Notes, tasks, and the **"our status"**
field on properties and units are yours — they survive every sync. That last one
exists precisely because AppFolio is read-only: it's where things like
"Turn in progress" or "Owner walkthrough booked" live.

---

## What's in it

- **Home** — what's assigned to you, what's assigned to your coworker, the latest
  updates across every property, and portfolio counts.
- **Properties** — searchable list with vacancy filters; each property shows its
  units, owner, occupancy, plus its own update feed and task list.
- **Units** — beds/baths/rent, occupancy, tenants on record, unit-level updates
  and tasks, and the full raw AppFolio record.
- **Tenants** — directory filtered by current/future/past, with click-to-call and
  click-to-email, lease dates and rent.
- **Owners** — contacts alongside the properties they own.
- **Tasks** — hand work back and forth; due dates, overdue flagging, open/done.

Notes and tasks can attach to a property or a unit, or stand alone as general
team updates.

---

## Database

Postgres everywhere — local and deployed. Not SQLite: Vercel's filesystem is
ephemeral and read-only, so a file database would vanish between requests and
couldn't be shared between two people anyway.

Free tiers that work well: **[Neon](https://neon.tech)**, **[Supabase](https://supabase.com)**,
or Vercel Postgres from the Storage tab. Any of them hands you a connection
string:

```bash
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"
```

Use the **pooled** connection string if the provider offers one (Neon calls it
`-pooler`). Serverless functions open a connection per instance, and a pooler is
what keeps that from exhausting the database's connection limit.

Then create the tables:

```bash
npx prisma db push
```

The same command is how you apply any later schema change.

---

## Deploying to Vercel

**1. Import the repo.** New Project → pick `QuasarTracker`. Framework and build
command are detected automatically; the app is at the repo root, so leave the
root directory alone.

**2. Add environment variables** (Settings → Environment Variables). At minimum:

| Variable | Value |
| -------- | ----- |
| `DATABASE_URL` | Pooled Postgres connection string |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_URL` | Your deployment URL, e.g. `https://quasartracker.vercel.app` |
| `CRON_SECRET` | Another random string, same generator |

Then the AppFolio credentials (`APPFOLIO_DATABASE`, `APPFOLIO_CLIENT_ID`,
`APPFOLIO_CLIENT_SECRET`) and, for email, `RESEND_API_KEY` and `EMAIL_FROM`.
The app runs without those — it just can't sync or send until they're set.

**3. Deploy, then open `/setup`** on your deployment. It creates the tables and
your first account in the browser — no terminal, no local clone. It only works
while the database has zero accounts, and refuses forever after that, so it
can't be used to add people later.

There is no sign-up page by design: accounts are created deliberately, so nobody
who finds the URL can make themselves one.

**4. Sync.** Sign in, go to Settings, and press **Sync from AppFolio**. Then
check Tenants shows real lease dates before trusting Renewals.

The daily digest cron in `vercel.json` starts running on its own once
`CRON_SECRET` is set.

### If something fails after deploying

Open **`/api/health`**. It probes each stage in order — connection string
present, database reachable, tables created, accounts exist — and tells you the
exact command to run next. It reports only booleans, counts and next steps,
never a connection string or secret, so it is safe to leave reachable.

The usual causes, in the order they bite:

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Sign-in shows "Can't reach the database" | `DATABASE_URL` missing or wrong | Set it in Vercel, redeploy |
| `/api/health` says no tables | Schema never applied | `npx prisma db push` with `DATABASE_URL` pointed at production |
| `/api/health` says 0 accounts | No user created yet | `npx tsx scripts/user.ts add …` |
| Sign-in mentions `SESSION_SECRET` | Not set | Add it, redeploy |

Sign-in failures no longer render a blank server-error page — the reason is
shown on the form itself.

### Notes

- `npm run build` runs `prisma generate` first, so the client is always built
  against the current schema.
- `prisma db push` is not run automatically on deploy — schema changes are
  applied deliberately, so a bad migration can't take the app down mid-deploy.

---

## Commands

| Command                          | Does                                        |
| -------------------------------- | ------------------------------------------- |
| `npm run dev`                    | Dev server on :3000                         |
| `npm run build` / `npm start`    | Production build and serve                  |
| `npx prisma db push`             | Apply schema changes                        |
| `npm run db:seed`                | Demo data + starter accounts                |
| `npm run test:renewals`          | Renewal milestone maths                     |
| `npx tsx prisma/seed.ts --clear` | Delete demo data, keep accounts             |
| `npm run db:studio`              | Browse the database in a GUI                |

## Layout

```
QuasarTracker/
├── prisma/schema.prisma     data model (mirrored vs. ours — commented inline)
├── scripts/user.ts          account management CLI
└── src/
    ├── lib/appfolio.ts      Reporting API client (auth, pagination, field matching)
    ├── lib/sync.ts          report -> database mapping  ← edit column names here
    ├── lib/auth.ts          password hashing + signed session cookies
    ├── app/actions.ts       every write the UI performs
    ├── app/(app)/           signed-in pages
    └── components/          shared UI
```
