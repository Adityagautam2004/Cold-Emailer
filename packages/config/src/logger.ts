import pino from "pino";
import { env } from "./env.js";

// Deliberately never uses pino's `transport` option here. pino-pretty's transport spins up
// a worker_thread pointed at a file path (thread-stream's lib/worker.js); merely having
// that code path exist in a module Next.js's webpack traces is enough for it to try to
// bundle/resolve that worker file into a vendor chunk, which then fails at runtime
// ("Cannot find module .../vendor-chunks/lib/worker.js") — a runtime `if` around the
// option does not prevent this, since it's a static-analysis/bundling problem, not a
// runtime one. This logger always emits plain JSON; apps/worker (a plain tsx/Node process,
// never webpack-bundled) pipes that JSON through the pino-pretty CLI instead — see its dev
// script in package.json.
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "credentialEnc",
      "*.credentialEnc",
      "password",
      "*.password",
      "authorization",
      "*.authorization",
      "req.headers.authorization",
      "ENCRYPTION_KEY",
      "AUTH_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
      "UNSUBSCRIBE_SECRET",
    ],
    censor: "[redacted]",
  },
});
