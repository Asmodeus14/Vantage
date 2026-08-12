import { NextResponse, type NextRequest } from "next/server";

import { SERVER_BACKEND_URL } from "@/lib/config";
import { errorResponse } from "@/lib/route-helpers";
import { authHeaders } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * AI actions, proxied.
 *
 * The browser used to POST straight to the API. That was never necessary — the
 * response is a single JSON payload, not a stream, and the body is a few bytes
 * — and it meant the call could not carry the session, which lives in an
 * HttpOnly first-party cookie only this server can read.
 *
 * Routing it through here attributes the action to the signed-in user and
 * removes one of the three direct-to-API paths.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  const { id, findingId } = await params;

  try {
    const body = await request.text();
    const response = await fetch(
      `${SERVER_BACKEND_URL}/api/reports/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}/ai`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body,
        // A model call is far slower than the client default; the backend
        // enforces its own timeout and returns a structured error.
        signal: AbortSignal.timeout(120_000),
      },
    );

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
