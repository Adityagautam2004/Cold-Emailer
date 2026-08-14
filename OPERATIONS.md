# Operations

Runbook for the person operating this deployment day to day — not a student-facing doc.

## An account errored out

**What happened:** an SMTP send or an IMAP poll hit an authentication failure (Gmail
revoked the app password) or found the stored credential undecryptable. Either one flips
`EmailAccount.status` to `error` (with `statusReason` set to something readable) and — in
the same transaction — pauses every `running` campaign on that account, and logs an
`account_error` Event. This happens automatically; there's nothing to trigger by hand.

**What to tell the student (or do yourself, in Settings):**

1. Go to **Settings** — the account shows as errored, with the reason.
2. Generate a fresh Gmail app password (the same walkthrough as initial connect:
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)) and
   submit it through **Reconnect**. That route re-verifies the credential against real
   SMTP before saving anything, so a still-bad password is rejected with a clear error
   rather than silently re-saved.
3. A successful reconnect flips the account back to `active` and clears `statusReason` —
   but it **deliberately does not resume any campaigns** that were auto-paused (the
   pause is what stopped things going further wrong; resuming isn't assumed to be safe by
   default). Go to each affected campaign and click **Resume** once you're confident it's
   safe to continue.

**If reconnecting doesn't fix it:** check `warmupStartedAt` wasn't accidentally reset (it
shouldn't be — reconnecting preserves it, see `DECISIONS.md`), and check the worker's logs
for the specific SMTP/IMAP response text `classifySendError`/the connect failure surfaced.

## Sends stuck in `claimed`

**Normal case — nothing to do.** Every tick (every 60 seconds) runs
`sweepStuckClaims()` first, which resets any `Send` that's been `claimed` for more than 10
minutes back to `queued`. This is what recovers from a worker crashing mid-send. You'll
see `"swept stuck claimed sends back to queued"` in the worker log when it fires.

**If sends are staying stuck longer than ~10-11 minutes:** the worker process itself is
probably down (check `apps/worker` is actually running — `npm run dev:worker` locally,
the Railway service in production) or its Redis connection is broken. Nothing about the
`Send` rows themselves needs manual repair once the worker is back — the next tick's
sweep picks them up on its own.

**To force it immediately** rather than waiting for the next tick (e.g. mid-incident,
worker just came back up), open Prisma Studio (`npm run prisma:studio`) or run:

```sql
UPDATE sends SET status = 'queued', "claimedAt" = NULL
 WHERE status = 'claimed' AND "claimedAt" <= now() - interval '10 minutes';
```

## Pause everything, right now

There's no single "kill switch" button in the UI — pausing is per-campaign by design
(§17: nothing schedules or cancels a whole campaign's worth of jobs at once, the tick
claims one `Send` row at a time). For a real incident (e.g. you need to stop **every**
running campaign across **every** user immediately — a credential leak, a bug you just
found, anything where "resume individually once verified safe" is the right recovery
shape), run:

```sql
UPDATE campaigns SET status = 'paused', "pauseReason" = 'paused by operator — incident'
 WHERE status = 'running';
```

This is safe to run at any time: it only stops the tick from claiming *new* `Send` rows
for those campaigns (`claimDueSends()` requires `c.status = 'running'`) — nothing
in-flight is corrupted, and every campaign resumes exactly where it left off once you set
it back to `running` (or a student clicks **Resume**) individually. There is deliberately
no "resume all" — each one should be a conscious decision once you know it's actually
safe.

## Rotating `ENCRYPTION_KEY`

Every stored Gmail app password is encrypted with `ENCRYPTION_KEY` (§7, AES-256-GCM).
Rotating it without re-encrypting every stored credential first would instantly break
every connected account. Sequence matters:

1. Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. **Back up the current `ENCRYPTION_KEY` value somewhere safe** — you need it as the
   *old* key in the next step, and there is no other way to recover it.
3. Update `.env`'s `ENCRYPTION_KEY` to the **new** value.
4. Run the migration script, passing the **old** key explicitly:

   ```bash
   OLD_ENCRYPTION_KEY=<the previous key> npm run rotate-encryption-key
   ```

   This decrypts every `EmailAccount.credentialEnc` with the old key and re-encrypts it
   with the new one (now live in `.env`), one row at a time. It never logs a decrypted
   value — only account ids and a final rotated/skipped count (`scripts/rotate-encryption-key.mjs`).
   A row that fails to decrypt with the old key is skipped and logged, not silently
   dropped — investigate any skips before considering the old key fully retired.
5. Restart the worker (and redeploy the web app, if this is production) so every running
   process picks up the new key from its environment.
6. Discard the old key once you've confirmed a normal send/poll cycle works.

If the wrong key is ever lost with no working backup, every connected account is
unrecoverable — every student would need to reconnect (§7's own warning, repeated here
because it's the one mistake in this whole runbook with no undo).
