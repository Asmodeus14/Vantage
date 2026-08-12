import { NextResponse } from "next/server";

import { ApiError, BackendUnreachableError } from "@/lib/api";

/**
 * Convert any thrown error into the same structured payload shape the backend
 * uses, so clients only ever parse one error format.
 */
export function errorResponse(error: unknown): NextResponse {
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
