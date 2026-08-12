import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TrendPanel } from "@/components/report/trend-panel";
import type { ReportSummary } from "@/lib/types";

// ChartShell draws nothing until it has measured a width, and jsdom reports 0.
Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get: () => 600,
});

function summary(overrides: Partial<ReportSummary> & { id: string }): ReportSummary {
  return {
    created_at: new Date("2026-08-01T12:00:00Z").toISOString(),
    source: {
      kind: "repository",
      repository: "a/b",
      ref: "main",
      commit: null,
      url: null,
      filename: null,
    },
    score: 70,
    grade: "C",
    severity_counts: { critical: 0, high: 1, medium: 2, low: 3, info: 0 },
    total_findings: 6,
    duration_seconds: 1,
    ...overrides,
  };
}

/** Newest first, as the API returns them. */
function runs(...scores: number[]) {
  return scores.map((score, index) =>
    summary({
      id: `r${scores.length - index}`,
      score,
      created_at: `2026-08-${String(20 - index).padStart(2, "0")}T12:00:00Z`,
    }),
  );
}

describe("TrendPanel — too little to plot", () => {
  it("says what to do instead of drawing a one-point chart", () => {
    render(
      <TrendPanel history={[summary({ id: "r1" })]} currentId="r1" repository="a/b" />,
    );

    expect(screen.getByText(/only one analysis/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("handles an empty history without crashing", () => {
    expect(() =>
      render(<TrendPanel history={[]} currentId="r1" repository="a/b" />),
    ).not.toThrow();
  });

  it("states two analyses in a line rather than drawing one segment", () => {
    // A chart of a single segment is a 200px rectangle restating two numbers.
    render(<TrendPanel history={runs(74, 68)} currentId="r2" repository="a/b" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // Both endpoints are still stated — the summary replaces the chart, it
    // does not drop the data.
    const text = document.body.textContent ?? "";
    expect(text).toContain("68");
    expect(text).toContain("74");
    expect(text).toMatch(/across two analyses/i);
    // Improvement is stated in words, not left to the reader to infer.
    expect(text).toContain("+6");
  });

  it("reports a regression as a fall, not an unsigned number", () => {
    render(<TrendPanel history={runs(55, 80)} currentId="r2" repository="a/b" />);
    expect(screen.getByText(/-25/)).toBeInTheDocument();
  });
});

describe("TrendPanel — charted", () => {
  it("draws the chart once there is a shape to read", () => {
    render(<TrendPanel history={runs(74, 71, 68)} currentId="r3" repository="a/b" />);
    expect(screen.getByRole("img", { name: /68 to 74/ })).toBeInTheDocument();
  });

  it("orders the chart oldest-first even though the API returns newest-first", () => {
    render(<TrendPanel history={runs(74, 71, 68)} currentId="r3" repository="a/b" />);

    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    // The older score must appear before the newer one in the data table.
    expect(cells.indexOf("68")).toBeLessThan(cells.indexOf("74"));
  });

  it("switches to severity series on request", async () => {
    const user = userEvent.setup();
    render(<TrendPanel history={runs(70, 70, 70)} currentId="r3" repository="a/b" />);

    await user.click(screen.getByRole("button", { name: "Severity" }));
    expect(screen.getByRole("columnheader", { name: "Critical" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "High" })).toBeInTheDocument();
    // `info` is deliberately not plotted.
    expect(screen.queryByRole("columnheader", { name: "Info" })).not.toBeInTheDocument();
  });
});
