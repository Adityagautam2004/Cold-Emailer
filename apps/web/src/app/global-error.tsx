"use client";

import { useEffect } from "react";

/**
 * Only fires if the ROOT LAYOUT ITSELF throws — a rarer, more catastrophic case than a normal
 * page error (that's app/error.tsx). Next.js requires this file to render its own <html>/<body>
 * since it replaces the entire root layout when triggered; app/error.tsx must NOT do that,
 * since the root layout is still mounted around it in the ordinary case.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#14161a", color: "#e8e6e1", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", maxWidth: 384, flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#8b9199" }}>
            That was unexpected on our end — nothing you did caused this. Try again, or head back home.
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
            {/* Plain <a>, not next/link — this fallback exists for when the root layout itself
                (and everything the router depends on) has already failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ borderRadius: 6, border: "1px solid #2a2f36", padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "#e8e6e1", textDecoration: "none" }}
            >
              Go home
            </a>
            <button
              type="button"
              onClick={reset}
              style={{ borderRadius: 6, background: "#4f5bd5", padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "white", border: "none", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
