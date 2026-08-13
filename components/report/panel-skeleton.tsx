import { Skeleton } from "@/components/ui/states";

/**
 * Placeholder for a tab panel whose code is still arriving.
 *
 * The three non-default panels are dynamically imported, so switching tabs has
 * a beat where the chunk is in flight. On a warm cache that beat is invisible;
 * on a cold one it is a short wait that needs to look deliberate rather than
 * broken.
 *
 * Rows are given a real height so the tab does not resize under the reader when
 * the panel lands — this page's CLS is 0.001 and splitting the panels out must
 * not be what changes that.
 */
export function PanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="space-y-3">
      <Skeleton className="h-8 w-full max-w-sm" />
      {Array.from({ length: rows }).map((_, row) => (
        <Skeleton key={row} className="h-14 w-full" />
      ))}
    </div>
  );
}
