import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  /*
    Shared: flat, bordered, quick feedback. Still no gradients and no hover
    lift — what changed with the retro theme is that `primary` and `danger`
    carry a hard 2px offset shadow that collapses on :active, so the control
    travels down onto the page when pressed.

    That is a shadow, which the old note here ruled out. The thing it ruled out
    was soft blurred elevation used to fake depth on every surface; this has
    zero blur, appears only on controls that are actually pressable, and reads
    as an edge rather than as lighting. The implementation is `.shadow-press`
    in `app/globals.css`, kept there because it needs an :active selector and a
    reduced-motion carve-out.
  */
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md " +
    "font-medium transition-colors duration-(--duration-fast) " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "shadow-press bg-accent text-fg-on-accent hover:bg-accent-hover border border-transparent",
        secondary:
          "bg-surface-raised text-fg border border-border hover:bg-surface-hover hover:border-border-strong",
        ghost: "text-fg-muted hover:text-fg hover:bg-surface-hover border border-transparent",
        /*
          `text-fg-on-accent`, not `text-white`. The token flips per theme,
          which this needs: --critical is a deep oxblood in light mode but a
          light pink in dark mode, and white on that measured 2.62:1 — a
          pre-existing failure, since the ramp's dark values were only ever
          checked as *foreground* text, never as a button background. The
          token pairing measures 7.73:1 light and 6.33:1 dark.
        */
        danger:
          "shadow-press bg-critical text-fg-on-accent hover:opacity-90 border border-transparent",
        link: "text-accent underline-offset-4 hover:underline border border-transparent",
      },
      size: {
        sm: "h-7 px-2.5 text-xs [&_svg]:size-3.5",
        md: "h-8 px-3 text-sm [&_svg]:size-4",
        lg: "h-10 px-4 text-sm [&_svg]:size-4",
        icon: "size-8 [&_svg]:size-4",
        "icon-sm": "size-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // `asChild` renders someone else's element, so injecting a spinner would
    // break Slot's single-child contract.
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size }), className)}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
