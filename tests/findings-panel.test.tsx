import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FindingsPanel } from "@/components/report/findings-panel";
import type { Finding, Report } from "@/lib/types";

/**
 * Every expanded finding mounts `AiActions`, which fetches `/api/health` on
 * mount and sets state when it resolves — after the synchronous render has
 * returned, so React reported an unwrapped update on every test in this file.
 *
 * Stubbed rather than flushed. Nothing here tests AI actions; that is
 * `ai-actions.test.tsx`'s job, and mounting the real component only coupled
 * these tests to an unrelated network call. A warning present on every run is
 * a warning nobody reads, and it would hide a real one.
 */
vi.mock("@/components/report/ai-actions", () => ({
  AiActions: () => null,
}));

/**
 * Stubbed for the same reason, plus one of its own: it calls `useRouter`, which
 * throws outside an app-router context. What is under test here is the panel's
 * filtering of accepted findings, not the control that creates them — that is
 * `suppress-action.test.tsx`.
 */
vi.mock("@/components/report/suppress-action", () => ({
  SuppressAction: () => null,
}));

function finding(overrides: Partial<Finding> = {}): Finding {
  const merged: Finding = {
    id: "f1",
    fingerprint: "",
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
    suppressed: false,
    priority: 0,
    suppression_reason: null,
    ...overrides,
  };
  // Derived from the id so distinct findings get distinct fingerprints without
  // every caller having to say so.
  return { ...merged, fingerprint: merged.fingerprint || `fp-${merged.id}` };
}

function report(findings: Finding[], delta: Report["delta"] = null): Report {
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
    rule_ids: ["test/rule"],
    suppressed_count: 0,
    effective_score: null,
    can_suppress: false,
    delta,
  };
}

describe("FindingsPanel", () => {
  it("shows a purposeful empty state when there are no findings", async () => {
    render(<FindingsPanel report={report([])} />);
    expect(screen.getByText("No findings")).toBeInTheDocument();
    // Explains *why* it's empty rather than just saying "no data".
    expect(screen.getByText(/every rule that applied/i)).toBeInTheDocument();
  });

  it("orders findings by severity, most urgent first", async () => {
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

  it("marks a finding without a location as project-wide rather than faking a path", async () => {
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

  it("reports every filter change so the view can put it in the URL", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <FindingsPanel
        report={report([finding()])}
        initialQuery="src/a.ts"
        onQueryChange={onQueryChange}
      />,
    );

    // The seeded value came from outside; echoing it straight back would loop.
    expect(onQueryChange).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Filter findings"), "!");
    expect(onQueryChange).toHaveBeenLastCalledWith("src/a.ts!");

    // Clearing must reach the URL too, or a stale `?q=` outlives the filter.
    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(onQueryChange).toHaveBeenLastCalledWith("");
  });

  it("marks findings that appeared since the last analysis, and can filter to them", async () => {
    const user = userEvent.setup();
    const fresh = finding({ id: "a", title: "Just appeared" });
    const old = finding({ id: "b", title: "Was here before" });

    render(
      <FindingsPanel
        report={report([fresh, old], {
          previous_report_id: "r0",
          previous_created_at: new Date(Date.now() - 86_400_000).toISOString(),
          new: [fresh.fingerprint],
          resolved: [],
          reopened: [],
          unchanged: 1,
          new_rules: [],
        })}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("New")).toBeInTheDocument();
    expect(within(items[1]!).queryByText("New")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^New 1$/ }));
    expect(screen.getByText("Just appeared")).toBeInTheDocument();
    expect(screen.queryByText("Was here before")).not.toBeInTheDocument();
  });

  it("offers no New filter when there is no comparison to filter against", async () => {
    // A control that can only ever match nothing reads as a bug in the report.
    render(<FindingsPanel report={report([finding()])} />);
    expect(screen.queryByRole("button", { name: /^New/ })).not.toBeInTheDocument();
  });

  it("hides accepted findings but never silently", async () => {
    const user = userEvent.setup();
    const accepted = finding({
      id: "a",
      title: "Known fixture key",
      suppressed: true,
      suppression_reason: "test fixture",
    });
    const live = finding({ id: "b", title: "Real problem" });

    const base = report([accepted, live]);
    render(<FindingsPanel report={{ ...base, suppressed_count: 1 }} />);

    expect(screen.queryByText("Known fixture key")).not.toBeInTheDocument();
    expect(screen.getByText("Real problem")).toBeInTheDocument();

    // The count is the thing that keeps this trustworthy: findings that vanish
    // without a trace make the whole feature suspect.
    const toggle = screen.getByRole("button", { name: /1 accepted/ });
    await user.click(toggle);
    expect(screen.getByText("Known fixture key")).toBeInTheDocument();
  });

  it("says nothing about acceptance when nothing is accepted", async () => {
    render(<FindingsPanel report={report([finding()])} />);
    expect(screen.queryByRole("button", { name: /accepted/ })).not.toBeInTheDocument();
  });

  it("surfaces confidence when a finding is heuristic", async () => {
    render(
      <FindingsPanel
        report={report([finding({ confidence: "low", title: "Maybe an issue" })])}
      />,
    );
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });
});

describe("FindingsPanel — incremental rendering", () => {
  const many = Array.from({ length: 75 }, (_, i) =>
    finding({ id: `f${i}`, title: `Finding number ${i}` }),
  );

  it("renders a page at a time rather than every finding on load", () => {
    // 500 findings are permitted, and every row hydrates. Mounting the whole
    // list was the largest single piece of main-thread work on this page.
    render(<FindingsPanel report={report(many)} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(30);
    expect(screen.getByText(/45 more findings not shown/)).toBeInTheDocument();
    // The true total stays visible, so the count is never misleading.
    expect(screen.getByText(/75 of 75 findings/)).toBeInTheDocument();
  });

  it("extends on request", async () => {
    const user = userEvent.setup();
    render(<FindingsPanel report={report(many)} />);

    await user.click(screen.getByRole("button", { name: /show 30 more/i }));
    expect(screen.getAllByRole("listitem")).toHaveLength(60);
  });

  it("shows the top of a narrowed result rather than a stale offset", async () => {
    const user = userEvent.setup();
    render(<FindingsPanel report={report(many)} />);

    await user.click(screen.getByRole("button", { name: /show 30 more/i }));
    await user.type(screen.getByLabelText("Filter findings"), "number 7");

    // Filtering resets the page, so what is on screen is the start of the
    // new result set.
    expect(screen.getByText("Finding number 7")).toBeInTheDocument();
  });
});

describe("FindingsPanel — prioritisation and the metric split", () => {
  it("orders by priority, not by severity", () => {
    // A medium-severity certainty the server ranked above a high-severity
    // guess. Sorting by severity would invert these.
    render(
      <FindingsPanel
        report={report([
          finding({
            id: "guess",
            title: "High severity guess",
            severity: "high",
            confidence: "low",
            priority: 15,
          }),
          finding({
            id: "certain",
            title: "Medium severity certainty",
            severity: "medium",
            confidence: "high",
            priority: 60,
          }),
        ])}
      />,
    );

    const titles = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(titles[0]).toContain("Medium severity certainty");
    expect(titles[1]).toContain("High severity guess");
  });

  it("keeps metrics out of the default view but never hides that they exist", async () => {
    const user = userEvent.setup();
    render(
      <FindingsPanel
        report={report([
          finding({ id: "sec", title: "Real problem", category: "security", priority: 90 }),
          finding({ id: "m1", title: "File is long", category: "metric", priority: 3 }),
          finding({ id: "m2", title: "Also long", category: "metric", priority: 3 }),
        ])}
      />,
    );

    expect(screen.getByText("Real problem")).toBeInTheDocument();
    expect(screen.queryByText("File is long")).not.toBeInTheDocument();

    // The count is on screen, and it is the way back to them.
    const toggle = screen.getByRole("button", { name: /2 metrics/i });
    await user.click(toggle);
    expect(screen.getByText("File is long")).toBeInTheDocument();
  });

  it("shows metrics when the category is asked for explicitly", async () => {
    const user = userEvent.setup();
    render(
      <FindingsPanel
        report={report([
          finding({ id: "sec", title: "Real problem", category: "security" }),
          finding({ id: "m1", title: "File is long", category: "metric" }),
        ])}
      />,
    );

    // Selecting Metrics and getting an empty list would read as a broken
    // filter rather than a deliberate default.
    await user.selectOptions(screen.getByLabelText(/category/i), "metric");
    expect(screen.getByText("File is long")).toBeInTheDocument();
    expect(screen.queryByText("Real problem")).not.toBeInTheDocument();
  });

  it("falls back to severity order for reports written before prioritisation", () => {
    // Every finding carries priority 0, so the old ordering must still apply
    // rather than the list shuffling into an arbitrary order.
    render(
      <FindingsPanel
        report={report([
          finding({ id: "low", title: "Low one", severity: "low", priority: 0 }),
          finding({ id: "crit", title: "Critical one", severity: "critical", priority: 0 }),
        ])}
      />,
    );
    const titles = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(titles[0]).toContain("Critical one");
  });
});

describe("FindingsPanel — reopened", () => {
  const delta = (over: Partial<NonNullable<Report["delta"]>> = {}) =>
    ({
      previous_report_id: "prev",
      previous_created_at: new Date().toISOString(),
      new: [],
      resolved: [],
      reopened: [],
      unchanged: 0,
      new_rules: [],
      ...over,
    }) as NonNullable<Report["delta"]>;

  it("marks a returning finding as reopened rather than new", () => {
    render(
      <FindingsPanel
        report={report(
          [finding({ id: "back", title: "It came back" })],
          delta({ reopened: ["fp-back"] }),
        )}
      />,
    );
    expect(screen.getByText("Reopened")).toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("includes reopened findings in the New filter", () => {
    // The filter means "appeared since last time", which a reopened finding
    // did. Excluding it would hide the most urgent thing behind a filter
    // named for it.
    render(
      <FindingsPanel
        initialOnlyNew
        report={report(
          [
            finding({ id: "back", title: "It came back" }),
            finding({ id: "old", title: "Still here" }),
          ],
          delta({ reopened: ["fp-back"], unchanged: 1 }),
        )}
      />,
    );
    expect(screen.getByText("It came back")).toBeInTheDocument();
    expect(screen.queryByText("Still here")).not.toBeInTheDocument();
  });

  it("prefers the reopened marker when a stale report claims both", () => {
    // Disjoint on the wire, but a report written by an older backend could
    // carry the same fingerprint in both lists. "Reopened" is the more
    // specific claim, so it wins.
    render(
      <FindingsPanel
        report={report(
          [finding({ id: "back", title: "It came back" })],
          delta({ new: ["fp-back"], reopened: ["fp-back"] }),
        )}
      />,
    );
    // Scoped to the row: a "New" filter chip legitimately exists here, because
    // the stale delta still lists the fingerprint under `new`. It is the
    // *marker* that must not say both.
    const row = screen.getAllByRole("listitem")[0]!;
    expect(within(row).getByText("Reopened")).toBeInTheDocument();
    expect(within(row).queryByText("New")).not.toBeInTheDocument();
  });
});

describe("FindingsPanel — confidence", () => {
  it("labels a finding the rules could not confirm", () => {
    render(
      <FindingsPanel
        report={report([
          finding({ id: "m", title: "Unproven reach", confidence: "medium" }),
        ])}
      />,
    );
    const row = screen.getAllByRole("listitem")[0]!;
    expect(within(row).getByText("Likely")).toBeInTheDocument();
  });

  it("labels a low-confidence finding distinctly", () => {
    render(
      <FindingsPanel
        report={report([
          finding({ id: "l", title: "Pattern only", confidence: "low" }),
        ])}
      />,
    );
    const row = screen.getAllByRole("listitem")[0]!;
    expect(within(row).getByText("Needs review")).toBeInTheDocument();
  });

  it("leaves confirmed findings unlabelled", () => {
    // `high` is 61-100% of rows on real reports. Labelling the norm turns the
    // flag into a decorative stripe, which is the mistake this display made
    // once already.
    render(
      <FindingsPanel
        report={report([
          finding({ id: "h", title: "Certain", confidence: "high" }),
        ])}
      />,
    );
    const row = screen.getAllByRole("listitem")[0]!;
    expect(within(row).queryByText("Confirmed")).not.toBeInTheDocument();
    expect(within(row).queryByText("Likely")).not.toBeInTheDocument();
  });
});
