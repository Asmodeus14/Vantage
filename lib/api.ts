/**
 * Typed backend client.
 *
 * Every call funnels through `request()`, so error handling is uniform: the
 * backend's structured `{code, message, detail}` payload is preserved and
 * surfaced to the UI rather than being flattened into a generic string.
 */

import { SERVER_BACKEND_URL } from "@/lib/config";
import type {
  ApiErrorBody,
  HealthResponse,
  JobStarted,
  PullRequestCommentResult,
  Report,
  ReportSummary,
  SourceFile,
  SourceTree,
} from "@/lib/types";

export class ApiError extends Error {
  readonly code: string;
  readonly detail: string | undefined;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.detail = body.detail;
  }

  /** True when retrying later could plausibly succeed. */
  get isTransient(): boolean {
    return (
      this.status >= 500 ||
      this.code === "rate_limited" ||
      this.code === "repository_fetch_failed"
    );
  }
}

/** Raised when the backend cannot be reached at all. */
export class BackendUnreachableError extends Error {
  constructor(readonly cause?: unknown) {
    super("Could not reach the analysis server.");
    this.name = "BackendUnreachableError";
  }
}

interface RequestOptions extends RequestInit {
  /** Base URL override; defaults to the server-only backend URL. */
  baseUrl?: string;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { baseUrl = SERVER_BACKEND_URL, timeoutMs = 30_000, ...init } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    throw new BackendUnreachableError(cause);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body: ApiErrorBody =
      payload && typeof payload === "object" && "message" in payload
        ? (payload as ApiErrorBody)
        : {
            code: "unexpected_error",
            message: `The server returned ${response.status}.`,
          };
    throw new ApiError(response.status, body);
  }

  return payload as T;
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

export const api = {
  health(options?: RequestOptions): Promise<HealthResponse> {
    // Short timeout: health is used to decide what the UI can offer, so a slow
    // answer is as useless as no answer.
    return request<HealthResponse>("/api/health", { timeoutMs: 8_000, ...options });
  },

  listReports(
    limit = 25,
    options?: RequestOptions & { repository?: string | null },
  ): Promise<ReportSummary[]> {
    const { repository, ...rest } = options ?? {};
    const query = new URLSearchParams({ limit: String(limit) });
    if (repository) query.set("repository", repository);
    return request<ReportSummary[]>(`/api/reports?${query}`, rest);
  },

  getReport(id: string, options?: RequestOptions): Promise<Report> {
    return request<Report>(`/api/reports/${encodeURIComponent(id)}`, options);
  },

  listFiles(id: string, options?: RequestOptions): Promise<SourceTree> {
    return request<SourceTree>(
      `/api/reports/${encodeURIComponent(id)}/files`,
      options,
    );
  },

  readFile(id: string, path: string, options?: RequestOptions): Promise<SourceFile> {
    const query = new URLSearchParams({ path });
    return request<SourceFile>(
      `/api/reports/${encodeURIComponent(id)}/file?${query}`,
      // Reading a repository file goes out to GitHub, which is slower than a
      // database read and occasionally rate limited.
      { timeoutMs: 20_000, ...options },
    );
  },

  deleteReport(id: string, options?: RequestOptions): Promise<void> {
    return request<void>(`/api/reports/${encodeURIComponent(id)}`, {
      method: "DELETE",
      ...options,
    });
  },

  analyseRepository(
    url: string,
    ref: string | null,
    options?: RequestOptions,
  ): Promise<JobStarted> {
    return request<JobStarted>("/api/analyze/repository", {
      method: "POST",
      body: JSON.stringify({ url, ref }),
      ...options,
    });
  },

  commentOnPullRequest(
    id: string,
    pullRequestUrl: string,
    options?: RequestOptions,
  ): Promise<PullRequestCommentResult> {
    return request<PullRequestCommentResult>(
      `/api/reports/${encodeURIComponent(id)}/pull-request-comment`,
      {
        method: "POST",
        body: JSON.stringify({ pull_request_url: pullRequestUrl }),
        // Resolves the PR and then reads up to 100 existing comments before
        // writing, so this is two or three GitHub round-trips, not one.
        timeoutMs: 25_000,
        ...options,
      },
    );
  },
};

/** Human-readable message for any failure, including non-API errors. */
export function describeError(error: unknown): { message: string; detail?: string } {
  if (error instanceof ApiError) {
    return { message: error.message, ...(error.detail && { detail: error.detail }) };
  }
  if (error instanceof BackendUnreachableError) {
    return {
      message: "Could not reach the analysis server.",
      detail:
        "It may be starting up — free hosting tiers sleep when idle and can take up to a minute to wake.",
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Something went wrong." };
}
