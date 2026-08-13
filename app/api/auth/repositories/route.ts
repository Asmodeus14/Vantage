import { NextResponse } from "next/server";

import { SERVER_BACKEND_URL } from "@/lib/config";
import { errorResponse } from "@/lib/route-helpers";
import { authHeaders } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The signed-in user's repositories, for the picker.
 *
 * Proxied so it can carry the session, which lives in an HttpOnly cookie only
 * this server can read. Signed out returns an empty list rather than 401 — the
 * picker is an alternative to pasting a URL, not a requirement, and the form
 * works either way.
 */
export async function GET() {
  const headers = await authHeaders();
  if (!("Authorization" in headers)) {
    return NextResponse.json([]);
  }

  try {
    const response = await fetch(`${SERVER_BACKEND_URL}/api/auth/repositories`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
