import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivityPanel } from "@/components/report/activity-panel";
import type { ChurnEntry, Report, RepositoryActivity } from "@/lib/types";

Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get: () => 600,
});

function churn(file: string, changes: number, findings = 1): ChurnEntry {
  return { file, changes, findings, top_severity: "medium" };
}

function report(
  activity: RepositoryActivity | null,
  kind: "repository" | "upload" = "repository",
): Report {
  return {
    id: "r1",
    created_at: new Date().toISOString(),
    duration_seconds: 1,
    source: {
      kind,
      repository: kind === "repository" ? "a/b" : null,
      ref: "main",
      commit: null,
      url: null,
      filename: kind === "upload" ? "project.zip" : null,
    },
    project: {
      name: "b",
      description: null,
      languages: [],
      frameworks: [],
      package_managers: [],
      entry_points: [],
      total_files: 1,
      analysed_files: 1,
      total_lines: 1,
      has_tests: false,
      has_ci: false,
      has_lockfile: false,
    },
    score: { value: 80, grade: "B", categories: [], summary: "ok" },
    severity_counts: { critical: 0, high: 0, medium: 1, low: 0, info: 0 },
    findings: [],
    dependencies: [],
    ingest: {
      files_extracted: 1,
      files_analysed: 1,
      bytes_extracted: 1,
      compression_ratio: 1,
      skipped_directories: [],
      rejected_entries: {},
    },
    activity,
    truncated: false,
    rule_ids: [],
    suppressed_count: 0,
    effective_score: null,
    can_suppress: false,
    delta: null,
  };
}

function activity(overrides: Partial<RepositoryActivity> = {}): RepositoryActivity {
  return {
    window_days: 90,
    weekly_commits: [],
    churn: [],
    files_with_findings: 0,
    partial: false,
    unavailable_reason: null,
    ...overrides,
  };
}

describe("ActivityPanel — no data", () => {
  it("explains that an upload has no repository to look up", () => {
    render(<ActivityPanel report={report(null, "upload")} onSelectFile={vi.fn()} />);
    expect(screen.getByText(/no repository to look up/i)).toBeInTheDocument();
  });

  it("does not blame the user when a repository's history was unreadable", () => {
    render(<ActivityPanel report={report(null)} onSelectFile={vi.fn()} />);
    expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
  });
});

describe("ActivityPanel — churn", () => {
  const withChurn = activity({
    churn: [churn("hot.js", 12, 3), churn("warm.js", 2), churn("cold.js", 0, 5)],
    files_with_findings: 8,
  });

  it("lists only files that actually changed", () => {
    render(<ActivityPanel report={report(withChurn)} onSelectFile={vi.fn()} />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("button", { name: "hot.js" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "warm.js" })).toBeInTheDocument();
    // A row of zeros is noise above the rows that carry the signal.
    expect(within(table).queryByRole("button", { name: "cold.js" })).toBeNull();
  });

  it("accounts for the files it left out", () => {
    render(<ActivityPanel report={report(withChurn)} onSelectFile={vi.fn()} />);
    // 8 files with findings, 2 of them changed.
    expect(screen.getByText(/6 other files/)).toBeInTheDocument();
  });

  it("hands the file path to the findings filter", async () => {
    const onSelectFile = vi.fn();
    const user = userEvent.setup();
    render(<ActivityPanel report={report(withChurn)} onSelectFile={onSelectFile} />);

    await user.click(screen.getByRole("button", { name: "hot.js" }));
    expect(onSelectFile).toHaveBeenCalledWith("hot.js");
  });

  it("falls back to the measured rows for reports stored before the count existed", () => {
    const legacy = activity({
      churn: [churn("a.js", 3), churn("b.js", 0), churn("c.js", 0)],
      files_with_findings: 0,
    });
    render(<ActivityPanel report={report(legacy)} onSelectFile={vi.fn()} />);
    expect(screen.getByText(/2 other files/)).toBeInTheDocument();
  });
});

describe("ActivityPanel — dormant", () => {
  it("states that settled code is settled, rather than showing a table of zeros", () => {
    const dormant = activity({
      churn: [churn("a.js", 0), churn("b.js", 0)],
      files_with_findings: 2,
      weekly_commits: [0, 0, 0],
    });
    render(<ActivityPanel report={report(dormant)} onSelectFile={vi.fn()} />);

    expect(screen.getByText(/None of the 2 files/)).toBeInTheDocument();
    // Every chart carries a hidden data table, so assert on the churn table's
    // own columns rather than on the absence of any table at all.
    expect(screen.queryByRole("columnheader", { name: "File" })).toBeNull();
    expect(screen.queryByRole("button", { name: "a.js" })).toBeNull();
  });
});

describe("ActivityPanel — partial", () => {
  it("shows the reason verbatim and keeps whatever did load", () => {
    const partial = activity({
      weekly_commits: [1, 2, 3],
      partial: true,
      unavailable_reason: "GitHub's API rate limit was reached.",
    });
    render(<ActivityPanel report={report(partial)} onSelectFile={vi.fn()} />);

    expect(
      screen.getByText("GitHub's API rate limit was reached."),
    ).toBeInTheDocument();
    // The commit chart that did load is still shown.
    expect(screen.getByRole("img", { name: /commits over the last year/i })).toBeInTheDocument();
  });

  it("does not warn about the file cap, which is a designed bound", () => {
    const capped = activity({
      churn: [churn("a.js", 4)],
      files_with_findings: 40,
      partial: false,
      unavailable_reason: null,
    });
    render(<ActivityPanel report={report(capped)} onSelectFile={vi.fn()} />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText(/39 other files/)).toBeInTheDocument();
  });
});
