import { type NextRequest, NextResponse } from "next/server";

import { api } from "@/lib/api";
import { errorResponse } from "@/lib/route-helpers";
import { authHeaders } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Forwards the request with the caller's session attached.
 *
 * The comment is posted as the signed-in user, on their token, so this has to
 * carry the session the same way every other owner-scoped call does. Only the
 * pull request URL is forwarded — the report link inside the comment is built
 * on the server from its own configuration, because a caller who could supply
 * it could have Vantage post a link to anywhere into someone's pull request.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as { pull_request_url?: unknown };
    const url = typeof body.pull_request_url === "string" ? body.pull_request_url : "";

    const result = await api.commentOnPullRequest(id, url, {
      headers: await authHeaders(),
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
