"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Feedback for a navigation that has started but not yet rendered.
 *
 * Every page here is `force-dynamic`, so following a link means waiting on the
 * API. Next's client router holds the *current* page on screen for that whole
 * time — correct behaviour, but with no acknowledgement the click looks like it
 * did nothing, which is the single most common way an app feels broken.
 *
 * `loading.tsx` covers the same gap but only once the server has begun
 * streaming a response. This fires immediately on click, in the browser, so
 * there is feedback even while the server is still thinking. The two are
 * complementary: this for the first moment, the route skeleton for the rest.
 *
 * Must be rendered inside the `<Link>` whose status it reports.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <>
      <Loader2
        className={cn("size-3.5 shrink-0 animate-spin text-fg-subtle", className)}
        aria-hidden
      />
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
