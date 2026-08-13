import nodemailer, { type Transporter } from "nodemailer";
import { textToMinimalHtml } from "../mail.js";
import type { EmailSender, OutgoingEmail, SendResult, SenderCredentials } from "./types.js";

/**
 * Wraps a Nodemailer transport per §8.1. Created per job and closed after — do not hold a
 * pool across the worker's lifetime, the worker process outlives any single mailbox session.
 */
export class SmtpSender implements EmailSender {
  private readonly transporter: Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(creds: SenderCredentials) {
    this.fromEmail = creds.fromEmail;
    this.fromName = creds.fromName;
    this.transporter = nodemailer.createTransport({
      host: creds.smtpHost,
      port: creds.smtpPort,
      secure: true,
      auth: { user: creds.fromEmail, pass: creds.secret },
    });
  }

  async verify(): Promise<void> {
    await this.transporter.verify();
  }

  async send(email: OutgoingEmail): Promise<SendResult> {
    await this.transporter.sendMail({
      from: { name: this.fromName, address: this.fromEmail },
      to: email.toName ? { name: email.toName, address: email.to } : email.to,
      subject: email.subject,
      text: email.text,
      html: textToMinimalHtml(email.text),
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      references: email.references,
      headers: email.headers,
      attachments: email.attachment
        ? [
            {
              filename: email.attachment.filename,
              content: email.attachment.content,
              contentType: email.attachment.contentType,
            },
          ]
        : undefined,
    });

    // Nodemailer's returned messageId can be normalised (e.g. re-bracketed); we already
    // generated the canonical one and stored it before sending, so return it verbatim —
    // that's the value every reply-matching query joins against.
    return { providerMessageId: email.messageId };
  }

  async close(): Promise<void> {
    this.transporter.close();
  }
}
