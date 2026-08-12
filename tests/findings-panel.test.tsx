import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { FindingsPanel } from "@/components/report/findings-panel";
import type { Finding, Report } from "@/lib/types";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    rule_id: "test/rule",
    title: "Test finding",
    description: "Something is wrong.",
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
}

function report(findings: Finding[]): Report {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const item of findings) counts[item.severity] += 1;

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
      total_files: 10,
      analysed_files: 10,
      total_lines: 100,
      has_tests: false,
      has_ci: false,
      has_lockfile: true,
    },
    score: { value: 80, grade: "B", categories: [], summary: "ok" },
    severity_counts: counts,
    findings,
    dependencies: [],
    ingest: {
      files_extracted: 10,
      files_analysed: 10,
      bytes_extracted: 1000,
      compression_ratio: 1,
      skipped_directories: [],
      rejected_entries: {},
    },
    activity: null,
    truncated: false,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai: { configured: false, available: false, state: "unconfigured", reason: "no key" },
      }),
    }),
  );
});

describe("FindingsPanel", () => {
  it("shows a purposeful empty state when there are no findings", () => {
    render(<FindingsPanel report={report([])} />);
    expect(screen.getByText("No findings")).toBeInTheDocument();
    // Explains *why* it's empty rather than just saying "no data".
    expect(screen.getByText(/every rule that applied/i)).toBeInTheDocument();
  });

  it("orders findings by severity, most urgent first", () => {
    render(
      <FindingsPanel
        report={report([
          finding({ id: "a", severity: "low", title: "Low issue" }),
          finding({ id: "b", severity: "critical", title: "Critical issue" }),
          finding({ id: "c", severity: "medium", title: "Medium issue" }),
        ])}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Critical issue")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Medium issue")).toBeInTheDocument();
    expect(within(items[2]!).getByText("Low issue")).toBeInTheDocument();
  });

  it("filters by search across title, file and rule id", async () => {
    const user = userEvent.setup();
    render(
      <FindingsPanel
        report={report([
          finding({ id: "a", title: "Missing key", file: "src/List.tsx" }),
          finding({ id: "b", title: "Long file", file: "src/Other.tsx" }),
        ])}
      />,
    );

    await user.type(screen.getByLabelText("Filter findings"), "List.tsx");

    expect(screen.getByText("Missing key")).toBeInTheDocument();
    expect(screen.queryByText("Long file")).not.toBeInTheDocument();
    expect(screen.getByText(/1 of 2 findings/)).toBeInTheDocument();
  });

  it("offers a way out when filters match nothing", async () => {
    const user = userEvent.setup();
    render(<FindingsPanel report={report([finding()])} />);

    await user.type(screen.getByLabelText("Filter findings"), "zzzzz");

    expect(screen.getByText("Nothing matches those filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(screen.getByText("Test finding")).toBeInTheDocument();
  });

  it("toggles severity filters and reflects pressed state", async () => {
    const user = userEvent.setup();
    // Titles deliberately avoid the words "Critical"/"Low": those also appear
    // as labels on the severity filter chips, so a bare text query would match
    // the filter rather than the finding.
    render(
      <FindingsPanel
        report={report([
          finding({ id: "a", severity: "critical", title: "Secret committed" }),
          finding({ id: "b", severity: "low", title: "Unused import" }),
        ])}
      />,
    );

    const buttons = screen.getAllByRole("button", { pressed: false });
    const critical = buttons.find((button) => button.textContent?.includes("Critical"));
    expect(critical).toBeDefined();

    await user.click(critical!);
    expect(critical).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Secret committed")).toBeInTheDocument();
    expect(screen.queryByText("Unused import")).not.toBeInTheDocument();
  });

  it("marks a finding without a location as project-wide rather than faking a path", () => {
    render(
      <FindingsPanel
        report={report([finding({ file: null, line: null, title: "No tests" })])}
      />,
    );
    expect(screen.getByText("project-wide")).toBeInTheDocument();
  });

  it("expands a finding to reveal its detail", async () => {
    const user = userEvent.setup();
    render(
      <FindingsPanel
        report={report([
          finding({ id: "a", title: "First" }),
          finding({ id: "b", title: "Second", description: "Second detail." }),
        ])}
      />,
    );

    const second = screen.getByRole("button", { name: /Second/ });
    expect(second).toHaveAttribute("aria-expanded", "false");

    await user.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Second detail.")).toBeInTheDocument();
  });

  it("surfaces confidence when a finding is heuristic", () => {
    render(
      <FindingsPanel
        report={report([finding({ confidence: "low", title: "Maybe an issue" })])}
      />,
    );
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });
});
