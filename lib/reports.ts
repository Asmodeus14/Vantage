/**
 * Shared derivations over a list of reports.
 *
 * `groupReports` was inline in `app/(app)/history/page.tsx` until the dashboard
 * needed the same answer. Two copies of "which runs belong to which project"
 * is exactly the drift `displayScore()` in `lib/severity.ts` exists to prevent,
 * so it moved here rather than being pasted.
 */

import { displayScore } from "@/lib/severity";
import type { ReportSummary } from "@/lib/types";

export interface GroupedReports {
  /** `[repository, runs]`, most recently analysed project first. */
  repositories: [string, ReportSummary[]][];
  /** Uploads have no stable identity across runs, so they stay ungrouped. */
  uploads: ReportSummary[];
}

/**
 * Group analyses by what they analysed.
 *
 * A flat reverse-chronological list buries the useful comparison: five runs of
 * the same repository interleaved with three of another tells you nothing about
 * either. Grouping puts each project's runs next to each other, which is what
 * makes a per-project sparkline meaningful.
 *
 * Assumes `reports` arrives newest-first, which is what the API returns — the
 * insertion order of the map is therefore also most-recent-first.
 */
export function groupReports(reports: ReportSummary[]): GroupedReports {
  const repositories = new Map<string, ReportSummary[]>();
  const uploads: ReportSummary[] = [];

  for (const report of reports) {
    const key = report.source.repository;
    if (!key) {
      uploads.push(report);
      continue;
    }
    const existing = repositories.get(key);
    if (existing) existing.push(report);
    else repositories.set(key, [report]);
  }

  return { repositories: [...repositories.entries()], uploads };
}

export interface DashboardStats {
  /** Distinct repositories, not counting uploads. */
  repositories: number;
  /** Every stored run, uploads included. */
  totalRuns: number;
  /**
   * Critical + high findings across the *latest* run of each project.
   *
   * Deliberately not summed over every run: the same unfixed finding appears in
   * all of them, so a total across history counts one problem once per
   * analysis and grows every time you re-scan without changing anything.
   */
  openHighRisk: number;
  /** Median of the latest score per project, or null with nothing to average. */
  medianScore: number | null;
}

export function dashboardStats(reports: ReportSummary[]): DashboardStats {
  const { repositories, uploads } = groupReports(reports);

  // One entry per project — its newest run — plus each upload, which is its own.
  const latest = [
    ...repositories.map(([, runs]) => runs[0]).filter((r): r is ReportSummary => !!r),
    ...uploads,
  ];

  const openHighRisk = latest.reduce(
    (total, r) => total + r.severity_counts.critical + r.severity_counts.high,
    0,
  );

  const scores = latest.map(displayScore).sort((a, b) => a - b);
  const medianScore = median(scores);

  return {
    repositories: repositories.length,
    totalRuns: reports.length,
    openHighRisk,
    medianScore,
  };
}

/**
 * Median rather than mean: one abandoned prototype scoring 12 drags an average
 * far enough to misrepresent every other project in the list.
 *
 * `values` must already be sorted ascending.
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid] ?? null;

  const low = values[mid - 1];
  const high = values[mid];
  if (low === undefined || high === undefined) return null;
  return Math.round((low + high) / 2);
}

/**
 * The last `limit` runs, oldest first, for a chart's x axis.
 *
 * Charts read left to right in time order; the API returns newest-first, so
 * something has to reverse it and it should not be the component.
 */
export function scoreTrend(reports: ReportSummary[], limit = 12): ReportSummary[] {
  return reports.slice(0, limit).reverse();
}

/**
 * Short date per point, falling back to a time when two runs share a day.
 *
 * Re-analysing twice in an afternoon is the common case for this chart, and
 * five ticks all reading "14 Aug" is worse than no tick at all.
 *
 * Lives here, and is called from the server component, because it must not run
 * on both sides of hydration. `toLocaleTimeString` resolves against the host's
 * locale and timezone: Node rendered "20:35" and the browser rendered
 * "08:35 pm" for the same instant, which React reported as a hydration
 * mismatch inside the chart's screen-reader table. Formatting once on the
 * server and passing the strings down means both sides render the same text.
 */
export function trendLabels(reports: ReportSummary[]): string[] {
  const dates = reports.map((r) => new Date(r.created_at));
  const asDay = dates.map((d) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  );

  if (new Set(asDay).size === asDay.length) return asDay;

  return dates.map((d) =>
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  );
}
