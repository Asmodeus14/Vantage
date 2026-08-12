"use client";

import * as React from "react";

import { BROWSER_BACKEND_URL } from "@/lib/config";
import type { AnalysisStage, ProgressEvent } from "@/lib/types";

export interface StreamState {
  stage: AnalysisStage;
  message: string;
  completed: number;
  total: number;
  reportId: string | null;
  error: string | null;
  /** Every event received, so the UI can show a real activity log. */
  history: ProgressEvent[];
  connected: boolean;
}

const INITIAL: StreamState = {
  stage: "queued",
  message: "Starting analysis…",
  completed: 0,
  total: 0,
  reportId: null,
  error: null,
  history: [],
  connected: false,
};

/**
 * Subscribes to a job's Server-Sent Events.
 *
 * The stream is opened against the API directly rather than through a Next
 * route handler: serverless functions buffer streaming responses, which would
 * defeat the point by delivering every event at once when the job finished.
 */
export function useAnalysisStream(jobId: string): StreamState {
  const [state, setState] = React.useState<StreamState>(INITIAL);

  React.useEffect(() => {
    const source = new EventSource(
      `${BROWSER_BACKEND_URL}/api/analyze/${encodeURIComponent(jobId)}/events`,
    );

    source.onopen = () => {
      setState((previous) => ({ ...previous, connected: true }));
    };

    source.addEventListener("progress", (event) => {
      let payload: ProgressEvent;
      try {
        payload = JSON.parse((event as MessageEvent<string>).data) as ProgressEvent;
      } catch {
        return;
      }

      setState((previous) => ({
        ...previous,
        stage: payload.stage,
        message: payload.message,
        completed: payload.completed,
        total: payload.total,
        reportId: payload.report_id ?? previous.reportId,
        error: payload.error ?? previous.error,
        history: [...previous.history, payload],
        connected: true,
      }));

      if (payload.stage === "done" || payload.stage === "failed") {
        source.close();
      }
    });

    source.onerror = () => {
      setState((previous) => {
        // A close after completion is expected, not a failure.
        if (previous.stage === "done" || previous.stage === "failed") {
          return { ...previous, connected: false };
        }
        return {
          ...previous,
          connected: false,
          stage: "failed",
          error:
            "Lost connection to the analysis server. The analysis may still be running.",
        };
      });
      source.close();
    };

    return () => source.close();
  }, [jobId]);

  return state;
}

export const STAGE_ORDER: AnalysisStage[] = [
  "fetching",
  "extracting",
  "indexing",
  "analysing",
  "scoring",
  "enriching",
  "persisting",
];

export const STAGE_LABELS: Record<AnalysisStage, string> = {
  queued: "Queued",
  fetching: "Fetching source",
  extracting: "Extracting",
  indexing: "Indexing files",
  analysing: "Running rules",
  scoring: "Scoring",
  enriching: "Reading commit history",
  persisting: "Saving report",
  done: "Complete",
  failed: "Failed",
};
