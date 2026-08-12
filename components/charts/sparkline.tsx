"use client";

import { linePath, linearScale } from "@/lib/scale";
import { cn } from "@/lib/utils";

/**
 * Axis-less inline trend, for list rows.
 *
 * Fixed pixel dimensions rather than a scaled `viewBox`: this sits inline with
 * text at a known size, and scaling would thin the stroke unpredictably. It
 * carries no tooltip and no axis — it answers "up or down?" and nothing more,
 * so the accessible name states the direction in words.
 */
export function Sparkline({
  values,
  width = 72,
  height = 20,
  colour = "var(--series-1)",
  label,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  colour?: string;
  /** Sentence for assistive technology, e.g. "Score rose from 68 to 74". */
  label: string;
  className?: string;
}) {
  // One point is not a trend. Render nothing rather than a misleading flat line.
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 2;
  const x = linearScale([0, values.length - 1], [pad, width - pad]);
  // A flat series would collapse to a zero-height domain; linearScale centres
  // it, which is exactly right — a straight line through the middle.
  const y = linearScale([min, max], [height - pad, pad]);

  const points = values.map((value, index) => ({ x: x(index), y: y(value) }));
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <path
        d={linePath(points)}
        fill="none"
        stroke={colour}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && <circle cx={last.x} cy={last.y} r={2} fill={colour} />}
    </svg>
  );
}
