import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    environment: "node",
    env: {
      ENCRYPTION_KEY: "0".repeat(64),
      UNSUBSCRIBE_SECRET: "1".repeat(64),
    },
  },
});
