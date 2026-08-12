"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDashed, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { ErrorState, LiveRegion } from "@/components/ui/states";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  useAnalysisStream,
} from "@/lib/use-analysis-stream";
import { cn } from "@/lib/utils";
import type { AnalysisStage } from "@/lib/types";

/**
 * Live analysis progress.
 *
 * Shows which stage is running, which rule is executing, and how many remain.
 * v2 displayed a bar hardcoded to 100% width with a pulse animation, so a
 * working analysis and a hung one looked identical.
 */
export function AnalysisProgress({ jobId }: { jobId: string }) {
  const router = useRouter();
  const state = useAnalysisStream(jobId);

  // Navigate to the report as soon as one exists.
  React.useEffect(() => {
    if (state.stage === "done" && state.reportId) {
      router.replace(`/r/${state.reportId}`);
    }
  }, [state.stage, state.reportId, router]);

  const currentIndex = STAGE_ORDER.indexOf(state.stage);
  const failed = state.stage === "failed";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <LiveRegion
        message={`${STAGE_LABELS[state.stage]}. ${state.message}`}
        assertive={failed}
      />

      {failed ? (
        <ErrorState
          title="Analysis failed"
          description={state.message}
          {...(state.error && state.error !== state.message
            ? { detail: state.error }
            : {})}
        />
      ) : (
        <Panel>
          <PanelHeader>
            <PanelTitle>
              {state.stage === "done" ? "Analysis complete" : "Analysing"}
            </PanelTitle>
            <span className="tabular text-xs text-fg-subtle">
              {state.total > 0
                ? `${state.completed} of ${state.total} rules`
                : STAGE_LABELS[state.stage]}
            </span>
          </PanelHeader>

          <PanelBody className="space-y-5">
            <ol className="space-y-0.5">
              {STAGE_ORDER.map((stage, index) => {
                const status =
                  state.stage === "done" || index < currentIndex
                    ? "done"
                    : index === currentIndex
                      ? "active"
                      : "pending";
                return (
                  <StageRow
                    key={stage}
                    stage={stage}
                    status={status}
                    detail={
                      status === "active" && state.stage === "analysing"
                        ? state.message
                        : undefined
                    }
                  />
                );
              })}
            </ol>

            {/* Determinate only while a real count exists; otherwise the bar
                would be inventing progress it doesn't have. */}
            {state.total > 0 && state.stage === "analysing" && (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={state.total}
                aria-valuenow={state.completed}
                aria-label="Rules completed"
                className="h-1 overflow-hidden rounded-full bg-surface-hover"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow)"
                  style={{
                    width: `${Math.round((state.completed / state.total) * 100)}%`,
                  }}
                />
              </div>
            )}

            {!state.connected && state.stage === "queued" && (
              <p className="text-xs text-fg-muted">
                Connecting… if the server has been idle it may take up to a
                minute to wake.
              </p>
            )}
          </PanelBody>
        </Panel>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-fg-subtle">
          Job <span className="font-mono">{jobId}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          {failed ? "Start over" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

function StageRow({
  stage,
  status,
  detail,
}: {
  stage: AnalysisStage;
  status: "done" | "active" | "pending";
  detail?: string;
}) {
  return (
    <li className="flex items-center gap-2.5 py-1">
      {status === "done" ? (
        <Check className="size-3.5 shrink-0 text-success" aria-hidden />
      ) : status === "active" ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" aria-hidden />
      ) : (
        <CircleDashed className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
      )}

      <span
        className={cn(
          "text-sm",
          status === "pending" && "text-fg-subtle",
          status === "active" && "font-medium text-fg",
          status === "done" && "text-fg-muted",
        )}
      >
        {STAGE_LABELS[stage]}
      </span>

      {detail && (
        <span className="min-w-0 truncate text-xs text-fg-subtle">{detail}</span>
      )}
    </li>
  );
}
