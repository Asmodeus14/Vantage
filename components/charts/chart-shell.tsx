"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared scaffolding for every chart.
 *
 * Charts are measured rather than scaled. A fixed `viewBox` stretched with
 * `width: 100%` would be one line of code, but it scales the axis labels too —
 * an 11px tick becomes 7px on a phone and 14px on a wide panel. Measuring the
 * container and drawing at real pixel sizes keeps type at the size the design
 * system says it is.
 *
 * `ResizeObserver` is polyfilled for jsdom in tests/setup.ts.
 */

/** Observed width of the element the returned ref is attached to. */
export function useChartWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    setWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export interface ChartShellProps {
  /**
   * A sentence describing what the chart shows and what it does — this is the
   * whole chart to a screen reader, so "Score rose from 68 to 74 over 5
   * analyses" beats "score chart".
   */
  caption: string;
  /** Rows for the hidden equivalent table: header row first. */
  table: { headers: string[]; rows: string[][] };
  height: number;
  className?: string;
  children: (width: number) => React.ReactNode;
}

/**
 * Wraps a chart with its non-visual equivalent.
 *
 * The table is not a nicety: an SVG of `<path>`s is unreadable to assistive
 * technology, and the data behind these charts is small enough that the honest
 * fallback is simply the numbers.
 */
export function ChartShell({
  caption,
  table,
  height,
  className,
  children,
}: ChartShellProps) {
  const [ref, width] = useChartWidth();

  return (
    <figure className={cn("relative m-0", className)}>
      <div ref={ref} style={{ height }} className="w-full">
        {/* Nothing is drawn until the width is known; one frame, no flash. */}
        {width > 0 && children(width)}
      </div>

      <figcaption className="sr-only">
        {caption}
        <table>
          <thead>
            <tr>
              {table.headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
