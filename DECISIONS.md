# Decisions

Running log of anywhere this build deviated from, or filled a silent gap in,
`BUILD_SPEC.md`. Newest first.

## 2026-08-14 — Phase 6

**Reply, bounce, and unsubscribe all share one cascade helper** (`suppressEmailCascade` in
`packages/db/src/suppression.ts`), not three separate implementations. All three mean the
same thing operationally — this address, everywhere it appears across the user's lists,
stops receiving anything — and `reason` (`replied`/`bounced`/`unsubscribed`) maps directly
onto `Contact.status`. It lives in `packages/db` rather than `packages/core` because it's
the one place both `apps/web` (the unsubscribe route) and `apps/worker` (reply/bounce
detection) can both reach without duplicating Prisma calls; `packages/core` stays
DB-free per its existing convention. The cascade touches **every** `Contact` row across
the user's lists that shares the email, not just the one row that triggered the match —
the same recruiter can appear in more than one uploaded list.

**`/u/[token]` is a `route.ts`, not a `page.tsx`.** Next.js won't allow both on the same
segment, and a plain React page can only handle GET. The email's `List-Unsubscribe-Post`
header (set in `packages/core/src/mail.ts` back in Phase 5) advertises RFC 8058 one-click
support — meaning the *recipient's own* mail provider (Gmail, Outlook) can POST directly
to this URL from its native "Unsubscribe" chip, without ever rendering a page. Not
supporting that POST would mean quietly breaking a feature we already claim to support.
GET performs the unsubscribe immediately and renders a hand-built HTML confirmation
(inline styles, not Tailwind — a route handler has no access to the app's CSS pipeline);
POST does the same and returns bare JSON. Both paths are idempotent, so a mail security
scanner prefetching the GET link is a harmless no-op, not a data-loss risk.

**IMAP's first poll for a newly-connected account never scans pre-existing mailbox
history** — it only records the current `uidNext` as a baseline (`lastImapUid`) and
returns. §13 says "fetch since `lastPolledAt`," which is ambiguous on a first poll with no
prior value. Scanning years of old INBOX history for reply/bounce matches the first time
an account connects would be slow, mostly irrelevant (nothing in that history could match
a `Send.providerMessageId` that didn't exist yet), and risks false-positive fallback
matches against unrelated old mail from the same sender addresses.

**Bounce recipient extraction has a heuristic fallback beyond RFC 3464 parsing.** The
primary path parses the `message/delivery-status` MIME part's `Final-Recipient`/
`Original-Recipient` field — but real-world bounces from arbitrary receiving mail servers
are inconsistent about including that part correctly. `extractLikelyBouncedRecipient`
falls back to scanning the DSN's human-readable body for the first email address that
isn't the receiving mailbox's own address or a generic mailer address. Heuristic, not
exact — documented as such, and only ever reached when the structured part is absent.

**A `decrypt()` failure on a stored credential is now an account-class error in both the
send job and poll-inbox**, not an uncaught exception. Found live: two leftover
test `EmailAccount` rows with deliberately-fake `credentialEnc` values (`"v1.fake.fake.fake"`)
were still `status: 'active'` when the newly-added poll-inbox scheduler picked them up: the
`decrypt()` call threw, and — before this fix — that would have propagated out of the job
entirely, meaning the exact same account gets retried and fails identically every 60
seconds (poll-inbox) or every 10-minute stuck-claim sweep (the send job) forever, forever
spamming errors without ever surfacing to the student that their mailbox needs
reconnecting. An undecryptable credential can't succeed on retry the way a network blip
can, so both jobs now call the same `pauseAccountOnError` used for real SMTP/IMAP auth
failures — the account flips to `status: 'error'` and stops being selected as "due" at
all, exactly like a real auth failure. `pauseAccountOnError` itself was extracted from
`send.ts`'s existing account-error branch (Phase 5) into `apps/worker/src/account-errors.ts`
so poll-inbox doesn't duplicate it.

**Added `@types/mailparser` as a dev dependency of `packages/core`.** `mailparser` ships
no bundled `.d.ts` of its own (unlike `imapflow`, which does); without the DefinitelyTyped
package every import comes through as untyped `any`, which would have hidden real
mistakes in the header/attachment handling this phase depends on.

**Raised vitest's global `testTimeout` to 20s** (from the 5s default). Not a product fix —
an integration test that reliably passes in isolation in ~4s occasionally timed out only
when the *entire* suite ran (every test file in its own worker process, all sharing one
real pooled Supabase connection — no separate test DB, per the Phase 0 decision below).
More concurrent round trips through one pool under a full run occasionally push a single
round trip past 5s; reducing file-level parallelism instead would slow every run to fix a
rare full-suite-only flake, so the timeout moved instead.

## 2026-08-14 — Phase 5

**`packages/config`'s shared logger never uses pino's `transport` option, even
conditionally.** Passing `{transport: {target: "pino-pretty", ...}}` — even behind a
runtime `if (env === "development")` — crashed the Next.js dev server
("Cannot find module .../vendor-chunks/lib/worker.js"). `pino-pretty`'s transport spawns
a `worker_thread` pointed at `thread-stream`'s `lib/worker.js`; webpack statically traces
and tries to bundle that path the moment the option merely exists in a traced module,
regardless of whether the branch actually runs. Initially misdiagnosed as OneDrive file
locking (the project lives in a OneDrive-synced folder) before root-causing it directly.
Fixed by having the shared logger always emit plain JSON (no `transport` at all); `apps/worker`
(a plain `tsx`/Node process, never webpack-bundled) instead pipes its own stdout through
the `pino-pretty` CLI as a separate process (`"dev": "... tsx watch src/index.ts | pino-pretty"`
in its `package.json`).

**Found via a test-cleanup failure, has a real product implication:** `CampaignStep.template`
is `onDelete: Restrict` on purpose (Phase 3 — deleting a template still referenced by a
campaign should fail with a friendly error, not silently erase that campaign's history).
But a plain `prisma.user.delete()` cascades to `Template` (via `User`'s own cascade) and to
`Campaign`/`CampaignStep` (via a separate cascade path) independently — Postgres doesn't
guarantee the CampaignStep side is gone before it tries to delete the Template side, so a
whole-account deletion can trip the same Restrict constraint. **Not fixed by loosening the
constraint** (that would defeat the Phase 3 guarantee) — instead, whoever deletes a User
must explicitly delete that user's `Campaign` rows first (cascades `CampaignStep`/`Send`
before `Template` is touched). Test cleanup here does this; the real self-service "delete
my account" feature (§14 Settings, not yet built) will need the same explicit ordering —
noted here so it isn't rediscovered the hard way.

**Send-row generation and the campaign builder's review step share `computeSlots` with
zero duplication** — the wizard's live per-day breakdown, the actual `/start` route's Send
creation, and even mid-campaign follow-up scheduling (a single-slot `computeSlots` call)
all call the exact same function from `packages/core`. There is no second scheduling
implementation anywhere to drift from the tested one.

**Follow-up threading reuses step 0's `renderedSubject`, not the follow-up template's own
subject.** §10.3 says keep "the subject" with a `Re: ` prefix for threading — interpreted
as the thread's original subject line, since most mail clients group by subject text in
addition to `References`/`In-Reply-To`, and a follow-up template's own distinct subject
would read as a second cold email even with correct headers. The follow-up template's
`subject` field is still meaningful when that same template is used as an initial (step 0)
send in a different campaign — it's simply not used for its own subject when acting as a
follow-up.

**A permanent SMTP-time rejection counts toward the bounce circuit breaker (§2.8) the same
as a Phase 6 IMAP-detected DSN bounce** — both mean "this contact bounced," so
`checkCircuitBreaker` is one shared function keyed off `Contact.status === 'bounced'`
regardless of which path set it. Denominator is every `Send` that reached a final outcome
(`sent` or `failed`) for the campaign, not just successes — an all-failing campaign should
still trip the breaker well before 20 *successful* sends ever happen.

**Verified end-to-end against a real worker process** (not just code review), using
`SEND_DRY_RUN=true` and a directly-inserted `EmailAccount` row with a fake credential —
legitimate because the dry-run path returns before `createSender()`/`decrypt()` are ever
reached, so no real Gmail credential is required to exercise the scheduling, quota, pause/
resume, and idempotency machinery honestly. What this can't cover without a real Gmail app
password: an actual SMTP handshake succeeding and a real email landing in a real inbox
(covered narrowly already in Phase 2's verify() path against real Gmail with a wrong
password). The claim-uniqueness (`SKIP LOCKED`) and stuck-claim sweeper mechanics are
covered directly against the real DB with concurrent callers and a backdated `claimedAt`,
rather than by trying to choreograph an actual worker-process kill/restart across tool
calls — the same mechanisms that make that safe (unique constraint, `SKIP LOCKED`, the
10-minute sweep) are what's under test either way.

**Real product bug, caught only by the live end-to-end run above, not by unit tests:**
`computeSlots` deliberately clamps a day's last slot to exactly `windowEnd` whenever
jitter would overshoot (by construction, this happens roughly half the time — the last
item's `baseInterval` always equals the exact remaining span, so any `jitterMul > 1`
clamps down to precisely `dayEnd`). `processClaimedSend`'s window recheck
(`apps/worker/src/jobs/tick.ts`) compared `isWithinSendWindow(new Date(), ...)` — a
byte-exact wall-clock comparison — against that same `windowEnd`. Any nonzero delay
between a slot's `scheduledAt` firing and the tick actually processing that row (typically
a few hundred ms to a few seconds; always > 0) pushed `now()` past `windowEnd`, so the
recheck saw "outside window" and bounced the send to `nextEligibleWindowStart` — which,
with a narrow `daysOfWeek` set, could be days out. First surfaced as a live acceptance
test failure (a send scheduled for exactly `windowEnd` never reached `sent` within a
10-minute poll) and reproduced twice before the root cause was clear. Fixed by tolerating
a grace period measured from the send's own `scheduledAt` (`WINDOW_RECHECK_GRACE_MS`,
5 minutes) rather than doing an exact `now()`-vs-`windowEnd` comparison — a send is still
correctly deferred if it's genuinely stale (claimed long after it was due, e.g. after a
worker outage), just not if it merely landed on the exact edge of its window. Regression
tests added in `tick.test.ts` for both the grace-period pass-through and the
genuinely-stale-still-defers case; `processClaimedSend` exported for direct testing.

**The acceptance script's own pause/resume check had a latent assumption bug, unrelated to
product code:** it reused the same `Send` row across the quota-cap-refusal assertion and
the pause/resume assertion, but a `perDayCap: 3` campaign that had already placed 3
successful sends will correctly refuse a 4th regardless of pause state — so "resume and
verify it proceeds" could never have passed as originally written. Fixed by bumping the
campaign's `perDayCap` between the two dimensions being tested, since quota-refusal and
pause/resume gating are independent behaviours that don't need to share exhausted quota
to both be exercised honestly.

## 2026-08-14 — Phase 4

**Mapping and the pre-commit report run entirely client-side**, reusing the exact same
pure functions from `packages/core` (`guessColumnMapping`, `bucketRows`,
`formatImportSummary`, `rejectedRowsToCsv`) that the fixture test exercises. Only the
initial parse (`POST /api/lists/import/parse`, needs `exceljs` + the file bytes) and the
final commit (`POST /api/lists`, needs the DB) touch the server. This means what the user
previews in the report step is provably the same computation as the fixture test, not a
second parallel implementation that could drift from it.

**"Already contacted" is read off `Contact.status` (`notIn: ["pending","skipped"]`), not
a Send/Campaign join.** §11 says "already sent to in any previous campaign"; since
`Contact.status` is exactly what Phase 5's worker mutates to `sent`/`replied`/`bounced` as
campaigns run, checking it directly is equivalent to the join and much cheaper. Verified
directly against the DB (Phase 5's engine doesn't exist yet to produce this state
naturally): a contact manually set to `status: "sent"` is correctly excluded on a later
import, one left `pending` for the same list is not, and a `Suppression` row excludes
independently of `Contact.status` — all scoped per-user via `partitionAgainstUserHistory`.

**Built `fixtures/contacts-messy.xlsx` to match the exact scenario named in the build
spec** (blank row, duplicate emails differing only in case, one malformed address, one
`careers@`, a stray repeated header row) and hand-verified the arithmetic before writing
the assertion: 9 sheet rows → 1 blank (excluded) → 7 read → 3 import / 1 duplicate / 2
invalid (the malformed one and the stray header row, whose "email" cell is literally the
text "Email") / 1 role-skipped. `bucketRows`'s bucket categories are mutually exclusive
and exhaustive by construction (see Phase 0 notes), so `totalRowsRead` equals the sum of
the four buckets exactly — this is what "every count in the report is exactly right"
means operationally here, verified in `import.fixture.test.ts`.

## 2026-08-14 — Phase 3

**The 3 seed templates are per-user, created lazily on first `GET /api/templates`**, not a
shared/global template concept. §5's schema gives `Template` a `userId` with no notion of
a system-owned template, so "every new user gets 3 starters" means creating real owned
rows for each user the first time their template list is loaded (idempotent — checks
`count === 0` first), rather than adding new schema surface for something read-only.

**Template save-time validation (§12's warnings) never blocks saving** — only starting a
campaign is blocked by the hard §2.4 rule (`hasPersonalizationVariable`). A template with
zero variables can be saved (with a warning) since a student might reasonably draft one
before deciding on personalisation, or use it as a base for a follow-up step.

**The live preview renders subject and body as two independent `renderTemplate` calls**,
not one combined string split back apart — simpler and doesn't risk a false match if a
body ever contained the separator text.

**Preview uses dummy data only, for now.** §12 says preview should run "against a real
contact from a selected list — or dummy data if no list exists yet." Lists don't exist
until Phase 4, so every template preview in this phase necessarily uses the dummy
contact (`Priya Sharma / Acme Corp / SDE Intern`). Revisit at the end of Phase 4: add a
list-selector to `TemplateEditor` so an existing list's real first contact can be chosen.

**Verified live against the real dev server, not just by inspection:** a fresh user's
first `/api/templates` call returns exactly the three named seed templates; a
newly-created template with no variable gets exactly one `no-variable` warning; editing
it to include `{{hr_name}}`/`{{company}}` clears the warnings; a second user gets their
own independent set of 3 seeds (no id overlap) and a 404 on the first user's template id.

## 2026-08-14 — Phase 2

**The onboarding wizard's "Connect Gmail" and "Send test email" steps share one UI panel
(`EmailAccountManager`)** rather than being two separate screens. §14 lists them as
distinct steps, and they're tracked as distinct completion checkpoints in the stepper —
but the actual "send test email" button naturally lives right where the account just got
connected, and forcing an extra screen transition to reach a button that's already visible
would be worse UX for no real benefit. The hard constraint this preserves is the one that
actually matters: `verifiedAt` is what gates campaign creation, not screen count.

**Reconnecting a mailbox (new app password after Gmail revokes the old one) does not
reset `warmupStartedAt`.** It's the same mailbox with the same sending history — resetting
would be pointless (it can only lower the cap, never raise it) and would make the warmup
stage display lie about how long the account has actually been sending.

**Verified the SMTP error-classification pipeline against real Gmail**, deliberately: a
connect request with a wrong app password against real `smtp.gmail.com:465` was rejected
by Gmail's actual server, correctly classified as an `account`-class error, and surfaced
the exact copy from §8.2's own example — "Gmail rejected the app password. Generate a new
one and reconnect." — not a generic "Auth error." Also confirmed a failed connect attempt
never creates an `EmailAccount` row (verify() runs before any Prisma write).

**What still needs your own Gmail app password:** actually succeeding at connecting an
account and receiving the test email in a real inbox. Everything downstream of a
successful `verify()` call — encryption, the safe-select shape, warmup display, reconnect
— is code-reviewable and the credentialEnc-never-leaks guarantee is covered by a real
integration test, but a genuine end-to-end "it arrived in my inbox" check needs you.

## 2026-08-14 — Phase 1

**Split the Auth.js config into `auth.config.ts` (Edge-safe) and `auth.ts` (full).**
Next.js middleware runs on the Edge runtime by default. The full config's Credentials
provider calls `argon2.verify()`, and argon2 is a native Node addon — importing it in
middleware crashes the build (`UnhandledSchemeError: node:crypto`). `auth.config.ts` holds
only the Google provider and the JWT callbacks (everything Edge-safe); `middleware.ts`
builds its own lightweight `NextAuth(authConfig)` instance from that. `auth.ts` spreads
`authConfig` and adds the Credentials provider plus the Prisma adapter, and only ever runs
in Node-runtime route handlers and server components. This is Auth.js's own documented
pattern for exactly this situation, not a spec deviation, but worth recording since it
means two config files where one might be expected.

**The ToS gate (§6) is checked in the `(app)` layout server component, not middleware.**
Middleware only verifies a session exists (Edge-safe, no DB access). Whether
`acceptedTosAt` is set requires a fresh Prisma read, which needs the Node runtime — so
that check lives in `src/app/(app)/layout.tsx`, which redirects to `/accept-terms` itself.

**Resume upload is two-step: `upload-url` (pre-generates a client-side id, returns a
signed PUT url) then `confirm` (creates the DB row only after verifying the object exists
in storage).** A single-step "create row, then upload" would leave an orphaned DB row
pointing at nothing if the browser's PUT fails. Verified the raw signed-upload-URL
contract directly against the real Supabase bucket before building the UI around it: a
plain `fetch(signedUrl, {method:"PUT", headers:{"Content-Type":"application/pdf"}, body})`
works with no client-side Supabase SDK or exposed key at all — §3's "no CORS setup needed"
note was the tell that this was the intended shape.

**A resource owned by a different user reports 404, not 403, everywhere (`getOwnedResume`
and everything modeled on it).** §19 allows either; 404 is used uniformly so a probing
request can't distinguish "not yours" from "doesn't exist."

**`packages/core/src/storage.ts` wraps Supabase Storage**, parameterized by config
(url/key/bucket) rather than reading env itself — same pattern as the `EmailSender`
interface — so both `apps/web` and the Phase 5 worker share one implementation without
`packages/core` importing Next.js or reaching into `@dispatch/config` directly.

**Test-only fixes, no product impact:** `server-only`'s default export unconditionally
throws outside Next's own bundler (it only resolves safely under the `react-server`
export condition, which vitest doesn't know about) — aliased to a no-op stub in
`vitest.config.ts` for tests only. Also found and fixed a bug in that same config file's
own `.env` parser: it split lines on `\n` only, and the file has CRLF endings, so every
line except the last kept a trailing `\r` that broke the end-anchored regex — silently
loaded exactly one env var. Fixed by splitting on `/\r?\n/`.

**No separate test database.** Integration tests (e.g. `resumes.test.ts`) run against the
same Supabase Postgres as local dev, with explicit `beforeAll`/`afterAll` create/cleanup.
Acceptable at this project's scale; noted here so it isn't mistaken for an oversight.

**Verified via a live E2E script (not committed) rather than solely by inspection:**
signup → credentials sign-in → session cookie → upload a real ~1MB PDF to the live
Supabase bucket → confirm → fetch the preview URL and diff the downloaded bytes against
the upload → a second user gets 404 on the first user's resume id and an empty list of
their own → unauthenticated requests get 401 → sign-out invalidates the session. All test
data (2 users, 1 storage object) was deleted afterward. **What this doesn't cover:** the
actual Google OAuth consent-screen click-through needs a real browser and your Google
account — the Credentials-provider path above exercises the identical session/storage/
isolation code downstream of sign-in, but the Google button itself needs your manual check.

## 2026-08-14 — Phase 0

**Added `directUrl` to the Prisma datasource, wired to a new `DIRECT_URL` env var.**
Not in §5's schema listing, but the user's Supabase project uses a pooled connection
(port 6543, pgbouncer) for `DATABASE_URL`; Prisma migrations need a direct, non-pooled
connection (port 5432) to run `CREATE`/`ALTER` safely. The setup checklist the user was
given anticipates this exact case. `packages/config`'s env schema treats `DIRECT_URL` as
optional so a plain single-URL Postgres setup still works.

**URL-encoded the DB password in `.env`.** The Supabase password contained `#`, `+`, `*`.
An un-encoded `#` truncates a URL at the fragment; Postgres connection strings must be
percent-encoded in the userinfo segment. Fixed in place; no code change.

**Added `college` field to `User`, plus `Account`/`Session`/`VerificationToken` models.**
§5's schema is silent on both. `college` is read by §12's `{{my_college}}` template
variable and §14's onboarding profile step, so `User` needs somewhere to store it.
`Account`/`Session`/`VerificationToken` are required by `@auth/prisma-adapter` for
Auth.js's database session strategy — not optional infrastructure, just not spelled out
in the domain model.

**`packages/config` hosts the shared `pino` logger, not just env parsing.** The repo
structure in §4 doesn't name a file for the logger; both `apps/web` and `apps/worker`
need it and both already depend on `packages/config` for env, so it lives there rather
than as a new package.

**`computeSlots` recomputes its interval from remaining time/item budget at every step**
instead of a fixed nominal interval plus a random walk. A pure random walk can drift
enough (with jitterRatio's default 0.6–1.4× multiplier) to blow through `windowEnd` or
violate `minGapMinutes` near the end of a full day. The adaptive version is
self-correcting by construction — every step recomputes `remainingSpan / itemsLeft` —
so both invariants hold regardless of what the RNG returns. Verified in
`schedule.test.ts` including a real US DST spring-forward transition.

**Email validity uses the `validator` npm package (`isEmail`)**, per §11's explicit
instruction to use a real validator rather than a naive regex.

**Worked around a type bug in exceljs's own bundled `.d.ts`.** `node_modules/exceljs`
ships `declare interface Buffer extends ArrayBuffer {}` at global scope, which conflicts
with the real Node `Buffer` type from `@types/node` and breaks `workbook.xlsx.load()`'s
call-site typing. Fixed with a narrow `as unknown as ArrayBuffer` cast at that one call
site (documented inline) rather than swapping libraries — §3 pins exceljs.

**Reverted `shadcn@latest init`'s default output.** The current CLI (v4.18) defaults to
an experimental `base-ui`/"base-nova" preset: it overwrote `globals.css`'s `--muted` and
`--accent` — names §15 also uses — with generic oklch grays, added a `.dark` toggle block
and a Geist font we never asked for. Reverted `globals.css`/`layout.tsx` to the exact §15
tokens, hand-wrote `components.json` (`style: "new-york"`, the mature Radix-based flavor),
and added a small shadcn-compatible semantic layer (`--color-background`, `--color-card`,
`--color-primary`, etc.) that only ever references the nine tokens already in §15 — no
new colours introduced. Future `npx shadcn add <component>` calls should render correctly
against our palette without needing this fix repeated.

**`dotenv-cli` loads the root `.env` for both apps.** Next.js only auto-loads `.env` from
its own app directory; `tsx` doesn't auto-load `.env` at all. Rather than symlink or
duplicate the file, both `apps/web` and `apps/worker`'s `dev`/`build`/`start` scripts run
through `dotenv -e ../../.env --`.

**Local `.env`'s `SEND_DRY_RUN` is `"true"`**, while `.env.example` documents `"false"` as
the production default. Matches the user's own setup checklist item 9.2 — a stray
`npm run dev:worker` locally should never call real SMTP.
