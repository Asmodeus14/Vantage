/**
 * Chart maths.
 *
 * Deliberately not a charting library. The charts this product needs are a
 * line, a bar and a sparkline over at most a few dozen points; a library would
 * cost more in bundle size and in fighting its theming than these ~120 lines
 * cost to own. Everything here is pure, so it is unit-testable without a DOM.
 */

export interface Scale {
  /** Map a domain value onto the pixel range. */
  (value: number): number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
}

/**
 * A linear scale from `domain` to `range`.
 *
 * A zero-width domain would divide by zero, so it collapses to the midpoint of
 * the range — which is what you want for a single-valued series: one point,
 * centred, rather than `NaN` or a point pinned to an edge.
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  const scale = ((value: number) => {
    if (span === 0) return (r0 + r1) / 2;
    return r0 + ((value - d0) / span) * (r1 - r0);
  }) as { (value: number): number; domain: readonly [number, number]; range: readonly [number, number] };

  scale.domain = domain;
  scale.range = range;
  return scale as Scale;
}

/**
 * Tick values at human-readable intervals covering `[min, max]`.
 *
 * Steps are chosen from the 1/2/5/10 progression, which is what makes an axis
 * read as 0, 25, 50, 75, 100 rather than 0, 23.4, 46.8. Returns at most
 * `count + 1` values and always includes both bounds of the nicened domain.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  if (count < 1) return [min, max];

  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;

  // Rounds the step *up* to the next allowed value, so `count` is a ceiling on
  // the number of gridlines rather than a target. d3 rounds to the nearest and
  // will happily return six lines when asked for four; in a 180px-tall chart
  // that reads as noise. Asking for 4 over 0–100 gives 0/50/100, which is what
  // this design wants.
  const step =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;

  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  // Half a step of slack absorbs the float error that otherwise drops the
  // final tick (0.1 + 0.2 arithmetic putting `value` a hair above `max`).
  for (let value = start; value <= max + step / 2; value += step) {
    // Re-round to the step's precision so 0.30000000000000004 never reaches a label.
    ticks.push(Number(value.toFixed(12)));
  }
  return ticks;
}

/**
 * Extend a domain outwards to the nearest nice step.
 *
 * Both bounds round *away* from the data, so the extreme points sit inside the
 * frame rather than on it. Clamping to the raw min/max instead would leave the
 * highest point drawn exactly on the top edge, reading as clipped.
 */
export function niceDomain(
  min: number,
  max: number,
  count = 5,
): [number, number] {
  if (min === max) {
    // A flat series still needs height to be visible.
    const pad = Math.abs(min) || 1;
    return [min - pad, max + pad];
  }

  const ticks = niceTicks(min, max, count);
  const first = ticks[0];
  const second = ticks[1];
  const last = ticks[ticks.length - 1];
  if (first === undefined || last === undefined) return [min, max];

  // niceTicks only emits ticks inside [min, max], so a step has to be inferred
  // to step beyond them. With a single tick there is nothing to infer from.
  const step = second === undefined ? 0 : second - first;
  if (step === 0) return [Math.min(min, first), Math.max(max, last)];

  return [first <= min ? first : first - step, last >= max ? last : last + step];
}

export interface Point {
  x: number;
  y: number;
}

/** An SVG `d` attribute for a polyline through `points`. Empty input → "". */
export function linePath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`)
    .join(" ");
}

/**
 * A closed path filling between the line and `baseline`, for area charts.
 *
 * A single point has no area, so it returns "" rather than a degenerate shape —
 * the caller still draws the point marker.
 */
export function areaPath(points: readonly Point[], baseline: number): string {
  if (points.length < 2) return "";
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return "";
  return `${linePath(points)} L${round(last.x)} ${round(baseline)} L${round(first.x)} ${round(baseline)} Z`;
}

/** Trim float noise out of path data; sub-pixel precision is invisible. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The categorical ramp, in order. Wraps rather than running out of colours. */
export const SERIES_COLOURS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
] as const;

export function seriesColour(index: number): string {
  return SERIES_COLOURS[index % SERIES_COLOURS.length] ?? SERIES_COLOURS[0];
}
