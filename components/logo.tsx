import { cn } from "@/lib/utils";

/**
 * Wordmark.
 *
 * The mark is a pixel-grid chevron drawn on a 10×10 lattice — deliberately a
 * *reinterpretation* of the brand mark for the retro theme, not a trace of it.
 *
 * The previous version rendered `public/mark.png` and `public/mark-light.png`,
 * with a note warning that the original is two interlocking chevrons whose
 * overlap produces specific negative shapes, and that approximating those by
 * eye would produce something V-shaped but not *that* mark. That warning still
 * holds and this does not attempt the trace: it is a different mark in a
 * different medium, which is defensible in a way a bad copy would not be. A
 * flat black raster beside hand-placed pixel art was the thing that could not
 * stay. Both PNGs are still in `public/` if this needs reverting.
 *
 * Drawing in `currentColor` means it inherits from whatever it sits in — the
 * cream text on the dashboard's dark rail, the forest text in the app header —
 * so the two-file light/dark swap is no longer needed at all.
 */

/** Columns filled on each row of the 10×10 grid, as [x, width] runs. */
const CHEVRON: ReadonlyArray<readonly [number, number][]> = [
  [[0, 2], [8, 2]],
  [[1, 2], [7, 2]],
  [[2, 2], [6, 2]],
  [[3, 2], [5, 2]],
  [[4, 2]],
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 10 10"
        width={18}
        height={18}
        shapeRendering="crispEdges"
        aria-hidden
        focusable="false"
        className="size-[18px] shrink-0"
      >
        {CHEVRON.map((runs, y) =>
          runs.map(([x, w]) => (
            <rect key={`${y}-${x}`} x={x} y={y + 1} width={w} height={1} fill="currentColor" />
          )),
        )}
        {/* The counterpoint stroke. Coral rather than currentColor so the mark
            carries the accent at the one size where a second colour still
            reads — below about 14px it merges and the chevron alone carries it. */}
        <rect x={4} y={7} width={2} height={1} fill="var(--accent)" />
      </svg>
      <span className="font-display text-base font-bold tracking-tight text-fg">
        Vantage
      </span>
    </span>
  );
}
