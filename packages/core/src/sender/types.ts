export interface OutgoingEmail {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  messageId: string; // we generate it, so we can match replies later
  attachment?: { filename: string; content: Buffer; contentType: string };
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string[];
}

export interface SendResult {
  providerMessageId: string;
  threadId?: string;
}

export interface EmailSender {
  verify(): Promise<void>;
  send(email: OutgoingEmail): Promise<SendResult>;
  close(): Promise<void>;
}

export interface SenderCredentials {
  provider: "smtp" | "gmail_oauth";
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  /** Decrypted app password (smtp) or access token (gmail_oauth). Never logged. */
  secret: string;
}
