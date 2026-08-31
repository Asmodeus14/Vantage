"use client";

import { LineChart } from "@/components/charts/line-chart";
import { displayScore } from "@/lib/severity";
import type { ReportSummary } from "@/lib/types";

/**
 * Score over the last handful of analyses.
 *
 * Progressive disclosure copied deliberately from
 * `components/report/trend-panel.tsx`, which established the rule and explains
 * it: a chart of one segment is a two-hundred-pixel rectangle restating two
 * numbers that fit in a sentence. The thresholds are the same so the two
 * surfaces do not disagree about when a trend exists.
 *
 * `pointLabels` rather than the hover tooltip. This chart sits in a sidebar
 * that is read at a glance and never interacted with, and on a touch screen
 * there is no hover to reveal the values at all.
 *
 * `labels` arrives as a prop rather than being derived here. See `trendLabels`
 * in `lib/reports.ts` — formatting dates on both sides of hydration produced a
 * mismatch, because the server and the browser do not share a locale.
 */
export function ScoreTrend({
  reports,
  labels,
}: {
  reports: ReportSummary[];
  labels: string[];
}) {
  const scores = reports.map(displayScore);
  const first = scores[0];
  const last = scores[scores.length - 1];

  if (scores.length === 0 || first === undefined || last === undefined) {
    return (
      <p className="text-[13px] text-fg-muted">
        Nothing to chart yet. Scores appear here after your first analysis.
      </p>
    );
  }

  if (scores.length === 1) {
    return (
      <p className="text-[13px] text-fg-muted">
        One analysis so far, scoring{" "}
        <span className="tabular font-medium text-fg">{first}</span>. Run another
        and the trend appears here.
      </p>
    );
  }

  if (scores.length === 2) {
    return (
      <p className="text-[13px] text-fg-muted">
        <span className="tabular font-medium text-fg">{first}</span> →{" "}
        <span className="tabular font-medium text-fg">{last}</span> across two
        analyses.
      </p>
    );
  }

  return (
    <LineChart
      labels={labels}
      series={[
        {
          id: "score",
          label: "Score",
          colour: "var(--series-1)",
          values: scores,
        },
      ]}
      height={150}
      yDomain={[0, 100]}
      area
      pointLabels
      caption={`Score across the last ${scores.length} analyses`}
    />
  );
}
