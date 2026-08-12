"use client";

import * as React from "react";

import { ChartShell } from "@/components/charts/chart-shell";
import { linearScale, niceDomain, niceTicks } from "@/lib/scale";
import { cn } from "@/lib/utils";

/**
 * Vertical bar chart for a single temporal or categorical series.
 *
 * Built for the case the product actually has — ~52 weekly commit counts —
 * where bars are a couple of pixels wide and the interesting shape is the
 * envelope, not any individual bar.
 */

export interface BarChartProps {
  values: number[];
  /** One per value, used for ticks and the tooltip. */
  labels: string[];
  height?: number;
  colour?: string;
  formatY?: (value: number) => string;
  caption: string;
  renderTooltip?: (index: number) => React.ReactNode;
  className?: string;
}

const PADDING = { top: 8, right: 8, bottom: 22, left: 34 };

export function BarChart({
  values,
  labels,
  height = 140,
  colour = "var(--series-1)",
  formatY = (value) => String(Math.round(value)),
  caption,
  renderTooltip,
  className,
}: BarChartProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  // Counts start at zero: a bar chart that does not include its baseline
  // exaggerates differences, which for "commits per week" would be a lie.
  const max = values.length > 0 ? Math.max(...values) : 0;
  const domain: [number, number] = max === 0 ? [0, 1] : niceDomain(0, max, 3);

  const table = {
    headers: ["Period", "Value"],
    rows: labels.map((label, index) => [label, formatY(values[index] ?? 0)]),
  };

  return (
    <ChartShell caption={caption} table={table} height={height} className={className}>
      {(width) => {
        const plotWidth = Math.max(1, width - PADDING.left - PADDING.right);
        const plotHeight = Math.max(1, height - PADDING.top - PADDING.bottom);
        const y = linearScale(domain, [PADDING.top + plotHeight, PADDING.top]);
        const ticks = niceTicks(domain[0], domain[1], 3);

        const slot = plotWidth / Math.max(1, values.length);
        // Keep at least a hairline gap, but never let the bar vanish.
        const barWidth = Math.max(1, Math.min(slot - 1.5, 24));
        const step = Math.max(1, Math.ceil(labels.length / Math.floor(plotWidth / 56)));

        return (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={caption}
              onPointerLeave={() => setHovered(null)}
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const index = Math.floor((event.clientX - box.left - PADDING.left) / slot);
                setHovered(
                  index >= 0 && index < values.length ? index : null,
                );
              }}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PADDING.left}
                    x2={PADDING.left + plotWidth}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="var(--chart-grid)"
                    strokeWidth={1}
                  />
                  <text
                    x={PADDING.left - 6}
                    y={y(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="tabular fill-fg-subtle text-[10px]"
                  >
                    {formatY(tick)}
                  </text>
                </g>
              ))}

              {values.map((value, index) => {
                const top = y(value);
                const barHeight = Math.max(value > 0 ? 1 : 0, PADDING.top + plotHeight - top);
                return (
                  <rect
                    key={index}
                    x={PADDING.left + index * slot + (slot - barWidth) / 2}
                    y={PADDING.top + plotHeight - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={barWidth > 4 ? 1.5 : 0}
                    fill={colour}
                    opacity={hovered === null || hovered === index ? 1 : 0.45}
                  />
                );
              })}

              {labels.map((label, index) =>
                index % step === 0 || index === labels.length - 1 ? (
                  <text
                    key={`${label}-${index}`}
                    x={PADDING.left + index * slot + slot / 2}
                    y={height - 6}
                    textAnchor={index === labels.length - 1 ? "end" : "middle"}
                    className="tabular fill-fg-subtle text-[10px]"
                  >
                    {label}
                  </text>
                ) : null,
              )}
            </svg>

            {hovered !== null && renderTooltip && (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1 z-10 rounded-md border border-border",
                  "bg-surface-raised px-2 py-1.5 text-[11px] shadow-sm",
                )}
                style={
                  PADDING.left + hovered * slot > width - 140
                    ? { right: width - (PADDING.left + hovered * slot) + 8 }
                    : { left: PADDING.left + hovered * slot + 8 }
                }
              >
                {renderTooltip(hovered)}
              </div>
            )}
          </>
        );
      }}
    </ChartShell>
  );
}
