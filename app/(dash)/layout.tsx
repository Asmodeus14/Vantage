import { IconRail } from "@/components/dash/icon-rail";

/**
 * The dashboard's shell: a rail instead of a header.
 *
 * Inset from the viewport on all sides so the rail reads as a floating panel
 * on the canvas rather than as browser chrome — the same reason the cards
 * inside it are cream on mint instead of edge-to-edge.
 *
 * The rail is hidden below `sm`, where a 56px column costs more than the
 * navigation is worth; the app header at `/analyse` and `/history` carries the
 * same destinations by name on those widths.
 */
export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh p-3 sm:p-4">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1400px] gap-4">
        <div className="hidden sm:block">
          <IconRail />
        </div>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
