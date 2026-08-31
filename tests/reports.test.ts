import { describe, expect, it } from "vitest";

import {
  dashboardStats,
  groupReports,
  scoreTrend,
  trendLabels,
} from "@/lib/reports";
import type { ReportSummary, SeverityCounts } from "@/lib/types";

function counts(partial: Partial<SeverityCounts> = {}): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0, ...partial };
}

/** Newest-first is the order the API returns and everything here assumes it. */
function report(
  id: string,
  repository: string | null,
  score: number,
  overrides: Partial<ReportSummary> = {},
): ReportSummary {
  return {
    id,
    created_at: "2026-08-20T12:00:00.000Z",
    source: { repository, ref: "main", commit: null, filename: null },
    score,
    effective_score: null,
    suppressed_count: 0,
    grade: "B",
    severity_counts: counts(),
    total_findings: 0,
    duration_seconds: 1,
    ...overrides,
  } as ReportSummary;
}

describe("groupReports", () => {
  it("groups runs of the same repository together", () => {
    const { repositories } = groupReports([
      report("a2", "acme/api", 70),
      report("b1", "acme/web", 80),
      report("a1", "acme/api", 60),
    ]);

    expect(repositories).toHaveLength(2);
    expect(repositories[0]?.[0]).toBe("acme/api");
    expect(repositories[0]?.[1].map((r) => r.id)).toEqual(["a2", "a1"]);
  });

  it("preserves most-recently-analysed order across projects", () => {
    const { repositories } = groupReports([
      report("b1", "acme/web", 80),
      report("a1", "acme/api", 60),
    ]);

    expect(repositories.map(([name]) => name)).toEqual(["acme/web", "acme/api"]);
  });

  it("keeps uploads ungrouped — they have no identity across runs", () => {
    const { repositories, uploads } = groupReports([
      report("u1", null, 55),
      report("u2", null, 65),
      report("a1", "acme/api", 60),
    ]);

    expect(repositories).toHaveLength(1);
    expect(uploads.map((r) => r.id)).toEqual(["u1", "u2"]);
  });
});

describe("dashboardStats", () => {
  it("counts distinct repositories, not runs", () => {
    const stats = dashboardStats([
      report("a3", "acme/api", 70),
      report("a2", "acme/api", 65),
      report("a1", "acme/api", 60),
      report("b1", "acme/web", 80),
    ]);

    expect(stats.repositories).toBe(2);
    expect(stats.totalRuns).toBe(4);
  });

  it("sums critical and high from each project's latest run only", () => {
    // The same unfixed finding appears in every run of a project. Summing all
    // of them counts one problem once per analysis and grows on a re-scan that
    // changed nothing.
    const stats = dashboardStats([
      report("a2", "acme/api", 70, {
        severity_counts: counts({ critical: 1, high: 2 }),
      }),
      report("a1", "acme/api", 60, {
        severity_counts: counts({ critical: 5, high: 5 }),
      }),
    ]);

    expect(stats.openHighRisk).toBe(3);
  });

  it("includes every upload in the risk total, since each is its own thing", () => {
    const stats = dashboardStats([
      report("u1", null, 50, { severity_counts: counts({ critical: 2 }) }),
      report("u2", null, 50, { severity_counts: counts({ high: 3 }) }),
    ]);

    expect(stats.openHighRisk).toBe(5);
  });

  it("takes the median of latest scores, not the mean", () => {
    // The mean of these is 61; one abandoned prototype should not drag the
    // number that stands for every other project.
    const stats = dashboardStats([
      report("a", "acme/a", 80),
      report("b", "acme/b", 90),
      report("c", "acme/c", 12),
    ]);

    expect(stats.medianScore).toBe(80);
  });

  it("averages the middle pair for an even count", () => {
    const stats = dashboardStats([
      report("a", "acme/a", 60),
      report("b", "acme/b", 70),
      report("c", "acme/c", 80),
      report("d", "acme/d", 90),
    ]);

    expect(stats.medianScore).toBe(75);
  });

  it("prefers the effective score, matching displayScore", () => {
    const stats = dashboardStats([
      report("a", "acme/a", 40, { effective_score: 90 }),
    ]);

    expect(stats.medianScore).toBe(90);
  });

  it("returns a null median rather than 0 when there is nothing to average", () => {
    const stats = dashboardStats([]);

    expect(stats.medianScore).toBeNull();
    expect(stats.repositories).toBe(0);
    expect(stats.openHighRisk).toBe(0);
  });
});

describe("scoreTrend", () => {
  it("returns oldest first, because time reads left to right", () => {
    const trend = scoreTrend(
      [report("c", "r", 3), report("b", "r", 2), report("a", "r", 1)],
      10,
    );

    expect(trend.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("takes the most recent N before reversing, not the oldest N", () => {
    const trend = scoreTrend(
      [report("d", "r", 4), report("c", "r", 3), report("b", "r", 2), report("a", "r", 1)],
      2,
    );

    expect(trend.map((r) => r.id)).toEqual(["c", "d"]);
  });
});

describe("trendLabels", () => {
  it("labels by day when every run is on a different one", () => {
    const labels = trendLabels([
      report("a", "r", 1, { created_at: "2026-08-10T09:00:00.000Z" }),
      report("b", "r", 2, { created_at: "2026-08-14T09:00:00.000Z" }),
    ]);

    expect(labels).toHaveLength(2);
    expect(new Set(labels).size).toBe(2);
    expect(labels[0]).toMatch(/\d/);
  });

  it("falls back to times when two runs share a day", () => {
    // Five ticks all reading "14 Aug" is worse than no tick at all.
    const labels = trendLabels([
      report("a", "r", 1, { created_at: "2026-08-14T09:00:00.000Z" }),
      report("b", "r", 2, { created_at: "2026-08-14T17:00:00.000Z" }),
    ]);

    expect(new Set(labels).size).toBe(2);
    expect(labels.every((l) => l.includes(":"))).toBe(true);
  });
});
