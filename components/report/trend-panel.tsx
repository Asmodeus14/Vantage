"use client";

import * as React from "react";
import Link from "next/link";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { SEVERITY_META, displayScore } from "@/lib/severity";
import { cn, pluralise } from "@/lib/utils";
import type { ReportSummary, Severity } from "@/lib/types";

/**
 * How this repository has changed across analyses.
 *
 * A single analysis is not a trend, and drawing an axis with one dot on it
 * would imply otherwise. Below two reports this panel says what to do to get a
 * trend instead of pretending to show one.
 */

/** Severities worth plotting. `info` is noise on a trend line. */
const PLOTTED: Severity[] = ["critical", "high", "medium", "low"];

export function TrendPanel({
  history,
  currentId,
  repository,
}: {
  /** Newest first, as the API returns them. */
  history: ReportSummary[];
  currentId: string;
  repository: string;
}) {
  const [metric, setMetric] = React.useState<"score" | "severity">("score");

  // Oldest first for the x axis; time runs left to right.
  const ordered = React.useMemo(() => [...history].reverse(), [history]);

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const delta =
    first && last ? displayScore(last) - displayScore(first) : 0;

  if (ordered.length < 2) {
    // One line, not a card. There is nothing to show yet, and drawing a
    // bordered container around that fact gave an absence the same weight as
    // the report's actual content.
    return (
      <section className="border-t border-border pt-5">
        <p className="max-w-[70ch] text-xs text-fg-subtle">
          Only one analysis of{" "}
          <span className="font-mono">{repository}</span> so far — run it again
          to see how the score and the finding mix move between commits.
        </p>
      </section>
    );
  }

  // Two points is one line segment, and a chart of one segment is a
  // two-hundred-pixel rectangle restating two numbers that fit in a sentence.
  // The axis earns its space once there is a shape to read.
  if (ordered.length === 2) {
    return (
      <section className="border-t border-border pt-5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-fg-subtle">
          <span className="font-medium text-fg">Trend</span>
          <span>
            {first && displayScore(first)} →{" "}
            <span className="text-fg">{last && displayScore(last)}</span> across
            two analyses
          </span>
          <Delta delta={delta} />
          <Link
            href={`/history?repository=${encodeURIComponent(repository)}`}
            className="rounded transition-colors duration-(--duration-fast) hover:text-fg"
          >
            All analyses
          </Link>
        </p>
      </section>
    );
  }

  const labels = axisLabels(ordered.map((report) => report.created_at));

  const series: LineSeries[] =
    metric === "score"
      ? [
          {
            id: "score",
            label: "Score",
            colour: "var(--series-1)",
            values: ordered.map(displayScore),
          },
        ]
      : PLOTTED.map((severity) => ({
          id: severity,
          label: SEVERITY_META[severity].label,
          // Severity is the dimension here, so the severity ramp is the
          // correct palette — this is the one case it is not borrowed.
          colour: `var(--${severity})`,
          values: ordered.map((report) => report.severity_counts[severity]),
        }));

  const caption =
    metric === "score"
      ? `Score moved from ${first && displayScore(first)} to ${last && displayScore(last)} across ${ordered.length} analyses of ${repository}.`
      : `Finding counts by severity across ${ordered.length} analyses of ${repository}.`;

  return (
    // Same measure as the score bars above it, so the column keeps one right
    // edge instead of the chart alone running the full width.
    <section className="max-w-xl border-t border-border pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-fg">
          Trend
          <span className="ml-2 font-normal text-fg-subtle">
            {ordered.length} {pluralise(ordered.length, "analysis", "analyses")}
          </span>
        </h2>

        <div className="flex items-center gap-4">
          <Delta delta={delta} />
          <div
            role="group"
            aria-label="Metric"
            className="flex items-center gap-3 text-[11px]"
          >
            {(["score", "severity"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMetric(option)}
                aria-pressed={metric === option}
                className={cn(
                  "rounded transition-colors duration-(--duration-fast)",
                  metric === option
                    ? "font-medium text-fg"
                    : "text-fg-subtle hover:text-fg",
                )}
              >
                {option === "score" ? "Score" : "Severity"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/*
        The score axis is pinned to 0–100 because that is what the score means;
        a fitted axis would turn a two-point wobble into a cliff. Kept short —
        at 180px a flat two-point line was a large empty rectangle saying
        "unchanged", which a single line of text says better.
      */}
      <LineChart
        labels={labels}
        series={series}
        height={120}
        yDomain={metric === "score" ? [0, 100] : undefined}
        caption={caption}
        renderTooltip={(index) => {
          const report = ordered[index];
          if (!report) return null;
          return (
            <div className="space-y-0.5">
              <div className="text-fg-subtle">
                {new Date(report.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              <div className="tabular font-medium text-fg">
                {displayScore(report)} · {report.grade}
                {report.id === currentId && (
                  <span className="ml-1 font-normal text-fg-subtle">this report</span>
                )}
              </div>
              <div className="text-fg-muted">
                {report.total_findings}{" "}
                {pluralise(report.total_findings, "finding")}
              </div>
            </div>
          );
        }}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {metric === "severity" ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {PLOTTED.map((severity) => (
              <li key={severity} className="flex items-center gap-1.5 text-[11px]">
                <span
                  aria-hidden
                  className="h-0.5 w-3 rounded-sm"
                  style={{ backgroundColor: `var(--${severity})` }}
                />
                <span className="text-fg-muted">{SEVERITY_META[severity].label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        <Link
          href={`/history?repository=${encodeURIComponent(repository)}`}
          className="rounded text-xs text-fg-subtle transition-colors duration-(--duration-fast) hover:text-fg"
        >
          All analyses
        </Link>
      </div>
    </section>
  );
}

/**
 * Axis labels that actually distinguish the points.
 *
 * Re-analysing a repository several times in one sitting is the normal way to
 * use this — fix something, run it again. Formatting those as dates produces
 * five ticks all reading "10 Aug", which is worse than no axis. So: try the
 * date, and if that collapses distinct runs into identical labels, fall back to
 * a format that separates them.
 */
function axisLabels(timestamps: string[]): string[] {
  const dates = timestamps.map((value) => new Date(value));

  const byDate = dates.map((date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  );
  if (new Set(byDate).size === byDate.length) return byDate;

  const byTime = dates.map((date) =>
    date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  );
  if (new Set(byTime).size === byTime.length) return byTime;

  // Same minute, more than once. Nothing time-based will separate these, so
  // number the runs rather than repeating a label that cannot be read.
  return dates.map((_, index) => `#${index + 1}`);
}

function Delta({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-xs text-fg-subtle">unchanged</span>;
  }
  const improved = delta > 0;
  return (
    <span
      className={cn(
        "tabular text-xs font-medium",
        improved ? "text-success" : "text-critical",
      )}
    >
      {improved ? "+" : ""}
      {delta}
      <span className="ml-1 font-normal text-fg-subtle">since first run</span>
    </span>
  );
}
