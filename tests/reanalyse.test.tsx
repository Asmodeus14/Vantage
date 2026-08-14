/**
 * "Analyse again" — the action that turns a one-off scan into the product.
 *
 * Everything Vantage is built around (new / resolved / unchanged / reopened)
 * only exists on a *second* analysis of the same repository, and until this
 * button the only route to one was going back to the form and re-pasting the
 * URL.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReportView } from "@/components/report/report-view";
import type { Report } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

// The panels are code-split and irrelevant here.
vi.mock("@/components/report/overview-panel", () => ({
  OverviewPanel: () => null,
}));

function report(over: Partial<Report["source"]> = {}): Report {
  return {
    id: "rep1",
    created_at: new Date().toISOString(),
    duration_seconds: 1,
    source: {
      kind: "repository",
      repository: "acme/app",
      ref: "release-2",
      commit: "abc1234",
      url: "https://github.com/acme/app",
      filename: null,
      ...over,
    },
    project: {
      name: null, description: null, languages: [], frameworks: [],
      package_managers: [], entry_points: [], total_files: 1,
      analysed_files: 1, total_lines: 10, has_tests: false,
      has_ci: false, has_lockfile: false,
    },
    score: { value: 90, grade: "A", categories: [], summary: "s" },
    severity_counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    findings: [],
    dependencies: [],
    ingest: {
      files_extracted: 1, files_analysed: 1, bytes_extracted: 1,
      compression_ratio: 1, skipped_directories: [], rejected_entries: {},
    },
    activity: null,
    truncated: false,
    rule_ids: [],
    suppressed_count: 0,
    can_suppress: false,
    effective_score: null,
    delta: null,
  } as Report;
}

beforeEach(() => {
  push.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ job_id: "job_9" }) }),
    ),
  );
});

describe("Analyse again", () => {
  it("re-runs the same repository at the same ref", async () => {
    const user = userEvent.setup();
    render(<ReportView report={report()} />);

    await user.click(screen.getByRole("button", { name: /analyse again/i }));

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("/api/analyze/repository");
    // The ref matters: comparing `main` against a report of `release-2` would
    // produce a delta full of differences that are real but are not *changes*.
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      url: "https://github.com/acme/app",
      ref: "release-2",
    });
  });

  it("sends the reader to the progress stream", async () => {
    const user = userEvent.setup();
    render(<ReportView report={report()} />);

    await user.click(screen.getByRole("button", { name: /analyse again/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/analysing/job_9"));
  });

  it("is absent for an uploaded archive", () => {
    // A ZIP has no stable identity to re-fetch; the button would exist only
    // to fail.
    render(
      <ReportView
        report={report({ kind: "upload", repository: null, url: null, filename: "app.zip" })}
      />,
    );
    expect(screen.queryByRole("button", { name: /analyse again/i })).toBeNull();
  });

  it("shows the reason when the server refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: async () => ({ code: "rate_limited", message: "Too many analyses." }),
        }),
      ),
    );
    const user = userEvent.setup();
    render(<ReportView report={report()} />);

    await user.click(screen.getByRole("button", { name: /analyse again/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Too many analyses."),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
