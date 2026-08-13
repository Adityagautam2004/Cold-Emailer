# Decisions

Running log of anywhere this build deviated from, or filled a silent gap in,
`BUILD_SPEC.md`. Newest first.

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
