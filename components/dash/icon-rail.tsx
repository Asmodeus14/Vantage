"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analyse", label: "Analyse a repository", icon: FileSearch },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * The dashboard's navigation: an icon-only rail rather than the app's text nav.
 *
 * Icon-only navigation is normally a bad trade — it saves width and costs
 * recognition. It earns its place here because the rail is four items that
 * never change, each one is also reachable by its full name from the app
 * header, and the dashboard's whole layout is built around the horizontal
 * space the rail gives back to the two content columns.
 *
 * What it must not cost is accessibility, so every control carries both an
 * `aria-label` and a hover/focus tooltip. Neither is optional here: the label
 * is what a screen reader announces, and the tooltip is what a sighted user
 * who does not recognise the glyph needs.
 */
export function IconRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className="sticky top-4 flex h-[calc(100dvh-2rem)] w-14 shrink-0 flex-col items-center gap-1 rounded-lg bg-rail py-4"
    >
      <Link
        href="/"
        aria-label="Vantage home"
        className="mb-4 rounded text-rail-fg transition-opacity duration-(--duration-fast) hover:opacity-80"
      >
        {/* The wordmark's chevron alone — at 14px of rail width the text would
            not fit, and a cropped wordmark reads as a rendering fault. */}
        <svg viewBox="0 0 10 10" width={20} height={20} shapeRendering="crispEdges" aria-hidden>
          {[
            [[0, 2], [8, 2]],
            [[1, 2], [7, 2]],
            [[2, 2], [6, 2]],
            [[3, 2], [5, 2]],
            [[4, 2]],
          ].map((runs, y) =>
            (runs as [number, number][]).map(([x, w]) => (
              <rect key={`${y}-${x}`} x={x} y={y + 1} width={w} height={1} fill="currentColor" />
            )),
          )}
          <rect x={4} y={7} width={2} height={1} fill="var(--accent)" />
        </svg>
      </Link>

      {NAV.map(({ href, label, icon: Icon }) => {
        // Segment-boundary match, not a bare prefix: `/analysing` starts with
        // `/analyse` and would otherwise light up the wrong icon.
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Tooltip key={href} content={label} side="right">
            <Link
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-md transition-colors duration-(--duration-fast)",
                active
                  ? "bg-accent text-fg-on-accent"
                  : "text-rail-fg/60 hover:bg-rail-fg/10 hover:text-rail-fg",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
            </Link>
          </Tooltip>
        );
      })}

      {/*
        A form, not a link. Signing out is a state change, and the handler at
        `/api/auth/logout` is a POST for exactly the reason this must not be a
        GET: a prefetch or a link scanner must not be able to end a session.

        The tooltip sits inside the form rather than around it — `Tooltip` uses
        Radix `asChild`, so whatever it wraps *becomes* the trigger, and
        wrapping the form would attach the hover and focus handlers to the form
        instead of to the button inside it.
      */}
      <form action="/api/auth/logout" method="post" className="mt-auto">
        <Tooltip content="Sign out" side="right">
          <button
            type="submit"
            aria-label="Sign out"
            className="inline-flex size-9 items-center justify-center rounded-md text-rail-fg/60 transition-colors duration-(--duration-fast) hover:bg-rail-fg/10 hover:text-rail-fg"
          >
            <LogOut className="size-[18px]" aria-hidden />
          </button>
        </Tooltip>
      </form>
    </nav>
  );
}
