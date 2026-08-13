import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeltaSummary } from "@/components/report/delta-summary";
import type { Finding, FindingDelta, Report } from "@/lib/types";

function finding(overrides: Partial<Finding> = {}): Finding {
  const merged: Finding = {
    id: "f1",
    fingerprint: "",
    rule_id: "test/rule",
    title: "Test finding",
    description: "d",
    category: "quality",
    severity: "medium",
    confidence: "high",
    file: "src/a.ts",
    line: 10,
    end_line: 10,
    snippet: null,
    snippet_start_line: null,
    remediation: null,
    references: [],
    ...overrides,
  };
  return { ...merged, fingerprint: merged.fingerprint || `fp-${merged.id}` };
}

function delta(overrides: Partial<FindingDelta> = {}): FindingDelta {
  return {
    previous_report_id: "r0",
    previous_created_at: new Date(Date.now() - 86_400_000).toISOString(),
    new: [],
    resolved: [],
    unchanged: 0,
    new_rules: [],
    ...overrides,
  };
}

function report(findings: Finding[], d: FindingDelta | null): Report {
  return {
    id: "r1",
    created_at: new Date().toISOString(),
    duration_seconds: 1,
    source: {
      kind: "repository",
      repository: "acme/app",
      ref: "main",
      commit: null,
      url: null,
      filename: null,
    },
    project: {
      name: "app",
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
      has_lockfile: true,
    },
    score: { value: 80, grade: "B", categories: [], summary: "ok" },
    severity_counts: { critical: 0, high: 0, medium: findings.length, low: 0, info: 0 },
    findings,
    dependencies: [],
    ingest: {
      files_extracted: 1,
      files_analysed: 1,
      bytes_extracted: 1,
      compression_ratio: 1,
      skipped_directories: [],
      rejected_entries: {},
    },
    activity: null,
    truncated: false,
    rule_ids: ["test/rule"],
    delta: d,
  };
}

describe("DeltaSummary", () => {
  it("renders nothing at all on a first analysis", () => {
    // Absent, not empty. A "0 resolved, 0 new" line on a first run implies a
    // comparison that did not happen.
    const { container } = render(
      <DeltaSummary report={report([finding()], null)} onViewNew={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says so plainly when nothing changed", () => {
    render(
      <DeltaSummary
        report={report([finding()], delta({ unchanged: 1 }))}
        onViewNew={vi.fn()}
      />,
    );
    expect(screen.getByText(/nothing has changed/i)).toBeInTheDocument();
  });

  it("reports resolved and new counts together", () => {
    const fresh = finding({ id: "b" });
    render(
      <DeltaSummary
        report={report(
          [fresh],
          delta({
            new: [fresh.fingerprint],
            resolved: [
              {
                fingerprint: "fp-old",
                rule_id: "test/rule",
                title: "Gone now",
                file: "src/old.ts",
                severity: "high",
              },
            ],
            unchanged: 3,
          }),
        )}
        onViewNew={vi.fn()}
      />,
    );

    expect(screen.getByText(/1 finding resolved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 new" })).toBeInTheDocument();
    expect(screen.getByText(/3 unchanged/)).toBeInTheDocument();
  });

  it("lists resolved findings, which appear nowhere else", () => {
    render(
      <DeltaSummary
        report={report(
          [],
          delta({
            resolved: [
              {
                fingerprint: "fp-old",
                rule_id: "security/hardcoded-secret",
                title: "Secret committed",
                file: "src/old.ts",
                severity: "critical",
              },
            ],
          }),
        )}
        onViewNew={vi.fn()}
      />,
    );

    // They are absent from `report.findings` by definition, so the delta is
    // their only route to the screen.
    expect(screen.getByText("Secret committed")).toBeInTheDocument();
    expect(screen.getByText("src/old.ts")).toBeInTheDocument();
  });

  it("says when new findings came from a rule that did not run last time", () => {
    const fresh = finding({ id: "b", rule_id: "security/new-rule" });
    render(
      <DeltaSummary
        report={report(
          [fresh],
          delta({ new: [fresh.fingerprint], new_rules: ["security/new-rule"] }),
        )}
        onViewNew={vi.fn()}
      />,
    );
    expect(screen.getByText(/not to the code/i)).toBeInTheDocument();
  });

  it("stays quiet about a new rule that produced no new findings", () => {
    // The caption is a caveat. Shown when it does not apply, it teaches people
    // to ignore it for the times it does.
    render(
      <DeltaSummary
        report={report(
          [finding()],
          delta({ new: [], unchanged: 1, new_rules: ["security/new-rule"] }),
        )}
        onViewNew={vi.fn()}
      />,
    );
    expect(screen.queryByText(/not to the code/i)).not.toBeInTheDocument();
  });

  it("hands off to the findings list when the new count is clicked", async () => {
    const user = userEvent.setup();
    const onViewNew = vi.fn();
    const fresh = finding({ id: "b" });
    render(
      <DeltaSummary
        report={report([fresh], delta({ new: [fresh.fingerprint] }))}
        onViewNew={onViewNew}
      />,
    );

    await user.click(screen.getByRole("button", { name: "1 new" }));
    expect(onViewNew).toHaveBeenCalledOnce();
  });
});
