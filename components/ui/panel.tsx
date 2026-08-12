import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A bordered surface.
 *
 * Depth comes from a 1px border and a background shift — not shadows. v2 used
 * `rounded-2xl shadow-2xl` on every container, which flattened the hierarchy
 * because everything looked equally important.
 */
export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-4 py-2.5",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  as: Comp = "h2",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return (
    <Comp
      className={cn("text-sm font-semibold tracking-tight text-fg", className)}
      {...props}
    />
  );
}

export function PanelBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

/** Label/value pair used across the overview surfaces. */
export function StatTile({
  label,
  value,
  hint,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate text-xs font-medium text-fg-muted">{label}</div>
      <div
        className={cn(
          "tabular mt-0.5 truncate text-xl font-semibold tracking-tight text-fg",
          valueClassName,
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-fg-subtle">{hint}</div>}
    </div>
  );
}
