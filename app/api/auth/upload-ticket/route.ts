import { NextResponse } from "next/server";

import { SERVER_BACKEND_URL } from "@/lib/config";
import { errorResponse } from "@/lib/route-helpers";
import { authHeaders } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived ticket so a direct upload can be attributed.
 *
 * The upload itself posts straight to the API, because serverless request
 * bodies are capped far below a project archive — and that request therefore
 * cannot send the session cookie, which is HttpOnly and first-party to this
 * origin. So the browser asks *this* server, which can read the cookie, for a
 * narrow credential to attach instead.
 *
 * Signed-out callers get 204 rather than 401. Uploading without an account is
 * a supported flow, not a failure, and the client should not have to
 * distinguish "no session" from "something went wrong".
 */
export async function POST() {
  const headers = await authHeaders();
  if (!("Authorization" in headers)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const response = await fetch(`${SERVER_BACKEND_URL}/api/auth/upload-ticket`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    // A ticket is an enhancement: without one the upload still works, it is
    // just anonymous. Failing the whole flow here would be a worse trade.
    if (!response.ok) return new NextResponse(null, { status: 204 });

    return new NextResponse(await response.text(), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
