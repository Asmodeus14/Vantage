import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { Sparkline } from "@/components/charts/sparkline";
import {
  areaPath,
  linePath,
  linearScale,
  niceDomain,
  niceTicks,
  seriesColour,
} from "@/lib/scale";

// jsdom reports zero-width elements, so ChartShell would never render its SVG.
// Pin a realistic width; the polyfilled ResizeObserver never fires in jsdom.
function withWidth(width = 600) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => width,
  });
}

describe("linearScale", () => {
  it("maps the domain onto the range linearly", () => {
    const scale = linearScale([0, 100], [0, 200]);
    expect(scale(0)).toBe(0);
    expect(scale(50)).toBe(100);
    expect(scale(100)).toBe(200);
  });

  it("inverts when the range is descending, as an SVG y axis is", () => {
    const scale = linearScale([0, 100], [180, 0]);
    expect(scale(0)).toBe(180);
    expect(scale(100)).toBe(0);
  });

  it("centres a zero-width domain instead of dividing by zero", () => {
    const scale = linearScale([5, 5], [0, 200]);
    expect(scale(5)).toBe(100);
    expect(Number.isNaN(scale(5))).toBe(false);
  });
});

describe("niceTicks", () => {
  it("produces round numbers on the 1/2/5 progression", () => {
    // 25 is not on the progression, so the step rounds up to 50 and `count`
    // acts as a ceiling. Three gridlines over 0–100 is the intent, not a bug.
    expect(niceTicks(0, 100, 4)).toEqual([0, 50, 100]);
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0, 1000, 4)).toEqual([0, 500, 1000]);
  });

  it("never returns more ticks than asked for", () => {
    for (const [min, max] of [
      [0, 7],
      [0, 100],
      [12, 87],
      [0, 3],
    ] as const) {
      expect(niceTicks(min, max, 4).length).toBeLessThanOrEqual(5);
    }
  });

  it("does not emit float noise", () => {
    for (const tick of niceTicks(0, 1, 5)) {
      expect(String(tick)).not.toMatch(/\d{6,}/);
    }
  });

  it("degrades safely on empty or degenerate input", () => {
    expect(niceTicks(5, 5)).toEqual([5]);
    expect(niceTicks(Number.NaN, 10)).toEqual([]);
  });
});

describe("niceDomain", () => {
  it("widens a flat series so it has height", () => {
    const [min, max] = niceDomain(50, 50);
    expect(max).toBeGreaterThan(min);
  });

  it("never crops the data it was given", () => {
    const [min, max] = niceDomain(13, 87);
    expect(min).toBeLessThanOrEqual(13);
    expect(max).toBeGreaterThanOrEqual(87);
  });

  it("leaves headroom so the extremes do not sit on the frame", () => {
    // The regression: ticks stop at 15 for a max of 17, and clamping to the
    // raw max drew the top point exactly on the top edge.
    const [min, max] = niceDomain(0, 17, 5);
    expect(max).toBeGreaterThan(17);
    expect(min).toBeLessThanOrEqual(0);
  });

  it("rounds a non-zero floor down to a round number", () => {
    const [min] = niceDomain(13, 87);
    expect(min % 10).toBe(0);
  });
});

describe("path builders", () => {
  it("returns an empty string for no points rather than invalid path data", () => {
    expect(linePath([])).toBe("");
    expect(areaPath([], 0)).toBe("");
  });

  it("emits a single move command for one point", () => {
    expect(linePath([{ x: 1, y: 2 }])).toBe("M1 2");
  });

  it("has no area under a single point", () => {
    expect(areaPath([{ x: 1, y: 2 }], 10)).toBe("");
  });

  it("closes the area path back to the baseline", () => {
    const d = areaPath(
      [
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ],
      20,
    );
    expect(d.startsWith("M0 10")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).toContain("L0 20");
  });

  it("wraps the categorical ramp rather than running out", () => {
    expect(seriesColour(0)).toBe(seriesColour(5));
  });
});

describe("LineChart", () => {
  it("exposes the data as a table matching what is drawn", () => {
    withWidth();
    render(
      <LineChart
        labels={["Jul", "Aug", "Sep"]}
        series={[{ id: "score", label: "Score", colour: "red", values: [68, 71, 74] }]}
        caption="Score rose from 68 to 74"
        yDomain={[0, 100]}
      />,
    );

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Score" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "68" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "74" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Score rose from 68 to 74/ })).toBeInTheDocument();
  });

  it("renders a gap, not a zero, for a missing value", () => {
    withWidth();
    render(
      <LineChart
        labels={["a", "b"]}
        series={[{ id: "s", label: "S", colour: "red", values: [1, null] }]}
        caption="test"
      />,
    );
    expect(screen.getByRole("cell", { name: "—" })).toBeInTheDocument();
  });

  it("renders a single point without throwing", () => {
    withWidth();
    expect(() =>
      render(
        <LineChart
          labels={["only"]}
          series={[{ id: "s", label: "S", colour: "red", values: [50] }]}
          caption="one point"
        />,
      ),
    ).not.toThrow();
  });

  it("survives an entirely empty series", () => {
    withWidth();
    expect(() =>
      render(
        <LineChart
          labels={[]}
          series={[{ id: "s", label: "S", colour: "red", values: [] }]}
          caption="nothing"
        />,
      ),
    ).not.toThrow();
  });
});

describe("BarChart", () => {
  it("tabulates every bar", () => {
    withWidth();
    render(
      <BarChart values={[3, 0, 7]} labels={["w1", "w2", "w3"]} caption="Commits per week" />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4); // header + 3
    expect(within(table).getByRole("cell", { name: "7" })).toBeInTheDocument();
  });

  it("handles an all-zero series without collapsing the axis", () => {
    withWidth();
    expect(() =>
      render(<BarChart values={[0, 0]} labels={["a", "b"]} caption="quiet" />),
    ).not.toThrow();
  });
});

describe("Sparkline", () => {
  it("renders nothing for fewer than two points, since one is not a trend", () => {
    const { container } = render(<Sparkline values={[70]} label="one" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("names the direction for assistive technology", () => {
    render(<Sparkline values={[68, 74]} label="Score rose from 68 to 74" />);
    expect(screen.getByRole("img", { name: "Score rose from 68 to 74" })).toBeInTheDocument();
  });

  it("draws a flat line for an unchanged series", () => {
    const { container } = render(<Sparkline values={[70, 70, 70]} label="flat" />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(d).not.toContain("NaN");
  });
});
