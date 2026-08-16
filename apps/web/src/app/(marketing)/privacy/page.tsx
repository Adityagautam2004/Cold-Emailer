import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-ink px-6 py-16 text-text">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-muted transition-standard hover:text-text">
          ← Dispatch
        </Link>

        <div className="mb-8 mt-6 rounded-md border border-pending/40 bg-surface px-4 py-3 text-sm text-pending">
          This is a template drafted with India&apos;s Digital Personal Data Protection Act,
          2023 (DPDP Act) in mind, not a substitute for advice from a lawyer. Read it, fill in
          every bracketed placeholder, and have it reviewed before you rely on it with real
          users.
        </div>

        <h1 className="font-display text-3xl font-bold">Privacy policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: see your deployment date.</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-text">
          <section>
            <h2 className="font-semibold">Who this policy covers, and who is the Data Fiduciary</h2>
            <p className="mt-2 text-muted">
              This policy explains how Dispatch handles <strong>your own account data</strong>
              — for that data, Dispatch is the Data Fiduciary under the DPDP Act. It works
              differently for the <strong>contacts you upload</strong>: you decide whose data
              to collect and why, so under the DPDP Act <strong>you are the Data Fiduciary
              for your contact list</strong>, and Dispatch acts only as a processor carrying
              out your instructions (sending, tracking replies, applying your suppression
              list). If you&apos;re contacting people about your own job search, this is the
              same basis any recruiter or student already relies on when emailing HR contacts
              directly — Dispatch doesn&apos;t change who&apos;s responsible for that outreach,
              only how it&apos;s scheduled and tracked.
            </p>
          </section>

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
            <h2 className="font-semibold">Why we process this data (lawful basis)</h2>
            <p className="mt-2 text-muted">
              You give consent to this processing when you accept these terms and create an
              account, and again — specifically — when you connect a mailbox or upload a
              contact list. You can withdraw that consent at any time by disconnecting your
              mailbox or deleting your account (see below); withdrawing consent doesn&apos;t
              affect the lawfulness of anything already done with it. We only collect what
              the service actually needs to function (your mailbox credential to send,
              your contacts to schedule outreach, send records to track replies) — nothing
              is collected &quot;just in case&quot;.
            </p>
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
            <h2 className="font-semibold">How long we keep your data</h2>
            <p className="mt-2 text-muted">
              We keep your data for as long as your account exists, since campaign history,
              reply tracking, and suppression records only work by comparing against past
              sends. We don&apos;t have an automatic time-based deletion for an active
              account — instead, deletion is entirely in your control: see &quot;Deleting
              your data&quot; below. If required by law to retain any record after account
              deletion (for example, in response to a legal process), we retain only what
              the law requires and for no longer than it requires.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Where your data is stored</h2>
            <p className="mt-2 text-muted">
              Your data is stored with our infrastructure providers (database, object
              storage, and hosting), which may be located outside India. The DPDP Act
              permits transferring personal data outside India except to countries the
              Central Government specifically restricts by notification; we don&apos;t
              transfer your data to any such restricted country. <strong>[Operator: name
              your actual infrastructure providers and their hosting regions here.]</strong>
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Security</h2>
            <p className="mt-2 text-muted">
              We apply reasonable security safeguards appropriate to the sensitivity of what
              we hold: your mailbox credential is encrypted at rest (AES-256-GCM) and only
              ever decrypted in-memory at the moment it&apos;s used; access to the database
              and object storage is restricted to the running application. No system is
              perfectly secure, and we can&apos;t guarantee absolute security — but we treat
              your mailbox credential as the single most sensitive thing we hold, and design
              around that.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">If something goes wrong (breach notification)</h2>
            <p className="mt-2 text-muted">
              If we become aware of a personal data breach affecting your data, we will
              notify the Data Protection Board of India and you, as required under the DPDP
              Act, without undue delay.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">What we don&apos;t do</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
              <li>We don&apos;t track whether recipients opened your emails.</li>
              <li>We don&apos;t sell or share your contact list or your data with anyone.</li>
              <li>We don&apos;t use your mailbox for anything other than your own campaigns.</li>
              <li>We don&apos;t show ads or build advertising profiles from your data.</li>
              <li>We don&apos;t knowingly collect data from, or make the service available to, anyone under 18.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">Your rights under the DPDP Act</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-muted">
              <li>
                <strong>Access:</strong> a summary of what personal data we hold about you
                and how it&apos;s being processed — everything is already visible in your
                Dashboard, Lists, Templates, Resumes, and Settings pages; contact us (below)
                for anything not shown there directly.
              </li>
              <li>
                <strong>Correction and erasure:</strong> fix inaccurate account details from
                Settings at any time; delete individual contacts by re-importing a corrected
                list, or erase everything at once (see below).
              </li>
              <li>
                <strong>Grievance redressal:</strong> contact our Grievance Officer (below)
                with any complaint about how your data is handled; we&apos;ll respond within a
                reasonable time.
              </li>
              <li>
                <strong>Nomination:</strong> you may nominate another individual to exercise
                these rights on your behalf in the event of your death or incapacity, by
                contacting us with their details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">Deleting your data</h2>
            <p className="mt-2 text-muted">
              From Settings → Danger zone, you can permanently delete your account
              yourself, immediately, no waiting period. This removes your contacts,
              campaigns, send and reply history, templates, resumes (including the
              underlying files in object storage), your connected mailbox and its
              credential, and your suppression list. This action can&apos;t be undone —
              we don&apos;t keep a recoverable backup of a deleted account.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Grievance Officer</h2>
            <p className="mt-2 text-muted">
              As required under the DPDP Act and the IT Act, 2000, questions or complaints
              about this policy or your data should go to:
              <br />
              <strong>[Grievance Officer name]</strong>
              <br />
              <strong>[email address]</strong>
              <br />
              — replace this section with real contact details before deployment. If you&apos;re
              not satisfied with our response, you may file a complaint with the{" "}
              <strong>Data Protection Board of India</strong>.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Changes to this policy</h2>
            <p className="mt-2 text-muted">
              We may update this policy from time to time; the &quot;Last updated&quot; date
              above reflects the latest version. If a change is material, we&apos;ll ask you
              to accept it again before you can keep using Dispatch.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
