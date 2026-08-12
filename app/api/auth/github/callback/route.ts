import { NextResponse, type NextRequest } from "next/server";

import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  INTERNAL_API_SECRET,
  SERVER_BACKEND_URL,
  SESSION_COOKIE,
  authConfigured,
} from "@/lib/config";
import { SESSION_COOKIE_OPTIONS, verifyState } from "@/lib/session";

export const dynamic = "force-dynamic";

interface TokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Complete the OAuth flow and establish a session.
 *
 * The code is exchanged here, server-side, so `GITHUB_CLIENT_SECRET` never
 * reaches a browser. The resulting GitHub token is handed to the API, which
 * encrypts it and returns an opaque session id; only that id is put in a
 * cookie, and the cookie is HttpOnly so script cannot read it either.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = request.nextUrl.origin;

  if (!authConfigured()) {
    return failure(origin, "Sign-in is not configured on this server.");
  }

  // GitHub reports user-side refusal here, not as an HTTP error.
  const denied = params.get("error");
  if (denied) {
    const description = params.get("error_description");
    return failure(
      origin,
      denied === "access_denied"
        ? "Sign-in was cancelled."
        : (description ?? `GitHub returned "${denied}".`),
    );
  }

  const state = verifyState(params.get("state"));
  if (!state.valid) {
    return failure(origin, state.reason ?? "Sign-in could not be verified.");
  }

  const code = params.get("code");
  if (!code) return failure(origin, "GitHub did not return an authorisation code.");

  let token: TokenResponse;
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: new URL("/api/auth/github/callback", origin).toString(),
      }),
    });
    token = (await response.json()) as TokenResponse;
  } catch {
    return failure(origin, "Could not reach GitHub to complete sign-in.");
  }

  // GitHub answers 200 with an error *body* for a bad or reused code. Checking
  // only the status code sails straight past it and fails later, somewhere far
  // less obvious.
  if (token.error || !token.access_token) {
    return failure(
      origin,
      token.error === "bad_verification_code"
        ? "That sign-in link had already been used. Try again."
        : (token.error_description ?? "GitHub refused the authorisation."),
    );
  }

  let session: { session_token?: string };
  try {
    const response = await fetch(`${SERVER_BACKEND_URL}/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        access_token: token.access_token,
        scopes: token.scope ?? "",
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      return failure(origin, body?.message ?? "Could not start a session.");
    }
    session = (await response.json()) as { session_token?: string };
  } catch {
    return failure(origin, "Could not reach the analysis server to sign you in.");
  }

  if (!session.session_token) {
    return failure(origin, "The analysis server did not return a session.");
  }

  const redirect = NextResponse.redirect(new URL(state.returnTo, origin));
  redirect.cookies.set(SESSION_COOKIE, session.session_token, SESSION_COOKIE_OPTIONS);
  return redirect;
}

/** Back to Settings with the reason stated, never a bare error page. */
function failure(origin: string, reason: string): NextResponse {
  const url = new URL("/settings", origin);
  url.searchParams.set("auth_error", reason);
  return NextResponse.redirect(url);
}
