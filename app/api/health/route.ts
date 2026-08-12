import { NextResponse } from "next/server";

import { ApiError, BackendUnreachableError, api } from "@/lib/api";

// Always hit the backend: this endpoint reports live state.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await api.health());
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { code: error.code, message: error.message, detail: error.detail },
        { status: error.status },
      );
    }
    if (error instanceof BackendUnreachableError) {
      return NextResponse.json(
        {
          code: "backend_unreachable",
          message: "Could not reach the analysis server.",
          detail:
            "It may be starting up — free hosting tiers sleep when idle and can take up to a minute to wake.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { code: "internal_error", message: "Unexpected error." },
      { status: 500 },
    );
  }
}
