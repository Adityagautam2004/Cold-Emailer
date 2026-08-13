# BUILD SPEC — "Dispatch": a cold-outreach console for final-year students

You are building this application end to end in this empty folder. Read this entire
document before writing any code. Follow the build order in §16 and do not skip the
acceptance checks. Where this spec is explicit, follow it exactly; where it is silent,
use your judgment and record the decision in `DECISIONS.md`.

---

## 1. What this product is

A small-scale web app for final-year college students running job-search outreach.
A student signs up, connects their own Gmail, uploads a resume PDF, uploads an Excel
sheet of HR contacts, picks an email template, sets a pace (N emails/day, spread over
a window), and the app sends those emails **from the student's own mailbox** on a
schedule, tracks replies, and stops chasing anyone who answers.

Scale target: ~200–500 students, each with a few hundred contacts. This is a college
tool, not a SaaS. Optimise for correctness and deliverability, not for throughput.

**The core product value is pacing and reply tracking, not sending.** Anyone can send
an email. The reason this app exists is that it sends 20 a day instead of 300 at once,
from a real mailbox, and tells the student who replied.

---

## 2. Non-negotiable constraints

These are product requirements, not suggestions. Do not build a version that violates
them, and do not add UI that lets a user opt out of them.

1. **Every email is sent from the student's own mailbox.** There is no shared
   application SMTP relay and no shared sending domain. Never add one.
2. **Hard cap of 50 emails per account per day**, enforced server-side. The UI must not
   accept a higher number.
3. **Mandatory warmup ramp** on a newly connected account (§9). A brand-new account
   cannot send 50 on day one even if the user asks.
4. **A campaign cannot start unless its template body contains at least one
   personalisation variable** (e.g. `{{hr_name}}` or `{{company}}`).
5. **Every outgoing email includes a one-line opt-out** with a working unsubscribe link.
6. **A reply cancels all pending follow-ups** to that contact, immediately.
7. **Suppression list is absolute.** Replied, bounced, and unsubscribed addresses are
   never emailed again by that user, in any campaign.
8. **Bounce circuit breaker.** If a campaign's bounce rate exceeds 5% over at least 20
   sends, pause the campaign automatically and surface why.
9. Credentials are encrypted at rest (§7) and never written to logs, never returned by
   any API route, never rendered in the UI after entry.
10. No list import from scraped or purchased sources — the ToS says so and the import
    screen says so.

---

## 3. Tech stack (pinned)

Use these. Do not substitute without recording why in `DECISIONS.md`.

| Concern | Choice |
|---|---|
| Framework | Next.js 15, App Router, TypeScript `strict: true` |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | Auth.js v5 (`next-auth@beta`), Google provider + email/password credentials fallback |
| DB | PostgreSQL (Neon) via Prisma |
| Queue | BullMQ + Redis (Upstash or Railway) |
| Worker | Separate long-running Node process, run with `tsx` |
| File storage | Supabase Storage (private bucket) via `@supabase/supabase-js`, signed upload + download URLs |
| Email send | `nodemailer` (SMTP) |
| Reply/bounce read | `imapflow` |
| Excel parsing | `exceljs` |
| Validation | `zod` everywhere at API boundaries |
| Timezones | `@date-fns/tz` + `date-fns` |
| Logging | `pino` + `pino-pretty` in dev |
| Tests | `vitest` |

Notes:
- Do **not** use the `xlsx` package from npm — the published version is stale. Use
  `exceljs`.
- Redis client must be configured with `maxRetriesPerRequest: null` for BullMQ.
- The worker cannot run on Vercel. Web deploys to Vercel; worker deploys to Railway.
- Supabase Storage is accessed **server-side only**, with the service-role key, in a
  private bucket. The service-role key bypasses row-level security, so it must never be
  imported into a client component, never prefixed `NEXT_PUBLIC_`, and never sent to the
  browser. Authorisation is your own `requireUser()` check plus a `userId/` key prefix —
  do not rely on Supabase RLS policies for this.
- Object keys are `{userId}/{resumeId}.pdf`. Browser uploads go through
  `createSignedUploadUrl()`; reads use `createSignedUrl()` with a 60-second expiry for
  previews, and a direct server-side `download()` in the worker.

---

## 4. Repo structure

Single repo, npm workspaces, two deployables sharing one Prisma client.

```
.
├── apps/
│   ├── web/                  # Next.js app
│   │   ├── src/app/
│   │   │   ├── (marketing)/  # landing page, /terms, /privacy
│   │   │   ├── (auth)/login
│   │   │   ├── (app)/        # authed shell: sidebar + topbar
│   │   │   │   ├── dashboard/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── resumes/
│   │   │   │   ├── templates/
│   │   │   │   ├── lists/
│   │   │   │   ├── campaigns/
│   │   │   │   └── settings/
│   │   │   ├── u/[token]/     # public unsubscribe, no auth
│   │   │   └── api/
│   │   └── src/components/
│   └── worker/               # BullMQ workers + tick scheduler
│       └── src/
│           ├── index.ts       # boots queues + workers + repeatable jobs
│           ├── jobs/tick.ts
│           ├── jobs/send.ts
│           ├── jobs/poll-inbox.ts
│           └── jobs/reset-quota.ts
├── packages/
│   ├── db/                   # prisma schema, client singleton, migrations
│   ├── core/                 # domain logic — pure, unit-testable
│   │   ├── crypto.ts
│   │   ├── quota.ts
│   │   ├── schedule.ts        # slot distribution math
│   │   ├── template.ts        # variable render + validation
│   │   ├── import.ts          # excel → validated contacts
│   │   └── sender/
│   │       ├── types.ts       # EmailSender interface
│   │       ├── smtp.ts
│   │       └── index.ts       # factory
│   └── config/               # zod-parsed env, shared by both apps
└── README.md
```

`packages/core` must not import Next.js, React, or BullMQ. Domain logic goes there so
it can be unit-tested without a server. This matters — the scheduling math is the part
most likely to be subtly wrong.

---

## 5. Data model

Write this as `packages/db/prisma/schema.prisma`. Adjust naming to Prisma conventions
but keep the shape, the constraints, and especially the indexes.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  name           String?
  passwordHash   String?
  timezone       String   @default("Asia/Kolkata")
  acceptedTosAt  DateTime?
  createdAt      DateTime @default(now())

  emailAccounts  EmailAccount[]
  resumes        Resume[]
  templates      Template[]
  contactLists   ContactList[]
  campaigns      Campaign[]
  suppressions   Suppression[]
}

model EmailAccount {
  id            String   @id @default(cuid())
  userId        String
  provider      String   @default("smtp")      // "smtp" | "gmail_oauth"
  fromEmail     String
  fromName      String
  credentialEnc String                          // AES-256-GCM payload, see §7
  imapHost      String   @default("imap.gmail.com")
  smtpHost      String   @default("smtp.gmail.com")
  smtpPort      Int      @default(465)

  dailyCap      Int      @default(10)
  sentToday     Int      @default(0)
  quotaResetAt  DateTime                        // next local midnight, in UTC
  warmupStartedAt DateTime @default(now())
  status        String   @default("active")     // active | paused | error
  statusReason  String?
  lastImapUid   Int?
  lastPolledAt  DateTime?
  verifiedAt    DateTime?

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaigns     Campaign[]

  @@unique([userId, fromEmail])
}

model Resume {
  id         String   @id @default(cuid())
  userId     String
  storageKey String
  filename   String
  sizeBytes  Int
  version    Int      @default(1)
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaigns  Campaign[]
}

model Template {
  id        String   @id @default(cuid())
  userId    String
  name      String
  subject   String
  bodyText  String   @db.Text                   // source of truth, plain text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  steps     CampaignStep[]
}

model ContactList {
  id             String   @id @default(cuid())
  userId         String
  name           String
  sourceFilename String
  rowCount       Int      @default(0)
  createdAt      DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  contacts  Contact[]
  campaigns Campaign[]
}

model Contact {
  id        String   @id @default(cuid())
  listId    String
  company   String?
  hrName    String?
  email     String                              // stored lowercased, trimmed
  title     String?
  custom    Json     @default("{}")
  status    String   @default("pending")         // pending|sent|replied|bounced|unsubscribed|skipped
  rowNumber Int

  list      ContactList @relation(fields: [listId], references: [id], onDelete: Cascade)
  sends     Send[]

  @@unique([listId, email])
  @@index([listId, status])
}

model Campaign {
  id             String   @id @default(cuid())
  userId         String
  listId         String
  resumeId       String
  emailAccountId String
  name           String
  status         String   @default("draft")      // draft|scheduled|running|paused|completed|stopped
  pauseReason    String?

  perDayCap      Int      @default(20)
  minGapMinutes  Int      @default(6)
  windowStart    String   @default("10:00")      // local HH:mm
  windowEnd      String   @default("18:00")
  daysOfWeek     Int[]    @default([1,2,3,4,5])  // 1=Mon .. 7=Sun, ISO
  timezone       String   @default("Asia/Kolkata")
  attachResume   Boolean  @default(true)
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  list         ContactList  @relation(fields: [listId], references: [id])
  resume       Resume       @relation(fields: [resumeId], references: [id])
  emailAccount EmailAccount @relation(fields: [emailAccountId], references: [id])
  steps        CampaignStep[]
  sends        Send[]
}

model CampaignStep {
  id         String @id @default(cuid())
  campaignId String
  templateId String
  stepOrder  Int                                 // 0 = initial, 1..2 = follow-ups
  delayDays  Int    @default(0)                  // days after previous step's send

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  template Template @relation(fields: [templateId], references: [id])
  sends    Send[]

  @@unique([campaignId, stepOrder])
}

model Send {
  id                String   @id @default(cuid())
  campaignId        String
  contactId         String
  stepId            String
  scheduledAt       DateTime
  status            String   @default("queued")  // queued|claimed|sending|sent|failed|cancelled|skipped
  attempts          Int      @default(0)
  lastError         String?
  providerMessageId String?                       // RFC Message-ID we generated
  threadId          String?
  sentAt            DateTime?
  renderedSubject   String?
  claimedAt         DateTime?

  campaign Campaign     @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact  Contact      @relation(fields: [contactId], references: [id], onDelete: Cascade)
  step     CampaignStep @relation(fields: [stepId], references: [id])
  events   Event[]

  @@unique([campaignId, contactId, stepId])
  @@index([status, scheduledAt])
  @@index([providerMessageId])
}

model Event {
  id         String   @id @default(cuid())
  sendId     String?
  userId     String?
  type       String                              // queued|sent|failed|replied|bounced|unsubscribed|paused|...
  occurredAt DateTime @default(now())
  meta       Json     @default("{}")

  send Send? @relation(fields: [sendId], references: [id], onDelete: Cascade)

  @@index([userId, occurredAt])
}

model Suppression {
  id        String   @id @default(cuid())
  userId    String
  email     String
  reason    String                               // replied|bounced|unsubscribed|manual
  token     String?  @unique                     // unsubscribe token that created it
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, email])
}
```

### The `Send` table is the ledger

When a campaign starts, create **one `Send` row per contact for step 0, up front**, all
in `queued` with a computed `scheduledAt`. Follow-up rows are created lazily after the
prior step sends. Every number in the UI is a `COUNT`/`GROUP BY` over `Send` — never
maintain denormalised counters. The `@@unique([campaignId, contactId, stepId])`
constraint is what makes double-clicking "Start campaign" harmless and makes worker
retries safe. Rely on it; catch `P2002` and treat it as success.

---

## 6. Auth

Auth.js v5, JWT session strategy, Prisma adapter.

- **Google provider** for login (most students have a college Google account).
- **Credentials provider** (email + `argon2` hash) as fallback.
- This login identity is *separate* from the sending mailbox. A student can log in with
  one Google account and connect a different Gmail for sending. Do not conflate them.
- Every `(app)` route and every `/api` route that touches user data must resolve the
  session and scope all queries by `userId`. Write a `requireUser()` helper and use it
  without exception. Add a test that hits each API route unauthenticated and expects 401.
- Block access to the app until `acceptedTosAt` is set.

---

## 7. Credential encryption

Gmail app passwords are stored encrypted with AES-256-GCM. `packages/core/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); // 32 bytes
if (KEY.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes of hex (64 chars)");

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function decrypt(payload: string): string {
  const [v, iv, tag, ct] = payload.split(".");
  if (v !== "v1") throw new Error("unknown ciphertext version");
  const d = createDecipheriv("aes-256-gcm", KEY, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
```

Rules: decrypt only inside the worker, at the moment of sending or polling. Never send
`credentialEnc` to the client — exclude it with an explicit Prisma `select` on every
query that touches `EmailAccount`, and add a unit test asserting the API response shape
has no such key. Configure `pino` with a redaction list covering `credentialEnc`,
`password`, `authorization`.

---

## 8. Sending

### 8.1 The sender interface

Abstract this now so Gmail OAuth can drop in later (§16 phase 8) without touching the
scheduler.

```ts
// packages/core/sender/types.ts
export interface OutgoingEmail {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  messageId: string;          // we generate it, so we can match replies later
  attachment?: { filename: string; content: Buffer; contentType: string };
  headers?: Record<string, string>;
}

export interface SendResult { providerMessageId: string; threadId?: string }

export interface EmailSender {
  verify(): Promise<void>;
  send(email: OutgoingEmail): Promise<SendResult>;
  close(): Promise<void>;
}
```

The SMTP implementation wraps a Nodemailer transport (`secure: true`, port 465, auth
user = `fromEmail`, pass = decrypted app password). Create the transport per job and
close it; do not hold a pool across a 24-hour worker lifetime.

### 8.2 Error classification

This is the part that determines whether the app is trustworthy. Classify every send
failure into exactly one of three buckets and act differently:

| Class | Examples | Action |
|---|---|---|
| `permanent` | SMTP 550/553, invalid recipient, mailbox not found | mark send `failed`, contact `bounced`, add to suppression, **no retry** |
| `transient` | connection reset, timeout, SMTP 421/451, temporary lookup failure | retry with backoff (1m, 5m, 25m), max 3 attempts |
| `account` | 535 auth failed, app-password revoked, "Daily user sending quota exceeded" | set `EmailAccount.status = 'error'` with reason, **pause every campaign on that account**, notify user on the dashboard, do not retry |

An `account`-class error must stop the account, not just the one send. A student whose
app password got revoked should see "Reconnect your Gmail" on the dashboard, not 40
silent failures.

### 8.3 Message construction

- Plain text primary. Generate the HTML part from the text with minimal markup
  (paragraph breaks and autolinked URLs only). No tables, no images, no tracking pixel,
  no wrapper divs with inline CSS. A near-plaintext email from a real mailbox is what
  gets replies; a styled marketing template is what gets filtered.
- Generate our own `Message-ID` as `<{sendId}.{random}@{sending-domain}>` and store it
  in `providerMessageId`. This is the join key for reply detection.
- Attach the resume PDF, fetched from Supabase Storage, named
  `{StudentName}_Resume.pdf` (sanitised). One attachment, under 2 MB — reject larger
  uploads at the upload step with a clear message.
- Append the opt-out as the last line of the text body:
  `Not the right contact? Reply "no" or opt out: {unsubscribeUrl}`
  and set the `List-Unsubscribe` header to the same URL plus `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click`.

---

### 8.4 Cache the resume in the worker

Naively downloading the PDF once per send is the single biggest cost driver in this app.
At 300 students × 20 sends/day × 500 KB, that is ~3 GB/day of storage egress — well past
any free tier — for what is really the same handful of files over and over.

In the send worker, keep an in-memory LRU cache keyed by `resumeId`, holding the raw
`Buffer` plus the resume's `updatedAt`. Cap it at 25 entries with a 30-minute TTL.
A day's batch for one student then reads storage **once**. Invalidate on resume version
change (compare `updatedAt`) so a student who re-uploads mid-campaign gets the new file
on the next send. Log a cache hit/miss counter at debug level so the ratio is verifiable.

## 9. Quota and warmup

### 9.1 Warmup ramp

Derived from `EmailAccount.warmupStartedAt`, computed in `packages/core/quota.ts`, never
user-editable:

| Days since connect | Allowed cap |
|---|---|
| 0–2 | 10 |
| 3–5 | 20 |
| 6–8 | 35 |
| 9+ | 50 |

Effective cap for any given day = `min(warmupCap(account), campaign.perDayCap, 50)`.
Show the current stage and the next step-up date in Settings so the limit reads as a
feature rather than a bug.

### 9.2 Atomic quota consumption

Never read-then-write. Consume the quota with a single conditional update immediately
before handing the email to SMTP:

```sql
UPDATE "EmailAccount"
   SET "sentToday" = "sentToday" + 1
 WHERE id = $1
   AND "sentToday" < $2          -- effective cap, computed in app code
   AND status = 'active'
RETURNING "sentToday";
```

Zero rows returned means the quota is gone or the account is halted — leave the send in
`queued`, reschedule it to the next eligible window, and stop processing that account
this tick. If the SMTP call then fails with a `transient` error, decrement the counter
back; if it fails `permanent`, keep the consumption (the attempt did hit Gmail).

### 9.3 Daily reset

A repeatable job every 15 minutes: `UPDATE "EmailAccount" SET "sentToday" = 0,
"quotaResetAt" = <next local midnight> WHERE "quotaResetAt" <= now()`. Compute local
midnight from the account owner's timezone, not UTC — an IST user's day must roll over
at 00:00 IST.

---

## 10. Scheduling

### 10.1 Slot distribution (pure function, unit-tested)

`packages/core/schedule.ts` exports:

```ts
computeSlots(input: {
  count: number;               // contacts to schedule
  startFrom: Date;             // usually now()
  perDayCap: number;
  minGapMinutes: number;
  windowStart: string;         // "10:00"
  windowEnd: string;           // "18:00"
  daysOfWeek: number[];        // ISO 1..7
  timezone: string;
  jitterRatio?: number;        // default 0.4
  rng?: () => number;          // injectable for deterministic tests
}): Date[]
```

Algorithm:
1. Walk forward day by day from `startFrom`, skipping days not in `daysOfWeek`.
2. For each eligible day, take up to `perDayCap` items.
3. Within a day, the usable span is `[windowStart, windowEnd]` in `timezone`; if the
   first day is already partway through the window, start from `now()`.
4. Base interval = `max(minGapMinutes, span / itemsThatDay)`.
5. Each slot = previous slot + interval × `(1 + jitterRatio × (rng()*2 - 1))`, clamped
   so it never drops below `minGapMinutes` and never crosses `windowEnd`.
6. Convert local slots back to UTC `Date`s. Handle DST transitions correctly via
   `@date-fns/tz` (not an issue for IST, but don't hard-code that assumption).

The jitter matters. Perfectly even 6-minute intervals are a machine fingerprint.

Tests: 300 contacts / 20 per day → 15 distinct local days, none on Sat/Sun, all inside
the window, all gaps ≥ `minGapMinutes`, deterministic given a seeded `rng`.

### 10.2 The tick

**Do not use `setTimeout`. Do not enqueue N delayed BullMQ jobs at campaign start.**
Users pause, re-pace, and get replies; delayed jobs scattered across a queue cannot be
revised. The database is the schedule; the queue is only the transport for work due now.

One BullMQ repeatable job every 60 seconds (`jobId: "tick"` so redeploys don't duplicate
it). Each tick:

```sql
WITH due AS (
  SELECT s.id
    FROM "Send" s
    JOIN "Campaign" c ON c.id = s."campaignId"
    JOIN "EmailAccount" a ON a.id = c."emailAccountId"
   WHERE s.status = 'queued'
     AND s."scheduledAt" <= now()
     AND c.status = 'running'
     AND a.status = 'active'
   ORDER BY s."scheduledAt"
   FOR UPDATE OF s SKIP LOCKED
   LIMIT 100
)
UPDATE "Send" SET status = 'claimed', "claimedAt" = now()
 WHERE id IN (SELECT id FROM due)
RETURNING id, "campaignId";
```

Then for each claimed send, in application code:
1. Re-check the send window and day-of-week (a send scheduled for 17:59 that the tick
   picks up at 18:04 must be pushed to tomorrow, not sent late).
2. Re-check the suppression list — the contact may have replied to a different campaign
   since scheduling.
3. Consume quota (§9.2). If refused, set back to `queued` with a new `scheduledAt`.
4. Enqueue a `send` job with the send id.

`SKIP LOCKED` is what makes this safe to run with more than one worker, and safe when a
tick overruns 60 seconds. Any send left in `claimed` for more than 10 minutes is
reclaimed to `queued` by a sweeper — that's your crash recovery.

### 10.3 Follow-ups

Max 2 follow-ups, minimum 3 days apart, enforced in the campaign builder. On a
successful send of step *n*, if step *n+1* exists and the contact has not replied,
create its `Send` row scheduled at `sentAt + delayDays`, snapped into the next eligible
window slot. Follow-ups must go **in the same thread**: set `In-Reply-To` and
`References` to the prior step's `providerMessageId`, and keep the subject with a `Re: `
prefix. A follow-up that starts a fresh thread reads as a second cold email.

---

## 11. Excel import

Multi-step, server-side, in `packages/core/import.ts` plus a wizard UI. Never
auto-trust headers.

1. **Upload** `.xlsx`/`.csv`, max 5 MB, max 2,000 rows. Parse with `exceljs` into a raw
   matrix. Reject a file with no data rows with a message naming the problem.
2. **Map** — show the first 5 rows in a table and let the user assign each column to
   `hr_name`, `email`, `company`, `title`, a named custom field, or "ignore". Pre-select
   a guess from fuzzy header matching, but the user confirms. `email` is the only
   required mapping.
3. **Validate** each row and bucket it:
   - trim, lowercase, strip mailto:, collapse internal whitespace
   - reject malformed addresses (use a real validator, not a naive regex)
   - flag role addresses (`info@`, `careers@`, `hr@`, `support@`, `admin@`,
     `noreply@`) as `skipped` by default with a "these get few replies — include
     anyway?" toggle
   - dedupe within the file (keep first, report row numbers of the rest)
   - drop anything on this user's suppression list
   - drop anything this user has already sent to in any previous campaign
4. **Report** before committing: `312 rows read · 287 will import · 19 duplicates ·
   6 invalid · 12 role addresses skipped`, with a downloadable CSV of every rejected row
   plus its reason. Only on explicit confirm do you write `Contact` rows, in one
   transaction.

This screen is where users lose confidence fastest. Precision in the counts and the
rejects file matters more than a pretty layout.

---

## 12. Templates

- Editor with a plain-text body, a variable palette (click to insert at cursor), and a
  live preview rendered against a real contact from a selected list — or dummy data if
  no list exists yet.
- Variables: `{{hr_name}}`, `{{first_name}}` (derived from `hr_name`), `{{company}}`,
  `{{title}}`, `{{my_name}}`, `{{my_college}}`, plus `{{custom.*}}` from mapped columns.
- Rendering is strict: an unresolvable variable is an **error**, not an empty string.
  Refuse to start a campaign if any contact would produce an unfilled variable, and show
  exactly which rows and which variable. "Hi , I saw that is hiring" is the single most
  damaging bug this app can ship.
- Provide 3 seeded starter templates (SDE application, referral request, follow-up).
  Write them as a student would: short, specific, one ask, no adjectives. Under 120
  words.
- Validation on save: warn if the body has no variable, if the subject is over 60
  characters, if the body is over 200 words, or if it contains obvious spam triggers
  ("guaranteed", "act now", all-caps runs, more than one exclamation mark).

---

## 13. Reply and bounce detection

Repeatable job every 15 minutes per active account (`poll-inbox`), staggered so all
accounts don't hit IMAP simultaneously.

Using `imapflow`, connect to the account, fetch messages in INBOX since
`lastPolledAt` (track `lastImapUid` for efficiency), and for each:

1. Parse `In-Reply-To` and `References` headers; match any value against
   `Send.providerMessageId` for this user. That's the reliable path.
2. Fallback: match the `From` address against a `Contact.email` the user has sent to in
   the last 30 days.
3. On a match: mark contact `replied`, create a `replied` event, set every remaining
   `queued`/`claimed` send for that contact to `cancelled`, and add the address to
   suppression with reason `replied`.
4. Detect bounces separately: sender is `mailer-daemon@`/`postmaster@`, or content-type
   is `multipart/report; report-type=delivery-status`. Extract the failed recipient from
   the DSN, mark that contact `bounced`, suppress, and run the §2.8 circuit-breaker check.

Skip open tracking entirely in v1. Pixels add spam signal, and Gmail's image proxy makes
open rates close to meaningless. Reply rate is the only metric that matters for this use
case, and you measure it exactly.

Handle IMAP failures gracefully — an auth failure here is an `account`-class error and
follows §8.2.

---

## 14. Screens

Auth-gated app shell with a left sidebar. Build these:

- **`/` landing** — one screen, what it does, who it's for, honest about the caps.
- **`/login`** — Google button, email/password below a divider.
- **`/onboarding`** — 4 steps, resumable, progress persisted: profile (name, college,
  timezone) → connect Gmail (with the app-password walkthrough inline, see §15) → upload
  resume → send a test email to yourself. The account is not `verifiedAt` until that
  test email succeeds. Do not let anyone create a campaign before that.
- **`/dashboard`** — sends today vs cap, replies this week, active campaigns with
  progress, and an alert region at top for anything demanding action (account error,
  paused campaign, warmup step-up).
- **`/resumes`** — list versions, upload new (signed upload URL, direct to Supabase
  Storage), set active,
  preview in an iframe. Never delete a resume referenced by a campaign; archive it.
- **`/templates`** — CRUD, editor per §12.
- **`/lists`** — list index, then the import wizard per §11, then a contact table with
  status filters and search.
- **`/campaigns/new`** — wizard: pick list → pick resume → pick template(s) and
  follow-up delays → set pace (per-day within the warmup cap, window, days of week,
  min gap) → **review**. The review step must show the computed first and last send
  dates, total emails, and a per-day breakdown *before* the user commits. This is the
  step that makes the pacing legible; do not reduce it to a summary sentence.
- **`/campaigns/[id]`** — header stats (queued / sent / replied / bounced), pause/resume/
  stop, and the send log: a virtualised table of every `Send` with contact, step,
  scheduled time, status, and error. Plus the signature timeline (§15).
- **`/settings`** — connected account with warmup stage and next step-up, reconnect
  flow, timezone, suppression list with manual add/remove, delete account (real cascade
  delete plus removal of every object under that user's storage prefix).
- **`/u/[token]`** — public, unauthenticated, one click, immediate confirmation.

Empty states are instructions, not decoration: "No lists yet. Upload an Excel sheet with
one HR contact per row" with the action right there.

---

## 15. Design direction

The subject is a dispatch console — a student watching a queue of applications leave
their own mailbox over two weeks. Density and legibility win; this is a tool someone
checks daily, not a landing page.

**Do not** produce: cream background with serif display and terracotta accent;
near-black with a single acid-green accent; a glassmorphism dashboard. The first two are
the current AI-design defaults, and glass on a data-dense table is illegible. Glass and
gradient may appear on the marketing landing page only, and nowhere in `(app)`.

**Tokens** — put these in `globals.css` as CSS variables and derive the Tailwind theme
from them. Do not introduce colours outside this set.

```
--ink:      #14161A   /* app background, warm-neutral graphite, not pure black */
--surface:  #1C1F24   /* cards, table rows */
--line:     #2A2F36   /* hairlines, 1px, used generously */
--text:     #E8E6E1   /* primary text, slightly warm off-white */
--muted:    #8B9199   /* secondary text, labels */
--accent:   #4F5BD5   /* indigo — interactive only: links, focus, primary buttons */
--pending:  #C9922E   /* amber — queued / in flight */
--good:     #3E9B6B   /* green — replied. the colour the user wants to see */
--bad:      #C4553F   /* clay red — bounced / failed */
```

Status colours are semantic and used *only* for status. Never decorative.

**Type** — display `Bricolage Grotesque` (600/700, used only for page titles and big
numbers), body `Public Sans` (400/500), data `JetBrains Mono` (timestamps, email
addresses, counts, message ids, quota fractions). The mono is not stylistic: monospaced
timestamps in a send log are scannable in a way proportional digits are not. Self-host
via `next/font`.

**Signature element — the dispatch strip.** On `/campaigns/[id]` and in the campaign
review step, render the schedule as a horizontal strip of days; each day is a thin
vertical column, and each send is a small tick positioned at its actual time of day
within the column. Sent ticks are `--good` or `--muted`, queued are `--pending`, failed
are `--bad`. The send window is a lighter band; off-hours are darker. At a glance the
student sees the shape of their outreach: the pacing, the gaps, the replies landing.
This is the one place to spend effort on craft. Keep everything around it flat and quiet.

Quality floor, unannounced: responsive to 375px, visible keyboard focus rings using
`--accent`, `prefers-reduced-motion` respected, all tables usable with keyboard, every
interactive element labelled. Transitions are 120–160ms or absent. No decorative
animation anywhere in the app shell.

Copy: sentence case, active voice, a button's label matches its resulting toast
("Start campaign" → "Campaign started"). Errors say what happened and what to do:
"Gmail rejected the app password. Generate a new one and reconnect." not "Auth error".

---

## 16. Build order

Complete each phase, verify its acceptance check, commit with a conventional-commit
message, and only then start the next. Report progress after each phase.

**Phase 0 — foundation.** Workspaces, TypeScript, Tailwind v4, shadcn init, Prisma with
the full §5 schema and an initial migration, zod-parsed env in `packages/config`, pino
with redaction, health-check route, `README.md` skeleton, `.env.example`.
*Accepts:* `npm run dev` boots web, `npm run dev:worker` boots the worker and logs a
tick, `npx prisma migrate dev` applies clean, `npm run typecheck` and `npm run lint` pass.

**Phase 1 — auth, profile, storage.** Auth.js with both providers, ToS gate, app shell,
Supabase Storage signed upload, resume upload/version/preview.
*Accepts:* sign in with Google, upload a 1 MB PDF, see it in an iframe, sign out; a
second user cannot fetch the first user's resume by id (write that test).

**Phase 2 — email account connect.** Encryption per §7, connect form with the inline
app-password walkthrough, `verify()` via SMTP, "send test email to myself", set
`verifiedAt`, warmup state display.
*Accepts:* a real Gmail app password connects, a test email arrives in your own inbox,
and `credentialEnc` appears in no API response and no log line.

**Phase 3 — templates.** CRUD, variable palette, strict render, live preview, spam-signal
warnings, 3 seeded starters.
*Accepts:* a template with `{{hr_name}}` previews against a dummy contact; a missing
variable surfaces an error naming the variable, not an empty string.

**Phase 4 — lists.** Full import wizard: upload → map → validate → report → commit,
rejects CSV, contact table with filters.
*Accepts:* import a deliberately messy sheet (blank rows, duplicate emails in different
cases, one malformed address, one `careers@`, a stray header row) and every count in the
report is exactly right.

**Phase 5 — the engine.** `computeSlots` with unit tests, campaign builder wizard with
the review breakdown, `Send` row generation, the tick, the send worker, quota and warmup
enforcement, error classification, the claimed-row sweeper.
*Accepts:* create a campaign of 6 contacts (5 to your own aliases, e.g.
`you+test1@gmail.com`) at 3/day with a 5-minute gap; 3 arrive today spread across the
window with unequal gaps, 3 tomorrow; pausing mid-run stops the rest; the daily cap
refuses the 4th; restarting the worker mid-campaign loses nothing and duplicates nothing.
**This phase is the product. Do not rush it.**

**Phase 6 — replies, bounces, suppression, unsubscribe.** IMAP poll, header matching,
DSN parsing, cancellation cascade, circuit breaker, public unsubscribe page.
*Accepts:* reply to one of your test emails from another account → within a poll cycle
the contact flips to `replied`, its pending sends become `cancelled`, and the address is
suppressed. Send to a known-invalid address → contact `bounced` and suppressed.

**Phase 7 — follow-ups and the dispatch strip.** Multi-step campaigns threaded correctly,
the §15 strip, dashboard alerts, campaign log polish.
*Accepts:* a 2-step campaign threads the follow-up under the original in Gmail, and
replying to step 1 prevents step 2 entirely.

**Phase 8 — Gmail OAuth (optional, behind a flag).** A second `EmailSender`
implementation using the Gmail API, plus `provider = 'gmail_oauth'` on the account. The
scheduler must not change at all — if it does, the §8.1 abstraction was wrong. Document
in `README.md` that the `gmail.send` scope is *sensitive*: in Testing status you are
capped at 100 test users and **refresh tokens expire every 7 days**, which silently
breaks scheduled campaigns; production use needs Google verification, unless the app is
registered as **Internal** to a Google Workspace org, which removes both limits.

---

## 17. Explicit anti-requirements

Do not, at any point:

- add a shared/application SMTP relay or a fallback "send via our server" path
- use `setTimeout`, `setInterval`, or `node-cron` in the web app for scheduling
- enqueue delayed jobs for the whole campaign at start time
- run the scheduler in a Next.js route handler, middleware, or Vercel cron
- use `localStorage` or `sessionStorage` for anything that must survive
- maintain denormalised counters instead of aggregating `Send`
- add tracking pixels, link-wrapping redirects, or open-rate reporting
- allow a per-day cap above 50, or any UI to raise the warmup ceiling
- render a variable as an empty string when data is missing
- log, return, or display a decrypted credential
- add an AI email-writing feature (out of scope; it produces the generic emails this
  tool exists to avoid)

---

## 18. Environment variables

Generate exactly this `.env.example`, with these comments:

```dotenv
# --- Database (Neon) -------------------------------------------------------
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# --- Redis (Upstash or Railway). BullMQ needs maxRetriesPerRequest: null ---
REDIS_URL="rediss://default:pass@host:6379"

# --- Auth.js ---------------------------------------------------------------
AUTH_SECRET=""                 # openssl rand -base64 32
AUTH_URL="http://localhost:3000"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# --- Credential encryption -------------------------------------------------
ENCRYPTION_KEY=""              # openssl rand -hex 32  → exactly 64 hex chars
                               # rotating this makes every stored app password
                               # undecryptable. back it up.

# --- Supabase Storage (resumes) --------------------------------------------
SUPABASE_URL=""                # https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=""   # SERVER ONLY. never NEXT_PUBLIC_, never sent to browser
SUPABASE_STORAGE_BUCKET="resumes"

# --- App -------------------------------------------------------------------
APP_URL="http://localhost:3000"   # used to build unsubscribe links
UNSUBSCRIBE_SECRET=""             # openssl rand -hex 32, for signing tokens
LOG_LEVEL="debug"
SEND_DRY_RUN="false"              # true = write sends, never call SMTP
```

`packages/config` parses these with zod at boot and **fails loudly** with the missing
key names. Both apps import from it; neither reads `process.env` directly.

`SEND_DRY_RUN=true` must be honoured by the send worker so the whole engine can be
exercised without touching a real mailbox. Use it in your own testing before phase 5's
acceptance check.

---

## 19. Testing

- Unit (vitest, no DB): `computeSlots` incl. DST and window edges, warmup cap table,
  template render/validate, email normalisation and role detection, crypto round-trip,
  error classification from real SMTP error strings.
- Integration (test Postgres): campaign start creates exactly N sends; starting twice
  creates no duplicates; the tick claims each send exactly once across two concurrent
  workers; quota refuses the cap+1th; reply cancels pending sends.
- Auth: every API route returns 401 unauthenticated and 403/404 for another user's
  resource.
- Fixture: commit a deliberately messy `fixtures/contacts-messy.xlsx` and assert the
  exact import report counts.

Then write `README.md`: what it is, the constraints from §2 stated plainly, local setup,
migration commands, how to run both processes, how to deploy (web → Vercel, worker →
Railway), and a "known limits" section (Gmail 500/day ceiling, no open tracking, IMAP
poll latency up to 15 min).

Also write `OPERATIONS.md` covering: what to do when an account errors, how to reclaim
stuck `claimed` sends, how to pause everything at once, and how to rotate
`ENCRYPTION_KEY` (decrypt-all then re-encrypt migration script — write it).

---

## 20. Legal surface

Generate real `/terms` and `/privacy` pages, not lorem ipsum. They must state: the user
is the sender and is responsible for their contact list; scraped or purchased lists are
prohibited; the app stores an encrypted mailbox credential used only to send the user's
own campaigns and read replies to them; resumes are stored in object storage and deleted
on account deletion; account deletion is self-service. Mark them clearly as templates
that need review before real deployment.

---

## 21. How to work

- Ask me before choosing differently on anything in §2, §3, or §17.
- Keep `DECISIONS.md` current: date, decision, alternatives, why.
- Commit per phase with a conventional-commit subject and a body listing what the
  acceptance check verified.
- After each phase, report: what works, what you skipped, what needs a real credential
  from me before it can be verified.
- If a phase's acceptance check cannot pass, stop and tell me. Do not proceed on a
  broken engine and do not stub over it silently.
