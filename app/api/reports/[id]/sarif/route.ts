import { type NextRequest } from "next/server";

import { SERVER_BACKEND_URL } from "@/lib/config";
import { errorResponse } from "@/lib/route-helpers";
import { authHeaders } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Streams the backend's SARIF export through, unchanged.
 *
 * A proxy rather than a direct link to the API for the same reason every other
 * report call goes through here: the browser holds a first-party session
 * cookie, not a bearer token, and only this side can turn one into the other.
 * A direct link would export the anonymous view of an owned report — silently
 * dropping the owner's accepted findings from the file.
 *
 * The body is passed along verbatim. Re-serialising it here would mean the
 * exported file and the schema-validated one the backend tested are two
 * different documents.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const response = await fetch(
      `${SERVER_BACKEND_URL}/api/reports/${encodeURIComponent(id)}/sarif`,
      { headers: await authHeaders(), cache: "no-store" },
    );

    if (!response.ok) {
      return new Response(await response.text(), {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(await response.text(), {
      status: 200,
      headers: {
        "content-type": "application/sarif+json",
        "content-disposition":
          response.headers.get("content-disposition") ??
          `attachment; filename="${id}.vantage.sarif"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
