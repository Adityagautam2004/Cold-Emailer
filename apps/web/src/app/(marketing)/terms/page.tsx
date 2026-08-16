import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-ink px-6 py-16 text-text">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-muted transition-standard hover:text-text">
          ← Dispatch
        </Link>

        <div className="mb-8 mt-6 rounded-md border border-pending/40 bg-surface px-4 py-3 text-sm text-pending">
          This is a template drafted with India&apos;s legal framework in mind (the Digital
          Personal Data Protection Act 2023, the IT Act 2000, and the Indian Contract Act
          1872), not a substitute for advice from a lawyer. Read it, fill in every bracketed
          placeholder, and have it reviewed before you rely on it with real users.
        </div>

        <h1 className="font-display text-3xl font-bold">Terms of service</h1>
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
            <h2 className="font-semibold">2. Who can use Dispatch</h2>
            <p className="mt-2 text-muted">
              You must be at least 18 years old, or the age of majority in your jurisdiction
              if higher, and legally capable of entering into a binding contract under the
              Indian Contract Act, 1872 (or the equivalent law where you live). Dispatch is
              not directed at, and must not be used by, anyone under 18 — we do not knowingly
              collect personal data from minors, and an account found to belong to a minor
              will be suspended and its data deleted.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">3. You are the sender — and the data fiduciary for your contacts</h2>
            <p className="mt-2 text-muted">
              Every email Dispatch schedules is sent from your own connected mailbox, under
              your name. You are the sender of record. Under India&apos;s Digital Personal
              Data Protection Act, 2023 (DPDP Act), <strong>you — not Dispatch — are the
              Data Fiduciary for the personal data in your contact list</strong>: you decide
              whose data to upload and why, so you bear the legal responsibility for having
              a lawful basis to hold and email each contact. Dispatch acts only as the
              technical means by which your instructions are carried out. You are
              responsible for the accuracy of your contact list, the content of your
              messages, and compliance with applicable law — including the DPDP Act and, if
              you contact recipients outside India, laws such as the US CAN-SPAM Act or the
              EU/UK GDPR.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">4. Contact lists and acceptable use</h2>
            <p className="mt-2 text-muted">
              You may only upload contacts you have a legitimate basis to email — for
              example, HR or recruiting contacts you are reaching out to about your own job
              search. <strong>Importing scraped or purchased contact lists is prohibited.
              </strong> You also agree not to use Dispatch to send unlawful, defamatory,
              harassing, or deceptive content; to impersonate any person or organisation; to
              distribute malware or phishing links; or to attempt to circumvent the sending
              limits described below. Dispatch does not verify the source or content of your
              list or messages; you are solely responsible for both.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">5. Your mailbox credential</h2>
            <p className="mt-2 text-muted">
              To send on your behalf, Dispatch stores an app-specific password or OAuth
              token for your mailbox, encrypted at rest. This credential is used
              exclusively to send the campaigns you create and to read replies to those
              campaigns in your inbox — never for anything else, and it is never shown
              back to you or anyone else once entered.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">6. Sending limits</h2>
            <p className="mt-2 text-muted">
              Every account is capped at 50 emails per day and starts on a slower warmup
              ramp. These limits exist to protect your mailbox&apos;s sending reputation and
              cannot be raised, including by Dispatch&apos;s operator.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">7. Resumes and other files</h2>
            <p className="mt-2 text-muted">
              Resume files you upload are stored in private object storage, accessible only
              to you. They are permanently deleted, along with everything else in your
              account, if you delete your account.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">8. Suspension and termination</h2>
            <p className="mt-2 text-muted">
              We may suspend or terminate an account that violates Section 4, that we
              reasonably believe puts the operator or its infrastructure providers (mailbox
              provider, hosting, storage) at risk — for example, triggering spam complaints
              or provider abuse flags — or as required by law. Where practical, we&apos;ll
              tell you why. You may stop using Dispatch and delete your account at any time,
              self-service, from Settings — see our{" "}
              <Link href="/privacy" className="text-accent underline underline-offset-2">
                Privacy policy
              </Link>{" "}
              for exactly what that removes.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">9. Intellectual property</h2>
            <p className="mt-2 text-muted">
              You keep all rights to the contact lists, templates, resumes, and messages you
              upload or create. We keep all rights to the Dispatch software and platform
              itself. Nothing here grants you rights beyond using the service as intended,
              or grants us rights to your content beyond what&apos;s needed to operate the
              service on your instructions.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">10. No warranty and limitation of liability</h2>
            <p className="mt-2 text-muted">
              Dispatch is provided &quot;as is&quot; and &quot;as available&quot;, run by a fellow
              student, without warranties of any kind, express or implied, including
              merchantability, fitness for a particular purpose, or non-infringement. It is
              not a substitute for your own judgment about who to contact or what to send
              them. To the maximum extent permitted by law, the operator&apos;s total
              liability for any claim arising from your use of Dispatch is limited to the
              amount (if any) you paid to use it in the preceding three months, and the
              operator is not liable for indirect, incidental, or consequential damages
              (including lost placement opportunities, lost data, or reputational harm to
              your mailbox).
            </p>
          </section>

          <section>
            <h2 className="font-semibold">11. Indemnity</h2>
            <p className="mt-2 text-muted">
              You agree to indemnify and hold the operator harmless from any claim, loss, or
              expense (including reasonable legal fees) arising from your contact list, the
              content you send, your violation of Section 4, or your violation of applicable
              law.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">12. Governing law and jurisdiction</h2>
            <p className="mt-2 text-muted">
              These terms are governed by the laws of India. Subject to any mandatory
              consumer-protection rights you have under the Consumer Protection Act, 2019,
              the courts at <strong>[your city], India</strong> have exclusive jurisdiction
              over any dispute arising from these terms or your use of Dispatch.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">13. Changes to these terms</h2>
            <p className="mt-2 text-muted">
              We may update these terms from time to time; the &quot;Last updated&quot; date
              above reflects the latest version. If a change is material, we&apos;ll ask you
              to accept it again before you can keep using Dispatch. Continued use after a
              non-material update means you accept the revised terms.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">14. Severability</h2>
            <p className="mt-2 text-muted">
              If any part of these terms is found unenforceable, the rest remains in effect,
              and the unenforceable part will be read to achieve its intent as closely as
              the law allows.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">15. Contact</h2>
            <p className="mt-2 text-muted">
              Questions about these terms should go to <strong>[operator name/email]</strong>
              — replace this with your real contact details before deployment.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
