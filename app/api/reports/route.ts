import { NextResponse, type NextRequest } from "next/server";

import { api } from "@/lib/api";
import { errorResponse } from "@/lib/route-helpers";
import { authHeaders } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const repository = request.nextUrl.searchParams.get("repository");
  try {
    const reports = await api.listReports(
      Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 25,
      // Forwards the caller's session so the listing is scoped to them.
      // Without it every signed-in user would see the anonymous pool.
      { repository, headers: await authHeaders() },
    );
    return NextResponse.json(reports);
  } catch (error) {
    return errorResponse(error);
  }
}
