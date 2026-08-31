import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitBranch, KeyRound, PackageSearch } from "lucide-react";

import { PixelScene } from "@/components/marketing/pixel-scene";

export const metadata: Metadata = {
  title: "Vantage — repository analysis",
  description:
    "Security issues, secrets and dependency risk, each anchored to a file and line — and on a second run, what changed since the last one.",
};

/*
  Static. No `force-dynamic`, no API call, no session read — this page is the
  same for everyone, so it prerenders and is served from the edge cache. That
  is the whole reason the tool moved off `/`: the route most people arrive on
  no longer waits for a backend that may be asleep on a free tier.
*/

const FEATURES = [
  {
    icon: GitBranch,
    title: "Static analysis",
    body: "Rules for JavaScript, TypeScript and Python, with every finding anchored to a file and a line number you can open.",
  },
  {
    icon: KeyRound,
    title: "Secret scanning",
    body: "Committed keys, tokens and credentials — including ones already rewritten out of HEAD but still reachable in history.",
  },
  {
    icon: PackageSearch,
    title: "Dependency risk",
    body: "Known advisories against your lockfile, and on a second run, exactly what is new, resolved or reopened since last time.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] flex-col">
      {/*
        Spacing is tuned so the hero, the three columns, the buttons and the
        whole scene fit inside a 1280×800 viewport without scrolling — the
        scene is the reason anyone remembers this page, and it does not work
        if the rabbit is below the fold.
      */}
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-8 sm:px-6 sm:pt-10">
        <h1 className="text-balance text-center font-display text-4xl font-bold leading-[1.15] tracking-tight text-fg sm:text-5xl">
          Know what you&rsquo;re shipping.
        </h1>

        <p className="mx-auto mt-4 max-w-[62ch] text-pretty text-center text-sm leading-relaxed text-fg-muted">
          Paste a repository URL and get security issues, exposed secrets and
          dependency risk back — each one anchored to a file and a line, not a
          score with no explanation. Run it twice and it tells you what changed.
        </p>

        {/* Three columns, not three cards. The landing is a document with a
            picture at the bottom; boxing these would add furniture the content
            does not need. */}
        <section
          id="features"
          aria-label="What Vantage checks"
          className="mx-auto mt-9 grid max-w-4xl gap-7 sm:grid-cols-3 sm:gap-6"
        >
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="text-center">
              <Icon
                className="mx-auto size-6 text-accent"
                strokeWidth={1.75}
                aria-hidden
              />
              <h2 className="mt-3 font-display text-base font-bold tracking-tight text-fg">
                {title}
              </h2>
              <p className="mx-auto mt-1.5 max-w-[34ch] text-pretty text-[13px] leading-relaxed text-fg-muted">
                {body}
              </p>
            </div>
          ))}
        </section>

        <div
          id="how"
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href="/analyse"
            className="shadow-press inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-medium text-fg-on-accent transition-colors duration-(--duration-fast) hover:bg-accent-hover sm:w-auto"
          >
            Analyse a repository
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border-strong bg-surface px-7 text-sm font-medium text-fg transition-colors duration-(--duration-fast) hover:bg-surface-hover sm:w-auto"
          >
            See the dashboard
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          No signup to run one. Sign in with GitHub only to reach private
          repositories.
        </p>
      </div>

      {/*
        Full bleed, pinned to the bottom by `mt-auto` regardless of how much
        copy sits above it.

        `h-auto` rather than a fixed height: the scene's aspect ratio is fixed
        by its viewBox, so constraining both axes would either crop it or
        letterbox it. Letting the height follow the width keeps the whole
        picture on screen at every size — about 300px tall at 1280.
      */}
      <div className="mt-auto w-full" aria-hidden>
        <PixelScene className="block h-auto w-full" />
      </div>
    </div>
  );
}
