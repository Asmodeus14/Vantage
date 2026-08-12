"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github } from "lucide-react";

import { BackendStatus } from "@/components/backend-status";
import { LinkPending } from "@/components/link-pending";
import {
  CommandPaletteProvider,
  CommandPaletteTrigger,
} from "@/components/command-palette";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Analyse" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <CommandPaletteProvider>
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-2 px-4 sm:gap-4">
          <Link href="/" className="rounded-md" aria-label="Vantage home">
            <Logo />
          </Link>

          <nav aria-label="Main" className="flex items-center gap-0.5">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                // Current page is signalled by weight and colour alone. A
                // filled pill carried more visual weight than the navigation
                // deserves next to the page content.
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition-colors duration-(--duration-fast)",
                    active
                      ? "font-medium text-fg"
                      : "text-fg-muted hover:text-fg",
                  )}
                >
                  {item.label}
                  <LinkPending className="size-3" />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <CommandPaletteTrigger />
            <BackendStatus />
            <UserMenu />
            <a
              href="https://github.com/Asmodeus14"
              target="_blank"
              rel="noopener noreferrer"
              // Attribution, not a product function. On a phone the header
              // cannot fit the logo, three nav items and four controls, and
              // this is the one that costs nothing to drop.
              className="hidden rounded-md p-1.5 text-fg-muted transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-fg sm:inline-flex"
              aria-label="GitHub (opens in a new tab)"
            >
              <Github className="size-4" aria-hidden />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
    </CommandPaletteProvider>
  );
}
