import { NextResponse, type NextRequest } from "next/server";

import { SERVER_BACKEND_URL } from "@/lib/config";
import { errorResponse } from "@/lib/route-helpers";
import { authHeaders } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Accepting and restoring a finding, proxied.
 *
 * This has to go through this server: the API authorises the change against the
 * report's owner, and the session lives in an HttpOnly first-party cookie that
 * only this server can read. A direct call from the browser could not carry it,
 * and would be refused.
 */
async function forward(
  request: NextRequest,
  params: Promise<{ id: string; findingId: string }>,
  method: "PUT" | "DELETE",
) {
  const { id, findingId } = await params;
  const url =
    `${SERVER_BACKEND_URL}/api/reports/${encodeURIComponent(id)}` +
    `/findings/${encodeURIComponent(findingId)}/suppression`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      // DELETE carries no body; PUT carries the reason.
      body: method === "PUT" ? await request.text() : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    // 204 has no body, and `new NextResponse(body)` on a 204 throws.
    if (response.status === 204) return new NextResponse(null, { status: 204 });

    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  return forward(request, params, "PUT");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  return forward(request, params, "DELETE");
}
