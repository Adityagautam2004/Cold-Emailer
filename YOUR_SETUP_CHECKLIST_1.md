# Your setup checklist

Everything Claude Code **cannot** do for you. Do items 1–6 before you start the build,
or at latest before Phase 2 — Claude Code will hit a wall without them.

All services below have free tiers that comfortably cover a few hundred students.

---

## 1. Generate your secrets first (2 minutes)

You don't need openssl. You already have Node, and Node's `crypto.randomBytes` is the
same cryptographically-secure source openssl would use.

Put `gen-secrets.mjs` in your project folder and run:

```bash
node gen-secrets.mjs
```

It prints all three values, correctly encoded, ready to paste into `.env`. Run it once.

**One-liners instead**, if you'd rather not keep the file:

```bash
# AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ENCRYPTION_KEY and UNSUBSCRIBE_SECRET (run twice, use different values)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If PowerShell mangles the quotes, use the script file, or switch to Git Bash — Git for
Windows ships an `openssl.exe`, so the original commands work there too.

**Do not use an online random-string generator**, and do not reuse any secret that has
appeared in a chat window, a screenshot, or a shared doc. `ENCRYPTION_KEY` protects every
student's mailbox credential; it needs to have existed only on your machine.

Sanity check before moving on: `ENCRYPTION_KEY` must be exactly 64 characters, all
`0-9a-f`. The app throws on boot if it isn't.

> **Back up `ENCRYPTION_KEY` somewhere outside the repo.** Every stored Gmail app
> password is encrypted with it. Lose or change it and every connected account breaks
> and each student has to reconnect. This is the one secret with no recovery path.

---

## 2. Postgres — Neon (5 minutes)

1. neon.tech → sign up → new project, region closest to you (`ap-southeast-1` for India).
2. Copy the **pooled** connection string from the dashboard.
3. `DATABASE_URL=` that string. Keep `?sslmode=require`.

Prisma migrations occasionally want a direct (non-pooled) URL. If `prisma migrate dev`
errors, add `DIRECT_URL=` with the unpooled string and tell Claude Code to add
`directUrl` to the datasource block.

Supabase works identically if you prefer it.

---

## 3. Redis — Upstash (5 minutes)

1. upstash.com → Redis → new database, same region as Neon, **eviction disabled**
   (BullMQ requires `noeviction`).
2. Copy the connection string in `rediss://` form — **not** the REST URL. BullMQ speaks
   the Redis protocol, not HTTP.
3. `REDIS_URL=` that string.

Free tier is 10k commands/day. A 60-second tick alone is ~1,440 ticks/day plus a few
commands each — fine early, but if you onboard a whole batch, move to Railway Redis
(~$5/mo, no command cap). Watch the Upstash usage graph in week one.

---

## 4. Resume storage — Supabase Storage (5 minutes, no card)

Cloudflare R2 asks for payment details even on the free tier. Supabase doesn't: 1 GB of
file storage and 5 GB egress per month, no card, and you can use the **same project** as
your database, so this replaces step 2 as well if you want.

1. supabase.com → sign in with GitHub → **New project**. Region `ap-south-1` (Mumbai) or
   `ap-southeast-1` (Singapore). Set a database password and save it.
2. **Storage** → New bucket → name it `resumes` → leave **Public** switched **off**.
   Set the file size limit to 2 MB and allowed MIME type to `application/pdf`.
3. **Project Settings → API**. Copy:
   - Project URL → `SUPABASE_URL`
   - `service_role` key (under "Project API keys", click reveal) →
     `SUPABASE_SERVICE_ROLE_KEY`
4. `SUPABASE_STORAGE_BUCKET="resumes"`.
5. No CORS setup needed — Supabase handles it for signed upload URLs.

**Using the same project for Postgres too?** Project Settings → Database → Connection
string → **Connection pooling** tab → copy the URI (port 6543) into `DATABASE_URL`, and
the direct one (port 5432) into `DIRECT_URL`. Then you can skip Neon entirely and you're
down to two accounts total. Tell Claude Code you're on Supabase for both.

Two things to know about the free tier:

- The `service_role` key bypasses all access rules. It is a **server-only** secret. Never
  put it in a `NEXT_PUBLIC_` variable and never import it into a client component. The
  spec already tells Claude Code this; check it during Phase 1 review.
- Free projects **pause after 7 days of no activity** and need a manual click to restore.
  Once your worker is running its 60-second tick, the project is never idle, so this only
  bites you if you step away mid-build. Restoring takes about a minute.

**If you'd rather not use Supabase**, `uploadthing.com` is the other genuinely card-free
option (2 GB, built for Next.js). Decide before Phase 1 and tell Claude Code — swapping
storage after the upload flow exists is annoying rework.

---

## 5. Google login — OAuth client (10 minutes)

This is for **signing in only**. It does not let the app send email, so it needs no
verification and no sensitive scopes.

1. console.cloud.google.com → new project ("Dispatch").
2. APIs & Services → OAuth consent screen → **External** → app name, your email,
   scopes: `email`, `profile`, `openid` only. Leave it in Testing; add your own address
   under Test users.
3. Credentials → Create credentials → OAuth client ID → **Web application**.
4. Authorised redirect URIs — add both:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.vercel.app/api/auth/callback/google`
5. Fill `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

While it's in Testing, only addresses you add as test users can log in. To open it up
later, hit "Publish app" — with only these three non-sensitive scopes there's no review.

If your college has Google Workspace and you can get access to the org's Cloud console,
set the consent screen to **Internal** instead. Anyone with a college address can then
log in immediately, and it unlocks the much better Gmail-API path later (see §8 of the
build spec).

---

## 6. A Gmail app password — for your own testing (5 minutes)

Each student will do this themselves during onboarding. You need one now to test.

1. The Google account **must** have 2-Step Verification on. If not:
   myaccount.google.com → Security → 2-Step Verification → enable.
2. Go to myaccount.google.com/apppasswords (search "app passwords" in account settings
   if the direct link redirects).
3. Name it "Dispatch", create, copy the 16-character code.
4. Paste it into the app's connect-email form. Spaces don't matter — the app strips them.
5. This does **not** go in `.env`. It lives encrypted in the database.

Common failures:
- **No app-passwords option** → 2FA isn't on, or you're on a Workspace account where the
  admin disabled them. Use a personal `@gmail.com` for testing.
- **535 auth failed** → you pasted your normal Google password, not the app password.
- **Revoked at any time** from that same page. Good to know for the demo: revoke it and
  confirm the app shows "Reconnect your Gmail" instead of silently failing.

---

## 7. Test aliases (do this before Phase 5)

Gmail ignores everything after a `+`, so `yourname+t1@gmail.com` … `+t6@gmail.com` all
land in your inbox but count as six distinct recipients. Put them in a test Excel sheet
and you can watch a real campaign pace itself without emailing a single stranger.

Also grab a second email account on another provider — you'll need it to reply from, to
test reply detection in Phase 6.

For a guaranteed bounce in Phase 6, send to a nonexistent address on a domain you
control. Avoid hammering random invalid addresses at real domains; that's exactly the
behaviour that damages sender reputation.

---

## 8. Deployment, when you get there

- **Web → Vercel.** Import the repo, set root directory to `apps/web`, paste every env
  var, update `AUTH_URL` and `APP_URL` to the real domain, and add the production
  redirect URI in Google Cloud.
- **Worker → Railway.** New service from the same repo, start command
  `npm run start:worker`, same env vars. It must be a **worker/background** service, not
  a web service — Railway will otherwise wait for an HTTP port and mark it unhealthy.
- Do **not** try to run the worker on Vercel. Serverless functions die after seconds;
  the tick and IMAP polling need a process that stays alive.

Total running cost at college scale: Vercel free, Supabase free, Upstash free,
Railway ~$5/mo for the worker. So $5/month, and that's the only card you'll need to put
down anywhere.

Watch one number as you grow: Supabase's 5 GB/month egress. Every email attaches a
resume, so a careless implementation re-downloads the same PDF 20 times a day per
student. §8.4 of the build spec makes the worker cache resume bytes in memory for exactly
this reason — verify that cache actually works during Phase 5, because without it a batch
of 300 students would burn the free egress in about two days.

---

## 9. Before you let other students use it

1. Read the generated `/terms` and `/privacy` and edit them — they're templates and they
   name you as the operator.
2. Confirm `SEND_DRY_RUN=false` in production but `true` in your local `.env` by default,
   so a stray `npm run dev:worker` never emails a real recruiter.
3. Run the acceptance check for Phase 5 against your own aliases one more time on the
   deployed setup, not just locally. Timezone bugs love production.
4. Tell your first five users plainly: the emails come from *their* Gmail, sending too
   many can get their own account rate-limited, and the caps are there to protect them.
   The tool's credibility with a batch of 300 students rests entirely on nobody's
   personal account getting flagged in week one.

---

## 10. Two things worth knowing before you build

**Gmail's real ceiling is 500 recipients/day** (2,000 on Workspace), and hitting it gets
the account temporarily locked out of sending. The app caps at 50 for exactly this
reason — a student's Gmail is their actual identity during placement season, and a
suspended account during interview scheduling is a much worse outcome than a slow
campaign. Don't raise the cap because someone asks.

**Cold outreach law applies to your users' sends, not just yours.** CAN-SPAM and India's
DPDP Act both matter here; the mandatory opt-out line and the honest sender identity in
the spec are what keep this on the right side of it. Keep them.
