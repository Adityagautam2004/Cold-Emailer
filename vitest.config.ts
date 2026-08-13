import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests (e.g. apps/web/src/lib/*.test.ts) hit the real dev Postgres/Supabase
// project — there's no separate provisioned test database for a project at this scale
// (see DECISIONS.md). Pure unit tests in packages/core never read these; they only need
// the two placeholders below.
function loadRootEnv(): Record<string, string> {
  const path = fileURLToPath(new URL("./.env", import.meta.url));
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="(.*)"$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./vitest.server-only-stub.js", import.meta.url)),
    },
  },
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    environment: "node",
    env: {
      ...loadRootEnv(),
      ENCRYPTION_KEY: "0".repeat(64),
      UNSUBSCRIBE_SECRET: "1".repeat(64),
    },
  },
});
