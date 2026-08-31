import { Skeleton } from "@/components/ui/states";

/** Streamed while the history list is fetched. See app/r/[id]/loading.tsx. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <span className="sr-only" role="status">
        Loading history…
      </span>

      <header className="mb-5 space-y-2">
        <h1 className="text-lg font-semibold tracking-tight text-fg">History</h1>
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>

      <div className="space-y-8">
        {[3, 2].map((rows, group) => (
          <section key={group}>
            <div className="flex items-center justify-between border-b border-border pb-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-16" />
            </div>
            {Array.from({ length: rows }, (_, row) => (
              <div
                key={row}
                className="flex items-center justify-between border-b border-border px-4 py-3"
              >
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
