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
  webpack: (config, { dev }) => {
    // Our workspace packages use explicit ".js" specifiers on relative imports (required for
    // Node ESM resolution when the worker runs them directly via tsx). Webpack doesn't do that
    // substitution on its own, so point it at the real ".ts" files.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    if (dev) {
      // This project lives inside a OneDrive-synced folder. OneDrive briefly locks files while
      // uploading them, and webpack's persistent disk cache writes by renaming a temp .pack.gz
      // into place — the two collide (EPERM on rename) whenever OneDrive is mid-sync, and a
      // failed cache write can leave a stale/corrupted chunk behind for the next dev build.
      // Disabling the disk cache in dev trades a bit of rebuild speed for not hitting that.
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
