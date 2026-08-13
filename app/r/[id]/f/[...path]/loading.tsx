/**
 * Shapes mirroring the real layout, so content lands in place rather than
 * shifting once the tree and the file arrive. This route is `force-dynamic` and
 * a repository file is two GitHub round-trips, so the wait is real.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-raised" />
        <div className="h-4 w-56 animate-pulse rounded bg-surface-raised" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="h-8 animate-pulse rounded-md bg-surface-raised" />
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="h-4 animate-pulse rounded bg-surface-raised"
              style={{ width: `${60 + ((index * 13) % 35)}%` }}
            />
          ))}
        </div>

        <div className="rounded-md border border-border bg-surface-sunken p-3">
          {Array.from({ length: 24 }).map((_, index) => (
            <div key={index} className="flex gap-3 py-0.5">
              <div className="h-3 w-8 shrink-0 animate-pulse rounded bg-surface-raised" />
              <div
                className="h-3 animate-pulse rounded bg-surface-raised"
                style={{ width: `${25 + ((index * 17) % 60)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
