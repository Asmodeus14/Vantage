import { NextResponse } from "next/server";

import { SERVER_BACKEND_URL, authUnavailableReason } from "@/lib/config";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Who the caller is, for the browser.
 *
 * Answers 200 with `{ user: null }` when signed out rather than 401 — being
 * signed out is a supported state, not an error, and the UI branches on it
 * every render.
 */
export async function GET() {
  const token = await getSessionToken();

  // Both halves have to be configured. This server owns the OAuth app and the
  // cookie; the API owns the accounts, the token encryption and the shared
  // secret. Offering a sign-in button when only one side is ready produces a
  // flow that fails at the last step, which is worse than not offering it.
  const local = authUnavailableReason();
  const remote = local === null ? await backendAuthReason() : null;
  const reason = local ?? remote;

  if (!token) {
    return NextResponse.json({ user: null, configured: reason === null, reason });
  }

  try {
    const response = await fetch(`${SERVER_BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      // Expired or revoked. Report signed-out; the stale cookie is harmless
      // and will be replaced on the next sign-in.
      return NextResponse.json({ user: null, configured: reason === null, reason });
    }

    return NextResponse.json({
      user: await response.json(),
      configured: true,
      reason: null,
    });
  } catch {
    return NextResponse.json({
      user: null,
      configured: false,
      reason: "Could not reach the analysis server.",
    });
  }
}

/** The API's own view of whether it can hold accounts. */
async function backendAuthReason(): Promise<string | null> {
  try {
    const response = await fetch(`${SERVER_BACKEND_URL}/api/auth/status`, {
      cache: "no-store",
    });
    if (!response.ok) return "The analysis server did not report its sign-in state.";
    const body = (await response.json()) as { configured: boolean; reason: string | null };
    return body.configured ? null : (body.reason ?? "Sign-in is unavailable.");
  } catch {
    return "Could not reach the analysis server.";
  }
}
