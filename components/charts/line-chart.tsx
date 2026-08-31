"use client";

import * as React from "react";

import { ChartShell } from "@/components/charts/chart-shell";
import { areaPath, linePath, linearScale, niceDomain, niceTicks } from "@/lib/scale";
import { cn } from "@/lib/utils";

/**
 * Line chart over a shared x axis.
 *
 * Every series must plot against the same x values — that is what makes a
 * single hover read out every series at once, and it is true of both callers
 * (score over time, severity mix over time), so it is enforced by the shape of
 * the props rather than checked at runtime.
 */

export interface LineSeries {
  id: string;
  label: string;
  /** A CSS colour, normally from `seriesColour()` or a severity token. */
  colour: string;
  /** One value per x tick. `null` leaves a gap rather than inventing a point. */
  values: (number | null)[];
}

export interface LineChartProps {
  /** x-axis positions, one label per point. Ordered left to right. */
  labels: string[];
  series: LineSeries[];
  height?: number;
  /** Force the y range, e.g. `[0, 100]` for a score that always means 0–100. */
  yDomain?: [number, number] | undefined;
  formatY?: (value: number) => string;
  /** Fill under the line. Only meaningful for a single series. */
  area?: boolean;
  caption: string;
  /** Tooltip body for the hovered x position. */
  renderTooltip?: (index: number) => React.ReactNode;
  /**
   * Print each point's value above it, so the chart reads without hovering.
   *
   * Only honoured for a single series — with two or more the labels collide at
   * every x where the lines converge, which is exactly where a reader most
   * needs to tell them apart. Multi-series callers keep the tooltip.
   */
  pointLabels?: boolean;
  className?: string;
}

const PADDING = { top: 8, right: 8, bottom: 22, left: 34 };

export function LineChart({
  labels,
  series,
  height = 180,
  yDomain,
  formatY = (value) => String(Math.round(value)),
  area = false,
  caption,
  renderTooltip,
  pointLabels = false,
  className,
}: LineChartProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  const showPointLabels = pointLabels && series.length === 1;
  // The labels sit above the highest point, which without extra headroom
  // renders outside the plot and gets clipped by the shell.
  const pad = showPointLabels ? { ...PADDING, top: 22 } : PADDING;

  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const domain: [number, number] =
    yDomain ??
    (values.length === 0
      ? [0, 1]
      : niceDomain(Math.min(...values), Math.max(...values)));

  const table = {
    headers: ["", ...series.map((s) => s.label)],
    rows: labels.map((label, index) => [
      label,
      ...series.map((s) => {
        const value = s.values[index];
        return value === null || value === undefined ? "—" : formatY(value);
      }),
    ]),
  };

  return (
    <ChartShell caption={caption} table={table} height={height} className={className}>
      {(width) => {
        const plotWidth = Math.max(1, width - pad.left - pad.right);
        const plotHeight = Math.max(1, height - pad.top - pad.bottom);

        // A single point has no span to spread across, so it sits centred.
        const x = linearScale(
          [0, Math.max(1, labels.length - 1)],
          labels.length === 1
            ? [pad.left + plotWidth / 2, pad.left + plotWidth / 2]
            : [pad.left, pad.left + plotWidth],
        );
        const y = linearScale(domain, [pad.top + plotHeight, pad.top]);
        const ticks = niceTicks(domain[0], domain[1], 4);

        // Only label every nth x tick when they would otherwise collide.
        const step = Math.max(1, Math.ceil(labels.length / Math.floor(plotWidth / 64)));
        const lastIndex = labels.length - 1;

        /*
          The last tick is always drawn, so a stepped tick landing near it
          overprints. With 12 points and room for five labels the step is 3,
          which draws 0, 3, 6, 9 and 11 — and 9 and 11 are two positions apart,
          close enough that the two strings overlapped into an unreadable smear
          at the right edge of the plot. Dropping any stepped tick within one
          full step of the end leaves 0, 3, 6, 11.
        */
        const showLabel = (index: number) =>
          index === lastIndex || (index % step === 0 && lastIndex - index >= step);

        return (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={caption}
              className="overflow-visible"
              onPointerLeave={() => setHovered(null)}
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const offset = event.clientX - box.left;
                const ratio = (offset - pad.left) / plotWidth;
                const index = Math.round(ratio * Math.max(1, labels.length - 1));
                setHovered(Math.min(labels.length - 1, Math.max(0, index)));
              }}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    x2={pad.left + plotWidth}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="var(--chart-grid)"
                    strokeWidth={1}
                  />
                  <text
                    x={pad.left - 6}
                    y={y(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="tabular fill-fg-subtle text-[10px]"
                  >
                    {formatY(tick)}
                  </text>
                </g>
              ))}

              {labels.map((label, index) =>
                showLabel(index) ? (
                  <text
                    key={`${label}-${index}`}
                    x={x(index)}
                    y={height - 6}
                    textAnchor={
                      index === 0 ? "start" : index === lastIndex ? "end" : "middle"
                    }
                    className="tabular fill-fg-subtle text-[10px]"
                  >
                    {label}
                  </text>
                ) : null,
              )}

              {hovered !== null && (
                <line
                  x1={x(hovered)}
                  x2={x(hovered)}
                  y1={pad.top}
                  y2={pad.top + plotHeight}
                  stroke="var(--chart-axis)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}

              {series.map((line) => {
                const points = line.values
                  .map((value, index) =>
                    value === null ? null : { x: x(index), y: y(value), value },
                  )
                  .filter(
                    (point): point is { x: number; y: number; value: number } =>
                      point !== null,
                  );

                return (
                  <g key={line.id}>
                    {area && points.length > 1 && (
                      <path
                        d={areaPath(points, pad.top + plotHeight)}
                        fill={line.colour}
                        opacity={0.1}
                      />
                    )}
                    <path
                      d={linePath(points)}
                      fill="none"
                      stroke={line.colour}
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {points.map((point, index) => (
                      <circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r={points.length === 1 || hovered !== null ? 3 : 2.5}
                        fill="var(--canvas)"
                        stroke={line.colour}
                        strokeWidth={1.75}
                      />
                    ))}

                    {/* Values above each point. The first and last anchor
                        inward so they do not overhang the plot on either side. */}
                    {showPointLabels &&
                      points.map((point, index) => (
                        <text
                          key={`label-${index}`}
                          x={point.x}
                          y={point.y - 9}
                          textAnchor={
                            index === 0
                              ? "start"
                              : index === points.length - 1
                                ? "end"
                                : "middle"
                          }
                          className="tabular fill-fg-muted text-[10px] font-medium"
                        >
                          {formatY(point.value)}
                        </text>
                      ))}
                  </g>
                );
              })}
            </svg>

            {hovered !== null && renderTooltip && (
              <ChartTooltip
                x={x(hovered)}
                width={width}
                content={renderTooltip(hovered)}
              />
            )}
          </>
        );
      }}
    </ChartShell>
  );
}

/**
 * Tooltip pinned to the hovered column.
 *
 * Not the Radix tooltip: that anchors to an element, and this anchors to a
 * coordinate that moves as the pointer sweeps. It flips side near the right
 * edge so it never clips out of the panel.
 */
function ChartTooltip({
  x,
  width,
  content,
}: {
  x: number;
  width: number;
  content: React.ReactNode;
}) {
  const flip = x > width - 140;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1 z-10 min-w-[7rem] rounded-md border border-border",
        "bg-surface-raised px-2 py-1.5 text-[11px] shadow-sm",
      )}
      style={flip ? { right: width - x + 8 } : { left: x + 8 }}
    >
      {content}
    </div>
  );
}
