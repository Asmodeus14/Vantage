import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm",
      "text-fg placeholder:text-fg-subtle",
      "transition-colors duration-(--duration-fast)",
      "hover:border-border-strong",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:border-accent",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-critical",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

/** Small keyboard-shortcut hint, e.g. inside a button or menu row. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border",
        "bg-surface-raised px-1 font-mono text-[10px] font-medium text-fg-subtle",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
