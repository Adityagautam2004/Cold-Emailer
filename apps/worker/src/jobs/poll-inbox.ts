import {
  extractLikelyBouncedRecipient,
  extractReferencedMessageIds,
  isBounceSenderAddress,
  isDsnContentType,
  parseDsnRecipient,
} from "@dispatch/core";
import { decrypt } from "@dispatch/core/src/crypto.js";
import { logger } from "@dispatch/config";
import { prisma, suppressEmailCascade } from "@dispatch/db";
import { AuthenticationFailure, ImapFlow } from "imapflow";
import { simpleParser, type Headers as ParsedHeaders } from "mailparser";
import { checkCircuitBreaker } from "../circuit-breaker.js";
import { pauseAccountOnError } from "../account-errors.js";

const POLL_INTERVAL_MS = 15 * 60_000; // §13 — each account polled at most this often
const REPLY_LOOKBACK_DAYS = 30;

type AccountForPoll = {
  id: string;
  userId: string;
  fromEmail: string;
  credentialEnc: string;
  imapHost: string;
  lastImapUid: number | null;
};

function contentTypeHeaderString(headers: ParsedHeaders): string {
  const ct = headers.get("content-type");
  if (!ct) return "";
  if (typeof ct === "string") return ct;
  if (Array.isArray(ct)) return ct.map((v) => (typeof v === "string" ? v : v.value)).join("; ");
  if (typeof ct === "object" && "value" in ct && typeof ct.value === "string" && "params" in ct) {
    const params = Object.entries(ct.params ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return params ? `${ct.value}; ${params}` : ct.value;
  }
  return "";
}

async function findSendForReply(userId: string, referencedIds: string[], fromAddress: string) {
  if (referencedIds.length > 0) {
    const byMessageId = await prisma.send.findFirst({
      where: { providerMessageId: { in: referencedIds }, campaign: { userId } },
      select: { id: true, campaignId: true, contact: { select: { email: true } } },
      orderBy: { sentAt: "desc" },
    });
    if (byMessageId) return byMessageId;
  }

  const since = new Date(Date.now() - REPLY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return prisma.send.findFirst({
    where: { campaign: { userId }, contact: { email: fromAddress }, sentAt: { gte: since } },
    select: { id: true, campaignId: true, contact: { select: { email: true } } },
    orderBy: { sentAt: "desc" },
  });
}

async function findSendForBounceRecipient(userId: string, recipient: string) {
  return prisma.send.findFirst({
    where: { campaign: { userId }, contact: { email: recipient }, status: "sent" },
    select: { id: true, campaignId: true, contact: { select: { email: true } } },
    orderBy: { sentAt: "desc" },
  });
}

async function handleReply(userId: string, email: string, matchedSendId: string | null): Promise<void> {
  await suppressEmailCascade(userId, email, "replied");
  await prisma.event.create({ data: { sendId: matchedSendId ?? undefined, userId, type: "replied", meta: { email } } });
}

async function handleBounce(userId: string, email: string, matchedSend: { id: string; campaignId: string } | null): Promise<void> {
  await suppressEmailCascade(userId, email, "bounced");
  await prisma.event.create({
    data: { sendId: matchedSend?.id, userId, type: "bounced", meta: { email, source: "imap" } },
  });
  if (matchedSend) await checkCircuitBreaker(matchedSend.campaignId);
}

/** §13.1 & §13.4 — classify one INBOX message as a bounce or a reply and run the matching cascade. Exported for direct testing without a live IMAP server. */
export async function processInboxMessage(account: AccountForPoll, rawSource: Buffer): Promise<void> {
  const parsed = await simpleParser(rawSource);
  const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase();
  const contentType = contentTypeHeaderString(parsed.headers);

  const looksLikeBounce = isBounceSenderAddress(fromAddress) || isDsnContentType(contentType);
  if (looksLikeBounce) {
    const dsnPart = parsed.attachments.find((a) => a.contentType === "message/delivery-status");
    const recipient =
      (dsnPart && parseDsnRecipient(dsnPart.content.toString("utf8"))) ??
      extractLikelyBouncedRecipient(parsed.text ?? rawSource.toString("utf8"), account.fromEmail);
    if (!recipient) {
      logger.warn({ accountId: account.id }, "poll-inbox: looked like a bounce but no recipient could be extracted");
      return;
    }
    const matched = await findSendForBounceRecipient(account.userId, recipient);
    await handleBounce(account.userId, recipient, matched);
    return;
  }

  if (!fromAddress) return;

  const inReplyTo = parsed.headers.get("in-reply-to");
  const references = parsed.headers.get("references");
  const referencedIds = extractReferencedMessageIds(
    typeof inReplyTo === "string" ? inReplyTo : undefined,
    typeof references === "string" || Array.isArray(references) ? (references as string | string[]) : undefined
  );

  const matched = await findSendForReply(account.userId, referencedIds, fromAddress);
  if (matched) {
    await handleReply(account.userId, matched.contact.email, matched.id);
  }
}

async function pollAccountInbox(account: AccountForPoll): Promise<void> {
  let secret: string;
  try {
    secret = decrypt(account.credentialEnc);
  } catch (err) {
    // An undecryptable credential can't ever succeed on retry (unlike a network blip) — treat
    // it the same as an auth failure rather than log-spamming every scheduler tick forever.
    logger.error({ accountId: account.id, err }, "poll-inbox: stored credential could not be decrypted");
    await pauseAccountOnError(account.id, account.userId, "Stored credential could not be decrypted. Reconnect your mailbox.");
    return;
  }

  const client = new ImapFlow({
    host: account.imapHost,
    port: 993,
    secure: true,
    auth: { user: account.fromEmail, pass: secret },
    logger: false,
  });

  try {
    await client.connect();
  } catch (err) {
    if (err instanceof AuthenticationFailure) {
      await pauseAccountOnError(account.id, account.userId, "IMAP authentication failed — reconnect your mailbox.");
    } else {
      logger.warn({ accountId: account.id, err }, "poll-inbox: IMAP connect failed, will retry next cycle");
    }
    return;
  }

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      if (account.lastImapUid == null) {
        // First poll for this account — establish a baseline rather than scanning the
        // mailbox's entire pre-existing history (see DECISIONS.md). Only messages that
        // arrive from here on are ever considered.
        const mailbox = client.mailbox;
        const uidNext = mailbox ? mailbox.uidNext : 1;
        await prisma.emailAccount.update({
          where: { id: account.id },
          data: { lastImapUid: uidNext - 1, lastPolledAt: new Date() },
        });
        return;
      }

      let maxUidSeen = account.lastImapUid;
      const range = `${account.lastImapUid + 1}:*`;
      for await (const message of client.fetch(range, { uid: true, source: true }, { uid: true })) {
        if (message.uid <= account.lastImapUid || !message.source) continue;
        maxUidSeen = Math.max(maxUidSeen, message.uid);
        try {
          await processInboxMessage(account, message.source);
        } catch (err) {
          logger.warn({ accountId: account.id, uid: message.uid, err }, "poll-inbox: failed to process one message, continuing");
        }
      }

      await prisma.emailAccount.update({
        where: { id: account.id },
        data: { lastImapUid: maxUidSeen, lastPolledAt: new Date() },
      });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/** Accounts whose 15-minute poll interval has elapsed — processed one at a time, which naturally staggers real IMAP connections within a tick. */
export async function pollDueInboxes(): Promise<number> {
  const cutoff = new Date(Date.now() - POLL_INTERVAL_MS);
  const due = await prisma.emailAccount.findMany({
    where: { status: "active", OR: [{ lastPolledAt: null }, { lastPolledAt: { lte: cutoff } }] },
    select: { id: true, userId: true, fromEmail: true, credentialEnc: true, imapHost: true, lastImapUid: true },
  });

  for (const account of due) {
    try {
      await pollAccountInbox(account);
    } catch (err) {
      logger.error({ accountId: account.id, err }, "poll-inbox: unexpected error polling account");
    }
  }
  return due.length;
}
