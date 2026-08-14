# Decisions

Running log of anywhere this build deviated from, or filled a silent gap in,
`BUILD_SPEC.md`. Newest first.

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
