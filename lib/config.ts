/**
 * Backend endpoints.
 *
 * Two variables, deliberately:
 *
 * - `BACKEND_URL` is server-only and used by Server Components and route
 *   handlers. It never reaches the browser, so the API origin can stay private
 *   and the frontend server can add caching or auth in front of it later.
 * - `NEXT_PUBLIC_BACKEND_URL` is used by the browser for exactly two things
 *   that cannot be proxied: the SSE progress stream (serverless functions
 *   buffer and time out streaming responses) and the ZIP upload (serverless
 *   request bodies are capped at a few megabytes, far below our limit).
 *
 * Everything else goes through this app's own `/api/*` route handlers.
 */

export const SERVER_BACKEND_URL =
  process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

export const BROWSER_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

/**
 * Sign-in.
 *
 * The OAuth code exchange happens here rather than on the API, for two
 * reasons. The client secret never has to leave this server, and the session
 * cookie it sets is **first-party** — same origin as the page.
 *
 * That second point is the whole design. In production the frontend and the
 * API live on different sites (Vercel and Render), and a cookie set by the API
 * would be a third-party cookie: blocked outright by Safari and by Firefox in
 * strict mode. It would pass every test in Chrome and then fail for a third of
 * users. So the API never sets a cookie; this server reads its own and
 * forwards the session as a bearer token.
 *
 * All four are server-only — none are `NEXT_PUBLIC_`.
 */
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
/** Shared with the API; authenticates this server, not a user. */
export const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "";
/** Signs the OAuth `state`. Stateless, so it survives multiple workers. */
export const SESSION_SECRET = process.env.SESSION_SECRET ?? "";

export const SESSION_COOKIE = "cc_session";

/** Whether sign-in can be offered at all, and why not when it cannot. */
export function authConfigured(): boolean {
  return Boolean(
    GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET && INTERNAL_API_SECRET && SESSION_SECRET,
  );
}

export function authUnavailableReason(): string | null {
  const missing = (
    [
      ["GITHUB_CLIENT_ID", GITHUB_CLIENT_ID],
      ["GITHUB_CLIENT_SECRET", GITHUB_CLIENT_SECRET],
      ["INTERNAL_API_SECRET", INTERNAL_API_SECRET],
      ["SESSION_SECRET", SESSION_SECRET],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length === 0) return null;
  return `Sign-in is not configured on this server (${missing.join(", ")}).`;
}

/** Uploads above this are refused client-side, before wasting the transfer. */
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

export const APP_NAME = "Vantage";
/*
  Names the scope rather than implying "any repository".

  The rule engine understands JavaScript, TypeScript and Python. Secret
  scanning and dependency advisories sit on top of that and are
  language-agnostic; anything else gets structural metrics and little more.
  The previous line — "point it at a repository and it tells you what is
  wrong" — was true of those two ecosystems and an overstatement everywhere
  else, and a scanner that overstates its reach is one people stop trusting
  after the first quiet run on a language it cannot read.

  The second clause is the part no other scanner claims, so it earns its place
  in the one sentence that actually gets read.
*/
export const APP_DESCRIPTION =
  "Finds security issues, secrets and dependency risk in JavaScript, " +
  "TypeScript and Python repositories — and tells you what changed since " +
  "the last analysis.";
