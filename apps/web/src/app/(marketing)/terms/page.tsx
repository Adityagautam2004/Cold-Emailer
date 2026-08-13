export default function TermsPage() {
  return (
    <main className="min-h-screen bg-ink px-6 py-16 text-text">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 rounded-md border border-pending/40 bg-surface px-4 py-3 text-sm text-pending">
          This is a template. It has not been reviewed by a lawyer. Read it, edit it, and
          have it reviewed before you rely on it with real users.
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Terms of service</h1>
        <p className="mt-2 text-sm text-muted">Last updated: see your deployment date.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-text">
          <section>
            <h2 className="font-semibold">1. What Dispatch does</h2>
            <p className="mt-2 text-muted">
              Dispatch lets you connect your own email mailbox, upload a list of contacts
              and a resume, and schedule outreach emails that are sent from your own
              mailbox at a pace you control. Dispatch is not an email service provider —
              it does not send email on anyone&apos;s behalf from a shared address, and
              there is no way to opt out of the sending limits described below.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">2. You are the sender</h2>
            <p className="mt-2 text-muted">
              Every email Dispatch schedules is sent from your own connected mailbox,
              under your name. You are the sender of record, and you are responsible for
              the accuracy of your contact list, the content of your messages, and
              compliance with applicable law (including India&apos;s DPDP Act and, if you
              contact recipients outside India, laws such as the US CAN-SPAM Act).
            </p>
          </section>

          <section>
            <h2 className="font-semibold">3. Contact lists</h2>
            <p className="mt-2 text-muted">
              You may only upload contacts you have a legitimate basis to email — for
              example, HR or recruiting contacts you are reaching out to about your own
              job search. <strong>Importing scraped or purchased contact lists is
              prohibited.</strong> Dispatch does not verify the source of your list; you
              are solely responsible for it.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">4. Your mailbox credential</h2>
            <p className="mt-2 text-muted">
              To send on your behalf, Dispatch stores an app-specific password or OAuth
              token for your mailbox, encrypted at rest. This credential is used
              exclusively to send the campaigns you create and to read replies to those
              campaigns in your inbox — never for anything else, and it is never shown
              back to you or anyone else once entered.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">5. Sending limits</h2>
            <p className="mt-2 text-muted">
              Every account is capped at 50 emails per day and starts on a slower warmup
              ramp. These limits exist to protect your mailbox&apos;s sending reputation and
              cannot be raised, including by Dispatch&apos;s operator.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">6. Resumes and other files</h2>
            <p className="mt-2 text-muted">
              Resume files you upload are stored in private object storage, accessible
              only to you. They are permanently deleted when you delete your account.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">7. Account deletion</h2>
            <p className="mt-2 text-muted">
              You may delete your account and all associated data — contacts, campaigns,
              resumes, and your mailbox credential — at any time from Settings. This
              action is self-service and irreversible.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">8. No warranty</h2>
            <p className="mt-2 text-muted">
              Dispatch is provided as-is, run by a fellow student, without warranty of any
              kind. It is not a substitute for your own judgment about who to contact or
              what to send them.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
