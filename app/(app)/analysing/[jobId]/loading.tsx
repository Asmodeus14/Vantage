import { Skeleton } from "@/components/ui/states";

/**
 * The gap between submitting a repository and the progress stream connecting.
 *
 * This is the most likely moment for the app to feel broken: the user has just
 * clicked the primary action, so anything less than immediate acknowledgement
 * reads as a dead button.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <p role="status" className="text-sm text-fg-muted">
        Starting analysis…
      </p>
      <div className="mt-5 space-y-2.5">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-4 w-48" />
        ))}
      </div>
    </div>
  );
}
