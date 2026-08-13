import * as React from "react";
import { AlertCircle, RotateCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Empty, loading and error states.
 *
 * Each answers three questions: what this area is for, why it's empty or
 * broken, and what to do next. "No data" on its own is not a state.
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-surface-raised">
        <Icon className="size-5 text-fg-subtle" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-pretty text-sm text-fg-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  detail,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-critical-border bg-critical-bg p-4",
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-critical">{title}</h3>
          <p className="mt-1 text-sm text-fg">{description}</p>
          {detail && <p className="mt-1.5 text-xs text-fg-muted">{detail}</p>}
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
              <RotateCw aria-hidden />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-skeleton rounded-md bg-surface-hover", className)}
      aria-hidden
      {...props}
    />
  );
}

/** Skeleton shaped like a findings row, so loading doesn't shift the layout. */
export function FindingRowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Skeleton className="h-5 w-16 shrink-0" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-32 shrink-0" />
    </div>
  );
}

/**
 * Announces async state to screen readers without changing the visual layout.
 * Paired with visible indicators so both channels carry the same information.
 */
export function LiveRegion({
  message,
  assertive = false,
}: {
  message: string;
  assertive?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
