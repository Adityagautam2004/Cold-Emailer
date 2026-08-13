export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ink px-6 py-16 text-text">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 rounded-md border border-pending/40 bg-surface px-4 py-3 text-sm text-pending">
          This is a template. It has not been reviewed by a lawyer. Read it, edit it, and
          have it reviewed before you rely on it with real users.
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: see your deployment date.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-text">
          <section>
            <h2 className="font-semibold">What we store</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
              <li>
                <strong>Your account:</strong> name, college, email, timezone, and (if you
                use email/password login) a salted password hash.
              </li>
              <li>
                <strong>Your mailbox credential:</strong> an app-specific password or OAuth
                token, encrypted at rest with AES-256-GCM. It is never written to logs,
                never returned by any API response, and never shown in the UI after entry.
              </li>
              <li>
                <strong>Your contacts:</strong> the HR contacts you upload — name, email,
                company, title, and any custom fields you map — plus whether each one has
                been sent to, replied, or bounced.
              </li>
              <li>
                <strong>Your resume:</strong> stored as a file in private object storage,
                accessible only to your account.
              </li>
              <li>
                <strong>Send and reply records:</strong> what was sent, when, and whether it
                was replied to or bounced — this is the data that makes reply tracking
                possible.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">How your mailbox credential is used</h2>
            <p className="mt-2 text-muted">
              Solely to send the campaigns you create from your own mailbox, and to check
              your inbox for replies to those campaigns and for bounce notifications. It is
              never used for anything else, and is decrypted only at the moment of sending
              or checking for replies.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">What we don&apos;t do</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
              <li>We don&apos;t track whether recipients opened your emails.</li>
              <li>We don&apos;t sell or share your contact list or your data with anyone.</li>
              <li>We don&apos;t use your mailbox for anything other than your own campaigns.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">Deleting your data</h2>
            <p className="mt-2 text-muted">
              Deleting your account from Settings is self-service and immediate. It removes
              your contacts, campaigns, send history, resumes (including the underlying
              files in object storage), and your mailbox credential.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Contact</h2>
            <p className="mt-2 text-muted">
              Questions about this policy should go to whoever operates your Dispatch
              instance — replace this section with a real contact address before
              deployment.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
