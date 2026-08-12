import { Skeleton } from "@/components/ui/states";

/**
 * Shown while the report is fetched on the server.
 *
 * Every route here is `force-dynamic`, so a navigation waits on the API before
 * anything renders. Without this file Next holds the *previous* page on screen
 * for that whole time and the app looks frozen — the click appears to have done
 * nothing.
 *
 * The shapes mirror the real header and tab strip so the content lands in place
 * rather than shifting when it arrives. Deliberately partial: enough to read as
 * "this is the report, loading", not a wireframe of the whole page.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <span className="sr-only" role="status">
        Loading report…
      </span>

      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      </header>

      <div className="flex gap-6 border-b border-border pb-2.5">
        {["w-20", "w-20", "w-28", "w-16"].map((width, index) => (
          <Skeleton key={index} className={`h-4 ${width}`} />
        ))}
      </div>

      <div className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
        <div className="space-y-6">
          <Skeleton className="h-4 w-full max-w-[52ch]" />
          <Skeleton className="h-4 w-full max-w-[38ch]" />
          <div className="flex gap-10 pt-4">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-6 w-8" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden space-y-4 lg:block">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}
