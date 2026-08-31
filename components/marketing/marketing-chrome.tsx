import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";

/** Anchors into the landing page's own sections, plus the one outbound link. */
const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "/history", label: "Reports" },
] as const;

/**
 * The landing header.
 *
 * Transparent and border-free, so the mint canvas runs unbroken from the top of
 * the viewport into the hero. The app's own header is bordered and sticky
 * because it sits above dense scrolling content that needs separating from it;
 * here there is nothing to separate.
 */
export function MarketingHeader() {
  return (
    <header className="relative z-10">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Vantage home" className="rounded-md">
          <Logo />
        </Link>

        <nav
          aria-label="Main"
          className="ml-auto hidden items-center gap-6 md:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded text-[13px] text-fg-muted transition-colors duration-(--duration-fast) hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-6">
          <ThemeToggle />
          {/*
            A pill, not the app's squared button. The landing is the one place
            with a single obvious action, and the shape is what marks it as
            that — everywhere else `rounded-full` would flatten the hierarchy
            by making an ordinary control look like the main event.

            Hidden below `sm`. At 390px it takes half the header, crowds the
            wordmark, and duplicates the identical button sitting a few hundred
            pixels below it in the hero — where there is room for it to be the
            main event properly.
          */}
          <Link
            href="/analyse"
            className="shadow-press hidden h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-medium text-fg-on-accent transition-colors duration-(--duration-fast) hover:bg-accent-hover sm:inline-flex"
          >
            Start analysing
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Vantage — static analysis, secret scanning and dependency risk for any
          repository.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <Link
            href="/analyse"
            className="rounded transition-colors duration-(--duration-fast) hover:text-fg"
          >
            Analyse
          </Link>
          <Link
            href="/dashboard"
            className="rounded transition-colors duration-(--duration-fast) hover:text-fg"
          >
            Dashboard
          </Link>
          <a
            href="https://github.com/Asmodeus14"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded transition-colors duration-(--duration-fast) hover:text-fg"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
