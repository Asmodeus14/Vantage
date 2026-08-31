import { MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-chrome";

/**
 * The landing page's chrome.
 *
 * Deliberately not `AppShell`: no command palette, no backend status pill, no
 * theme toggle in the corner. A visitor who has not signed in has nothing to
 * do with any of them, and the header exists here to point at one thing.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
