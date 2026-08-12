import { NextResponse, type NextRequest } from "next/server";

import {
  GITHUB_CLIENT_ID,
  authConfigured,
  authUnavailableReason,
} from "@/lib/config";
import { createState, safeReturnTo } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Start the GitHub OAuth flow.
 *
 * Scopes are requested narrowly by default. `read:user` is enough for identity,
 * report ownership, and the user's own 5000-per-hour API budget. `repo` is only
 * asked for when someone explicitly opts in to private-repository analysis,
 * because it grants read *and write* to every private repo on the account —
 * a request most people should decline for a code-reading tool.
 */
export async function GET(request: NextRequest) {
  if (!authConfigured()) {
    // Nothing to redirect to. Send the user back with the reason rather than
    // bouncing them to a GitHub error page.
    const url = new URL("/settings", request.nextUrl.origin);
    url.searchParams.set("auth_error", authUnavailableReason() ?? "unavailable");
    return NextResponse.redirect(url);
  }

  const params = request.nextUrl.searchParams;
  const returnTo = safeReturnTo(params.get("next") ?? "/");
  const scope = params.get("private") === "1" ? "read:user repo" : "read:user";

  const authorise = new URL("https://github.com/login/oauth/authorize");
  authorise.searchParams.set("client_id", GITHUB_CLIENT_ID);
  authorise.searchParams.set(
    "redirect_uri",
    new URL("/api/auth/github/callback", request.nextUrl.origin).toString(),
  );
  authorise.searchParams.set("scope", scope);
  authorise.searchParams.set("state", createState(returnTo));

  return NextResponse.redirect(authorise);
}
