import pino from "pino";
import { env } from "./env.js";

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
  transport:
    env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});
