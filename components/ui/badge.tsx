import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { SEVERITY_META } from "@/lib/severity";
import type { Severity } from "@/lib/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-surface-raised text-fg-muted border-border",
        accent: "bg-accent-subtle text-accent border-accent-border",
        success: "bg-success-bg text-success border-success-border",
        warning: "bg-medium-bg text-medium border-medium-border",
        danger: "bg-critical-bg text-critical border-critical-border",
        outline: "bg-transparent text-fg-muted border-border",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/**
 * Severity indicator.
 *
 * Colour, icon and text together, so the level survives without colour.
 *
 * Two forms, and the distinction matters at scale. A *chip* — tinted, bordered
 * — is for the handful of places severity is the subject, like a filter
 * control. Down a fifty-row findings list it becomes fifty boxes forming a
 * decorative stripe, so there the icon carries the colour on its own and the
 * row's own text does the rest.
 */
export function SeverityBadge({
  severity,
  showLabel = true,
  chip = false,
  className,
}: {
  severity: Severity;
  showLabel?: boolean;
  /** Draw the tinted, bordered container. Off by default. */
  chip?: boolean;
  className?: string;
}) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium leading-none",
        chip
          ? cn("rounded-md border px-1.5 py-0.5", meta.chip)
          : meta.text,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {showLabel ? meta.label : <span className="sr-only">{meta.label}</span>}
    </span>
  );
}

export { badgeVariants };
