import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dispatch/core", "@dispatch/config", "@dispatch/db"],
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Pin the workspace root explicitly — an unrelated lockfile in a parent directory on this
  // machine otherwise makes Next guess the wrong monorepo root.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  webpack: (config) => {
    // Our workspace packages use explicit ".js" specifiers on relative imports (required for
    // Node ESM resolution when the worker runs them directly via tsx). Webpack doesn't do that
    // substitution on its own, so point it at the real ".ts" files.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
