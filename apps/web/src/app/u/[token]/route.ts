import { NextResponse } from "next/server";
import { processUnsubscribeToken } from "@/lib/unsubscribe";

// Tokens sent to this route are stable HMACs (see packages/core/src/unsubscribe.ts), not
// magic secrets in the git-secret sense, but a route.ts is used instead of a page.tsx
// specifically so POST can be handled here too (RFC 8058 List-Unsubscribe-Post) — a mail
// provider's own one-click "Unsubscribe" button (see the header set in
// packages/core/src/mail.ts) POSTs directly to this URL without ever rendering a page.
// Next.js doesn't allow a page.tsx and a route.ts on the same segment, so the GET path
// below hand-builds the confirmation HTML rather than using a React page component.

function htmlPage(body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dispatch — unsubscribe</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #14161A; color: #E8E6E1; font-family: "Public Sans", system-ui, sans-serif; padding: 24px; }
  .card { max-width: 420px; text-align: center; }
  h1 { font-size: 1.375rem; font-weight: 700; margin: 0 0 12px; }
  p { color: #8B9199; font-size: 0.9375rem; line-height: 1.5; margin: 0; }
  .mark { color: #3E9B6B; }
  .mark.err { color: #C4553F; }
</style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

async function respondHtml(token: string): Promise<NextResponse> {
  const result = await processUnsubscribeToken(token);
  const body = result.ok
    ? `<h1 class="mark">You're unsubscribed</h1><p>You won't receive any further emails from this sender. This took effect immediately.</p>`
    : `<h1 class="mark err">This link isn't valid</h1><p>It may be malformed or already used. No changes were made.</p>`;
  return new NextResponse(htmlPage(body), {
    status: result.ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await params;
  return respondHtml(token);
}

/** RFC 8058 one-click — mail providers POST here directly; a plain 200/4xx with no HTML is all it checks for. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const { token } = await params;
  const result = await processUnsubscribeToken(token);
  return NextResponse.json({ ok: result.ok }, { status: result.ok ? 200 : 400 });
}
