# Dispatch

A cold-outreach console for final-year college students running job-search outreach.
A student signs up, connects their own Gmail, uploads a resume and an Excel sheet of HR
contacts, picks a template, sets a pace, and Dispatch sends those emails **from the
student's own mailbox** on a schedule, tracks replies, and stops chasing anyone who
answers.

Scale target: ~200–500 students, each with a few hundred contacts. This is a college
tool, not a SaaS. It optimises for correctness and deliverability, not throughput.

The core product value is pacing and reply tracking, not sending. Anyone can send an
email. Dispatch exists because it sends 20 a day instead of 300 at once, from a real
mailbox, and tells the student who replied.

## The constraints that shape everything here

These are enforced in code, not just documented — there is no UI path that lets a user
opt out of them:

1. **Every email is sent from the student's own mailbox.** No shared application SMTP
   relay, no shared sending domain, ever.
2. **Hard cap of 50 emails per account per day**, enforced server-side.
3. **Mandatory warmup ramp** on a newly connected account: 10/day for days 0–2, 20/day
   for days 3–5, 35/day for days 6–8, 50/day from day 9 on. Not user-editable.
4. **A campaign cannot start unless its template body contains at least one
   personalisation variable** (`{{hr_name}}`, `{{company}}`, `{{title}}`, `{{first_name}}`,
   or a mapped `{{custom.*}}` field).
5. **Every outgoing email includes a one-line opt-out** with a working unsubscribe link.
6. **A reply cancels every pending follow-up** to that contact, immediately.
7. **Suppression is absolute.** Replied, bounced, and unsubscribed addresses are never
   emailed again by that user, in any campaign.
8. **Bounce circuit breaker.** A campaign whose bounce rate exceeds 5% over at least 20
   sends is paused automatically, with the reason surfaced in the UI.
9. Mailbox credentials are encrypted at rest, never logged, never returned by any API
   route, never rendered in the UI after entry.
10. No list import from scraped or purchased sources.

See `BUILD_SPEC.md` for the full spec this was built against, and `DECISIONS.md` for
every place this build made a judgment call where the spec was silent.

## Repo layout

npm workspaces, two deployables sharing one Prisma client:

```
apps/web/       Next.js 15 App Router — the product UI and API routes
apps/worker/    BullMQ workers + the 60-second tick scheduler (long-running Node process)
packages/db/    Prisma schema, migrations, client singleton
packages/core/  Pure domain logic — crypto, quota/warmup, scheduling, templates, import,
                the EmailSender abstraction. No Next.js, React, or BullMQ imports; every
                file here is unit-testable without a server.
packages/config/ zod-parsed env (fails loudly on boot with the missing key names) and the
                shared pino logger, with credential fields redacted.
```

## Local setup

Requirements: Node 20+, npm.

1. Copy `.env.example` to `.env` and fill it in. You'll need, at minimum:
   - A Postgres database (Neon or Supabase both work — see `.env.example` for the pooled
     vs. direct URL note).
   - Redis with `noeviction` (Upstash free tier or Railway).
   - A Google OAuth client (for login only — see the setup checklist for the exact scopes;
     this does not grant Gmail send access).
   - `ENCRYPTION_KEY` and `UNSUBSCRIBE_SECRET` — each `openssl rand -hex 32`, or
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - A Supabase Storage project with a private `resumes` bucket (2 MB file size limit,
     `application/pdf` MIME type only).

   **Back up `ENCRYPTION_KEY` outside the repo.** Every stored Gmail app password is
   encrypted with it; losing or rotating it breaks every connected account (see
   `OPERATIONS.md` for the rotation procedure).

2. `npm install`
3. `npm run prisma:migrate` — applies the schema to your database.
4. `npm run dev` — boots the Next.js app on `http://localhost:3000`.
5. In a second terminal, `npm run dev:worker` — boots the scheduler/send/poll-inbox
   workers. **The app does not send anything without this process running.**

Keep `SEND_DRY_RUN=true` in your local `.env` (the example defaults to `false`, which is
the production setting) — with it on, the worker writes `Send` rows and advances state
but never calls SMTP. Turn it off only once you're deliberately testing against real Gmail
aliases (see the setup checklist's test-alias section).

## Common commands

| Command | Does |
|---|---|
| `npm run dev` | Web app, `http://localhost:3000` |
| `npm run dev:worker` | Worker (scheduler tick, send, poll-inbox) |
| `npm run prisma:migrate` | Apply schema changes locally (`prisma migrate dev`) |
| `npm run prisma:deploy` | Apply migrations in production (`prisma migrate deploy`) |
| `npm run prisma:studio` | Browse the database |
| `npm run rotate-encryption-key` | Rotate `ENCRYPTION_KEY` — see `OPERATIONS.md` |
| `npm run typecheck` | TypeScript across every workspace |
| `npm run lint` | ESLint (web app) |
| `npm test` | vitest — unit tests in `packages/core`, integration tests where noted |

## Deployment

- **Web → Vercel.** Import the repo, set the root directory to `apps/web`, add every env
  var from `.env.example`, and update `AUTH_URL`/`APP_URL` to the real domain. Add the
  production redirect URI (`https://<domain>/api/auth/callback/google`) in Google Cloud.
- **Worker → Railway.** New service from the same repo, start command
  `npm run start:worker`, same env vars. It must run as a **worker/background** service,
  not a web service — Railway will otherwise wait for an HTTP port and mark it unhealthy.
- The worker cannot run on Vercel — serverless functions don't stay alive long enough for
  a 60-second tick or 15-minute IMAP polling.

## Known limits

- Gmail's real ceiling is 500 recipients/day (2,000 on Workspace); Dispatch caps at 50
  well below that on purpose — a suspended personal Gmail account during placement season
  is a much worse outcome than a slower campaign.
- No open-rate tracking, by design (§13 of the build spec) — pixels are a spam signal and
  Gmail's image proxy makes the number meaningless anyway. Reply rate is the metric that
  matters here, and it's measured exactly.
- IMAP polling runs every 15 minutes per account, staggered — a reply can take up to that
  long to register and cancel follow-ups.
- Gmail OAuth sending (§16 phase 8) is optional/behind a flag; while Google's OAuth consent
  screen is in Testing, refresh tokens expire every 7 days, which silently breaks scheduled
  sends unless the app is verified or the Google Workspace org marks it Internal.

## Operating this

See `OPERATIONS.md` for: what to do when an account errors out, how to reclaim stuck
`claimed` sends, how to pause everything at once, and how to rotate `ENCRYPTION_KEY`.

## Legal

`/terms` and `/privacy` are real pages, not lorem ipsum, but are marked in-app as
templates that need a legal review before real deployment.
