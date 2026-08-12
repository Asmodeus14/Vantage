import { NextResponse, type NextRequest } from "next/server";

import { api } from "@/lib/api";
import { errorResponse } from "@/lib/route-helpers";
import { authHeaders } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Starts an analysis. The request body is tiny JSON, so proxying through this
 * server is fine — unlike the ZIP upload and the SSE stream, which the browser
 * sends to the backend directly.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: unknown; ref?: unknown };

    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json(
        { code: "invalid_repository", message: "A repository URL is required." },
        { status: 400 },
      );
    }

    const ref = typeof body.ref === "string" && body.ref.trim() ? body.ref.trim() : null;
    return NextResponse.json(
      // Attributes the report to the caller, and lets the analysis spend
      // their GitHub budget instead of the server's shared one.
      await api.analyseRepository(body.url.trim(), ref, {
        headers: await authHeaders(),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
