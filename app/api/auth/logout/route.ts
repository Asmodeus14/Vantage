import { NextResponse, type NextRequest } from "next/server";

import { SERVER_BACKEND_URL, SESSION_COOKIE } from "@/lib/config";
import { getSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * End the session.
 *
 * The cookie is cleared whatever the API says. A failed revoke should still
 * sign the user out of this browser — leaving them apparently signed in
 * because a network call failed is the worse outcome.
 */
export async function POST(request: NextRequest) {
  const token = await getSessionToken();

  if (token) {
    try {
      await fetch(`${SERVER_BACKEND_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Best-effort. The session expires on its own regardless.
    }
  }

  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), {
    status: 303,
  });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
