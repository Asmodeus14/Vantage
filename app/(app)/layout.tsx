import { AppShell } from "@/components/app-shell";

/**
 * The tool's chrome: sticky header, nav, command palette, theme toggle.
 *
 * This used to live in the root layout and wrap every route. It moved here when
 * the landing page and the dashboard grew their own shells — those two have no
 * use for a nav bar, and the landing in particular needs the page to start at
 * the very top of the viewport.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
