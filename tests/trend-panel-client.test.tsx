import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrendPanelClient } from "@/components/report/overview-panel";
import type { ReportSummary } from "@/lib/types";

// ChartShell draws nothing until it has measured a width, and jsdom reports 0.
Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get: () => 600,
});

function summary(id: string, score: number, day: number): ReportSummary {
  return {
    id,
    created_at: `2026-08-${String(day).padStart(2, "0")}T12:00:00Z`,
    source: {
      kind: "repository",
      repository: "a/b",
      ref: "main",
      commit: null,
      url: null,
      filename: null,
    },
    score,
    effective_score: null,
    suppressed_count: 0,
    grade: "C",
    severity_counts: { critical: 0, high: 1, medium: 2, low: 3, info: 0 },
    total_findings: 6,
    duration_seconds: 1,
  };
}

/** Newest first, as the API returns them. */
const HISTORY = [summary("r3", 68, 20), summary("r2", 71, 19), summary("r1", 74, 18)];

function mockFetch(impl: (url: string) => unknown) {
  const spy = vi.fn((url: string, init?: { signal: AbortSignal }) => {
    void init;
    return Promise.resolve(impl(String(url)));
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => vi.unstubAllGlobals());

/**
 * The trend moved off the server so it would stop holding the streamed
 * document open. These cover the part that move introduced — the fetch — not
 * the chart, which `trend-panel.test.tsx` already drives directly.
 */
describe("TrendPanelClient", () => {
  it("reserves the chart's height before the history arrives", () => {
    mockFetch(() => new Promise(() => {}) as never); // never settles
    const { container } = render(
      <TrendPanelClient currentId="r3" repository="a/b" />,
    );

    // The skeleton is what keeps the swap from shifting the page.
    expect(container.querySelector(".animate-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Trend")).not.toBeInTheDocument();
  });

  it("asks for this repository's history and charts it", async () => {
    const spy = mockFetch(() => ({ ok: true, json: async () => HISTORY }));
    render(<TrendPanelClient currentId="r3" repository="a/b" />);

    await waitFor(() => expect(screen.getByText("Trend")).toBeInTheDocument());
    expect(screen.getByText("3 analyses")).toBeInTheDocument();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]![0])).toContain(
      "/api/reports?limit=20&repository=a%2Fb",
    );
  });

  it("says so plainly when there is only one analysis", async () => {
    mockFetch(() => ({ ok: true, json: async () => [summary("r1", 74, 18)] }));
    render(<TrendPanelClient currentId="r1" repository="a/b" />);

    await waitFor(() =>
      expect(screen.getByText(/Only one analysis of/)).toBeInTheDocument(),
    );
  });

  it("does not take the report down when the history request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network"))),
    );
    render(<TrendPanelClient currentId="r1" repository="a/b" />);

    // Degrades to the same state as an empty history rather than throwing.
    await waitFor(() =>
      expect(screen.getByText(/Only one analysis of/)).toBeInTheDocument(),
    );
  });

  it("treats a non-ok response as no history", async () => {
    mockFetch(() => ({ ok: false, json: async () => ({ code: "boom" }) }));
    render(<TrendPanelClient currentId="r1" repository="a/b" />);

    await waitFor(() =>
      expect(screen.getByText(/Only one analysis of/)).toBeInTheDocument(),
    );
  });

  it("abandons an in-flight request when the repository changes", async () => {
    const spy = mockFetch(() => ({ ok: true, json: async () => HISTORY }));
    const { rerender } = render(
      <TrendPanelClient currentId="r3" repository="a/b" />,
    );
    rerender(<TrendPanelClient currentId="r3" repository="c/d" />);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    const [first, second] = spy.mock.calls;
    expect(String(first![0])).toContain("repository=a%2Fb");
    expect(String(second![0])).toContain("repository=c%2Fd");

    // The first call's controller is aborted, so a late response cannot
    // overwrite the current repository's trend.
    expect(first![1]?.signal.aborted).toBe(true);
    expect(second![1]?.signal.aborted).toBe(false);
  });
});
