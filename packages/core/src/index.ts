export * from "./quota.js";
export * from "./schedule.js";
export * from "./template.js";
export * from "./import.js";
export * from "./mail.js";
export * from "./storage.js";
export * from "./seed-templates.js";
export * from "./reply-detection.js";
// The following are deliberately NOT re-exported from this barrel, each because it imports a
// real Node built-in unconditionally at module load (crypto.js/message-id.js/unsubscribe.js
// need `node:crypto`; spreadsheet-parser.js needs `node:stream` via exceljs; the sender
// modules pull in `nodemailer`, which itself needs `fs`/`net`/`tls`):
//   - crypto.js            (encrypt, decrypt, decryptWithKey)
//   - message-id.js        (generateMessageId)
//   - unsubscribe.js       (generateUnsubscribeToken, verifyUnsubscribeToken, buildUnsubscribeUrl)
//   - spreadsheet-parser.js (parseSpreadsheet)
//   - sender/index.js      (createSender)
//   - sender/errors.js     (classifySendError, etc.)
//
// Next.js's `transpilePackages` setting means it processes this workspace package's own TS
// source directly rather than treating it as a pre-built dependency, and webpack dev builds
// don't eliminate an unused barrel re-export the way a production build's tree-shaking might.
// Concretely: any "use client" component that imports *anything* from this barrel — even an
// unrelated constant from a completely different file — would drag one of these Node-only
// modules into the browser bundle and fail to compile. Server-only code (apps/worker, and
// apps/web's API routes/lib) imports each of these by its own explicit subpath instead, e.g.
// @dispatch/core/src/crypto.js.
