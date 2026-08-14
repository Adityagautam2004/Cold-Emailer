// ENCRYPTION_KEY rotation — see OPERATIONS.md for the full runbook and the required
// sequencing. Summary: put the NEW key in .env's ENCRYPTION_KEY *before* running this, and
// pass the OLD key via the OLD_ENCRYPTION_KEY env var. Every EmailAccount.credentialEnc row
// is decrypted with the old key and re-encrypted with the new one. Never logs a decrypted
// value (§2.9) — only account ids and a final count.
//
// Usage:
//   OLD_ENCRYPTION_KEY=<previous 64-hex key> npm run rotate-encryption-key

import { decryptWithKey, encrypt } from "@dispatch/core/src/crypto.js";
import { prisma } from "@dispatch/db";

const HEX_64 = /^[0-9a-f]{64}$/;

async function main() {
  const oldKey = process.env.OLD_ENCRYPTION_KEY;
  const newKey = process.env.ENCRYPTION_KEY;

  if (!oldKey || !HEX_64.test(oldKey)) {
    throw new Error("Set OLD_ENCRYPTION_KEY to the previous 64-hex-char key before running this.");
  }
  if (!newKey || !HEX_64.test(newKey)) {
    throw new Error("ENCRYPTION_KEY (the new key) must already be set in .env as 64 hex chars.");
  }
  if (oldKey === newKey) {
    throw new Error("OLD_ENCRYPTION_KEY and ENCRYPTION_KEY are the same — nothing to rotate. Did you forget to update .env first?");
  }

  const accounts = await prisma.emailAccount.findMany({ select: { id: true, credentialEnc: true } });
  console.log(`Found ${accounts.length} email account(s) to check.`);

  let rotated = 0;
  let skipped = 0;
  for (const account of accounts) {
    let plaintext;
    try {
      plaintext = decryptWithKey(account.credentialEnc, oldKey);
    } catch (err) {
      console.warn(`  skip ${account.id}: could not decrypt with OLD_ENCRYPTION_KEY (${err.message}) — already rotated?`);
      skipped++;
      continue;
    }

    const reEncrypted = encrypt(plaintext);
    await prisma.emailAccount.update({ where: { id: account.id }, data: { credentialEnc: reEncrypted } });
    rotated++;
  }

  console.log(`Done. Rotated ${rotated}, skipped ${skipped}.`);
  if (skipped > 0) {
    console.warn("Investigate skipped accounts before considering the old key fully retired.");
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
