"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { ApiErrorBody, JobStarted } from "@/lib/types";

export interface StartFailure {
  message: string;
  detail?: string;
}

/**
 * Starting a repository analysis, from anywhere.
 *
 * Extracted when the report page gained "Analyse again". That button and the
 * home form do exactly the same thing — post a URL, then navigate to the
 * progress stream — and the interesting part is not the fetch but the
 * `submitting` lifecycle, which is easy to get subtly wrong in a way that only
 * shows up as a frozen-looking page.
 */
export function useStartAnalysis() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<StartFailure | null>(null);

  const start = React.useCallback(
    async (url: string, ref?: string | null) => {
      const target = url.trim();
      if (!target || submitting) return;

      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/analyze/repository", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // `ref` is omitted rather than sent as null when absent, so the
          // backend picks the default branch exactly as it did before this
          // hook existed.
          body: JSON.stringify(ref ? { url: target, ref } : { url: target }),
        });
        const body = await response.json();

        if (!response.ok) {
          const failure = body as ApiErrorBody;
          setError({
            message: failure.message,
            ...(failure.detail && { detail: failure.detail }),
          });
          setSubmitting(false);
          return;
        }

        // Deliberately stays pending. `router.push` returns before the
        // navigation completes, so clearing it here — as a `finally` once did
        // — dropped the button back to idle mid-flight and left the page
        // looking frozen until the next route rendered. The component
        // unmounts on navigation, so there is nothing to reset.
        router.push(`/analysing/${(body as JobStarted).job_id}`);
      } catch {
        setError({
          message: "Could not reach the analysis server.",
          detail: "Check your connection, or the server may still be waking up.",
        });
        setSubmitting(false);
      }
    },
    [router, submitting],
  );

  /**
   * Navigate to a job someone else started — the ZIP upload posts straight to
   * the API, so it produces a job id without going through `start`.
   */
  const goToJob = React.useCallback(
    (jobId: string) => router.push(`/analysing/${jobId}`),
    [router],
  );

  return { start, goToJob, submitting, setSubmitting, error, setError };
}
